import { describe, expect, it } from 'vitest'
import { hoursMinutes, monthYear, shownExerciseName, tileText } from './profileFormat'

const t = (key: string, vars?: Record<string, unknown>) => vars ? `${key}:${JSON.stringify(vars)}` : key

describe('tileText', () => {
  it('deutsche Zahlen mit Komma und echtem Minus', () => {
    expect(tileText('weight', { weight: { v: 81, unit: 'kg', delta: -3.2 } }, t, 'de')).toEqual({
      label: 'profil_feld_weight', value: '81', unit: 'kg', sub: 'profil_seit_start:{"wert":"−3,2 kg"}',
    })
  })

  it('Schlaf als Stunden:Minuten, Umfänge als langer Text', () => {
    expect(tileText('sleep', { sleep: { v: 432, unit: 'min' } }, t, 'de')?.value).toBe('7:12')
    const u = tileText('measurements', { measurements: { unit: 'cm', sites: [{ site: 'waist', v: 84, delta: -5 }, { site: 'upper_arm', v: 37.5 }] } }, t, 'de')
    expect(u).toMatchObject({ value: 'umfang_waist 84 · umfang_upper_arm 37,5', long: true, sub: 'umfang_waist −5 cm' })
  })

  it('ohne Wert null, außer HRV/VO2max (Strich)', () => {
    expect(tileText('age', {}, t, 'de')).toBeNull()
    expect(tileText('hrv', {}, t, 'de')?.value).toBe('–')
  })

  it('Berichte: mit Bewertung Sterne, in der Stufe web nur die Anzahl', () => {
    expect(tileText('reviews', { reviews: { count: 3, avgRating: 4.5 } }, t, 'de')?.value).toBe('★ 4,5')
    expect(tileText('reviews', { reviews: { count: 1240 } }, t, 'de')).toEqual({
      label: 'profil_feld_reviews', value: '1.240', sub: 'profil_berichte_sub',
    })
  })

  it('Bestleistung als halbe Karte: beste Übung mit Wert', () => {
    expect(tileText('e1rm', { e1rm: { unit: 'kg', top: [{ id: 'a', name: 'Kreuzheben', v: 142 }] } }, t, 'de')).toMatchObject({ value: 'Kreuzheben 142', unit: 'kg' })
  })

  it('Übungsnamen in der Sprache des Betrachters, nicht der beim Speichern', () => {
    const fields = {
      e1rm: { unit: 'kg' as const, top: [{ id: 'deadlift_barbell', name: 'Kreuzheben (Langhantel)', v: 142 }] },
      favorite_exercise: { id: 'deadlift_barbell', name: 'Kreuzheben (Langhantel)' },
    }
    expect(tileText('e1rm', fields, t, 'en-US')?.value).toBe('Deadlift (Barbell) 142')
    expect(tileText('favorite_exercise', fields, t, 'en')?.value).toBe('Deadlift (Barbell)')
    expect(tileText('favorite_exercise', fields, t, 'de-DE')?.value).toBe('Kreuzheben (Langhantel)')
  })
})

describe('shownExerciseName', () => {
  it('Katalog-Übung neu aufgelöst, eigene Übung mit gespeichertem Namen', () => {
    expect(shownExerciseName({ id: 'deadlift_barbell', name: 'x' }, 'de')).toBe('Kreuzheben (Langhantel)')
    expect(shownExerciseName({ id: 'deadlift_barbell', name: 'x' }, 'fr')).toBe('Deadlift (Barbell)')
    expect(shownExerciseName({ id: 'custom:0b6d1c2e-1111-4222-8333-444455556666', name: 'Meine Übung' }, 'en')).toBe('Meine Übung')
  })
})

describe('Helfer', () => {
  it('hoursMinutes und monthYear', () => {
    expect(hoursMinutes(65)).toBe('1:05')
    expect(monthYear('2026-03', 'de')).toBe('März 2026')
    expect(monthYear('2026-03', 'en')).toBe('March 2026')
  })
})
