/**
 * Rechenkern der Kalorien-Kugel — ohne React, ohne Canvas.
 *
 * 1 Punkt = 1 kcal (ab 4000 kcal Ziel mehrere je Punkt), 1 Punkt = 1 g bei den
 * Makro-Monden. Gefüllt wird von unten; was über dem Ziel liegt, schwebt als
 * lockere Hülle außen, in derselben Farbe, bis zum doppelten Ziel.
 * Entscheidungen: memory/projects/kalorientracker.md.
 */
import type { DayTotals } from './dayRings'
import type { Goals } from './nutrition'

export const MAX_DOTS = 4000
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

const ORBITS: Record<MacroKey, Orbit> = {
  protein: { rad: 1.52, tiltX: 1.16, tiltZ: 0.4, phase: 0.4, speed: 0.00016 },
  carbs: { rad: 1.72, tiltX: 1.3, tiltZ: -0.55, phase: 2.5, speed: -0.00012 },
  fat: { rad: 1.62, tiltX: 1.04, tiltZ: 1.2, phase: 4.4, speed: 0.0001 },
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
      return {
        key, n, unit: goal / n, orbit: ORBITS[key],
        fill: fill(n, totals[key] / goal),
        r: Math.max(0.12, Math.min(0.6, Math.sqrt(n / main.n))),
      }
    })
  return {
    main: { key: main.key, n: main.n, unit: main.goal > 0 ? main.goal / main.n : 1, fill: fill(main.n, main.goal > 0 ? main.value / main.goal : 0) },
    moons,
  }
}

/** Mehr Punkte = kleinere Punkte, damit die Kugel gleich luftig bleibt (Bezug: 3000 Punkte). */
export function dotScale(n: number): number {
  return Math.max(0.8, Math.min(1.15, Math.sqrt(3000 / n)))
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
