// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AmbientEngine } from './engine'

function card(rect: { top: number; left?: number; width?: number; height?: number }) {
  const el = document.createElement('section')
  const box = { left: 0, width: 360, height: 300, ...rect }
  el.getBoundingClientRect = () => ({
    ...box, right: box.left + box.width, bottom: box.top + box.height, x: box.left, y: box.top, toJSON: () => ({}),
  })
  return { el, move: (top: number) => { box.top = top } }
}

const position = (node: HTMLElement) => {
  const m = /translate3d\(([-\d.]+)px, ([-\d.]+)px/.exec(node.style.transform)
  return m ? { x: Number(m[1]), y: Number(m[2]) } : null
}

describe('AmbientEngine', () => {
  let layer: HTMLDivElement
  let detach: () => void
  let engine: AmbientEngine

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })
    layer = document.createElement('div')
    engine = new AmbientEngine()
  })
  afterEach(() => {
    detach?.()
    vi.useRealTimers()
  })

  it('setzt das Licht an seinen Anker und blendet es auf die gewünschte Stärke ein', () => {
    const { el } = card({ top: 100 })
    engine.register('hero', () => el)
    detach = engine.attach(layer)
    engine.update('hero', { color: '#f59e0b', intensity: 0.6, anchorX: 0.25, anchorY: 0.5, size: 400 })
    vi.advanceTimersByTime(3000)
    const node = layer.querySelector<HTMLElement>('.fg-light')!
    expect(Number(node.style.opacity)).toBeCloseTo(0.6, 1)
    // Mitte des Lichts = Anker: x = 0,25 · 360 = 90, y = 100 + 0,5 · 300 = 250
    expect(position(node)).toEqual({ x: 90 - 200, y: 250 - 200 })
    expect(node.style.backgroundColor).toBe('rgb(245, 158, 11)')
  })

  it('folgt der Karte beim Scrollen mit Verzögerung und verblasst außerhalb des Bildes', () => {
    const { el, move } = card({ top: 100 })
    engine.register('hero', () => el)
    detach = engine.attach(layer)
    engine.update('hero', { color: '#fff', intensity: 0.5, anchorX: 0.5, anchorY: 0.5, size: 400 })
    vi.advanceTimersByTime(3000)
    const node = layer.querySelector<HTMLElement>('.fg-light')!

    move(-200)
    window.dispatchEvent(new Event('scroll'))
    vi.advanceTimersByTime(50)
    const midway = position(node)!.y
    // Noch unterwegs: zwischen alter (50) und neuer Lage (−250)
    expect(midway).toBeLessThan(50)
    expect(midway).toBeGreaterThan(-250)

    move(3000)
    window.dispatchEvent(new Event('scroll'))
    vi.advanceTimersByTime(3000)
    expect(Number(node.style.opacity)).toBeCloseTo(0, 2)
  })

  it('schläft ein, sobald alle Federn ruhen', () => {
    const { el } = card({ top: 100 })
    engine.register('hero', () => el)
    detach = engine.attach(layer)
    engine.update('hero', { color: '#fff', intensity: 0.5, anchorX: 0.5, anchorY: 0.5 })
    vi.advanceTimersByTime(5000)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('entfernt das Licht, wenn die Karte geht', () => {
    const { el } = card({ top: 100 })
    engine.register('hero', () => el)
    detach = engine.attach(layer)
    expect(layer.querySelectorAll('.fg-light')).toHaveLength(1)
    engine.unregister('hero')
    expect(layer.querySelectorAll('.fg-light')).toHaveLength(0)
  })
})
