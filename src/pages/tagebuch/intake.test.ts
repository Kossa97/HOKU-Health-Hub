import { describe, expect, it } from 'vitest'
import { de } from 'date-fns/locale'
import { groupByDay, intakeDay, intakeDose, intakeGap, intakeTime, intakeWhen } from './intake'

const t = (key: string, options?: Record<string, unknown>) => `${key}:${options?.n}`

describe('Tagebuch – Bezug zur Einnahme', () => {
  it('Abstand in Minuten, Stunden, ab 72 h in Tagen', () => {
    expect(intakeGap('2026-09-01T08:00:00Z', '2026-09-01T08:45:00Z', t)).toBe('tagebuch_abstand_min:45')
    expect(intakeGap('2026-09-01T08:00:00Z', '2026-09-01T10:20:00Z', t)).toBe('tagebuch_abstand_h:2')
    expect(intakeGap('2026-09-01T08:00:00Z', '2026-09-03T23:00:00Z', t)).toBe('tagebuch_abstand_h:63')
    expect(intakeGap('2026-09-01T08:00:00Z', '2026-09-05T08:00:00Z', t)).toBe('tagebuch_abstand_tage:4')
  })

  it('kein Abstand, wenn der Eintrag vor der Einnahme liegt', () => {
    expect(intakeGap('2026-09-01T08:00:00Z', '2026-09-01T07:00:00Z', t)).toBeNull()
  })

  it('Einnahme in derselben Minute: Abstand 0', () => {
    expect(intakeGap('2026-09-01T08:00:40Z', '2026-09-01T08:00:00Z', t)).toBe('tagebuch_abstand_min:0')
  })

  it('Menge mit Einheit, ohne Menge leer', () => {
    expect(intakeDose({ dose: 250, unit: 'mcg' }, 'de')).toBe('250 mcg')
    expect(intakeDose({ dose: 0.25, unit: 'mg' }, 'de')).toBe('0,25 mg')
    expect(intakeDose({ dose: null, unit: null }, 'de')).toBe('')
  })
})

describe('Tagebuch – Beschriftung einer Einnahme', () => {
  const t = (key: string, options?: Record<string, unknown>) => `${key}:${String(options?.zeit)}`
  // Lokale Zeiten: der Test laeuft in der Zeitzone der Maschine.
  const local = (y: number, m: number, d: number, h: number, min = 0) => new Date(y, m - 1, d, h, min).toISOString()

  it('am Tag des Plans: Tag und echte Uhrzeit, ohne Zusatz', () => {
    const option = { logged_at: local(2026, 10, 30, 21, 15), routine_slot_key: 'c@2026-10-30T20:00' }
    expect(intakeDay(option, de)).toBe('Fr. 30.10.')
    expect(intakeTime(option, de, t)).toBe('21:15')
    expect(intakeWhen({ logged_at: local(2026, 10, 30, 20), routine_slot_key: null }, de, t)).toBe('Fr. 30.10. 20:00')
  })

  it('nach Mitternacht bestaetigt: steht am Plantag mit geplanter Zeit, dazu wann genommen', () => {
    const option = { logged_at: local(2026, 10, 31, 4), routine_slot_key: 'c@2026-10-30T20:00' }
    expect(intakeDay(option, de)).toBe('Fr. 30.10.')
    expect(intakeTime(option, de, t)).toBe('20:00 · tagebuch_einnahme_erst:Sa. 04:00')
    expect(intakeWhen(option, de, t)).toBe('Fr. 30.10. 20:00 · tagebuch_einnahme_erst:Sa. 04:00')
  })

  it('gruppiert nach Tag in der gegebenen Reihenfolge', () => {
    const groups = groupByDay([
      { id: 'a', logged_at: local(2026, 10, 31, 4), routine_slot_key: 'c@2026-10-30T20:00' },
      { id: 'b', logged_at: local(2026, 10, 30, 8), routine_slot_key: null },
      { id: 'c', logged_at: local(2026, 10, 29, 20), routine_slot_key: null },
    ], de)
    expect(groups.map(g => [g.tag, g.options.map(o => o.id)])).toEqual([['Fr. 30.10.', ['a', 'b']], ['Do. 29.10.', ['c']]])
  })
})
