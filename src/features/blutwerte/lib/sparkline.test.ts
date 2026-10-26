import { describe, expect, it } from 'vitest'
import { buildMarkerSummaries } from './bloodwork'
import { changeSincePrevious, markerStatus, sparklineGeometry } from './sparkline'
import type { BloodworkEntry } from '../types'

function eintrag(tested_at: string, value: number, felder: Partial<BloodworkEntry> = {}): BloodworkEntry {
  return {
    id: tested_at, user_id: 'u', tested_at, marker: 'Kortisol', value, unit: 'µg/dL', notes: null,
    report_id: null, ref_min: 5, ref_max: 25, created_at: tested_at, ...felder,
  } as BloodworkEntry
}

const kortisol = (entries: BloodworkEntry[]) => buildMarkerSummaries(entries).find(s => s.name === 'Kortisol')!

describe('sparklineGeometry', () => {
  it('zeichnet chronologisch und nimmt die Grenzen in die Skala', () => {
    const s = kortisol([eintrag('2026-09-01', 10), eintrag('2026-09-15', 30)])
    const g = sparklineGeometry(s, 100, 40, 0)
    // aelterer Wert links, neuerer rechts
    expect(g.line.startsWith('M0,')).toBe(true)
    expect(g.last!.x).toBe(100)
    // 30 ist der Hoechstwert → oben; die Grenze 25 liegt darunter, 5 ganz unten
    expect(g.last!.y).toBe(0)
    expect(g.bounds).toHaveLength(2)
    expect(Math.max(...g.bounds)).toBe(40)
  })

  it('setzt die Messungen nach Datum, nicht in gleichen Abstaenden', () => {
    const s = kortisol([eintrag('2024-01-01', 10), eintrag('2026-09-01', 12), eintrag('2026-09-08', 14)])
    const xs = [...sparklineGeometry(s, 100, 40, 0).line.matchAll(/[ML]([\d.]+),/g)].map(m => Number(m[1]))
    expect(xs[0]).toBe(0)
    expect(xs[2]).toBe(100)
    // die beiden juengsten liegen eine Woche auseinander — fast am selben Ort
    expect(xs[2] - xs[1]).toBeLessThan(2)
  })

  it('zeigt einen einzelnen Wert als Punkt ohne Linie', () => {
    const g = sparklineGeometry(kortisol([eintrag('2026-09-15', 14)]), 100, 40)
    expect(g.line).toBe('')
    expect(g.last).toEqual({ x: 50, y: expect.any(Number) })
  })

  it('kommt ohne Referenzbereich und mit gleichen Werten aus', () => {
    const custom = buildMarkerSummaries(['2026-09-01', '2026-09-02'].map(d => eintrag(d, 7, { marker: 'Mein Wert', ref_min: null, ref_max: null })))
      .find(x => x.name === 'Mein Wert')!
    const g = sparklineGeometry(custom, 100, 40)
    expect(g.bounds).toEqual([])
    expect(g.line).not.toContain('NaN')
  })
})

describe('Status und Veraenderung', () => {
  it('unterscheidet im Bereich, auffaellig, ungeprueft und ohne Wert', () => {
    expect(markerStatus(kortisol([eintrag('2026-09-15', 14)]))).toBe('in')
    expect(markerStatus(kortisol([eintrag('2026-09-15', 30)]))).toBe('out')
    expect(markerStatus(kortisol([]))).toBe('none')
    const custom = buildMarkerSummaries([eintrag('2026-09-15', 3, { marker: 'Mein Wert', ref_min: null, ref_max: null })])
      .find(x => x.name === 'Mein Wert')!
    expect(markerStatus(custom)).toBe('unchecked')
  })

  it('gibt die Veraenderung zur vorigen Messung, ohne vorige Messung keine', () => {
    expect(changeSincePrevious(kortisol([eintrag('2026-09-01', 10), eintrag('2026-09-15', 13)]))).toBe(3)
    expect(changeSincePrevious(kortisol([eintrag('2026-09-15', 13)]))).toBeNull()
  })
})
