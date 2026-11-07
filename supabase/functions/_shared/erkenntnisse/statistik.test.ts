import { describe, expect, it } from 'vitest'
import { benjaminiHochberg, permutationsTest, seed, zufall } from './statistik.ts'

describe('erkenntnisse: Statistik', () => {
  it('seed ist FNV-1a (32 bit) und stabil', () => {
    expect(seed('')).toBe(0x811c9dc5)
    expect(seed('a')).toBe(0xe40c292c)
    expect(seed('H1:vor_grenze2026-11-01')).toBe(seed('H1:vor_grenze2026-11-01'))
    expect(seed('x')).not.toBe(seed('y'))
  })

  it('zufall liefert reproduzierbare Zahlen in [0, 1)', () => {
    const r1 = zufall(42)
    const r2 = zufall(42)
    const folge = Array.from({ length: 20 }, () => r1())
    expect(folge).toEqual(Array.from({ length: 20 }, () => r2()))
    for (const x of folge) {
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(1)
    }
    expect(new Set(folge).size).toBe(20)
  })

  it('Permutationstest: gleiche Gruppen geben ein hohes p, klare Trennung ein kleines', () => {
    expect(permutationsTest([1, 1, 1, 1, 1, 1, 1, 1], [1, 1, 1, 1, 1, 1, 1, 1], 2000, zufall(1))).toBeGreaterThan(0.9)
    expect(permutationsTest(Array(10).fill(480), Array(10).fill(400), 2000, zufall(1))).toBeLessThan(0.01)
  })

  it('Permutationstest ist zweiseitig und hat nie p = 0', () => {
    const a = [5, 6, 7, 8, 9, 10, 11, 12]
    const b = [1, 2, 3, 4, 5, 6, 7, 8]
    const p1 = permutationsTest(a, b, 500, zufall(7))
    const p2 = permutationsTest(b, a, 500, zufall(7))
    expect(p1).toBeCloseTo(p2, 1)
    expect(p1).toBeGreaterThanOrEqual(1 / 501)
  })

  it('Permutationstest ist bei gleichem Seed reproduzierbar', () => {
    const a = [1, 5, 3, 8, 2, 9, 4, 7]
    const b = [4, 6, 6, 9, 3, 8, 7, 9]
    expect(permutationsTest(a, b, 2000, zufall(seed('x')))).toBe(permutationsTest(a, b, 2000, zufall(seed('x'))))
  })

  it('Benjamini-Hochberg: adjustierte q-Werte in Originalreihenfolge', () => {
    expect(benjaminiHochberg([0.01, 0.04, 0.03])).toEqual([0.03, 0.04, 0.04])
    expect(benjaminiHochberg([])).toEqual([])
    expect(benjaminiHochberg([0.5])).toEqual([0.5])
  })

  it('Benjamini-Hochberg: monoton und bei 1 gedeckelt', () => {
    const q = benjaminiHochberg([0.9, 0.8, 0.001])
    expect(q[0]).toBeLessThanOrEqual(1)
    expect(q[2]).toBeCloseTo(0.003, 10)
    expect(q[1]).toBeCloseTo(0.9, 10) // 0.8*3/2 = 1.2, gedeckelt durch 0.9 darüber
  })
})
