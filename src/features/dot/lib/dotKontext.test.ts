import { describe, expect, it } from 'vitest'
import type { ResolvedTimelineIntake } from '../../../lib/intakeSchedule'
import type { CycleTimeline } from '../../../lib/planTimeline'
import { einnahmenAusPlaenen, heuteOffen, type DotKontext } from './dotKontext'

const k = (jetzt: string): DotKontext => ({
  heute: '2026-10-22', jetzt, zeitzone: 'Europe/Berlin', stack: [], blutwerte: [], ernaehrung: null,
  einnahmen: [
    { datum: '2026-10-21', zeit: '08:00', minuten: 480, substanz: 'A', menge: null, status: 'offen' },
    { datum: '2026-10-22', zeit: '08:00', minuten: 480, substanz: 'D3', menge: null, status: 'genommen' },
    { datum: '2026-10-22', zeit: '12:00', minuten: 720, substanz: 'Mg', menge: null, status: 'offen' },
    { datum: '2026-10-22', zeit: '18:00', minuten: 1080, substanz: 'BPC-157', menge: '250 mcg', status: 'offen' },
  ],
})

describe('Dot: was heute offen ist', () => {
  it('nächste offene ab jetzt und letzte verpasste, nur heute', () => {
    const h = heuteOffen(k('14:30'))
    expect(h.geplant).toBe(3)
    expect(h.offen).toBe(2)
    expect(h.naechste?.substanz).toBe('BPC-157')
    expect(h.verpasst?.substanz).toBe('Mg')
  })
  it('rechnet mit der aktuellen Uhrzeit statt der beim Laden', () => {
    const h = heuteOffen(k('09:00'), '19:00')
    expect(h.naechste).toBeNull()
    expect(h.verpasst?.substanz).toBe('BPC-157')
  })
  it('morgens ist nichts verpasst', () => {
    const h = heuteOffen(k('09:00'))
    expect(h.naechste?.substanz).toBe('Mg')
    expect(h.verpasst).toBeNull()
  })
})

describe('Dot: Verweise für Meldungen per Satz', () => {
  it('jede Einnahme bekommt einen kurzen Verweis, der auf ihren Platz zeigt', () => {
    const timeline: CycleTimeline = {
      cycle: { id: 'c1', stack_item_id: 'item', started_at: '2026-10-01T00:00:00Z', ended_at: null },
      versions: [{
        id: 'v1', cycle_id: 'c1', effective_kind: 'local_date', effective_at: null, effective_local_date: '2026-10-01', change_kind: 'initial',
        frequency: 'Täglich', x_days_interval: null, interval_unit: null, cycle_on_days: null, cycle_off_days: null, schedule_days: [],
        intake_time: 'morgens', intake_time_custom: '08:00', slot_doses: null, slot_days: null, dose: 2, unit: 'mg', method: 'Subkutan',
      }],
      pauses: [],
    }
    const slots = new Map<string, ResolvedTimelineIntake>()
    const e = einnahmenAusPlaenen([timeline], [], new Map([['item', 'Tesa']]), '2026-10-24', 'Europe/Berlin', 2, slots)
    expect(e.map(x => x.ref)).toEqual(['e1', 'e2'])
    expect(slots.get('e2')?.routineSlotKey).toBe('c1@2026-10-24T08:00')
  })
})
