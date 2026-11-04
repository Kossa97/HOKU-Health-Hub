/**
 * Seite „Hoku“: Hokus Farbe wählen (Nutzer 02.11.2026), als Karussell (Nutzer 04.11.2026). Man wischt durch
 * die Farbkugeln; die Kugel, die in der Mitte einrastet, ist gewählt, und Hoku im Glas trägt sie sofort.
 * Antippen holt eine Kugel in die Mitte. „Passend zum Design“ ist der Standard und nimmt die Farbe, die zum
 * gewählten Erscheinungsbild gehört.
 */
import { useEffect, useRef } from 'react'
import { useActiveLook } from '../../lib/look'
import { HOKU_FARBEN, STANDARD_JE_LOOK, muster, useHokuFarbWahl, type HokuFarbe, type HokuFarbWahl } from './lib/hokuFarbe'
import { useDotText, type DotTextKey } from './texte'

const name = (f: HokuFarbe) => `farbe_${f}` as DotTextKey
const WAHLEN: readonly HokuFarbWahl[] = ['auto', ...HOKU_FARBEN]

function Muster({ farbe }: { farbe: HokuFarbe }) {
  const [v, r, h] = muster(farbe)
  const rgb = (c: readonly number[]) => `rgb(${c[0]},${c[1]},${c[2]})`
  return (
    <span
      className="tyd-farbe-kugel"
      aria-hidden="true"
      style={{
        background: `radial-gradient(circle at 38% 34%, ${rgb(v)} 0%, ${rgb(r)} 48%, ${rgb(h)} 100%)`,
        boxShadow: `0 0 18px ${rgb(r)}55`,
      }}
    />
  )
}

export function HokuFarbAuswahl() {
  const { dt } = useDotText()
  const look = useActiveLook()
  const [wahl, setWahl] = useHokuFarbWahl()
  const standard = STANDARD_JE_LOOK[look]
  const band = useRef<HTMLDivElement>(null)
  const wahlRef = useRef(wahl)
  useEffect(() => { wahlRef.current = wahl }, [wahl])
  const weniger = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

  const zur = (w: HokuFarbWahl, sanft: boolean) => {
    const el = band.current?.querySelector<HTMLElement>(`[data-hoku-farbe="${w}"]`), b = band.current
    if (!el || !b) return
    b.scrollTo({ left: el.offsetLeft + el.offsetWidth / 2 - b.clientWidth / 2, behavior: sanft && !weniger ? 'smooth' : 'auto' })
  }
  // beim Öffnen steht die gewählte Kugel in der Mitte
  useEffect(() => { zur(wahlRef.current, false) }, []) // eslint-disable-line react-hooks/exhaustive-deps -- nur beim Einhängen

  // Wischen: die Kugel in der Mitte wird gewählt, sobald das Band zur Ruhe kommt
  useEffect(() => {
    const b = band.current
    if (!b) return
    let t = 0
    const mitte = () => {
      const m = b.scrollLeft + b.clientWidth / 2
      let beste: HokuFarbWahl | null = null, d = Infinity
      for (const el of b.querySelectorAll<HTMLElement>('[data-hoku-farbe]')) {
        const dd = Math.abs(el.offsetLeft + el.offsetWidth / 2 - m)
        if (dd < d) { d = dd; beste = el.dataset.hokuFarbe as HokuFarbWahl }
      }
      if (beste && beste !== wahlRef.current) setWahl(beste)
    }
    const beiRollen = () => { window.clearTimeout(t); t = window.setTimeout(mitte, 110) }
    b.addEventListener('scroll', beiRollen, { passive: true })
    return () => { b.removeEventListener('scroll', beiRollen); window.clearTimeout(t) }
  }, [setWahl])

  const waehle = (w: HokuFarbWahl) => { setWahl(w); zur(w, true) }
  const text = (w: HokuFarbWahl) => w === 'auto' ? dt('farbe_auto') : dt(name(w))
  const beschriftung = wahl === 'auto' ? dt('farbe_auto_jetzt', { farbe: dt(name(standard)) }) : dt(name(wahl))

  return (
    <div style={{ marginTop: 24 }} data-hoku-farbwahl>
      <p className="lg-group-title">{dt('farbe_titel')}</p>
      <div className="card tyd-farbe-karte">
        <div
          ref={band}
          className="tyd-farbe-band"
          role="radiogroup"
          aria-label={dt('farbe_titel')}
          onKeyDown={e => {
            if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
            e.preventDefault()
            const i = WAHLEN.indexOf(wahl), n = Math.max(0, Math.min(WAHLEN.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1)))
            waehle(WAHLEN[n])
            band.current?.querySelector<HTMLElement>(`[data-hoku-farbe="${WAHLEN[n]}"]`)?.focus()
          }}
        >
          {WAHLEN.map(w => {
            const an = wahl === w
            return (
              <button
                key={w}
                type="button"
                role="radio"
                aria-checked={an}
                tabIndex={an ? 0 : -1}
                data-hoku-farbe={w}
                className="tyd-farbe-wahl"
                onClick={() => waehle(w)}
              >
                <Muster farbe={w === 'auto' ? standard : w} />
                <span className="tyd-farbe-name">{text(w)}</span>
              </button>
            )
          })}
        </div>
        <p className="tyd-farbe-jetzt" aria-live="polite">{beschriftung}</p>
        <p style={{ marginTop: 6, fontSize: 13, lineHeight: 1.45, color: 'var(--lg-text-3)' }}>{dt('farbe_hinweis')}</p>
      </div>
    </div>
  )
}
