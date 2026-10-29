// Damped-spring slosh physics for the vial liquid.
//
// One engine drives every vial in a view: interactions push a velocity impulse,
// an underdamped spring integrates a tilt angle that overshoots and settles, and
// an ever-advancing clock feeds the ambient ripple so the surface stays alive at
// rest. A single requestAnimationFrame loop notifies all subscribers per frame —
// subscribers update their own SVG imperatively, so there are no React re-renders
// while the liquid moves.

export interface SloshState {
  tilt: number // -1..1, the spring angle (oscillates and decays)
  energy: number // 0..1, overall agitation — scales waves and highlights
  time: number // seconds, monotonic — drives the ambient living ripple
}

// A subscriber may return true while it animates on its own (e.g. a fill-level
// tween) and needs every frame, even though the liquid itself is at rest.
type Subscriber = (state: SloshState) => boolean | void

// Tuned for a lively, fluid swipe slosh: quick response, visible counter-swing, then settles.
const STIFFNESS = 135 // spring constant (higher = snappier, faster wobble)
const DAMPING = 6.2 // friction (lower = more overshoot / counter-swing)
const IMPULSE_GAIN = 6.2 // how hard an impulse of magnitude 1 kicks the spring
const MAX_TILT = 0.85 // clamp so even stacked drag impulses can't overturn it
const MAX_VEL = 9 // ceiling on accumulated velocity (a fast continuous drag)
const MAX_DT = 1 / 30 // clamp long frames so tab-switches don't explode the spring
// At rest only the ambient ripple moves — at most ~1.7 viewBox units per second,
// a few screen pixels. Redrawing it 30 instead of 60 (or 120) times a second
// moves the surface by well under a tenth of a pixel per step: invisible, but it
// halves the SVG repaints that kept the main thread busy while nothing happened.
// Any slosh energy, a subscriber's own animation or a fresh impulse returns to
// every frame at once.
export const REST_ENERGY = 0.004
const REST_FRAME_MS = 1000 / 30 - 6 // slack for rAF timestamps that aren't snapped to vsync

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export interface SpringState {
  angle: number
  vel: number
}

// One step of the underdamped spring (semi-implicit Euler). Pure, so the physics
// character can be unit-tested without a requestAnimationFrame loop.
export function stepSlosh(state: SpringState, dt: number): SpringState {
  const acc = -STIFFNESS * state.angle - DAMPING * state.vel
  const vel = state.vel + acc * dt
  const angle = state.angle + vel * dt
  return { angle, vel }
}

export interface SloshEngine {
  pushImpulse: (velocity: number) => void
  subscribe: (cb: Subscriber) => () => void
  setEnabled: (enabled: boolean) => void
  destroy: () => void
}

export function createSloshEngine(): SloshEngine {
  let angle = 0
  let vel = 0
  let time = 0
  let last = 0
  let raf = 0
  let enabled = true
  let lastNotify = 0
  let busy = false // a subscriber asked for every frame
  const subs = new Set<Subscriber>()

  const snapshot = (): SloshState => ({
    tilt: clamp(angle, -MAX_TILT, MAX_TILT),
    energy: Math.min(1, Math.abs(angle) + Math.abs(vel) * 0.12),
    time,
  })

  const notify = () => {
    const s = snapshot()
    let wantsFrames = false
    subs.forEach(cb => { if (cb(s) === true) wantsFrames = true })
    busy = wantsFrames
  }

  const tick = (ts: number) => {
    raf = 0
    if (!last) last = ts
    const dt = Math.min((ts - last) / 1000, MAX_DT)
    last = ts
    time += dt
    const next = stepSlosh({ angle, vel }, dt)
    angle = next.angle
    vel = next.vel
    const resting = !busy && Math.abs(angle) + Math.abs(vel) * 0.12 < REST_ENERGY
    if (!resting || ts - lastNotify >= REST_FRAME_MS) {
      lastNotify = ts
      notify()
    }
    schedule()
  }

  function schedule() {
    if (raf || !enabled || subs.size === 0 || typeof requestAnimationFrame === 'undefined') return
    raf = requestAnimationFrame(tick)
  }

  const stop = () => {
    if (raf) cancelAnimationFrame(raf)
    raf = 0
    last = 0
    lastNotify = 0
  }

  return {
    pushImpulse(velocity: number) {
      if (!enabled || !Number.isFinite(velocity)) return
      vel = clamp(vel + clamp(velocity, -1, 1) * IMPULSE_GAIN, -MAX_VEL, MAX_VEL)
      schedule()
    },
    subscribe(cb: Subscriber) {
      subs.add(cb)
      if (cb(snapshot()) === true) busy = true
      schedule()
      return () => {
        subs.delete(cb)
        if (subs.size === 0) stop()
      }
    },
    setEnabled(value: boolean) {
      enabled = value
      if (!enabled) {
        stop()
        angle = 0
        vel = 0
        notify()
      } else {
        schedule()
      }
    },
    destroy() {
      stop()
      subs.clear()
    },
  }
}
