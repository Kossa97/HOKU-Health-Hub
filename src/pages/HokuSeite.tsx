/**
 * Seite „Hoku“ im Profil (Nutzer 03.11.2026): oben eine Bühne, auf der Hoku sitzt, solange die
 * Seite offen ist; darunter Farbe, ruhige Bewegung, „kommt für Hinweise heraus“ und Hinweise.
 * Was man ändert, sieht man sofort an ihm. War er im Haus, kommt er für die Seite heraus und geht
 * beim Verlassen wieder hinein.
 */
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { Schalter } from '../components/ui/Schalter'
import { HokuFarbAuswahl } from '../features/dot/HokuFarbAuswahl'
import { dotStore, useDotStand } from '../features/dot/dotStore'
import { useHokuEinstellungen, type HokuEinstellung } from '../features/dot/lib/hokuEinstellungen'
import { useDotText, type DotTextKey } from '../features/dot/texte'
import '../features/dot/dot.css'

const weniger = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

export function HokuSeite() {
  const { dt } = useDotText()
  const stand = useDotStand()
  const [werte, setze] = useHokuEinstellungen()
  const buehne = useRef<HTMLDivElement>(null)
  const warDrinnen = useRef<boolean | null>(null)
  const geraetRuhig = weniger()
  // Die Bühne bleibt oben stehen, sobald man an ihr vorbeiscrollt: so sieht man jede Änderung an ihm.
  // (CSS „sticky“ greift hier nicht: der Inhaltsrahmen der App schneidet quer ab und wäre sonst der Bezug.)
  const platz = useRef<HTMLDivElement>(null)
  const [angeheftet, setAngeheftet] = useState<{ left: number; width: number } | null>(null)
  useEffect(() => {
    const pruefe = () => {
      const el = platz.current
      if (!el) return
      const r = el.getBoundingClientRect(), oben = parseFloat(getComputedStyle(el).scrollMarginTop) || 0
      setAngeheftet(a => {
        if (r.top >= oben) return a ? null : a
        return a && a.left === r.left && a.width === r.width ? a : { left: r.left, width: r.width }
      })
    }
    pruefe()
    window.addEventListener('scroll', pruefe, { passive: true, capture: true })
    window.addEventListener('resize', pruefe)
    return () => { window.removeEventListener('scroll', pruefe, { capture: true }); window.removeEventListener('resize', pruefe) }
  }, [])

  // oben beginnen: die Bühne ist das Erste, was man sieht (das Profil war meist weiter unten gescrollt)
  useEffect(() => { window.scrollTo(0, 0) }, [])
  // Beim Öffnen aus dem Haus holen (nur einmal); beim Verlassen zurück, wenn er drinnen war
  useEffect(() => {
    if (!stand.bereit || warDrinnen.current !== null) return
    const dot = dotStore.api()
    if (!dot) return
    warDrinnen.current = dot.modus() === 'house'
    if (warDrinnen.current && stand.darfRaus) dot.klingeln()
  }, [stand.bereit, stand.darfRaus])
  useEffect(() => () => {
    const dot = dotStore.api()
    if (!dot) return
    dot.schliesseBuehne()
    if (warDrinnen.current) dot.heimgehen()
  }, [])
  // Sobald er draußen ist, auf die Bühne
  useEffect(() => {
    const dot = dotStore.api(), el = buehne.current
    if (dot && el && stand.modus === 'home') dot.oeffneBuehne(el)
  }, [stand.modus])

  const schalter = (k: HokuEinstellung, titel: DotTextKey, text: DotTextKey, gesperrt = false) => {
    const an = gesperrt || werte[k]
    return (
      <div className="tyd-hoku-einst" data-hoku-einst={k}>
        <button
          type="button"
          role="switch"
          aria-checked={an}
          aria-disabled={gesperrt || undefined}
          onClick={() => {
            if (gesperrt) return
            const neu = !werte[k]
            setze(k, neu)
            const dot = dotStore.api()
            // kleine Vorführung auf der Bühne
            if (k === 'ruhig' && !neu) dot?.zeigeForm('freude')
            if (k === 'hinweise' && neu) dot?.sag(dt('einst_hinweise_probe'), 2200)
          }}
        >
          <span className="tyd-hoku-einst-titel">{dt(titel)}</span>
          <Schalter an={an} />
        </button>
        <p>{gesperrt ? dt('einst_ruhig_geraet') : dt(text)}</p>
      </div>
    )
  }

  return (
    <div data-hoku-seite>
      <Link to="/profil" className="tyd-hoku-zurueck" aria-label={dt('einst_zurueck')}>
        <ChevronLeft size={22} aria-hidden="true" />
      </Link>
      <h1 className="lg-large-title">{dt('einst_titel')}</h1>
      <div ref={platz} className="tyd-hoku-platz">
        <div
          ref={buehne}
          className="tyd-hoku-buehne"
          data-hoku-buehne
          data-angeheftet={angeheftet ? 'true' : undefined}
          style={angeheftet ? { left: angeheftet.left, width: angeheftet.width } : undefined}
          aria-hidden="true"
        />
      </div>
      <p className="tyd-hoku-buehne-text">{dt('einst_buehne')}</p>

      <HokuFarbAuswahl />

      <div style={{ marginTop: 24 }}>
        <p className="lg-group-title">{dt('einst_verhalten')}</p>
        <div className="card tyd-hoku-einst-karte">
          {schalter('ruhig', 'einst_ruhig', 'einst_ruhig_text', geraetRuhig)}
          {schalter('raus', 'einst_raus', 'einst_raus_text')}
          {schalter('hinweise', 'einst_hinweise', 'einst_hinweise_text')}
        </div>
      </div>
    </div>
  )
}
