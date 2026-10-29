import { describe, expect, it } from 'vitest'
import { edgeLight } from './flashlight'

const viewport = { width: 390, height: 844 }
const card = (top: number) => ({ left: 16, top, width: 358, height: 120 })

describe('Taschenlampen-Kante', () => {
  const light = { x: 195, y: 354 }

  it('glänzt an der Oberkante, wenn die Karte unter dem Licht liegt', () => {
    const edge = edgeLight(card(600), light, viewport)
    expect(edge.angle).toBeCloseTo(0, 0)
    expect(edge.glow.y).toBe(0)
  })

  it('glänzt an der Unterkante, wenn die Karte über dem Licht liegt', () => {
    expect(edgeLight(card(40), light, viewport).angle).toBeCloseTo(180, 0)
  })

  it('leuchtet rundum und leiser, wenn das Licht über der Karte steht', () => {
    const darunter = edgeLight(card(300), light, viewport)
    const weitWeg = edgeLight(card(700), light, viewport)
    expect(darunter.spread).toBeGreaterThan(weitWeg.spread)
    expect(darunter.intensity).toBeLessThan(weitWeg.intensity)
  })

  it('wandert seitlich, wenn das Licht seitlich steht', () => {
    const edge = edgeLight({ left: 16, top: 600, width: 160, height: 120 }, { x: 380, y: 660 }, viewport)
    expect(edge.angle).toBeGreaterThan(60)
    expect(edge.angle).toBeLessThan(120)
  })
})
