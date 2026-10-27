import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Dot hört zu: Spracheingabe über die Spracherkennung des Browsers (Web Speech
 * API, in Safari `webkitSpeechRecognition`). Wo es sie nicht gibt, gibt es
 * auch keinen Knopf — das Diktat der Tastatur geht immer.
 *
 * Während man spricht, steht das Gehörte schon im Eingabefeld (`zwischen`).
 * Ist man fertig (Pause oder erneutes Tippen), kommt der ganze Satz einmal an
 * `beiFertig`. Die Erkennung selbst macht das Gerät bzw. der Browser (unter
 * iOS Apple), nicht TYD und nicht Anthropic.
 */

interface Erkennung {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
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

export function useSpracheingabe(sprache: 'de' | 'en', beiFertig: (text: string) => void, beiFehler: (f: SpracheFehler) => void) {
  const [hoert, setHoert] = useState(false)
  const [zwischen, setZwischen] = useState('')
  const erkennung = useRef<Erkennung | null>(null)
  const text = useRef('')
  const fertig = useRef(beiFertig)
  const fehler = useRef(beiFehler)
  useEffect(() => { fertig.current = beiFertig; fehler.current = beiFehler })
  const [verfuegbar] = useState(() => erkennungKlasse() !== null)

  // Beim Verlassen nicht weiter zuhören
  useEffect(() => () => erkennung.current?.abort(), [])

  const starten = useCallback(() => {
    const Klasse = erkennungKlasse()
    if (!Klasse || erkennung.current) return
    const e = new Klasse()
    e.lang = sprache === 'de' ? 'de-DE' : 'en-US'
    e.continuous = false
    e.interimResults = true
    text.current = ''
    e.onresult = ev => {
      let gesamt = ''
      for (let i = 0; i < ev.results.length; i++) gesamt += ev.results[i][0]?.transcript ?? ''
      text.current = gesamt.trim()
      setZwischen(text.current)
    }
    e.onerror = ev => {
      if (ev.error === 'aborted') return
      fehler.current(ev.error === 'not-allowed' || ev.error === 'service-not-allowed' ? 'verweigert' : ev.error === 'no-speech' ? 'nichts' : 'fehler')
    }
    e.onend = () => {
      erkennung.current = null
      setHoert(false)
      setZwischen('')
      const satz = text.current
      text.current = ''
      if (satz) fertig.current(satz)
    }
    erkennung.current = e
    setHoert(true)
    try { e.start() } catch { erkennung.current = null; setHoert(false); fehler.current('fehler') }
  }, [sprache])

  /** Fertig gesprochen: das Gehörte geht ab. */
  const beenden = useCallback(() => { erkennung.current?.stop() }, [])

  return { verfuegbar, hoert, zwischen, starten, beenden }
}
