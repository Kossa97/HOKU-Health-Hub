import { describe, expect, it } from 'vitest'
import { REICHWEITE, hokuSchein } from './hokuLicht'

const karte = { left: 100, top: 100, width: 200, height: 100 }

describe('hokuSchein', () => {
  it('zeigt zu Hoku: über der Karte 0°, rechts 90°, darunter 180°', () => {
    expect(hokuSchein(karte, { x: 200, y: 40 }).angle).toBeCloseTo(0)
    expect(hokuSchein(karte, { x: 380, y: 150 }).angle).toBeCloseTo(90)
    expect(hokuSchein(karte, { x: 200, y: 260 }).angle).toBeCloseTo(180)
  })

  it('ist an der Kante am hellsten und weit weg aus', () => {
    expect(hokuSchein(karte, { x: 200, y: 100 }).intensity).toBe(1)
    expect(hokuSchein(karte, { x: 200, y: 100 - REICHWEITE - 1 }).intensity).toBe(0)
    const halb = hokuSchein(karte, { x: 200, y: 100 - REICHWEITE / 2 }).intensity
    expect(halb).toBeCloseTo(0.25)
  })

  it('reicht nah um die ganze Kante, weit weg nur schmal', () => {
    expect(hokuSchein(karte, { x: 200, y: 100 }).spread).toBe(180)
    expect(hokuSchein(karte, { x: 200, y: -500 }).spread).toBe(60)
  })

  it('setzt den Lichtpunkt in Prozent der Karte, begrenzt auf die Fläche', () => {
    expect(hokuSchein(karte, { x: 150, y: 125 })).toMatchObject({ x: 25, y: 25 })
    expect(hokuSchein(karte, { x: 0, y: 400 })).toMatchObject({ x: 0, y: 100 })
  })
})
