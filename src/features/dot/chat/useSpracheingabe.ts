import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Dot hört zu: Spracheingabe über die Spracherkennung des Browsers (Web Speech
 * API, in Safari `webkitSpeechRecognition`). Wo es sie nicht gibt, gibt es
 * auch keinen Knopf — das Diktat der Tastatur geht immer.
 *
 * Während man spricht, steht das Gehörte schon im Eingabefeld (`zwischen`).
 * Ist man fertig (Pause oder erneutes Tippen), kommt der ganze Satz einmal an
 * `beiFertig`. Abbrechen (Chat zu, Seite weg) oder ein Fehler schickt nichts.
 * Die Erkennung selbst macht das Gerät bzw. der Browser (unter iOS Apple),
 * nicht TYD und nicht Anthropic.
 */

interface Erkennung {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
type ErkennungKlasse = new () => Erkennung

function erkennungKlasse(): ErkennungKlasse | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: ErkennungKlasse; webkitSpeechRecognition?: ErkennungKlasse }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export type SpracheFehler = 'verweigert' | 'nichts' | 'fehler'

/** Die Teile eines Ergebnisses zu einem Satz, mit genau einem Leerzeichen dazwischen. */
export function satzAus(results: ArrayLike<ArrayLike<{ transcript: string }>>): string {
  return Array.from(results, r => r[0]?.transcript ?? '').join(' ').replace(/\s+/g, ' ').trim()
}

export function useSpracheingabe(sprache: 'de' | 'en', beiFertig: (text: string) => void, beiFehler: (f: SpracheFehler) => void) {
  const [hoert, setHoert] = useState(false)
  const [zwischen, setZwischen] = useState('')
  // Gibt es die Klasse, aber der Dienst ist gesperrt (z. B. in einer App-Ansicht), verschwindet der Knopf
  const [verfuegbar, setVerfuegbar] = useState(() => erkennungKlasse() !== null)
  const erkennung = useRef<Erkennung | null>(null)
  const text = useRef('')
  const verwerfen = useRef(false)
  const fertig = useRef(beiFertig)
  const fehler = useRef(beiFehler)
  useEffect(() => { fertig.current = beiFertig; fehler.current = beiFehler })

  /** Aufhören, ohne etwas zu schicken. */
  const abbrechen = useCallback(() => {
    if (!erkennung.current) return
    verwerfen.current = true
    text.current = ''
    erkennung.current.abort()
  }, [])

  // Beim Verlassen nicht weiter zuhören
  useEffect(() => abbrechen, [abbrechen])

  const starten = useCallback(() => {
    const Klasse = erkennungKlasse()
    if (!Klasse || erkennung.current) return
    const e = new Klasse()
    e.lang = sprache === 'de' ? 'de-DE' : 'en-US'
    e.continuous = false
    e.interimResults = true
    text.current = ''
    verwerfen.current = false
    e.onresult = ev => {
      text.current = satzAus(ev.results)
      setZwischen(text.current)
    }
    e.onerror = ev => {
      if (ev.error === 'aborted') return
      // Halb Gehörtes nach einem Fehler geht nicht ab
      verwerfen.current = true
      if (ev.error === 'service-not-allowed') setVerfuegbar(false)
      fehler.current(ev.error === 'not-allowed' ? 'verweigert' : ev.error === 'no-speech' ? 'nichts' : 'fehler')
    }
    e.onend = () => {
      erkennung.current = null
      setHoert(false)
      setZwischen('')
      const satz = verwerfen.current ? '' : text.current
      text.current = ''
      verwerfen.current = false
      if (satz) fertig.current(satz)
    }
    erkennung.current = e
    setHoert(true)
    try { e.start() } catch { erkennung.current = null; setHoert(false); fehler.current('fehler') }
  }, [sprache])

  /** Fertig gesprochen: das Gehörte geht ab. */
  const beenden = useCallback(() => { erkennung.current?.stop() }, [])

  return { verfuegbar, hoert, zwischen, starten, beenden, abbrechen }
}
