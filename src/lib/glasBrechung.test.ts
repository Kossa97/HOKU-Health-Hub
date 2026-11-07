import { describe, expect, it } from 'vitest'
import { brechungsPixel } from './glasBrechung'

describe('brechungsPixel', () => {
  const k = brechungsPixel(100, 40, 20, 6)
  const px = (d: Uint8ClampedArray, x: number, y: number) => d[(y * k.spalten + x) * 4]
  const alpha = (d: Uint8ClampedArray, x: number, y: number) => d[(y * k.spalten + x) * 4 + 3]

  it('lässt die Mitte unberührt', () => {
    expect(Math.abs(px(k.quer, 50, 20) - 128)).toBeLessThanOrEqual(1)
    expect(Math.abs(px(k.hoch, 50, 20) - 128)).toBeLessThanOrEqual(1)
    expect(alpha(k.bereich, 50, 20)).toBeLessThan(40)
  })

  it('zieht an der Kante Inhalt von weiter innen heran', () => {
    // rechts: kleiner als 128 = holt von links (innen); links umgekehrt
    expect(px(k.quer, 97, 20)).toBeLessThan(110)
    expect(px(k.quer, 2, 20)).toBeGreaterThan(146)
    // oben holt von unten, unten von oben
    expect(px(k.hoch, 50, 1)).toBeGreaterThan(146)
    expect(px(k.hoch, 50, 38)).toBeLessThan(110)
    expect(alpha(k.bereich, 97, 20)).toBeGreaterThan(200)
  })

  it('außerhalb der Kapsel neutral', () => {
    expect(px(k.quer, 0, 0)).toBe(128)
    expect(alpha(k.bereich, 0, 0)).toBe(0)
  })
})
