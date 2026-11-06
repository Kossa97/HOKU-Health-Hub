import { describe, expect, test } from 'vitest'
import { erstelleQualitaet, STUFEN } from './qualitaet'

/** Eine Sekunde Bilder: `n` Bilder, davon `ruck` mit 40 ms, der Rest mit 8 ms. */
function sekunde(q: ReturnType<typeof erstelleQualitaet>, ruckAnteil: number) {
  const wechsel: number[] = []
  let t = 0, i = 0
  while (t < 1000) {
    const iv = (i % 100) < ruckAnteil * 100 ? 40 : 8
    t += iv; i++
    const neu = q.bild(iv)
    if (neu !== null) wechsel.push(neu)
  }
  return wechsel
}

describe('automatische Qualität', () => {
  test('flüssig bleibt sie auf voller Stufe', () => {
    const q = erstelleQualitaet()
    for (let s = 0; s < 10; s++) sekunde(q, 0)
    expect(q.stufe).toBe(0)
  })

  test('zwei schlechte Sekunden regeln eine Stufe herunter, nicht schon eine', () => {
    const q = erstelleQualitaet()
    expect(sekunde(q, 0.4)).toEqual([])
    expect(sekunde(q, 0.4)).toEqual([1])
    expect(STUFEN[q.stufe].aufloesung).toBeLessThan(1)
  })

  test('tiefer als die letzte Stufe geht es nicht', () => {
    const q = erstelleQualitaet()
    for (let s = 0; s < 20; s++) sekunde(q, 0.5)
    expect(q.stufe).toBe(STUFEN.length - 1)
  })

  test('hinauf erst nach fünf guten Sekunden', () => {
    const q = erstelleQualitaet(2)
    for (let s = 0; s < 4; s++) sekunde(q, 0)
    expect(q.stufe).toBe(2)
    sekunde(q, 0)
    expect(q.stufe).toBe(1)
  })

  test('Pausen zählen nicht als Ruck', () => {
    const q = erstelleQualitaet()
    for (let s = 0; s < 5; s++) { q.bild(2000); sekunde(q, 0) }
    expect(q.stufe).toBe(0)
  })
})
