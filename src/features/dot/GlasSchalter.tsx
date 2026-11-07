/**
 * Schalter aus Glas wie bei iOS 26 (Nutzer 04.11.2026, Vorschau „Hoku Aquarium“): gedrückt oder gezogen hebt
 * sich der Knopf als Linse an und vergrößert die Spur darunter, mit leichtem Farbsaum; losgelassen federt er
 * an seinen Platz. Kurz antippen schaltet um. Technik nach Glisse (https://github.com/0kzh/glisse, MIT, Kelvin
 * Zhang): ein SVG-Verschiebungsbild auf der Spur selbst, nicht auf dem Hintergrund – so geht es auch im
 * iPhone-WebView. Die Kante des angehobenen Knopfs ist die gerechnete Glaskante (`lib/glasKante`).
 */
import { Fragment, useEffect, useId, useMemo, useRef } from 'react'
import { kantenBild, kantenFeld } from '../../lib/glasKante'

const SPUR_W = 64, SPUR_H = 28, KNOPF_W = 38, KNOPF_H = 24, LINSE_W = 54, LINSE_H = 34
// Platz um die Spur, den die angehobene Linse bricht (Safari malt einen Filter nur im Element)
const RAUM_X = 14, RAUM_Y = 8
const X_AUS = 2, X_AN = SPUR_W - KNOPF_W - 2
const HEBEN = 1.42

/** Verschiebungsbild der Linse: zieht zur Mitte (vergrößert), am Rand am stärksten. 128 = keine Verschiebung. */
function linsenKarte(): string | null {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas'); c.width = LINSE_W; c.height = LINSE_H
  const g = c.getContext('2d')
  if (!g) return null
  const img = g.createImageData(LINSE_W, LINSE_H)
  for (let y = 0; y < LINSE_H; y++) for (let x = 0; x < LINSE_W; x++) {
    const { d, nx, ny } = kantenFeld(x + 0.5, y + 0.5, LINSE_W, LINSE_H, LINSE_H / 2)
    const k = d > 0 ? 0 : Math.pow(Math.max(0, 1 + d / (LINSE_H * 0.5)), 1.6), i = (y * LINSE_W + x) * 4
    img.data[i] = 128 + nx * k * 127; img.data[i + 1] = 128 + ny * k * 127; img.data[i + 2] = 128; img.data[i + 3] = 255
  }
  g.putImageData(img, 0, 0)
  return c.toDataURL()
}

const KANAELE: [number, string][] = [
  [1.2, '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0'],
  [1, '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0'],
  [0.8, '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0'],
]

export interface GlasSchalterProps {
  an: boolean
  onWechsel: (an: boolean) => void
  /** gesperrt: zeigt `an` und lässt sich nicht umschalten (z. B. „Bewegung reduzieren“ am Gerät) */
  gesperrt?: boolean
  beschriftetVon: string
  id?: string
}

export function GlasSchalter({ an, onWechsel, gesperrt = false, beschriftetVon, id }: GlasSchalterProps) {
  const knopf = useRef<HTMLButtonElement>(null)
  const bett = useRef<HTMLSpanElement>(null)
  const bild = useRef<SVGFEImageElement>(null)
  const fid = 'glas-linse-' + useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const karte = useMemo(() => linsenKarte(), [])
  const weniger = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const z = useRef({ x: an ? X_AN : X_AUS, vx: 0, ziel: an ? X_AN : X_AUS, s: 1, sz: 1, laeuft: false, halt: null as null | { x0: number; xs: number; bewegt: boolean }, an })
  const wechsel = useRef(onWechsel)
  useEffect(() => { wechsel.current = onWechsel }, [onWechsel])

  const setze = () => {
    const k = knopf.current, Z = z.current
    if (!k) return
    k.style.setProperty('--x', Z.x.toFixed(2) + 'px'); k.style.setProperty('--s', Z.s.toFixed(3))
    k.style.setProperty('--fuell', Math.min(1, Math.max(0, (Z.x - X_AUS) / (X_AN - X_AUS))).toFixed(3))
    bild.current?.setAttribute('x', (RAUM_X + Z.x + KNOPF_W / 2 - LINSE_W / 2).toFixed(1))
  }
  const feder = () => {
    const Z = z.current
    if (Z.laeuft) return
    Z.laeuft = true
    let t0 = performance.now()
    const lauf = (now: number) => {
      const dt = Math.min(0.032, (now - t0) / 1000); t0 = now
      if (!Z.halt) { Z.vx += ((Z.ziel - Z.x) * 520 - Z.vx * 32) * dt; Z.x += Z.vx * dt }
      Z.s += (Z.sz - Z.s) * Math.min(1, dt * (Z.sz > Z.s ? 18 : 12))
      setze()
      if (Z.halt || Math.abs(Z.ziel - Z.x) > 0.05 || Math.abs(Z.vx) > 0.5 || Math.abs(Z.sz - Z.s) > 0.003) requestAnimationFrame(lauf)
      else {
        Z.x = Z.ziel; Z.s = Z.sz; setze(); Z.laeuft = false
        if (!Z.halt) { delete knopf.current?.dataset.gehoben; if (bett.current) bett.current.style.filter = '' }
      }
    }
    requestAnimationFrame(lauf)
  }
  // Änderung von außen (oder nach dem eigenen Umschalten): an den neuen Platz federn
  useEffect(() => {
    const Z = z.current
    Z.an = an; Z.ziel = an ? X_AN : X_AUS
    if (weniger) { Z.x = Z.ziel; setze() } else feder()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setze/feder lesen nur Refs
  }, [an])
  useEffect(() => {
    const k = knopf.current
    if (!k) return
    const url = kantenBild(KNOPF_W, KNOPF_H, KNOPF_H / 2, { fase: 2, glanz: 0.9 })
    if (url) k.style.setProperty('--glas-kante', url)
    setze()
  }, [])

  const umschalten = (neu: boolean) => {
    z.current.an = neu; z.current.ziel = neu ? X_AN : X_AUS
    wechsel.current(neu)
  }
  return (
    <button
      ref={knopf}
      id={id}
      type="button"
      role="switch"
      aria-checked={an}
      aria-labelledby={beschriftetVon}
      aria-disabled={gesperrt || undefined}
      className="tyd-glas-schalter"
      onPointerDown={e => {
        if (gesperrt) return
        knopf.current?.setPointerCapture(e.pointerId)
        const Z = z.current
        Z.halt = { x0: e.clientX, xs: Z.x, bewegt: false }
        if (!weniger) {
          if (knopf.current) knopf.current.dataset.gehoben = ''
          if (bett.current) bett.current.style.filter = `url(#${fid})`
          Z.sz = HEBEN
        }
        feder()
      }}
      onPointerMove={e => {
        const Z = z.current
        if (!Z.halt) return
        const dx = e.clientX - Z.halt.x0
        if (Math.abs(dx) > 3) Z.halt.bewegt = true
        Z.x = Math.max(X_AUS - 4, Math.min(X_AN + 4, Z.halt.xs + dx))
      }}
      onPointerUp={() => {
        const Z = z.current, h = Z.halt
        if (!h) return
        Z.halt = null; Z.sz = 1
        if (h.bewegt) { const neu = Z.x > (X_AUS + X_AN) / 2; if (neu !== Z.an) umschalten(neu); else Z.ziel = Z.an ? X_AN : X_AUS }
        else umschalten(!Z.an)
        feder()
      }}
      onPointerCancel={() => { const Z = z.current; Z.halt = null; Z.sz = 1; Z.ziel = Z.an ? X_AN : X_AUS; feder() }}
      onKeyDown={e => { if (gesperrt) return; if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); umschalten(!z.current.an) } }}
      onClick={e => e.preventDefault()}
    >
      <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
        <filter id={fid} x="0" y="0" width={SPUR_W + 2 * RAUM_X} height={SPUR_H + 2 * RAUM_Y} filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodColor="rgb(128,128,128)" result="neutral" />
          {karte && <feImage ref={bild} href={karte} x={RAUM_X} y={RAUM_Y + SPUR_H / 2 - LINSE_H / 2} width={LINSE_W} height={LINSE_H} preserveAspectRatio="none" result="roh" />}
          <feComposite in="roh" in2="neutral" operator="over" result="karte" />
          {KANAELE.map(([k, m], i) => (
            <Fragment key={i}>
              <feDisplacementMap in="SourceGraphic" in2="karte" scale={20 * k} xChannelSelector="R" yChannelSelector="G" result={`v${i}`} />
              <feColorMatrix in={`v${i}`} type="matrix" values={m} result={`k${i}`} />
            </Fragment>
          ))}
          <feComposite in="k0" in2="k1" operator="arithmetic" k2={1} k3={1} result="k01" />
          <feComposite in="k01" in2="k2" operator="arithmetic" k2={1} k3={1} />
        </filter>
      </svg>
      <span ref={bett} className="tyd-glas-schalter-bett" aria-hidden="true">
        <span className="tyd-glas-schalter-spur"><span className="tyd-glas-schalter-fuell" /><span className="tyd-glas-schalter-strich" /><span className="tyd-glas-schalter-kreis" /></span>
      </span>
      <span className="tyd-glas-schalter-knopf" aria-hidden="true" />
    </button>
  )
}
