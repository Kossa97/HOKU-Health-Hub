import { describe, expect, it } from 'vitest'
import { lokaleStunde, lokalerTag, tagePlus, tageZwischen, wochentag } from './zeit.ts'
import { baueTage } from './tage.ts'
import type { Rohdaten } from './typen.ts'

const leer: Rohdaten = { health: [], tagebuch: [], effekte: [], essen: [], trainings: [] }

describe('erkenntnisse: Zeit', () => {
  it('rechnet UTC in den lokalen Tag und die lokale Stunde um', () => {
    expect(lokalerTag('2026-10-31T23:30:00Z', 'Europe/Berlin')).toBe('2026-11-01')
    expect(lokaleStunde('2026-10-31T21:30:00Z', 'Europe/Berlin')).toBe(22)
  })

  it('kennt Mitternacht als Stunde 0 und die Zeitumstellung', () => {
    expect(lokaleStunde('2026-10-31T23:00:00Z', 'Europe/Berlin')).toBe(0)
    // 2026-10-25: Sommerzeit endet. 21:30Z am 24. ist noch 23:30 MESZ, 22:30Z am 25. ist 23:30 MEZ
    expect(lokaleStunde('2026-10-24T21:30:00Z', 'Europe/Berlin')).toBe(23)
    expect(lokalerTag('2026-10-25T22:30:00Z', 'Europe/Berlin')).toBe('2026-10-25')
    expect(lokalerTag('2026-10-25T23:30:00Z', 'Europe/Berlin')).toBe('2026-10-26')
  })

  it('hängt nicht an der Prozesszeitzone', () => {
    expect(lokalerTag('2026-11-01T02:00:00Z', 'America/Los_Angeles')).toBe('2026-10-31')
  })

  it('zählt Kalendertage', () => {
    expect(tagePlus('2026-10-31', 1)).toBe('2026-11-01')
    expect(tagePlus('2026-03-01', -1)).toBe('2026-02-28')
    expect(tageZwischen('2026-10-30', '2026-11-01')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01'])
    expect(tageZwischen('2026-10-24', '2026-10-26')).toEqual(['2026-10-24', '2026-10-25', '2026-10-26'])
    expect(tageZwischen('2026-11-02', '2026-11-01')).toEqual([])
  })

  it('liefert den Wochentag mit 0 = Sonntag', () => {
    expect(wochentag('2026-11-01')).toBe(0)
    expect(wochentag('2026-11-02')).toBe(1)
  })
})

describe('erkenntnisse: Tage bilden', () => {
  it('lässt Lücken null und zählt Schnelleinträge nicht als Proteinangabe', () => {
    const t = baueTage({ ...leer, health: [{ day: '2026-11-01', sleep_min: 420 }],
      essen: [{ log_date: '2026-10-31', protein_g: 30, source: 'bls' }, { log_date: '2026-10-31', protein_g: 0, source: 'quick' }, { log_date: '2026-11-01', protein_g: 0, source: 'quick' }],
      trainings: [{ startedAt: '2026-10-31T21:30:00Z', kind: 'strength', exercises: [] }] }, 'Europe/Berlin', '2026-10-31', '2026-11-01')
    expect(t[0]).toEqual({ datum: '2026-10-31', schlafMin: null, energie: null, proteinG: 30, trainingsStunden: [22], tagebuch: false })
    expect(t[1].schlafMin).toBe(420)
    expect(t[1].proteinG).toBeNull()
  })

  it('rechnet einen Effekt um 00:30 Berliner Zeit zum neuen Tag', () => {
    expect(baueTage({ ...leer, effekte: [{ occurred_at: '2026-10-31T23:30:00Z' }] }, 'Europe/Berlin', '2026-11-01', '2026-11-01')[0].tagebuch).toBe(true)
  })

  it('übernimmt Energie aus dem Tagebuch, summiert Protein und ignoriert Einträge außerhalb', () => {
    const t = baueTage({ ...leer,
      tagebuch: [{ log_date: '2026-11-01', energie: 7 }, { log_date: '2026-11-05', energie: 3 }],
      essen: [{ log_date: '2026-11-01', protein_g: 20, source: 'bls' }, { log_date: '2026-11-01', protein_g: 15.5, source: 'manual' }] },
    'Europe/Berlin', '2026-10-31', '2026-11-01')
    expect(t.map((x) => x.datum)).toEqual(['2026-10-31', '2026-11-01'])
    expect(t[1]).toEqual({ datum: '2026-11-01', schlafMin: null, energie: 7, proteinG: 35.5, trainingsStunden: [], tagebuch: true })
    expect(t[0].tagebuch).toBe(false)
  })

  it('liefert Trainingsstunden je Einheit aufsteigend', () => {
    const t = baueTage({ ...leer, trainings: [
      { startedAt: '2026-11-01T17:00:00Z', kind: 'strength', exercises: [] },
      { startedAt: '2026-11-01T06:00:00Z', kind: 'cardio', exercises: [] },
    ] }, 'Europe/Berlin', '2026-11-01', '2026-11-01')
    expect(t[0].trainingsStunden).toEqual([7, 18])
  })
})
