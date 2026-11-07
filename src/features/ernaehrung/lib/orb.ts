/**
 * Rechenkern der Kalorien-Kugel — ohne React, ohne Canvas.
 *
 * 1 Punkt = 1 kcal, 1 Punkt = 1 g bei den Makro-Monden — immer, auch beim höchsten
 * Ziel. Regel (Nutzer 07.11.2026): Die Kugeln passen immer ins Bild und bleiben
 * proportional. Wird das Ziel größer, wird die Kugel nicht größer, sondern die Punkte
 * feiner (`dotScale`); dasselbe gilt für Gericht- und Essens-Kugeln, die nicht in
 * ihren Platz passen würden. Gefüllt wird von unten; was über dem Ziel liegt, schwebt
 * als lockere Hülle außen, in derselben Farbe, bis zum doppelten Ziel.
 * Entscheidungen: memory/projects/kalorientracker.md.
 */
import type { DayTotals } from './dayRings'
import type { Goals } from './nutrition'

/** Höchstes Kalorienziel (GOAL_LIMITS.kcal): so bleibt jeder Punkt genau 1 kcal. */
export const MAX_DOTS = 6000
export const MAX_MOON_DOTS = 1500
/** Kalorien ausgeblendet: Eiweiß wird die große Kugel, als Anteil am Ziel. */
export const PROTEIN_ORB_DOTS = 1500

const pointCache = new Map<number, Float32Array>()

/**
 * `n` Punkte gleichmäßig auf der Einheitskugel (Fibonacci), je Punkt x, y, z
 * und ein fester Zufallswert 0–1. Punkt 0 liegt oben (y = 1), der letzte unten.
 */
export function spherePoints(n: number): Float32Array {
  const hit = pointCache.get(n)
  if (hit) return hit
  const a = new Float32Array(n * 4)
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n
    const r = Math.sqrt(1 - y * y)
    const phi = i * 2.399963229728653
    a[i * 4] = Math.cos(phi) * r
    a[i * 4 + 1] = y
    a[i * 4 + 2] = Math.sin(phi) * r
    a[i * 4 + 3] = Math.abs((Math.sin(i * 12.9898) * 43758.5453) % 1)
  }
  pointCache.set(n, a)
  return a
}

/** Gefüllte Plätze (von unten gezählt) und Hüllenpunkte über dem Ziel. */
export interface Fill {
  filled: number
  extra: number
}

/** Anteil `f` am Ziel auf `n` Plätze; darüber Hüllenpunkte bis zum doppelten Ziel. */
export function fill(n: number, f: number): Fill {
  const share = Number.isFinite(f) ? Math.max(0, f) : 0
  return {
    filled: Math.round(n * Math.min(1, share)),
    extra: Math.min(n, Math.max(0, Math.round(n * (share - 1)))),
  }
}

export type MacroKey = 'protein' | 'carbs' | 'fat'

/** Schräge Bahn eines Mondes: Radius (in Kugelradien), Kippung, Startwinkel, Tempo (rad/ms). */
export interface Orbit {
  rad: number
  tiltX: number
  tiltZ: number
  phase: number
  speed: number
}

// Flach gekippte Bahnen: Die Monde ziehen vor allem seitlich vorbei, nicht hoch über die Kugel
// (steile Bahnen reichten beim Drehen bis 1,7 Kugelradien nach oben und liefen aus dem Bild).
const ORBITS: Record<MacroKey, Orbit> = {
  protein: { rad: 1.45, tiltX: 0.3, tiltZ: 0.15, phase: 0.4, speed: 0.00016 },
  carbs: { rad: 1.6, tiltX: 0.4, tiltZ: -0.2, phase: 2.5, speed: -0.00012 },
  fat: { rad: 1.52, tiltX: 0.25, tiltZ: 0.35, phase: 4.4, speed: 0.0001 },
}

/** Neigung der ganzen Kugel nach vorn (rad) — dieselbe wie in der Zeichnung (orbEngine). */
export const ORB_TILT = 0.22

/**
 * Wie weit die Mitte eines Mondes höchstens reicht (in Kugelradien), seitlich und nach oben —
 * über alle Bahnpositionen und jede Drehung der Kugel um die senkrechte Achse.
 */
const ORBIT_EXTENT: Record<MacroKey, { x: number; y: number }> = (() => {
  const out = {} as Record<MacroKey, { x: number; y: number }>
  const STEPS = 48
  for (const key of Object.keys(ORBITS) as MacroKey[]) {
    const o = ORBITS[key]
    let x = 0, y = 0
    for (let i = 0; i < STEPS; i++) {
      // Drehung um y, dann Neigung um x, dann die Bahn selbst (z, dann x) — wie im Zeichner.
      const yaw = (i / STEPS) * Math.PI * 2
      for (let j = 0; j < STEPS; j++) {
        const th = (j / STEPS) * Math.PI * 2
        let px = Math.cos(th) * o.rad, py = 0, pz = Math.sin(th) * o.rad
        ;[py, pz] = [py * Math.cos(o.tiltX) - pz * Math.sin(o.tiltX), py * Math.sin(o.tiltX) + pz * Math.cos(o.tiltX)]
        ;[px, py] = [px * Math.cos(o.tiltZ) - py * Math.sin(o.tiltZ), px * Math.sin(o.tiltZ) + py * Math.cos(o.tiltZ)]
        ;[px, pz] = [px * Math.cos(yaw) + pz * Math.sin(yaw), -px * Math.sin(yaw) + pz * Math.cos(yaw)]
        py = py * Math.cos(ORB_TILT) - pz * Math.sin(ORB_TILT)
        x = Math.max(x, Math.abs(px))
        y = Math.max(y, Math.abs(py))
      }
    }
    out[key] = { x, y }
  }
  return out
})()

/** Ein Mond wird vorn bis 15 % größer, angetippt noch einmal 38 %. */
const MOON_GROW = 1.15 * 1.38
/** Hülle über dem Ziel (Kugelradien): Grundabstand, Streuung, Atmen — gezeichnet in orbDraw. */
export const HULL_BASE = 1.12
export const HULL_SPREAD = 0.16
export const HULL_WOBBLE = 0.03
/**
 * So weit reicht die Hülle höchstens — oben und seitlich bleibt dafür Platz. Unten darf sie
 * hinter die Zahl ziehen (die Zeichenfläche reicht 120 px weiter), so bleibt die Kugel groß.
 */
const HULL_EXTENT = HULL_BASE + HULL_SPREAD + HULL_WOBBLE + 0.02

/**
 * Größe und Lage der Tageskugel in der Zone (CSS-Pixel): so groß, wie Breite und Höhe
 * es zulassen, ohne dass ein Mond — auch angetippt und vorn — aus dem Bild läuft.
 * Unten bleibt Platz für die zwei Textzeilen; oben dürfen Monde hinter Tag und „Ziele“ ziehen.
 */
export function fitOrb(layout: OrbLayout, width: number, height: number): { R: number; cy: number } {
  const TOP = 4, SIDE = 6, TEXT = 80
  let extX = HULL_EXTENT, extUp = HULL_EXTENT
  for (const m of layout.moons) {
    const e = ORBIT_EXTENT[m.key]
    extX = Math.max(extX, e.x + m.r * MOON_GROW)
    extUp = Math.max(extUp, e.y + m.r * MOON_GROW)
  }
  const room = height - TEXT - TOP
  const R = Math.max(24, Math.min((width / 2 - SIDE) / extX, room / (extUp + 1)))
  // Begrenzt die Breite (schmale Geräte), steht die Kugel mittig im übrigen Platz.
  return { R, cy: TOP + extUp * R + Math.max(0, room - (extUp + 1) * R) / 2 }
}

export interface Sphere {
  n: number
  fill: Fill
  /** kcal bzw. g je Punkt. */
  unit: number
}

export interface Moon extends Sphere {
  key: MacroKey
  /** Radius in Kugelradien. */
  r: number
  /**
   * Punktgröße relativ zur großen Kugel, damit die Dichte gleich bleibt, auch wenn der
   * Radius begrenzt ist (sehr großer Mond: feinere Punkte; sehr kleiner: kräftigere).
   */
  dens: number
  orbit: Orbit
}

export interface OrbLayout {
  main: Sphere & { key: 'kcal' | 'protein' }
  moons: Moon[]
}

const goalOf = (key: MacroKey, goals: Goals) => (key === 'protein' ? goals.proteinG : key === 'carbs' ? goals.carbsG : goals.fatG)

/**
 * Aufbau der Kugel für einen Tag. Die Monde haben dieselbe Punktdichte wie
 * die große Kugel: ihre Fläche wächst mit der Punktzahl (Radius = √(Punkte / Kugelpunkte)).
 * Ein Makro ohne Ziel (0 g) hat keinen Mond.
 */
export function orbLayout(totals: DayTotals, goals: Goals): OrbLayout {
  const main = goals.hideKcal
    ? { key: 'protein' as const, n: PROTEIN_ORB_DOTS, goal: goals.proteinG, value: totals.protein }
    : { key: 'kcal' as const, n: Math.max(1, Math.min(MAX_DOTS, Math.round(goals.kcal))), goal: goals.kcal, value: totals.kcal }
  const keys: MacroKey[] = goals.hideKcal ? ['carbs', 'fat'] : ['protein', 'carbs', 'fat']
  const moons = keys
    .filter(key => goalOf(key, goals) > 0)
    .map(key => {
      const goal = goalOf(key, goals)
      const n = Math.max(1, Math.min(MAX_MOON_DOTS, Math.round(goal)))
      const ideal = Math.sqrt(n / main.n)
      const r = Math.max(0.12, Math.min(0.6, ideal))
      return {
        key, n, unit: goal / n, orbit: ORBITS[key],
        fill: fill(n, totals[key] / goal),
        r, dens: Math.max(0.4, Math.min(2.5, r / ideal)),
      }
    })
  return {
    main: { key: main.key, n: main.n, unit: main.goal > 0 ? main.goal / main.n : 1, fill: fill(main.n, main.goal > 0 ? main.value / main.goal : 0) },
    moons,
  }
}

/**
 * Mehr Punkte = feinere Punkte, damit die Kugel gleich luftig bleibt (Bezug: 3000 Punkte).
 * Nach unten weit offen: beim höchsten Ziel (6000 kcal) noch 1 Punkt = 1 kcal, nur feiner.
 */
export function dotScale(n: number): number {
  return Math.max(0.55, Math.min(1.15, Math.sqrt(3000 / n)))
}

/**
 * Passt eine Kugel nicht in ihren Platz (Radius über `max`), wird sie auf `max` begrenzt
 * und ihre Punkte im selben Verhältnis feiner — so bleibt die Dichte gleich (proportional).
 */
export function fitRadius(R: number, max: number): { R: number; dotFactor: number } {
  if (!(R > max)) return { R, dotFactor: 1 }
  // Noch kein Platz gemessen (oder keiner da): nichts zeichnen statt überlaufen.
  if (max <= 0) return { R: 0, dotFactor: 0 }
  return { R: max, dotFactor: max / R }
}

/**
 * Was sich zwischen zwei Ständen einer Kugel ändert: die Plätze `from`–`to`
 * (von unten gezählt) und wie viele Hüllenpunkte dazukommen oder gehen.
 */
export interface FillChange {
  from: number
  to: number
  extra: number
  grew: boolean
}

export function fillChange(before: Fill, after: Fill): FillChange | null {
  if (before.filled === after.filled && before.extra === after.extra) return null
  const grew = after.filled + after.extra > before.filled + before.extra
  return {
    from: Math.min(before.filled, after.filled),
    to: Math.max(before.filled, after.filled),
    extra: Math.abs(after.extra - before.extra),
    grew,
  }
}

/** „64 / 150 g" — über dem Ziel mit dem Überschuss als Zahl, ohne Wertung: „180 / 150 g · +30". */
export function gramText(value: number, goal: number): string {
  const v = Math.round(value)
  return `${v} / ${goal} g${v > goal ? ` · +${v - goal}` : ''}`
}
