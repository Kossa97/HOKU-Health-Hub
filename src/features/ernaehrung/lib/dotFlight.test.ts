import { describe, expect, it } from 'vitest'
import { dotPaths } from './dotFlight'

const from = { x: 100, y: 50, r: 12 }
const to = { x: 260, y: 50, r: 12 }

describe('dotPaths', () => {
  const paths = dotPaths(from, to, 20, 3)

  it('so viele Bahnen wie Punkte, nacheinander gestaffelt', () => {
    expect(paths).toHaveLength(20)
    expect(paths[0].delay).toBe(0)
    expect(paths[19].delay).toBeGreaterThan(paths[1].delay)
  })

  it('Start in der unteren Hälfte der alten Kugel, unsichtbar', () => {
    for (const p of paths) {
      const k = p.keys[0]
      expect(Math.hypot(k.x - from.x, k.y - from.y)).toBeLessThanOrEqual(from.r)
      expect(k.y).toBeGreaterThan(from.y)
      expect(k.opacity).toBe(0)
    }
  })

  it('sinkt erst unter die Kugel, dann von unten in die neue — und geht dort auf', () => {
    for (const p of paths) {
      expect(Math.max(...p.keys.map(k => k.y))).toBeGreaterThan(from.y + from.r)
      const end = p.keys[p.keys.length - 1]
      expect(Math.hypot(end.x - to.x, end.y - to.y)).toBeLessThanOrEqual(to.r)
      expect(end.y).toBeGreaterThanOrEqual(to.y)
      expect(end.opacity).toBe(0)
      expect(p.keys.map(k => k.offset)).toEqual([...p.keys.map(k => k.offset)].sort((a, b) => a - b))
    }
  })

  it('gleicher Startwert, gleiche Wolke', () => {
    expect(dotPaths(from, to, 5, 9)).toEqual(dotPaths(from, to, 5, 9))
  })
})
