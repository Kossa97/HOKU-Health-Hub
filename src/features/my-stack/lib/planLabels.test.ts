import { describe, expect, it } from 'vitest'
import type { CyclePlanVersion } from '../../../lib/planTimeline'
import { nextIntakeLabel, rhythmLabelWithDay, slotCountSuffix } from './planLabels'

const t = (key: string, options?: Record<string, unknown>) => {
  let text = String(options?.defaultValue ?? key)
  for (const [name, value] of Object.entries(options ?? {})) text = text.replace(`{{${name}}}`, String(value))
  return text
}

const version = (felder: Partial<CyclePlanVersion>) => ({
  frequency: 'Täglich', x_days_interval: null, interval_unit: null, schedule_days: [],
  cycle_on_days: null, cycle_off_days: null, intake_time: 'morgens', intake_time_custom: null,
  slot_doses: null, slot_days: null, dose: 1, unit: 'mg',
  ...felder,
}) as CyclePlanVersion

describe('Plan-Beschriftung', () => {
  it('nennt beim Wochenrhythmus den Wochentag der naechsten Einnahme', () => {
    expect(rhythmLabelWithDay(version({ frequency: 'Wöchentlich' }), t, 'de', '2026-10-14')).toBe('Jeden Mittwoch')
    expect(rhythmLabelWithDay(version({ frequency: 'Alle X Tage', x_days_interval: 2, interval_unit: 'week' }), t, 'de', '2026-10-14'))
      .toBe('Alle 2 Wochen am Mittwoch')
    // Monatlich ohne Tag: ein Plan vom 31. faellt im Februar auf den 28.
    expect(rhythmLabelWithDay(version({ frequency: 'Alle X Tage', x_days_interval: 1, interval_unit: 'month' }), t, 'de', '2027-02-28'))
      .toBe('Jeden Monat')
  })

  it('bleibt ohne naechste Einnahme oder bei taeglichem Rhythmus allgemein', () => {
    expect(rhythmLabelWithDay(version({ frequency: 'Wöchentlich' }), t, 'de', null)).toBe('Jede Woche')
    expect(rhythmLabelWithDay(version({}), t, 'de', '2026-10-14')).toBe('Täglich')
  })

  it('nennt die Zahl der Einnahmezeiten nur, wenn es mehrere sind', () => {
    expect(slotCountSuffix(1, t)).toBe('')
    expect(slotCountSuffix(2, t)).toBe(' · 2 Einnahmezeiten')
  })

  it('sagt Heute und Morgen, sonst Wochentag und Datum — das Jahr nur, wenn es ein anderes ist', () => {
    expect(nextIntakeLabel({ localDate: '2026-10-13', time: '08:00' }, '2026-10-13', 'de', t)).toBe('Heute · 08:00')
    expect(nextIntakeLabel({ localDate: '2026-10-14', time: '08:00' }, '2026-10-13', 'de', t)).toBe('Morgen · 08:00')
    expect(nextIntakeLabel({ localDate: '2026-10-21', time: '08:00' }, '2026-10-13', 'de', t)).toBe('Mi., 21.10. · 08:00')
    expect(nextIntakeLabel({ localDate: '2027-01-06', time: '08:00' }, '2026-12-31', 'de', t)).toBe('Mi., 06.01.2027 · 08:00')
  })
})
