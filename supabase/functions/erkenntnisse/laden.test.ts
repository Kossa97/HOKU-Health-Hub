import { describe, expect, it } from 'vitest'
import { baueKandidaten, eigeneMitUnterstuetzung, tageMitDaten, zuRohdaten } from './laden.ts'
import type { Fund, Rohdaten } from '../_shared/erkenntnisse/typen.ts'

const leer = { health: [], daily: [], effects: [], food: [], training: [] }
const ZONE = 'Europe/Berlin'

function leerRoh(): Rohdaten {
  return { health: [], tagebuch: [], effekte: [], essen: [], trainings: [] }
}

describe('zuRohdaten', () => {
  it('macht aus kaputten exercises ein leeres Array', () => {
    const roh = zuRohdaten({ ...leer, training: [{ started_at: '2026-10-31T17:00:00Z', kind: 'strength', exercises: 'kaputt' }] })
    expect(roh.trainings[0].exercises).toEqual([])
  })

  it('setzt nicht-numerischen Schlaf auf null', () => {
    expect(zuRohdaten({ ...leer, health: [{ day: '2026-10-31', sleep_min: 'x' }] }).health[0].sleep_min).toBeNull()
    expect(zuRohdaten({ ...leer, health: [{ day: '2026-10-31', sleep_min: Infinity }] }).health[0].sleep_min).toBeNull()
    expect(zuRohdaten({ ...leer, health: [{ day: '2026-10-31', sleep_min: 420 }] }).health[0].sleep_min).toBe(420)
  })

  it('verwirft Zeilen mit unlesbarem Datum', () => {
    const roh = zuRohdaten({
      health: [{ day: 'gestern', sleep_min: 400 }, { day: '2026-10-31T00:00', sleep_min: 400 }, null, 'x'],
      daily: [{ log_date: '31.10.2026', energie: 3 }],
      effects: [{ occurred_at: 'kein datum' }, { occurred_at: null }, { occurred_at: '2026-10-30T20:00:00Z' }],
      food: [{ log_date: 'x', protein_g: 10, source: 'manual' }],
      training: [{ started_at: 'nope', kind: 'run', exercises: [] }, { started_at: '2026-10-30T10:00:00Z', kind: 'run', exercises: [] }],
    })
    expect(roh.health).toEqual([])
    expect(roh.tagebuch).toEqual([])
    expect(roh.effekte).toEqual([{ occurred_at: '2026-10-30T20:00:00Z' }])
    expect(roh.essen).toEqual([])
    expect(roh.trainings).toHaveLength(1)
  })

  it('setzt nicht-endliche Energie auf null und behält die Zeile', () => {
    const roh = zuRohdaten({ ...leer, daily: [{ log_date: '2026-10-31', energie: NaN }, { log_date: '2026-10-30', energie: 4 }] })
    expect(roh.tagebuch).toEqual([{ log_date: '2026-10-31', energie: null }, { log_date: '2026-10-30', energie: 4 }])
  })

  it('verwirft Essen ohne endliche Menge oder ohne source-Text', () => {
    const roh = zuRohdaten({
      ...leer,
      food: [
        { log_date: '2026-10-31', protein_g: 'viel', source: 'manual' },
        { log_date: '2026-10-31', protein_g: null, source: 'manual' },
        { log_date: '2026-10-31', protein_g: 20, source: 5 },
        { log_date: '2026-10-31', protein_g: 0, source: 'manual' },
        { log_date: '2026-10-31', protein_g: 25, source: 'quick' },
      ],
    })
    expect(roh.essen).toEqual([
      { log_date: '2026-10-31', protein_g: 0, source: 'manual' },
      { log_date: '2026-10-31', protein_g: 25, source: 'quick' },
    ])
  })

  it('reduziert Übungen und Sätze auf das, was die Auswertung braucht', () => {
    const roh = zuRohdaten({
      ...leer,
      training: [{
        started_at: '2026-10-31T17:00:00Z',
        kind: 'strength',
        exercises: [
          { exerciseId: 'bench', notes: 'geheim', sets: [{ type: 'normal', weightKg: 80, reps: 5, done: true, rpe: 8 }, { type: 'normal', weightKg: 'x', reps: Infinity }, 7] },
          { exerciseId: 5, sets: [] },
          { exerciseId: 'squat', sets: 'kaputt' },
          null,
          { exerciseId: 'row', sets: [] },
        ],
      }],
    })
    expect(roh.trainings[0].exercises).toEqual([
      { exerciseId: 'bench', sets: [{ type: 'normal', weightKg: 80, reps: 5 }, { type: 'normal', weightKg: null, reps: null }] },
      { exerciseId: 'row', sets: [] },
    ])
  })

  it('verwirft Trainings ohne Art-Text', () => {
    expect(zuRohdaten({ ...leer, training: [{ started_at: '2026-10-30T10:00:00Z', kind: null, exercises: [] }] }).trainings).toEqual([])
  })
})

describe('tageMitDaten', () => {
  const roh: Rohdaten = {
    health: [{ day: '2026-10-26', sleep_min: 400 }, { day: '2026-10-27', sleep_min: null }],
    tagebuch: [{ log_date: '2026-10-28', energie: null }],
    effekte: [{ occurred_at: '2026-10-28T09:00:00Z' }, { occurred_at: '2026-10-30T22:30:00Z' }], // 30.10. 23:30 lokal
    essen: [{ log_date: '2026-10-26', protein_g: 30, source: 'manual' }],
    trainings: [],
  }

  it('zählt Tage mit mindestens einem Datenpunkt', () => {
    expect(tageMitDaten(roh, ZONE, '2026-10-25', '2026-10-31')).toBe(3)
  })

  it('zählt die lokalen Tage, nicht die UTC-Tage', () => {
    const r: Rohdaten = { ...leerRoh(), effekte: [{ occurred_at: '2026-10-30T23:30:00Z' }] } // 31.10. 00:30 lokal
    expect(tageMitDaten(r, ZONE, '2026-10-31', '2026-10-31')).toBe(1)
    expect(tageMitDaten(r, ZONE, '2026-10-30', '2026-10-30')).toBe(0)
  })

  it('zählt einen Tag mit mehreren Einheiten einmal und ignoriert Tage außerhalb', () => {
    const r: Rohdaten = {
      ...leerRoh(),
      trainings: [
        { startedAt: '2026-10-29T10:00:00Z', kind: 'run', exercises: [] },
        { startedAt: '2026-10-29T16:00:00Z', kind: 'run', exercises: [] },
        { startedAt: '2026-10-01T10:00:00Z', kind: 'run', exercises: [] },
      ],
    }
    expect(tageMitDaten(r, ZONE, '2026-10-25', '2026-10-31')).toBe(1)
  })

  it('gibt 0 bei leeren Daten', () => {
    expect(tageMitDaten(leerRoh(), ZONE, '2026-10-25', '2026-10-31')).toBe(0)
  })
})

describe('baueKandidaten', () => {
  const fund = (schluessel: string): Fund => ({
    id: 'H1', schluessel, bezug: null, richtung: 'neutral', datenlage: 'hinweis', staerke: 0.5,
    zeitraum: { von: '2026-10-01', bis: '2026-10-31' }, werte: {},
  })
  const zeile = (id: string, schluessel: string, o: Record<string, unknown> = {}) => ({
    id, schluessel, fund: fund(schluessel), datenlage: 'hinweis', gueltig: true,
    gemeldet_datenlage: null, ausgeblendet_am: null, ...o,
  })

  it('baut Kandidaten aus gespeicherten Zeilen', () => {
    const k = baueKandidaten([
      zeile('a', 'x'),
      zeile('b', 'y', { gueltig: false, ausgeblendet_am: '2026-10-30T00:00:00Z', gemeldet_datenlage: 'hinweis', datenlage: 'deutlich' }),
    ])
    expect(k.map((c) => c.id)).toEqual(['a', 'b'])
    expect(k[0].gespeichert).toEqual({ id: 'a', schluessel: 'x', datenlage: 'hinweis', gueltig: true, gemeldet_datenlage: null, ausgeblendet: false })
    expect(k[1].gespeichert).toMatchObject({ gueltig: false, ausgeblendet: true, gemeldet_datenlage: 'hinweis', datenlage: 'deutlich' })
    expect(k[1].fund.schluessel).toBe('y')
  })

  it('lässt Zeilen mit unbrauchbarem fund oder Datenlage weg', () => {
    const k = baueKandidaten([zeile('a', 'x', { fund: null }), zeile('b', 'y', { datenlage: 'komisch' }), zeile('c', 'z')])
    expect(k.map((c) => c.id)).toEqual(['c'])
  })

  it('übernimmt die Datenlage aus der Spalte in den Fund', () => {
    const k = baueKandidaten([zeile('a', 'x', { datenlage: 'deutlich' })])
    expect(k[0].fund.datenlage).toBe('deutlich')
  })
})

describe('eigeneMitUnterstuetzung', () => {
  it('macht aus eigenen Übungen mit Erfassung assisted_reps die IDs der Sätze (custom:<id>)', () => {
    const ids = eigeneMitUnterstuetzung([
      { id: 'u1', tracking: 'assisted_reps' },
      { id: 'u2', tracking: 'weight_reps' },
      { id: 'u3', tracking: 'assisted_reps' },
      { id: 7, tracking: 'assisted_reps' },
      null,
      'x',
    ])
    expect([...ids].sort()).toEqual(['custom:u1', 'custom:u3'])
  })

  it('ohne Zeilen eine leere Menge', () => {
    expect(eigeneMitUnterstuetzung([]).size).toBe(0)
  })
})
