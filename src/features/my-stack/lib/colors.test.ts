import { describe, expect, test } from 'vitest'
import { STACK_ITEM_COLORS, getRandomStackItemColor, getStableStackItemColor } from './colors'

describe('stack item colors', () => {
  test('besteht aus unseren eigenen Farben und liest sich als Farbkreis', () => {
    // Fuenf Markenfarben aus index.css stehen unveraendert drin.
    for (const marke of ['#f59e0b', '#10b981', '#00ccf5', '#8b5cf6', '#f43f5e']) {
      expect(STACK_ITEM_COLORS, marke).toContain(marke)
    }
    expect(STACK_ITEM_COLORS).toHaveLength(12)
    expect(new Set(STACK_ITEM_COLORS).size).toBe(12)

    // Nach Farbton sortiert, keine zwei Toene naeher als 20 Grad beieinander:
    // die Palette liest sich als Kreis, und man kann die Farben auseinander
    // halten.
    const toene = STACK_ITEM_COLORS.map(hexFarbton)
    expect(toene).toEqual([...toene].sort((a, b) => a - b))
    for (let i = 1; i < toene.length; i += 1) {
      expect(toene[i] - toene[i - 1], STACK_ITEM_COLORS[i]).toBeGreaterThan(20)
    }
  })

  test('returns a color from the curated palette', () => {
    expect(STACK_ITEM_COLORS).toContain(getRandomStackItemColor(() => 0))
    expect(STACK_ITEM_COLORS).toContain(getRandomStackItemColor(() => 0.999))
  })

  test('uses the supplied random source to pick stable palette entries', () => {
    expect(getRandomStackItemColor(() => 0)).toBe(STACK_ITEM_COLORS[0])
    expect(getRandomStackItemColor(() => 0.5)).toBe(STACK_ITEM_COLORS[Math.floor(STACK_ITEM_COLORS.length * 0.5)])
  })

  test('keeps the ID fallback stable across reloads', () => {
    // Geprueft wird die Eigenschaft, nicht ein Hex-Wert: derselbe Eintrag
    // bekommt immer dieselbe Farbe, und die stammt aus der Palette. Der
    // frueher hier eingetragene Wert band den Test an den Inhalt der Palette
    // — jede Farbaenderung liess ihn umfallen, ohne dass etwas kaputt war.
    const einmal = getStableStackItemColor('stack-item-1')

    expect(getStableStackItemColor('stack-item-1')).toBe(einmal)
    expect(STACK_ITEM_COLORS).toContain(einmal)
    // Verschiedene Eintraege landen nicht alle auf derselben Farbe.
    const streuung = new Set(
      Array.from({ length: 40 }, (_, i) => getStableStackItemColor(`stack-item-${i}`)),
    )
    expect(streuung.size).toBeGreaterThan(4)
  })
})

// Farbton in Grad, damit die Reihenfolge geprueft werden kann statt behauptet.
function hexFarbton(hex: string): number {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (max === min) return 0
  const d = max - min
  const h = max === r
    ? ((g - b) / d + (g < b ? 6 : 0))
    : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return h * 60
}

describe('swatch colors', () => {
  test('sind die zwoelf Systemfarben, und die Vorbelegung kommt aus ihnen', async () => {
    const { SWATCH_COLORS, getRandomSwatchColor } = await import('./colors')
    expect(SWATCH_COLORS).toHaveLength(12)
    expect(new Set(SWATCH_COLORS.map(farbe => farbe.hex)).size).toBe(12)
    const hexe = SWATCH_COLORS.map(farbe => farbe.hex)
    expect(hexe).toContain(getRandomSwatchColor(() => 0))
    expect(hexe).toContain(getRandomSwatchColor(() => 0.999))
  })
})
