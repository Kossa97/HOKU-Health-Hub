import { describe, expect, it } from 'vitest'
import type { IntakeLog } from '../../../lib/intakeSchedule'
import type { CycleTimeline, PlanScheduleSnapshot } from '../../../lib/planTimeline'
import { autoEintraege, autoKarte, brauchtBestand, dotTraegtEin, faelligeAutoEinnahmen, istAutoGetrackt } from './autoTracking'

const plan = (o: Partial<PlanScheduleSnapshot> = {}): PlanScheduleSnapshot => ({
  frequency: 'Täglich', x_days_interval: null, interval_unit: null, cycle_on_days: null, cycle_off_days: null,
  schedule_days: [], intake_time: 'morgens,abends', intake_time_custom: '08:00,20:00', slot_doses: null, slot_days: null,
  dose: 2, unit: 'mg', method: 'Subkutan', ...o,
})
const timeline = (id: string, item: string, o: Partial<PlanScheduleSnapshot> = {}): CycleTimeline => ({
  cycle: { id, stack_item_id: item, started_at: '2026-10-01T00:00:00Z', ended_at: null },
  versions: [{ id: `${id}-v1`, cycle_id: id, effective_kind: 'local_date', effective_at: null, effective_local_date: '2026-10-01', change_kind: 'initial', ...plan(o) }],
  pauses: [],
})
const TZ = 'Europe/Berlin'
// 24.10.2026, 20:45 Berlin (Sommerzeit, UTC+2)
const jetzt = new Date('2026-10-24T18:45:00.000Z')

describe('Dot trägt automatisch ein', () => {
  it('Karte: früheste Quelle gewinnt, Substanz oder Bündel', () => {
    const k = autoKarte(
      [{ id: 'a', auto_log_since: '2026-10-20T10:00:00Z' }, { id: 'b', auto_log_since: null }],
      [{ stack_item_ids: ['a', 'c'], auto_log_since: '2026-10-18T10:00:00Z' }, { stack_item_ids: ['b'], auto_log_since: null }],
    )
    expect([...k.keys()].sort()).toEqual(['a', 'c'])
    expect(k.get('a')).toBe(Date.parse('2026-10-18T10:00:00Z'))
    expect(istAutoGetrackt(k, 'a', '2026-10-18T09:59:00Z')).toBe(false)
    expect(istAutoGetrackt(k, 'a', '2026-10-18T10:00:00Z')).toBe(true)
    expect(istAutoGetrackt(k, 'b', '2026-10-24T10:00:00Z')).toBe(false)
  })

  it('nur nach dem Einschalten, nur wenn Zeit plus Puffer vorbei ist', () => {
    // eingeschaltet am 23.10. um 12:00 Berlin
    const karte = autoKarte([{ id: 'item', auto_log_since: '2026-10-23T10:00:00Z' }], [])
    const faellig = faelligeAutoEinnahmen({ timelines: [timeline('c1', 'item')], logs: [], karte, jetzt, timeZone: TZ })
    // 23.10. 20:00, 24.10. 08:00, 24.10. 20:00 (20:45 ist mehr als 30 min danach); 23.10. 08:00 lag vor dem Einschalten
    expect(faellig.map(i => i.routineSlotKey)).toEqual(['c1@2026-10-23T20:00', 'c1@2026-10-24T08:00', 'c1@2026-10-24T20:00'])
    const kurzDanach = faelligeAutoEinnahmen({ timelines: [timeline('c1', 'item')], logs: [], karte, jetzt: new Date('2026-10-24T18:10:00Z'), timeZone: TZ })
    expect(kurzDanach.map(i => i.routineSlotKey)).not.toContain('c1@2026-10-24T20:00')
  })

  it('Entscheidungen des Nutzers gewinnen; andere Substanzen bleiben unberührt', () => {
    const karte = autoKarte([{ id: 'item', auto_log_since: '2026-10-24T00:00:00Z' }], [])
    const logs: IntakeLog[] = [
      { id: 'l1', stack_item_id: 'item', logged_at: '2026-10-24T06:00:00Z', taken: false, cycle_id: 'c1', routine_slot_key: 'c1@2026-10-24T08:00' },
    ]
    const faellig = faelligeAutoEinnahmen({ timelines: [timeline('c1', 'item'), timeline('c2', 'andere')], logs, karte, jetzt, timeZone: TZ })
    expect(faellig.map(i => i.routineSlotKey)).toEqual(['c1@2026-10-24T20:00'])
  })

  it('wieder geöffneter Eintrag (taken null) gehört dem Nutzer: Dot füllt ihn nicht erneut', () => {
    const karte = autoKarte([{ id: 'item', auto_log_since: '2026-10-24T00:00:00Z' }], [])
    const logs: IntakeLog[] = [
      { id: 'offen', stack_item_id: 'item', logged_at: '2026-10-24T06:00:00Z', taken: null, cycle_id: 'c1', routine_slot_key: 'c1@2026-10-24T08:00' },
    ]
    const faellig = faelligeAutoEinnahmen({ timelines: [timeline('c1', 'item')], logs, karte, jetzt, timeZone: TZ })
    expect(faellig.map(i => i.routineSlotKey)).toEqual(['c1@2026-10-24T20:00'])
  })

  it('Rückschau „Verpasst“ lässt nur aus, was Dot auch eintragen kann', () => {
    const karte = autoKarte([{ id: 'item', auto_log_since: '2026-01-01T00:00:00Z' }], [])
    const pro = { geladen: true, darfRaus: true }
    expect(dotTraegtEin(karte, 'item', '2026-10-23T06:00:00Z', jetzt, pro as never)).toBe(true)
    // ohne Pro, oder älter als 14 Tage: wie immer als verpasst markieren
    expect(dotTraegtEin(karte, 'item', '2026-10-23T06:00:00Z', jetzt, { geladen: true, darfRaus: false } as never)).toBe(false)
    expect(dotTraegtEin(karte, 'item', '2026-10-01T06:00:00Z', jetzt, pro as never)).toBe(false)
    // Zugang noch nicht geladen: nur aufschieben
    expect(dotTraegtEin(karte, 'item', '2026-10-23T06:00:00Z', jetzt, { geladen: false, darfRaus: false } as never)).toBe(true)
    expect(dotTraegtEin(karte, 'andere', '2026-10-23T06:00:00Z', jetzt, pro as never)).toBe(false)
  })

  it('höchstens 14 Tage zurück', () => {
    const karte = autoKarte([{ id: 'item', auto_log_since: '2026-01-01T00:00:00Z' }], [])
    const faellig = faelligeAutoEinnahmen({ timelines: [timeline('c1', 'item')], logs: [], karte, jetzt, timeZone: TZ })
    expect(Date.parse(faellig[0].scheduledAt)).toBeGreaterThanOrEqual(jetzt.getTime() - 14 * 86_400_000)
  })

  it('Einträge wie der Haken: Zeitpunkt = geplant, Menge je Tracking-Stufe', () => {
    const karte = autoKarte([{ id: 'item', auto_log_since: '2026-10-24T00:00:00Z' }, { id: 'nur', auto_log_since: '2026-10-24T00:00:00Z' }], [])
    const faellig = faelligeAutoEinnahmen({ timelines: [timeline('c1', 'item'), timeline('c2', 'nur')], logs: [], karte, jetzt, timeZone: TZ })
    const items = new Map([
      ['item', { id: 'item', display_name: 'Tesa', tracking_level: 'complete', dosage_form: 'vial' }],
      ['nur', { id: 'nur', display_name: 'Vitamin D', tracking_level: 'intake_only', dosage_form: 'tablet' }],
    ])
    const e = autoEintraege(faellig, items)
    const tesa = e.find(x => x.stackItemId === 'item')!
    expect(tesa).toMatchObject({ actualDose: 2, actualUnit: 'mg', selected: true, injectable: true })
    expect(tesa.actualLoggedAt).toBe(tesa.scheduledAt)
    expect(e.find(x => x.stackItemId === 'nur')).toMatchObject({ actualDose: null, actualUnit: null })
    // archiviert/unbekannt: nichts
    expect(autoEintraege(faellig, new Map())).toEqual([])
  })

  it('Bestand nur für Vial mit Menge oder vollständig getrackt, nur bei genommen', () => {
    expect(brauchtBestand({ id: 'a', dosage_form: 'vial', tracking_level: 'with_amount' }, { id: '1', taken: true, dose: 2 })).toBe(true)
    expect(brauchtBestand({ id: 'a', dosage_form: 'tablet', tracking_level: 'complete' }, { id: '1', taken: true, dose: 1 })).toBe(true)
    expect(brauchtBestand({ id: 'a', dosage_form: 'tablet', tracking_level: 'with_amount' }, { id: '1', taken: true, dose: 1 })).toBe(false)
    expect(brauchtBestand({ id: 'a', dosage_form: 'vial', tracking_level: 'complete' }, { id: '1', taken: false, dose: 2 })).toBe(false)
  })
})
