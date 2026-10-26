/**
 * Punkte wandern zwischen zwei Mini-Kugeln der Wochenleiste: Ein Eintrag zieht auf einen anderen
 * Tag, also rieseln Punkte unten aus der Kugel des alten Tages, sinken kurz ab und fliegen im
 * Bogen von unten in die Kugel des neuen Tages. Gezeichnet als einzelne Punkte mit WAAPI
 * (Transform und Deckkraft) — das läuft weiter, während die Seite neu rendert.
 */

export interface FlightOrb {
  /** Mittelpunkt und Radius der Kugel auf dem Bildschirm (px). */
  x: number
  y: number
  r: number
}

/** Dauer der Phasen (ms): absinken, fliegen; Versatz zwischen den Punkten insgesamt. */
const SINK_MS = 300
const FLY_MS = 640
const STAGGER_MS = 260
/** Wie tief die Punkte unter die Kugel sinken (px), bevor sie losfliegen. */
const DROP = 14
const SIZE = 4
/** Stützstellen der Bahn (WAAPI verbindet sie linear — fein genug für einen runden Bogen). */
const STEPS = 18

const smooth = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

/** Pseudozufall mit Startwert — gleiche Eingabe, gleiche Wolke (ruhiger beim Rückgängig). */
function rng(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

export interface DotPath { keys: { x: number; y: number; scale: number; opacity: number; offset: number }[]; delay: number }

/**
 * Bahnen der Punkte (rein rechnerisch, testbar): Start in der unteren Hälfte der Quelle,
 * Absinken unter sie, dann ein Bogen unter der Leiste hindurch, der von unten in das Ziel steigt.
 */
export function dotPaths(from: FlightOrb, to: FlightOrb, count: number, seed = 1): DotPath[] {
  const rand = rng(seed)
  const total = SINK_MS + FLY_MS
  const sinkEnd = SINK_MS / total
  const out: DotPath[] = []
  for (let i = 0; i < count; i++) {
    // Start: untere Halbkugel (dort, wo sie „herausfallen“).
    const a = Math.PI * (0.15 + 0.7 * rand())
    const d = from.r * (0.35 + 0.55 * Math.sqrt(rand()))
    const sx = from.x + Math.cos(a) * d
    const sy = from.y + Math.sin(a) * d
    // Unter der Kugel: etwas gestreut, wie ein kleiner Schauer.
    const bx = from.x + (sx - from.x) * 0.6 + (rand() - 0.5) * 6
    const by = from.y + from.r + DROP * (0.6 + 0.6 * rand())
    // Landung: untere Hälfte des Ziels, steigt von unten hinein.
    const la = Math.PI * (0.2 + 0.6 * rand())
    const ld = to.r * (0.2 + 0.5 * rand())
    const ex = to.x + Math.cos(la) * ld
    const ey = to.y + Math.sin(la) * ld
    // Bogen unter beiden Kugeln hindurch; weiter entfernt, etwas tiefer.
    const cx = (bx + ex) / 2
    const cy = Math.max(by, ey) + 10 + Math.abs(ex - bx) * 0.12 + rand() * 6

    const keys: DotPath['keys'] = []
    for (let k = 0; k <= STEPS; k++) {
      const off = k / STEPS
      let x: number, y: number, scale = 1, opacity = 1
      if (off <= sinkEnd) {
        // Absinken wie unter Schwerkraft: langsam los, dann schneller.
        const t = off / sinkEnd
        const g = t * t
        x = sx + (bx - sx) * t
        y = sy + (by - sy) * g
        scale = 0.6 + 0.4 * Math.min(1, t * 3)
        opacity = Math.min(1, t * 4)
      } else {
        const t = smooth((off - sinkEnd) / (1 - sinkEnd))
        const u = 1 - t
        x = u * u * bx + 2 * u * t * cx + t * t * ex
        y = u * u * by + 2 * u * t * cy + t * t * ey
        // Am Ziel aufgehen: kleiner werden und in der Kugel verschwinden.
        if (t > 0.85) { const q = Math.min(1, (t - 0.85) / 0.15); scale = 1 - 0.5 * q; opacity = Math.max(0, 1 - q) }
      }
      keys.push({ x, y, scale, opacity, offset: off })
    }
    out.push({ keys, delay: count > 1 ? (i / (count - 1)) * STAGGER_MS : 0 })
  }
  return out
}

/** Gesamtdauer eines Flugs mit Versatz (ms). */
export const DOT_FLIGHT_MS = SINK_MS + FLY_MS + STAGGER_MS

/**
 * Punkte fliegen lassen. Löst auf, wenn der letzte Punkt angekommen ist (auch, wenn der
 * Browser kein WAAPI kann — dann sofort).
 */
export function flyDots(from: FlightOrb, to: FlightOrb, count: number, color: string, seed = 1): Promise<void> {
  const layer = document.createElement('div')
  layer.setAttribute('aria-hidden', 'true')
  layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:75;overflow:hidden'
  document.body.appendChild(layer)
  const anims: Animation[] = []
  for (const p of dotPaths(from, to, count, seed)) {
    const dot = document.createElement('div')
    dot.style.cssText = `position:absolute;left:0;top:0;width:${SIZE}px;height:${SIZE}px;margin:${-SIZE / 2}px 0 0 ${-SIZE / 2}px;`
      + `border-radius:50%;background:${color};box-shadow:0 0 5px ${color};opacity:0;will-change:transform,opacity`
    layer.appendChild(dot)
    if (typeof dot.animate !== 'function') continue
    anims.push(dot.animate(
      p.keys.map(k => ({ transform: `translate3d(${k.x}px, ${k.y}px, 0) scale(${k.scale})`, opacity: k.opacity, offset: k.offset })),
      { duration: SINK_MS + FLY_MS, delay: p.delay, easing: 'linear', fill: 'both' },
    ))
  }
  return Promise.all(anims.map(a => a.finished.catch(() => undefined))).then(() => { layer.remove() })
}
