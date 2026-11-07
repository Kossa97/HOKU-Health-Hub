// Pure geometry for the single-graphic vial liquid.
// One SVG draws the whole liquid: body fill, its living top surface (the
// waterline is the top edge of the liquid itself, not a separate band), the
// surface sheen oval, the sub-surface glow, the meniscus rim and a specular
// highlight — all derived from the same sampled curve so they move as one.
//
// The surface is a sum of waves over time: tiny ambient ripples keep it alive
// at rest, and a slosh term (driven by the spring physics) tilts and waves it
// physically on interaction.

export const LIQUID_VB_W = 120
export const LIQUID_VB_H = 200
const MARGIN_TOP = 13 // permanent air gap so a raised wall never reaches the rim
const MARGIN_BOT = 3
const USABLE = LIQUID_VB_H - MARGIN_TOP - MARGIN_BOT
const CX = LIQUID_VB_W / 2
const HALF_W = LIQUID_VB_W / 2
const SAMPLES = 12

// How far (in viewBox units) the liquid climbs one wall at full tilt.
const TILT_RISE = 22
// The rendered chamber's width / height in px. The reference is today's vial
// chamber at 74.7 x 94.1. The tilt rise is measured in viewBox units of the
// HEIGHT while the surface half-width is measured in units of the WIDTH, so a
// narrower chamber would tilt far more steeply for the same rise. Scaling the
// rise by this ratio keeps the surface ANGLE comparable across every form.
export const REFERENCE_CHAMBER_ASPECT = 0.794
// Resting downward bow at the surface center (kept small — real water is flat).
const NEAR_BOW = 1.8
// Capillary rise: the liquid climbs slightly up both glass walls (meniscus).
const CAP_RISE = 2.4
// Surface band thickness (distance between front and back rim) at the center.
const SURFACE_THICKNESS = 9
// Depth of the brighter sub-surface scattering band just under the waterline.
const GLOW_DEPTH = 28

export interface LiquidParams {
  fill: number // 0..1, already capped by the caller
  tilt?: number // -1..1 slosh tilt (right wall higher when > 0)
  energy?: number // 0..1 slosh energy — scales the traveling wave + highlight
  time?: number // seconds, advances continuously to animate the surface
  chamberAspect?: number // rendered chamber width / height in px
}

export interface LiquidGeometry {
  body: string // filled liquid body (top edge = front waterline)
  surface: string // surface sheen oval band
  glow: string // brighter sub-surface scattering band under the waterline
  rim: string // front waterline stroke
  surfaceY: number // nominal surface height (viewBox units)
  highlightX: number // specular highlight x, shifts with tilt
  highlightY: number
  leftWallY: number // where the meniscus meets the left glass wall
  rightWallY: number // where the meniscus meets the right glass wall
  // Ausmaße der Flächen (viewBox), für Verläufe in der Zeichenfläche
  // (LiquidCanvas): SVG legt sie über den Umriss der Fläche, Canvas braucht sie ausdrücklich
  bodyTop: number // höchster Punkt der vorderen Wasserlinie
  surfaceTop: number // höchster Punkt der hinteren Linie des Oberflächenbands
  surfaceBottom: number // tiefster Punkt der vorderen Wasserlinie
  glowBottom: number // tiefster Punkt des Leuchtbands unter der Oberfläche
}

const clamp = (v: number, lo: number, hi: number) =>
  Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : lo

function norm(x: number): number {
  return (x - CX) / HALF_W // -1 at left wall, +1 at right wall
}

// How much a vial sloshes given its fill level. A half-full vial has the most
// free surface and sloshes the most; a nearly-full vial is constrained by the
// rim and a near-empty one has little liquid — both move noticeably less. This
// is what makes every vial in the carousel react differently.
export function fillSloshResponse(fill: number): number {
  const f = clamp(fill, 0, 1)
  const peak = 1 - (2 * f - 1) ** 2 // 0 at empty/full, 1 at half-full
  return 0.32 + 0.68 * peak
}

// Front (near) rim height at x — the top edge of the liquid body.
function nearEdgeY(
  x: number,
  surfaceY: number,
  tilt: number,
  energy: number,
  time: number,
  scale: number,
  motion: number,
): number {
  const n = norm(x)
  const tiltY = -tilt * TILT_RISE * scale * motion * n // right wall rises when tilt > 0
  const bow = NEAR_BOW * (1 - n * n) // gentle downward bow at the center
  const capillary = CAP_RISE * n * n // liquid climbs the glass walls
  // Ambient ripples: two slow, low waves that keep the surface alive at rest.
  const ambient =
    0.7 * Math.sin(n * 2.3 + time * 1.7) + 0.45 * Math.sin(n * 4.1 - time * 1.1 + 0.7)
  // Slosh wave: a gentle traveling wave that grows with slosh energy and rides
  // toward the rising wall, so a swipe ripples the surface as well as tilting it.
  const dir = tilt >= 0 ? 1 : -1
  const slosh =
    energy * scale * motion * 3 * Math.sin(n * 3.2 - dir * time * 6) * (0.5 + 0.5 * Math.abs(n))
  return surfaceY + tiltY + bow - capillary + ambient + slosh
}

export function liquidSurfaceY(fill: number): number {
  return MARGIN_TOP + (1 - clamp(fill, 0, 1)) * USABLE
}

// Catmull-Rom → cubic Bézier continuation through the points (pen at p[0]).
function smoothCont(p: Array<[number, number]>): string {
  let d = ''
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i === 0 ? 0 : i - 1]
    const p1 = p[i]
    const p2 = p[i + 1]
    const p3 = p[i + 2 < p.length ? i + 2 : p.length - 1]
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`
  }
  return d
}

function moveTo(p: [number, number]): string {
  return `M ${p[0].toFixed(2)} ${p[1].toFixed(2)}`
}

const finite = (v: number, fallback = 0) => (Number.isFinite(v) ? v : fallback)

export function buildLiquid({
  fill,
  tilt = 0,
  energy = 0,
  time = 0,
  chamberAspect = REFERENCE_CHAMBER_ASPECT,
}: LiquidParams): LiquidGeometry {
  const t = clamp(tilt, -1, 1)
  const e = clamp(energy, 0, 1)
  const tm = finite(time)
  const scale = fillSloshResponse(fill)
  const motion = clamp(finite(chamberAspect, REFERENCE_CHAMBER_ASPECT) / REFERENCE_CHAMBER_ASPECT, 0.2, 2)
  const surfaceY = liquidSurfaceY(fill)

  const near: Array<[number, number]> = []
  for (let i = 0; i <= SAMPLES; i++) {
    const x = (i / SAMPLES) * LIQUID_VB_W
    near.push([x, nearEdgeY(x, surfaceY, t, e, tm, scale, motion)])
  }
  const thickness = (x: number) => SURFACE_THICKNESS * (1 - 0.55 * norm(x) * norm(x)) + 1.5
  const back = near.map(([x, y]) => [x, y - thickness(x)] as [number, number])
  const backRev = [...back].reverse()
  const glowBottom = near.map(([x, y]) => [x, Math.min(y + GLOW_DEPTH, LIQUID_VB_H)] as [number, number])
  const glowRev = [...glowBottom].reverse()

  const rim = moveTo(near[0]) + smoothCont(near)

  // Body: smooth front rim, then down the right wall, the floor, up the left
  // wall. The liquid always touches both glass walls (no side gap).
  const body = `${rim} L ${LIQUID_VB_W} ${LIQUID_VB_H} L 0 ${LIQUID_VB_H} Z`

  // Surface sheen oval: between the raised back rim and the front rim.
  const surface = `${rim} L ${backRev[0][0].toFixed(2)} ${backRev[0][1].toFixed(2)}${smoothCont(backRev)} Z`

  // Sub-surface scattering band: hugs just under the front rim and fades down.
  const glow = `${rim} L ${glowRev[0][0].toFixed(2)} ${glowRev[0][1].toFixed(2)}${smoothCont(glowRev)} Z`

  const highlightX = clamp(CX + t * scale * motion * 30, 16, LIQUID_VB_W - 16)
  const highlightY =
    nearEdgeY(highlightX, surfaceY, t, e, tm, scale, motion) - thickness(highlightX) * 0.5

  return {
    body,
    surface,
    glow,
    rim,
    surfaceY,
    highlightX,
    highlightY,
    leftWallY: near[0][1],
    rightWallY: near[near.length - 1][1],
    bodyTop: Math.min(...near.map(p => p[1])),
    surfaceTop: Math.min(...back.map(p => p[1])),
    surfaceBottom: Math.max(...near.map(p => p[1])),
    glowBottom: Math.max(...glowBottom.map(p => p[1])),
  }
}
