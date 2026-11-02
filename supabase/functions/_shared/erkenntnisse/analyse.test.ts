import { describe, expect, it } from 'vitest'
import { analysiere } from './analyse.ts'
import { tagePlus } from './zeit.ts'
import type { Rohdaten } from './typen.ts'

const ZONE = 'Europe/Berlin'
const HEUTE = '2026-11-02'
const START = '2026-09-01' // Berlin: MESZ, UTC+2

const leer: Rohdaten = { health: [], tagebuch: [], effekte: [], essen: [], trainings: [] }

/** Je Gruppe `n` Trainingstage im Abstand von 2 Tagen; Schlaf am Folgetag. Früh = 18 Uhr, spät = 22 Uhr (Ortszeit). */
function schlafRoh(n: number, schlafFrueh: number, schlafSpaet: number): Rohdaten {
  const roh: Rohdaten = { ...leer, health: [], trainings: [] }
  for (let k = 0; k < 2 * n; k++) {
    const frueh = k < n
    const tag = tagePlus(START, 2 * k)
    const utcStunde = frueh ? '16' : '20'
    roh.trainings.push({ startedAt: `${tag}T${utcStunde}:00:00Z`, kind: 'strength', exercises: [] })
    const rauschen = (k % 3) * 5 - 5
    roh.health.push({ day: tagePlus(tag, 1), sleep_min: (frueh ? schlafFrueh : schlafSpaet) + rauschen })
  }
  return roh
}

describe('erkenntnisse: analysiere', () => {
  it('gleiche Daten ergeben gleiche Funde', () => {
    const roh = schlafRoh(12, 470, 420)
    expect(analysiere(roh, ZONE, HEUTE)).toEqual(analysiere(roh, ZONE, HEUTE))
  })

  it('klarer Unterschied mit je 12 Tagen: deutlicher Fund', () => {
    const funde = analysiere(schlafRoh(12, 470, 420), ZONE, HEUTE)
    expect(funde).toHaveLength(1)
    expect(funde[0]).toMatchObject({ id: 'H1', schluessel: 'H1:vor_grenze', datenlage: 'deutlich', richtung: 'neutral' })
    expect(funde[0].werte).toMatchObject({ mittel_a: 470, mittel_b: 420, differenz: 50, n_a: 12, n_b: 12, grenze: 21 })
    expect(funde[0].zeitraum.bis).toBe('2026-11-01')
    expect(funde[0].zeitraum.von).toBe(tagePlus('2026-11-01', -89))
  })

  it('weniger als 12 Tage in einer Gruppe: nur Hinweis', () => {
    const funde = analysiere(schlafRoh(10, 470, 420), ZONE, HEUTE)
    expect(funde).toHaveLength(1)
    expect(funde[0]).toMatchObject({ id: 'H1', datenlage: 'hinweis' })
  })

  it('kein Unterschied: keine Funde', () => {
    expect(analysiere(schlafRoh(12, 450, 450), ZONE, HEUTE)).toEqual([])
    expect(analysiere(leer, ZONE, HEUTE)).toEqual([])
  })

  it('Daten außerhalb der 90 Tage und am heutigen Tag fließen nicht ein', () => {
    const roh = schlafRoh(12, 470, 420)
    roh.trainings.push({ startedAt: '2026-11-02T08:00:00Z', kind: 'strength', exercises: [] })
    roh.health.push({ day: '2026-11-02', sleep_min: 100 }, { day: '2026-05-01', sleep_min: 100 })
    expect(analysiere(roh, ZONE, HEUTE)).toEqual(analysiere(schlafRoh(12, 470, 420), ZONE, HEUTE))
  })

  it('T7 sieht länger zurück als 90 Tage: Serie von 103 Tagen bis gestern gibt Marke 100', () => {
    const roh: Rohdaten = { ...leer, tagebuch: [] }
    for (let i = 103; i >= 1; i--) roh.tagebuch.push({ log_date: tagePlus(HEUTE, -i), energie: null })
    const funde = analysiere(roh, ZONE, HEUTE)
    expect(funde).toHaveLength(1)
    expect(funde[0]).toMatchObject({ id: 'T7', schluessel: `T7:tagebuch:100:${tagePlus(HEUTE, -103)}` })
    expect(funde[0].werte).toEqual({ tage: 100 })
  })

  it('T7: Serie von 370 Tagen trägt ihren echten Beginn im Schlüssel (sonst wanderte er täglich mit dem Fenster)', () => {
    const roh: Rohdaten = { ...leer, tagebuch: [] }
    for (let i = 370; i >= 1; i--) roh.tagebuch.push({ log_date: tagePlus(HEUTE, -i), energie: null })
    const funde = analysiere(roh, ZONE, HEUTE)
    expect(funde).toHaveLength(1)
    expect(funde[0]).toMatchObject({ schluessel: `T7:tagebuch:365:${tagePlus(HEUTE, -370)}`, werte: { tage: 365 } })
  })

  it('T7: Serie von 40 Tagen hat Marke 30 vor 10 Tagen erreicht, kein Fund', () => {
    const roh: Rohdaten = { ...leer, tagebuch: [] }
    for (let i = 40; i >= 1; i--) roh.tagebuch.push({ log_date: tagePlus(HEUTE, -i), energie: null })
    expect(analysiere(roh, ZONE, HEUTE)).toEqual([])
  })

  it('hängt T7 und R4 unverändert an', () => {
    const roh = schlafRoh(12, 470, 420)
    for (let i = 0; i < 8; i++) roh.tagebuch.push({ log_date: tagePlus('2026-10-25', i), energie: null })
    for (const d of ['2026-09-01', '2026-09-08', '2026-09-15']) {
      roh.trainings.push({ startedAt: `${d}T10:00:00Z`, kind: 'strength', exercises: [{ exerciseId: 'bank', sets: [{ weightKg: 100, reps: 1 }] }] })
    }
    roh.trainings.push({ startedAt: '2026-10-30T10:00:00Z', kind: 'strength', exercises: [{ exerciseId: 'bank', sets: [{ weightKg: 105, reps: 1 }] }] })
    const funde = analysiere(roh, ZONE, HEUTE)
    expect(funde.map((f) => f.id)).toEqual(['H1', 'T7', 'R4'])
    expect(funde[1].werte).toEqual({ tage: 7 })
    expect(funde[2].werte).toEqual({ kg: 105, vorher: 100 })
  })

  it('R4 vergleicht mit der ganzen Geschichte: eine Einheit vor über 90 Tagen mit höherem Wert verhindert den Rekord', () => {
    // frische Arrays: schlafRoh teilt `leer.tagebuch`, das ein Test davor befüllt
    const roh: Rohdaten = { health: [], tagebuch: [], effekte: [], essen: [], trainings: [] }
    const bank =(d: string, kg: number) => ({ startedAt: `${d}T10:00:00Z`, kind: 'strength', exercises: [{ exerciseId: 'bank', sets: [{ weightKg: kg, reps: 1 }] }] })
    for (const d of ['2026-09-01', '2026-09-08', '2026-09-15']) roh.trainings.push(bank(d, 100))
    roh.trainings.push(bank('2026-10-30', 105))
    expect(analysiere(roh, ZONE, HEUTE).map((f) => f.id)).toEqual(['R4'])
    roh.trainings.unshift(bank('2026-03-01', 110)) // 246 Tage vor heute
    expect(analysiere(roh, ZONE, HEUTE)).toEqual([])
  })

  it('reicht ausgeschlossene Übungen an R4 weiter', () => {
    const roh: Rohdaten = { health: [], tagebuch: [], effekte: [], essen: [], trainings: [] }
    const ex =(d: string, kg: number) => ({ startedAt: `${d}T10:00:00Z`, kind: 'strength', exercises: [{ exerciseId: 'custom:hilfe', sets: [{ weightKg: kg, reps: 5 }] }] })
    for (const d of ['2026-09-01', '2026-09-08', '2026-09-15']) roh.trainings.push(ex(d, 20))
    roh.trainings.push(ex('2026-10-30', 40))
    expect(analysiere(roh, ZONE, HEUTE).map((f) => f.id)).toEqual(['R4'])
    expect(analysiere(roh, ZONE, HEUTE, new Set(['custom:hilfe']))).toEqual([])
  })
})
