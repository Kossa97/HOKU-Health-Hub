import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { createSloshEngine, stepSlosh, type SpringState } from './sloshEngine'

const source = () => readFileSync(new URL('./sloshEngine.ts', import.meta.url), 'utf8')

describe('stepSlosh spring', () => {
  test('an impulse velocity moves the tilt angle in that direction', () => {
    expect(stepSlosh({ angle: 0, vel: 9 }, 1 / 60).angle).toBeGreaterThan(0)
  })

  test('the spring restores toward rest, opposing displacement', () => {
    expect(stepSlosh({ angle: 0.5, vel: 0 }, 1 / 60).vel).toBeLessThan(0)
  })

  test('overshoots past zero before settling (underdamped counter-swing)', () => {
    let s: SpringState = { angle: 0, vel: 9 }
    let peaked = false
    let counterSwing = false
    for (let i = 0; i < 600; i++) {
      s = stepSlosh(s, 1 / 60)
      if (s.angle > 0.1) peaked = true
      if (peaked && s.angle < -0.02) counterSwing = true
    }
    expect(peaked).toBe(true)
    expect(counterSwing).toBe(true)
  })

  test('energy decays to rest over time', () => {
    let s: SpringState = { angle: 0, vel: 9 }
    for (let i = 0; i < 1200; i++) s = stepSlosh(s, 1 / 60)
    expect(Math.abs(s.angle)).toBeLessThan(0.01)
    expect(Math.abs(s.vel)).toBeLessThan(0.05)
  })
})

describe('createSloshEngine', () => {
  test('notifies a new subscriber with the resting state immediately', () => {
    const engine = createSloshEngine()
    let state: unknown = null
    const unsub = engine.subscribe(s => { state = s })
    expect(state).toEqual({ tilt: 0, energy: 0, time: 0 })
    unsub()
    engine.destroy()
  })

  test('ignores non-finite impulses without throwing', () => {
    const engine = createSloshEngine()
    expect(() => engine.pushImpulse(Number.NaN)).not.toThrow()
    expect(() => engine.pushImpulse(Number.POSITIVE_INFINITY)).not.toThrow()
    engine.destroy()
  })

  test('setEnabled(false) snaps the liquid back to rest', () => {
    const engine = createSloshEngine()
    const states: Array<{ tilt: number; energy: number; time: number }> = []
    engine.subscribe(s => { states.push(s) })
    engine.pushImpulse(1)
    engine.setEnabled(false)
    expect(states[states.length - 1]).toEqual({ tilt: 0, energy: 0, time: 0 })
    engine.destroy()
  })
  test('keeps scroll impulses responsive and fluid for carousel swipes', () => {
    const text = source()

    expect(text).toContain('const STIFFNESS = 135')
    expect(text).toContain('const DAMPING = 6.2')
    expect(text).toContain('const IMPULSE_GAIN = 6.2')
  })
})

describe('rest throttling', () => {
  type Frame = (ts: number) => void
  function withFakeFrames(run: (step: (ms: number) => void) => void) {
    const g = globalThis as unknown as { requestAnimationFrame?: unknown; cancelAnimationFrame?: unknown }
    const prevRaf = g.requestAnimationFrame
    const prevCancel = g.cancelAnimationFrame
    let queued: Frame | null = null
    let now = 0
    g.requestAnimationFrame = (cb: Frame) => { queued = cb; return 1 }
    g.cancelAnimationFrame = () => { queued = null }
    try {
      run((ms: number) => {
        now += ms
        const cb = queued
        queued = null
        cb?.(now)
      })
    } finally {
      g.requestAnimationFrame = prevRaf
      g.cancelAnimationFrame = prevCancel
    }
  }

  test('at rest the ripple is redrawn about 30 times a second, not every frame', () => {
    withFakeFrames(step => {
      const engine = createSloshEngine()
      let calls = 0
      engine.subscribe(() => { calls++ })
      calls = 0
      for (let i = 0; i < 60; i++) step(1000 / 60)
      expect(calls).toBeGreaterThanOrEqual(28)
      expect(calls).toBeLessThanOrEqual(32)
      engine.destroy()
    })
  })

  test('an impulse redraws every frame while the liquid sloshes', () => {
    withFakeFrames(step => {
      const engine = createSloshEngine()
      let calls = 0
      engine.subscribe(() => { calls++ })
      engine.pushImpulse(1)
      calls = 0
      for (let i = 0; i < 30; i++) step(1000 / 60)
      expect(calls).toBe(30)
      engine.destroy()
    })
  })

  test('a subscriber that animates on its own keeps every frame', () => {
    withFakeFrames(step => {
      const engine = createSloshEngine()
      let calls = 0
      engine.subscribe(() => { calls++; return true })
      calls = 0
      for (let i = 0; i < 30; i++) step(1000 / 60)
      expect(calls).toBe(30)
      engine.destroy()
    })
  })
})
