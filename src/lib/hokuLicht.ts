/**
 * Hoku-Licht: Hoku ist die Lichtquelle der Seite.
 *
 * Wo Hoku gerade ist, fangen die Kanten der Flächen und Knöpfe in seiner Nähe
 * sein Licht: die Kante leuchtet auf der Seite, die zu ihm zeigt, je näher,
 * desto heller und breiter. Fliegt er weiter, wandert das Licht mit.
 *
 * Gerechnet wird nur, wenn der Look es will (`--hoku-licht: 1` am `<html>`),
 * nur für sichtbare Flächen und nur, wenn Hoku sich bewegt hat. Das Ergebnis
 * steht als CSS-Variablen am Element; wie es aussieht, entscheidet der Look
 * in liquid-glass.css:
 *   --hl-a  Richtung zu Hoku (0° = oben, im Uhrzeigersinn)
 *   --hl-w  wie weit der Schein um die Kante reicht (Grad)
 *   --hl-i  Helligkeit, 0 (weit weg) bis 1 (Hoku an der Kante)
 *   --hl-x, --hl-y  wo Hoku über der Fläche steht (Prozent)
 */

export interface Rect { left: number; top: number; width: number; height: number }
export interface Point { x: number; y: number }
export interface HokuSchein { angle: number; spread: number; intensity: number; x: number; y: number }

/** Bis zu diesem Abstand von der Kante (px) fängt eine Fläche Hokus Licht. */
export const REICHWEITE = 230

/*
 * Die Navbar fängt Hokus Licht nur in ihren eigenen Materialien
 * (<html data-navbar="eigen">). Im gemeinsamen Glas nutzt sie die --hl-Werte
 * nicht — dann wird sie gar nicht erst beschrieben: jeder Wert dort erbt der
 * ganze Baum der Leiste (samt Kopien in der Linse) und rechnete jedes Bild neu.
 */
const ZIELE_ALLGEMEIN = '.lg-surface, .card, .lg-group, .lg-btn, .lg-icon-btn, .lg-chip'
const ZIELE_LEISTE = '.tyd-tabbar, .tyd-tabdock-action'
const ziele = () => document.documentElement.dataset.navbar === 'eigen' ? `${ZIELE_ALLGEMEIN}, ${ZIELE_LEISTE}` : ZIELE_ALLGEMEIN

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

/** Hokus Schein auf einer Fläche (beides in Bildschirm-Pixeln). */
export function hokuSchein(r: Rect, hoku: Point, reichweite = REICHWEITE): HokuSchein {
  const cx = r.left + r.width / 2
  const cy = r.top + r.height / 2
  const dx = hoku.x - cx
  const dy = hoku.y - cy
  const ox = Math.max(0, Math.abs(dx) - r.width / 2)
  const oy = Math.max(0, Math.abs(dy) - r.height / 2)
  const near = Math.max(0, 1 - Math.hypot(ox, oy) / reichweite)
  return {
    angle: ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360,
    spread: 60 + near * 120,
    // Quadratisch: fällt weich ab, ganz nah wird es deutlich
    intensity: near * near,
    x: clamp(((hoku.x - r.left) / r.width) * 100, 0, 100),
    y: clamp(((hoku.y - r.top) / r.height) * 100, 0, 100),
  }
}

type Quelle = () => Point | null
let quelle: Quelle | null = null

/** Hokus Ebene meldet hier, wo er ist (`null`: nicht zu sehen). */
export function setHokuLichtQuelle(q: Quelle | null): void {
  quelle = q
}

export function installHokuLicht(): () => void {
  const sichtbar = new Set<HTMLElement>()
  const beleuchtet = new Set<HTMLElement>()
  const geschrieben = new WeakMap<HTMLElement, string>()
  let aktiv = false
  let frame = 0
  let zuletzt: Point | null = null
  let dirty = true

  const pruefeLook = () => {
    aktiv = getComputedStyle(document.documentElement).getPropertyValue('--hoku-licht').trim() === '1'
    if (aktiv) { dirty = true; schedule() } else loeschen()
  }
  const loeschen = () => {
    for (const el of beleuchtet) {
      for (const v of ['--hl-a', '--hl-w', '--hl-i', '--hl-x', '--hl-y']) el.style.removeProperty(v)
      geschrieben.delete(el)
    }
    beleuchtet.clear()
  }

  const draw = () => {
    frame = 0
    if (!aktiv || document.hidden) return
    const hoku = quelle?.() ?? null
    if (!hoku) {
      if (beleuchtet.size) loeschen()
      zuletzt = null
      schedule()
      return
    }
    const bewegt = !zuletzt || Math.abs(hoku.x - zuletzt.x) > 0.75 || Math.abs(hoku.y - zuletzt.y) > 0.75
    if (bewegt || dirty) {
      dirty = false
      zuletzt = hoku
      // Erst alles messen, dann schreiben: kein erzwungenes Neu-Layout dazwischen
      const lagen = [...sichtbar].map(el => [el, el.getBoundingClientRect()] as const)
      for (const [el, r] of lagen) {
        if (r.width === 0) continue
        const s = hokuSchein(r, hoku)
        const werte = `${s.angle.toFixed(0)}|${s.spread.toFixed(0)}|${s.intensity.toFixed(2)}|${s.x.toFixed(0)}|${s.y.toFixed(0)}`
        if (geschrieben.get(el) === werte) continue
        geschrieben.set(el, werte)
        beleuchtet.add(el)
        el.style.setProperty('--hl-a', `${s.angle.toFixed(0)}deg`)
        el.style.setProperty('--hl-w', `${s.spread.toFixed(0)}deg`)
        el.style.setProperty('--hl-i', s.intensity.toFixed(2))
        el.style.setProperty('--hl-x', `${s.x.toFixed(0)}%`)
        el.style.setProperty('--hl-y', `${s.y.toFixed(0)}%`)
      }
    }
    // Hoku bewegt sich ständig ein wenig (Atmen, Rundflug): weiter beobachten
    schedule()
  }
  const schedule = () => {
    if (!frame && aktiv) frame = requestAnimationFrame(draw)
  }
  const touch = () => { dirty = true; schedule() }

  const io = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
    for (const e of entries) {
      const el = e.target as HTMLElement
      if (e.isIntersecting) sichtbar.add(el)
      else sichtbar.delete(el)
    }
    touch()
  }, { rootMargin: '40px' })
  const beobachtet = new WeakSet<Element>()
  const sammeln = () => {
    for (const el of document.querySelectorAll<HTMLElement>(ziele())) {
      if (beobachtet.has(el)) continue
      beobachtet.add(el)
      if (io) io.observe(el)
      else sichtbar.add(el)
    }
    for (const el of sichtbar) if (!el.isConnected) sichtbar.delete(el)
    touch()
  }
  let sammelFrame = 0
  const mo = new MutationObserver(() => {
    if (sammelFrame) return
    sammelFrame = requestAnimationFrame(() => { sammelFrame = 0; sammeln() })
  })
  mo.observe(document.body, { childList: true, subtree: true })
  const lookMo = new MutationObserver(pruefeLook)
  lookMo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-look'] })
  const onScroll = () => touch()
  window.addEventListener('scroll', onScroll, { passive: true, capture: true })
  window.addEventListener('resize', onScroll)
  document.addEventListener('visibilitychange', touch)

  sammeln()
  pruefeLook()

  return () => {
    cancelAnimationFrame(frame)
    cancelAnimationFrame(sammelFrame)
    io?.disconnect()
    mo.disconnect()
    lookMo.disconnect()
    window.removeEventListener('scroll', onScroll, { capture: true })
    window.removeEventListener('resize', onScroll)
    document.removeEventListener('visibilitychange', touch)
    loeschen()
  }
}
