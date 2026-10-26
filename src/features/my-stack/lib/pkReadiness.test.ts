import { afterEach, describe, expect, it, vi } from 'vitest'
import { FEATURES } from '../../../config/features'
import type { CycleTimeline } from '../../../lib/planTimeline'
vi.mock('../../../config/features', () => ({ FEATURES: { planTimelineV2: false } }))
import { evaluatePkReadiness, mgPerMlFromStrength, pkRouteStatus, resolvePkScheduleForDay, toPkMilligrams } from './pkReadiness'
import type { EscalationRow, ScheduleCycle } from '../../../lib/intakeSchedule'

const readyInput = {
  trackingLevel: 'complete' as const,
  pkProfileId: 'profile-1',
  pkProfileMethod: 'Subkutan',
  method: 'Subkutan',
  dose: 1,
  unit: 'mg',
  scheduledAt: '08:00',
}

describe('normalized PK readiness', () => {
  afterEach(() => { (FEATURES as { planTimelineV2: boolean }).planTimelineV2 = false })
  const timeline: CycleTimeline = {
    cycle: { id: 'c', stack_item_id: 's', started_at: '2026-09-01T00:00:00Z', ended_at: null },
    versions: [{ id: 'v1', cycle_id: 'c', effective_kind: 'local_date', effective_at: null,
      effective_local_date: '2026-09-01', change_kind: 'initial', frequency: 'Täglich',
      x_days_interval: null, interval_unit: null, cycle_on_days: null, cycle_off_days: null,
      schedule_days: [], intake_time: 'custom', intake_time_custom: '08:00', slot_doses: null,
      slot_days: null, dose: 1, unit: 'mg', method: 'Subkutan' }], pauses: [],
  }
  const cycle = { ...timeline.versions[0], id: 'c', stack_item_id: 's', start_date: '2026-09-01', end_date: null,
    dose: 99, unit: 'IU', intake_time: 'custom', intake_time_custom: '22:00', schedule_history: null, timeline }
  it('uses the version effective now, not a future version or legacy fields', () => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    const withFuture = { ...timeline, versions: [...timeline.versions, { ...timeline.versions[0], id: 'v2', effective_local_date: '2026-10-01', dose: 9 }] }
    expect(resolvePkScheduleForDay({ ...cycle as object, timeline: withFuture } as never, [], new Date('2026-09-19T12:00:00Z'))).toMatchObject({ dose: 1, unit: 'mg', method: 'Subkutan' })
  })
  it('returns no current schedule for a planned cycle whose first version is not effective', () => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    const future = { ...timeline, cycle: { ...timeline.cycle, started_at: '2026-10-01T00:00:00Z' },
      versions: [{ ...timeline.versions[0], effective_local_date: '2026-10-01' }] }
    expect(resolvePkScheduleForDay({ ...cycle, timeline: future }, [], new Date('2026-09-19T12:00:00Z'))).toBeNull()
  })
  it('still rejects an active cycle without an effective version', () => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    expect(() => resolvePkScheduleForDay({ ...cycle, timeline: { ...timeline, versions: [] } }, [],
      new Date('2026-09-19T12:00:00Z'))).toThrow('Cycle plan version unavailable')
  })
  it.each(['pause', 'ended', 'prn'])('does not fabricate scheduled readiness for %s', state => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    const value = structuredClone(timeline)
    if (state === 'pause') value.pauses = [{ id: 'p', cycle_id: 'c', paused_at: '2026-09-18T00:00:00Z', ends_at: null }]
    if (state === 'ended') value.cycle.ended_at = '2026-09-18T00:00:00Z'
    if (state === 'prn') value.versions[0].frequency = 'Bei Bedarf'
    expect(resolvePkScheduleForDay({ ...cycle as object, timeline: value } as never, [], new Date('2026-09-19T12:00:00Z'))).toMatchObject({ dose: null, scheduledAt: null })
  })
})

describe('evaluatePkReadiness', () => {
  it('requires complete tracking', () => {
    expect(evaluatePkReadiness({
      ...readyInput,
      trackingLevel: 'with_amount',
    })).toEqual({ status: 'missing', missing: ['complete_tracking'] })
  })

  it('reports every missing requirement alongside incomplete tracking', () => {
    expect(evaluatePkReadiness({
      ...readyInput,
      trackingLevel: 'with_amount',
      pkProfileMethod: null,
      dose: null,
      unit: null,
      scheduledAt: null,
    })).toEqual({
      status: 'missing',
      missing: ['complete_tracking', 'method', 'dose', 'unit', 'time'],
    })
  })

  it('reports unsupported when no profile exists', () => {
    expect(evaluatePkReadiness({
      ...readyInput,
      pkProfileId: null,
    })).toEqual({ status: 'unsupported', reason: 'no_profile' })
  })

  it('reports the exact missing route, dose, unit, and time', () => {
    expect(evaluatePkReadiness({
      ...readyInput,
      pkProfileMethod: null,
      dose: null,
      unit: null,
      scheduledAt: null,
    })).toEqual({
      status: 'missing',
      missing: ['method', 'dose', 'unit', 'time'],
    })
  })

  it('requires the confirmed PK method to match the active plan method', () => {
    expect(evaluatePkReadiness({
      ...readyInput,
      pkProfileMethod: 'Oral',
    })).toEqual({ status: 'missing', missing: ['method'] })
  })

  it('rejects units without an explicit conservative conversion', () => {
    expect(evaluatePkReadiness({ ...readyInput, unit: 'IU' })).toEqual({
      status: 'unsupported',
      reason: 'unit_conversion',
    })
  })

  it('reports ready only when every PK requirement is satisfied', () => {
    expect(evaluatePkReadiness(readyInput)).toEqual({ status: 'ready' })
  })
})

describe('toPkMilligrams', () => {
  it('normalizes mg and mcg without help', () => {
    expect(toPkMilligrams(1, 'mg')).toBe(1)
    expect(toPkMilligrams(1000, 'mcg')).toBe(1)
  })

  it('rechnet IU um, sobald die Substanz ihren Faktor mitbringt', () => {
    // Eine Internationale Einheit ist keine Masse, sondern eine biologische
    // Wirkstaerke — der Faktor haengt an der Substanz. HGH: 3 IU je mg.
    expect(toPkMilligrams(6, 'IU', 3)).toBe(2)
    // HCG: rund 10.000 IU je mg.
    expect(toPkMilligrams(5000, 'IU', 10000)).toBe(0.5)
    expect(toPkMilligrams(5000, 'iu', 10000)).toBe(0.5)
  })

  it('bleibt bei null, solange kein brauchbarer Faktor dasteht', () => {
    // Vor dieser Runde fielen HCG und HGH genau hier durch — mit dem
    // Unterschied, dass es gar keinen Faktor geben konnte.
    expect(toPkMilligrams(5000, 'IU')).toBeNull()
    expect(toPkMilligrams(5000, 'IU', null)).toBeNull()
    expect(toPkMilligrams(5000, 'IU', 0)).toBeNull()
    expect(toPkMilligrams(5000, 'IU', -3)).toBeNull()
    expect(toPkMilligrams(5000, 'IU', Number.NaN)).toBeNull()
  })

  it('laesst einen Faktor Einheiten unberuehrt, die keine IU sind', () => {
    // Der Faktor gilt der Umrechnung von IU. Auf ml oder Kapseln angewendet
    // waere er eine erfundene Masse.
    expect(toPkMilligrams(2, 'ml', 10000)).toBeNull()
    expect(toPkMilligrams(1, 'capsule', 3)).toBeNull()
    expect(toPkMilligrams(1, 'mg', 3)).toBe(1)
  })
})

describe('resolvePkScheduleForDay', () => {
  const cycle: ScheduleCycle & { method: string } = {
    id: 'cycle-1',
    stack_item_id: 'stack-1',
    start_date: '2026-08-01',
    end_date: null,
    frequency: 'Täglich',
    x_days_interval: null,
    schedule_days: [],
    intake_time: 'custom',
    intake_time_custom: '08:00',
    dose: 1,
    unit: 'mg',
    method: 'Subkutan',
    schedule_history: [{
      effective_from: '2026-08-01',
      frequency: 'Täglich',
      x_days_interval: null,
      schedule_days: [],
      intake_time: 'custom',
      intake_time_custom: '08:00',
      dose: 1,
      unit: 'mg',
    }, {
      effective_from: '2026-08-20',
      frequency: 'Wöchentlich',
      x_days_interval: null,
      schedule_days: [],
      intake_time: 'custom',
      intake_time_custom: '09:30',
      dose: 2,
      unit: 'mg',
    }],
  }

  it.each([
    {
      label: 'before a future effective date',
      day: new Date(2026, 7, 19, 12),
      expected: { dose: 1, unit: 'mg', scheduledAt: '08:00', frequency: 'Täglich' },
    },
    {
      label: 'on the future effective date',
      day: new Date(2026, 7, 20, 12),
      expected: { dose: 2, unit: 'mg', scheduledAt: '09:30', frequency: 'Wöchentlich' },
    },
  ])('uses the date-effective segment $label', ({ day, expected }) => {
    expect(resolvePkScheduleForDay(cycle, [], day)).toMatchObject({
      ...expected,
      method: 'Subkutan',
    })
  })

  it('rejects an active escalation whose unit differs from the effective segment', () => {
    const escalations: EscalationRow[] = [{
      cycle_id: cycle.id,
      increase_amount: 500,
      unit: 'mcg',
      start_type: 'date',
      start_date: '2026-08-20',
      start_after_days: null,
    }]

    expect(resolvePkScheduleForDay(cycle, escalations, new Date(2026, 7, 20, 12)))
      .toMatchObject({ dose: null, unit: null, scheduledAt: '09:30', frequency: 'Wöchentlich' })
  })
})


describe('mgPerMlFromStrength — die Konzentration aus der Staerke', () => {
  it('rechnet das aufgeloeste Vial: 5 mg auf 2 ml sind 2,5 mg/ml', () => {
    expect(mgPerMlFromStrength(5, 'mg', 2, 'ml')).toBe(2.5)
  })

  it('rechnet auch in Mikrogramm eingetragene Staerken', () => {
    // 500 mcg auf 1 ml sind 0,5 mg/ml.
    expect(mgPerMlFromStrength(500, 'mcg', 1, 'ml')).toBe(0.5)
  })

  it('schweigt, wo die Produktmenge kein Volumen ist', () => {
    // Eine Kapsel hat keine Konzentration — „mg je Kapsel" ist schon die Menge.
    expect(mgPerMlFromStrength(500, 'mg', 1, 'capsule')).toBeNull()
    expect(mgPerMlFromStrength(5, 'mg', 1, 'vial')).toBeNull()
  })

  it('schweigt bei unvollstaendiger oder unsinniger Staerke', () => {
    expect(mgPerMlFromStrength(null, 'mg', 2, 'ml')).toBeNull()
    expect(mgPerMlFromStrength(5, 'mg', null, 'ml')).toBeNull()
    expect(mgPerMlFromStrength(5, 'mg', 0, 'ml')).toBeNull()
    expect(mgPerMlFromStrength(-5, 'mg', 2, 'ml')).toBeNull()
    // Eine Einheit, die keine Wirkstoffmenge ist, ergibt keine Konzentration.
    expect(mgPerMlFromStrength(5, 'ml', 2, 'ml')).toBeNull()
  })
})

describe('toPkMilligrams — Milliliter', () => {
  it('macht aus aufgezogenem Volumen eine Wirkstoffmenge', () => {
    // So dosiert man ein aufgeloestes Peptid: 5 mg im Vial auf 2 ml Wasser
    // sind 2,5 mg/ml; wer 0,2 ml aufzieht, hat 0,5 mg.
    const konzentration = mgPerMlFromStrength(5, 'mg', 2, 'ml')!
    expect(toPkMilligrams(0.2, 'ml', null, konzentration)).toBeCloseTo(0.5, 10)
  })

  it('gibt jeder Zutat eines Kombi-Vials ihre eigene Menge', () => {
    // 5 mg CJC-1295 ohne DAC UND 5 mg Ipamorelin in denselben 2 ml. Aus
    // denselben 0,2 ml folgt fuer jede ihre eigene Dosis — hier gleich viel,
    // weil beide gleich stark eingewogen sind; bei 5 mg und 10 mg waere es
    // doppelt so viel fuer die zweite.
    const cjc = mgPerMlFromStrength(5, 'mg', 2, 'ml')!
    const ipa = mgPerMlFromStrength(10, 'mg', 2, 'ml')!
    expect(toPkMilligrams(0.2, 'ml', null, cjc)).toBeCloseTo(0.5, 10)
    expect(toPkMilligrams(0.2, 'ml', null, ipa)).toBeCloseTo(1.0, 10)
  })

  it('bleibt ohne Konzentration bei null, statt eine Zahl zu erfinden', () => {
    // Milliliter sind ein Volumen. Ohne zu wissen, was darin geloest ist,
    // gibt es keine Menge — und null heisst „koennen wir nicht umrechnen",
    // nicht „ist null Milligramm".
    expect(toPkMilligrams(0.2, 'ml')).toBeNull()
    expect(toPkMilligrams(0.2, 'ml', null, 0)).toBeNull()
  })

  it('laesst mg, mcg und IU, wie sie waren', () => {
    expect(toPkMilligrams(1, 'mg', null, 2.5)).toBe(1)
    expect(toPkMilligrams(500, 'mcg', null, 2.5)).toBe(0.5)
    expect(toPkMilligrams(3, 'IU', 3, 2.5)).toBe(1)
  })
})

describe('evaluatePkReadiness — in Millilitern geplant', () => {
  it('nimmt einen in ml geplanten Zyklus an, sobald die Konzentration bekannt ist', () => {
    // Vorher fiel genau das durch: „unsupported", und die Karte verschwand
    // wortlos aus dem Karussell — obwohl der Nutzer alles eingetragen hatte.
    const inMl = { ...readyInput, dose: 0.2, unit: 'ml' }
    expect(evaluatePkReadiness(inMl).status).toBe('unsupported')
    expect(evaluatePkReadiness({ ...inMl, mgPerMl: 2.5 }).status).toBe('ready')
  })
})

describe('PK-Route aus dem Profil', () => {
  it('nimmt eine Route, die das Profil nennt, ohne Bestaetigung', () => {
    expect(pkRouteStatus('subkutan ', null, ['Subkutan'])).toBe('covered')
    expect(evaluatePkReadiness({ ...readyInput, pkProfileMethod: null, pkProfileRoutes: ['Intramuskulär', 'Subkutan'] }))
      .toEqual({ status: 'ready' })
  })

  it('zeigt keine Kurve fuer eine Route, die das Profil nicht nennt', () => {
    expect(pkRouteStatus('Oral', null, ['Subkutan'])).toBe('mismatch')
    expect(evaluatePkReadiness({ ...readyInput, pkProfileMethod: null, method: 'Oral', pkProfileRoutes: ['Subkutan'] }))
      .toEqual({ status: 'unsupported', reason: 'route' })
  })

  it('verlangt die Bestaetigung nur, wenn das Profil keine Route nennt', () => {
    expect(pkRouteStatus('Subkutan', null, [])).toBe('unconfirmed')
    expect(evaluatePkReadiness({ ...readyInput, pkProfileMethod: null, pkProfileRoutes: [] }))
      .toEqual({ status: 'missing', missing: ['method'] })
    expect(evaluatePkReadiness({ ...readyInput, pkProfileRoutes: [] })).toEqual({ status: 'ready' })
  })

  it('laesst keine fruehere Bestaetigung gegen die Routen des Profils gelten', () => {
    expect(pkRouteStatus('Oral', 'Oral', ['Subkutan'])).toBe('mismatch')
    expect(evaluatePkReadiness({ ...readyInput, pkProfileMethod: 'Oral', method: 'Oral', pkProfileRoutes: ['Subkutan'] }))
      .toEqual({ status: 'unsupported', reason: 'route' })
  })

  it('braucht eine Route im Plan', () => {
    expect(pkRouteStatus('  ', 'Subkutan', ['Subkutan'])).toBe('no_method')
    expect(evaluatePkReadiness({ ...readyInput, method: null, pkProfileRoutes: ['Subkutan'] }))
      .toEqual({ status: 'missing', missing: ['method'] })
  })
})
