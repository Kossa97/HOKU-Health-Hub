// A few rising bubbles give the liquid life. Positions are in viewBox units and
// the body clip-path makes them pop out of existence at the waterline.
// `phase`: wie weit jede Blase beim Einhaengen schon aufgestiegen ist (Anteil
// ihrer Dauer). Frueher starteten alle unten, einige erst nach bis zu 3 s —
// nach dem Auffuellen stand die Fluessigkeit noch sekundenlang still, bis die
// Blasen oben ankamen. Mit negativem `begin` laufen sie ab dem ersten Bild,
// ueber die Hoehe verteilt.
export const LIQUID_BUBBLES = [
  { cx: 24, r: 1.5, dur: 5.4, phase: 0.62 },
  { cx: 46, r: 1.0, dur: 6.6, phase: 0.3 },
  { cx: 63, r: 1.9, dur: 5.0, phase: 0.08 },
  { cx: 82, r: 1.1, dur: 7.2, phase: 0.46 },
  { cx: 98, r: 1.4, dur: 5.9, phase: 0.8 },
] as const

export type Blase = (typeof LIQUID_BUBBLES)[number]

/** Aufstieg von 192 nach 30 (viewBox) */
const VON = 192, BIS = 30

/**
 * Lage und Deckkraft einer Blase zur Zeit `t` (s), wie früher die CSS-Animation
 * der SVG-Flüssigkeit: Einblenden bis 18 %, halb sichtbar bis 72 %, Ausblenden bis zum Ende.
 */
export function blaseZu(b: { dur: number; phase: number }, t: number): { y: number; deckkraft: number } {
  const roh = (t / b.dur + b.phase) % 1
  const p = roh < 0 ? roh + 1 : roh
  const y = VON + (BIS - VON) * p
  const deckkraft = p < 0.18 ? (p / 0.18) * 0.5 : p < 0.72 ? 0.5 : ((1 - p) / 0.28) * 0.5
  return { y, deckkraft }
}
