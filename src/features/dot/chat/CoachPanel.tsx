import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useAuth } from '../../../context/AuthContext'
import type { DotApi } from '../engine/dotEngine'
import type { DotKontext } from '../lib/dotKontext'
import { useDotText, type DotTextKey } from '../texte'
import {
  frageCoach, ladeVerlauf, loescheVerlauf, setzeCoachEinwilligung, speichereVerlauf,
  type CoachFehler, type CoachNachricht,
} from './coachService'

/**
 * Das Chatfenster. Es öffnet sich als Kreis genau dort, wo Dot gerade ist,
 * und Dot fliegt auf die Bühne oben. Antworten laufen Zeichen für Zeichen ein,
 * Dot „spricht" dabei (Welle). Ohne Einwilligung geht nichts an den Server.
 */

export type DotSeite = 'home' | 'my-stack' | 'kalender' | 'ernaehrung' | 'sonst'

const CHIPS: Record<DotSeite, DotTextKey[]> = {
  home: ['chip_heute', 'chip_naechste', 'chip_blutwerte'],
  'my-stack': ['chip_heute', 'chip_bestand', 'chip_naechste'],
  kalender: ['chip_verpasst', 'chip_heute'],
  ernaehrung: ['chip_ernaehrung', 'chip_heute'],
  sonst: ['chip_heute', 'chip_naechste', 'chip_blutwerte'],
}
const INTRO: Partial<Record<DotSeite, DotTextKey>> = {
  'my-stack': 'chat_intro_stack', kalender: 'chat_intro_kalender', ernaehrung: 'chat_intro_ernaehrung',
}
const FEHLER: Record<CoachFehler, DotTextKey> = {
  consent_required: 'chat_fehler', no_access: 'chat_kein_zugang', limit_reached: 'chat_grenze', offline: 'chat_offline', server_error: 'chat_fehler',
}

export interface CoachPanelProps {
  offen: boolean
  /** Steht der Inhalt im DOM? Nur offen und kurz beim Schließen. */
  inhalt: boolean
  ursprung: { x: number; y: number }
  seite: DotSeite
  einwilligung: string | null
  setEinwilligung(wert: string | null): void
  kontext(): Promise<DotKontext | null>
  dot: DotApi | null
  onSchliessen(): void
  onHeim(): void
}

const warte = (ms: number) => new Promise(r => setTimeout(r, ms))

export function CoachPanel({ offen, inhalt, ursprung, seite, einwilligung, setEinwilligung, kontext, dot, onSchliessen, onHeim }: CoachPanelProps) {
  const { user } = useAuth()
  const { dt, lang } = useDotText()
  const [verlauf, setVerlauf] = useState<CoachNachricht[]>(() => (user ? ladeVerlauf(user.id) : []))
  const [laufend, setLaufend] = useState<string | null>(null)
  const [denkt, setDenkt] = useState(false)
  const [eingabe, setEingabe] = useState('')
  const [menue, setMenue] = useState(false)
  const [einwFehler, setEinwFehler] = useState(false)
  const buehne = useRef<HTMLDivElement>(null)
  const faden = useRef<HTMLDivElement>(null)
  const arbeitet = useRef(false)
  const weniger = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => { if (user) speichereVerlauf(user.id, verlauf) }, [user, verlauf])

  // Dot auf die Bühne, sobald das Fenster offen ist; zurück beim Schließen
  useEffect(() => {
    if (!offen || !dot) return
    const el = buehne.current
    if (el) dot.oeffneBuehne(el)
    return () => dot.schliesseBuehne()
  }, [offen, dot])

  useEffect(() => {
    faden.current?.scrollTo({ top: faden.current.scrollHeight })
  }, [verlauf, laufend, denkt])

  const schliessen = () => { setMenue(false); onSchliessen() }
  useEffect(() => {
    if (!offen) return
    const beiTaste = (e: KeyboardEvent) => { if (e.key === 'Escape') onSchliessen() }
    window.addEventListener('keydown', beiTaste)
    return () => window.removeEventListener('keydown', beiTaste)
  }, [offen, onSchliessen])

  async function fragen(eingabeText: string) {
    const frage = eingabeText.trim()
    if (!frage || arbeitet.current || !user) return
    if (frage === dt('chip_heim')) {
      setVerlauf(v => [...v, { rolle: 'ich', text: frage, lokal: true }, { rolle: 'dot', text: dt('heim_antwort'), lokal: true }])
      window.setTimeout(onHeim, 700)
      return
    }
    arbeitet.current = true
    setEingabe('')
    const neu: CoachNachricht[] = [...verlauf, { rolle: 'ich', text: frage }]
    setVerlauf(neu)
    setDenkt(true); dot?.setStimmung('think')
    const k = await kontext().catch(() => null)
    const antwort = await frageCoach(neu, k, seite, lang)
    setDenkt(false)
    if (!antwort.ok && antwort.fehler === 'consent_required') setEinwilligung(null)
    const text = antwort.ok ? antwort.text : dt(FEHLER[antwort.fehler])
    const lokal = !antwort.ok
    dot?.setStimmung('speak')
    if (weniger) setVerlauf(v => [...v, { rolle: 'dot', text, lokal }])
    else {
      for (let i = 2; i <= text.length + 1; i += 2) {
        setLaufend(text.slice(0, i))
        dot?.stimme(/[ .,]/.test(text[i - 1] ?? ' ') ? 0.05 : 0.22)
        await warte(28)
      }
      setLaufend(null)
      setVerlauf(v => [...v, { rolle: 'dot', text, lokal }])
    }
    dot?.setStimmung('idle')
    arbeitet.current = false
  }

  async function einwilligen(an: boolean) {
    if (!user) return
    setEinwFehler(false)
    try {
      const wert = await setzeCoachEinwilligung(user.id, an)
      setEinwilligung(wert)
      if (!an) setVerlauf(v => [...v, { rolle: 'dot', text: dt('einw_widerrufen_fertig'), lokal: true }])
      else dot?.setStimmung('joy')
    } catch { setEinwFehler(true) }
    setMenue(false)
  }

  const intro = dt(INTRO[seite] ?? 'chat_intro')
  const stil = { '--dot-ox': `${ursprung.x}px`, '--dot-oy': `${ursprung.y}px` } as CSSProperties

  return (
    <section
      className="tyd-dot-chat"
      data-offen={offen ? 'true' : 'false'}
      data-dot-chat
      data-app-modal={offen ? '' : undefined}
      role="dialog"
      aria-modal="true"
      aria-label={dt('chat_titel')}
      aria-hidden={!offen}
      inert={!offen}
      style={stil}
    >
      <header className="tyd-dot-chat-kopf">
        <button type="button" className="tyd-dot-rund" onClick={schliessen} aria-label={dt('chat_schliessen')} data-app-back-close>✕</button>
        <span className="tyd-dot-chat-titel">{dt('chat_titel')}</span>
        <div className="tyd-dot-menue-anker">
          <button type="button" className="tyd-dot-rund" aria-haspopup="menu" aria-expanded={menue} onClick={() => setMenue(m => !m)} aria-label="…">⋯</button>
          {menue && (
            <div className="tyd-dot-menue" role="menu">
              <button type="button" role="menuitem" onClick={() => { setVerlauf([]); if (user) loescheVerlauf(user.id); setMenue(false) }}>{dt('chat_leeren')}</button>
              {einwilligung && <button type="button" role="menuitem" onClick={() => void einwilligen(false)}>{dt('einw_widerrufen')}</button>}
            </div>
          )}
        </div>
      </header>
      {inhalt && (
        <>
          <div ref={buehne} className="tyd-dot-buehne" aria-hidden="true" />
          <p className="tyd-dot-status" aria-live="polite">{denkt ? dt('chat_denkt') : ''}</p>

          {einwilligung && (
            <div ref={faden} className="tyd-dot-faden">
              {verlauf.length === 0 && !laufend && <p className="tyd-dot-intro">{intro}</p>}
              {verlauf.map((n, i) => <div key={i} className="tyd-dot-msg" data-rolle={n.rolle}>{n.text}</div>)}
              {laufend && <div className="tyd-dot-msg" data-rolle="dot" aria-hidden="true">{laufend}</div>}
            </div>
          )}

          {einwilligung ? (
            <>
              <div className="tyd-dot-chips">
                {CHIPS[seite].map((k, i) => (
                  <button key={k} type="button" className="tyd-dot-chip" data-erster={i === 0 && seite !== 'home' && seite !== 'sonst' ? 'true' : undefined} onClick={() => void fragen(dt(k))}>{dt(k)}</button>
                ))}
                <button type="button" className="tyd-dot-chip" data-befehl="true" onClick={() => void fragen(dt('chip_heim'))}>{dt('chip_heim')}</button>
              </div>
              <form className="tyd-dot-eingabe" onSubmit={e => { e.preventDefault(); void fragen(eingabe) }}>
                <input
                  value={eingabe}
                  onChange={e => setEingabe(e.target.value)}
                  placeholder={dt('chat_platzhalter')}
                  aria-label={dt('chat_platzhalter')}
                  maxLength={500}
                  enterKeyHint="send"
                />
                <button type="submit" className="tyd-dot-senden" aria-label={dt('chat_senden')} disabled={!eingabe.trim()}>↑</button>
              </form>
              <p className="tyd-dot-hinweis">{dt('hinweis_unten')}</p>
            </>
          ) : (
            <div className="tyd-dot-einw">
              <h2>{dt('einw_titel')}</h2>
              <p>{dt('einw_text')}</p>
              <ul>
                <li>{dt('einw_punkt_1')}</li>
                <li>{dt('einw_punkt_2')}</li>
                <li>{dt('einw_punkt_3')}</li>
              </ul>
              {einwFehler && <p className="tyd-dot-fehler" role="alert">{dt('einw_fehler')}</p>}
              <div className="tyd-dot-einw-knoepfe">
                <button type="button" className="tyd-dot-knopf" onClick={schliessen}>{dt('einw_nein')}</button>
                <button type="button" className="tyd-dot-knopf" data-haupt="true" onClick={() => void einwilligen(true)}>{dt('einw_ja')}</button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}
