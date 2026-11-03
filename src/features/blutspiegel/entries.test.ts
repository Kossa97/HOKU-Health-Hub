import { afterEach, describe, expect, it, vi } from 'vitest'
import { FEATURES } from '../../config/features'
import { KOMBI_FARBEN, buildEntryCurve, gruppeZu, loadBlutspiegelEntries, loadEntryHistories, nachProdukt, type ReadyEntry } from './entries'
import { loadDoseHistory } from '../../services/blutspiegelHistory'

vi.mock('../../config/features', () => ({ FEATURES: { planTimelineV2: false } }))

const db = vi.hoisted(() => ({
  tables: [] as string[],
  cycles: [] as Array<Record<string, unknown>>,
  escalations: [] as Array<Record<string, unknown>>,
  normalized: null as Array<Record<string, unknown>> | null,
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      db.tables.push(table)
      const builder: Record<string, unknown> = {}
      builder.select = () => builder
      builder.eq = () => builder
      builder.order = () => builder
      builder.then = (resolve: (v: unknown) => unknown) => Promise.resolve({
        data: table === 'cycles' ? (db.normalized ?? db.cycles) : db.escalations, error: null,
      }).then(resolve)
      return builder
    },
  },
}))

vi.mock('../../services/blutspiegelHistory', async importOriginal => ({
  ...await importOriginal<typeof import('../../services/blutspiegelHistory')>(),
  loadDoseHistory: vi.fn(async () => ({ events: [], interruptedAt: null })),
}))

const NOW = new Date('2026-08-10T12:00:00Z')

function legacyCycle(overrides: Record<string, unknown> = {}, tracking = 'complete') {
  return {
    id: 'cycle-1', stack_item_id: 'stack-1', start_date: '2026-08-01', end_date: null,
    dose: null, unit: null, method: 'Subkutan', frequency: 'Täglich', x_days_interval: null,
    schedule_days: [], intake_time: 'custom', intake_time_custom: null, active: true,
    schedule_history: [{
      effective_from: '2026-08-01', frequency: 'Täglich', x_days_interval: null, schedule_days: [],
      intake_time: 'custom', intake_time_custom: '08:00', dose: 5, unit: 'mg',
    }],
    stack_items: {
      id: 'stack-1', display_name: 'BPC-157', tracking_level: tracking, pk_profile_method: 'Subkutan',
      ingredients: [{
        position: 0, custom_name: null, amount_value: null, amount_unit: null, basis_value: null, basis_unit: null,
        substance_catalog: { canonical_name: 'BPC-157', pk_profile_id: 'pk-1', pk_profiles: {
          name: 'BPC-157', half_life_hours: 4, tmax_hours: 1, bioavailability_sc: 1, iu_per_mg: null, category: 'peptide',
        } },
      }],
    },
    ...overrides,
  }
}

function normalizedCycle(base: Record<string, unknown>) {
  return {
    ...base, active: false, schedule_history: null, started_at: '2026-08-01T00:00:00Z', ended_at: null, pauses: [],
    versions: [{
      id: 'v1', cycle_id: base.id, effective_kind: 'local_date', effective_at: null, effective_local_date: '2026-08-01',
      change_kind: 'initial', frequency: 'Täglich', x_days_interval: null, interval_unit: null, cycle_on_days: null,
      cycle_off_days: null, schedule_days: [], intake_time: 'custom', intake_time_custom: '08:00',
      slot_doses: null, slot_days: null, dose: 5, unit: 'mg', method: 'Subkutan',
    }],
  }
}

afterEach(() => {
  vi.clearAllMocks()
  db.tables = []
  db.cycles = []
  db.escalations = []
  db.normalized = null
  ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = false
})

describe('loadBlutspiegelEntries', () => {
  it('liest normalisierte Zyklen ohne Dosis-Steigerungen', async () => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    db.normalized = [normalizedCycle(legacyCycle({}, 'with_amount'))]
    const entries = await loadBlutspiegelEntries('user-1', NOW)
    expect(entries.map(e => e.kind)).toEqual(['missing'])
    expect(db.tables).not.toContain('dose_escalations')
  })

  it('gibt jeder Zutat eines Kombi-Vials einen eigenen Eintrag mit eigener Umrechnung', async () => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    const base = legacyCycle()
    const ingredient = (base.stack_items as { ingredients: Array<Record<string, any>> }).ingredients[0]
    ;(base.stack_items as { ingredients: unknown[] }).ingredients = [5, 10].map((amount, position) => ({
      ...ingredient, position, amount_value: amount, amount_unit: 'mg', basis_value: 2, basis_unit: 'ml',
      substance_catalog: { canonical_name: `Zutat ${position}`, pk_profile_id: `pk-${position}`, pk_profiles: {
        ...ingredient.substance_catalog.pk_profiles, iu_per_mg: position + 3,
      } },
    }))
    db.normalized = [normalizedCycle(base)]
    const entries = await loadBlutspiegelEntries('user-1', NOW) as ReadyEntry[]
    expect(entries.map(e => [e.key, e.name, e.umrechnung])).toEqual([
      ['cycle-1:pk-0', 'BPC-157 · Zutat 0', { iuPerMg: 3, mgPerMl: 2.5, mgJe: { einheit: 'ml', mg: 2.5 }, anteil: 1 / 3 }],
      ['cycle-1:pk-1', 'BPC-157 · Zutat 1', { iuPerMg: 4, mgPerMl: 5, mgJe: { einheit: 'ml', mg: 5 }, anteil: 2 / 3 }],
    ])
  })

  it('gibt einer Kombi-Zutat ohne umrechenbare Staerke keinen 0-%-Spiegel', async () => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    const base = legacyCycle()
    const ingredient = (base.stack_items as { ingredients: Array<Record<string, any>> }).ingredients[0]
    ;(base.stack_items as { ingredients: unknown[] }).ingredients = [0, 1].map(position => ({
      ...ingredient, position,
      amount_value: position === 0 ? 5 : null, amount_unit: position === 0 ? 'mg' : null, basis_value: 2, basis_unit: 'ml',
      substance_catalog: { canonical_name: `Zutat ${position}`, pk_profile_id: `pk-${position}`, pk_profiles: ingredient.substance_catalog.pk_profiles },
    }))
    const normalized = normalizedCycle(base)
    ;(normalized.versions[0] as Record<string, unknown>).unit = 'ml'
    ;(normalized.versions[0] as Record<string, unknown>).dose = 0.2
    db.normalized = [normalized]
    const entries = await loadBlutspiegelEntries('user-1', NOW)
    expect(entries.map(e => [e.key, e.kind])).toEqual([['cycle-1:pk-0', 'ready'], ['cycle-1:pk-1', 'unsupported']])
  })

  it('rechnet eine Kombi-Kapsel je Wirkstoff ueber dessen Staerke je Kapsel um', async () => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    const base = legacyCycle()
    const ingredient = (base.stack_items as { ingredients: Array<Record<string, any>> }).ingredients[0]
    ;(base.stack_items as { display_name: string }).display_name = 'Focus'
    ;(base.stack_items as { ingredients: unknown[] }).ingredients = [['Koffein', 100], ['L-Theanin', 200]].map(([name, amount], position) => ({
      ...ingredient, position, amount_value: amount, amount_unit: 'mg', basis_value: 1, basis_unit: 'capsule',
      substance_catalog: { canonical_name: name, pk_profile_id: `pk-${position}`, pk_profiles: { ...ingredient.substance_catalog.pk_profiles, category: 'other' } },
    }))
    const normalized = normalizedCycle(base)
    Object.assign(normalized.versions[0] as Record<string, unknown>, { unit: 'capsule', dose: 2, method: 'Oral' })
    ;(base.stack_items as { pk_profile_method: string }).pk_profile_method = 'Oral'
    db.normalized = [normalized]
    const entries = await loadBlutspiegelEntries('user-1', NOW) as ReadyEntry[]
    expect(entries.map(e => [e.kind, e.produkt, e.wirkstoff, e.umrechnung.mgJe, e.accent])).toEqual([
      ['ready', 'Focus', 'Koffein', { einheit: 'capsule', mg: 100 }, KOMBI_FARBEN[0]],
      ['ready', 'Focus', 'L-Theanin', { einheit: 'capsule', mg: 200 }, KOMBI_FARBEN[1]],
    ])
    // Zwei Kapseln: je Wirkstoff die eigene Menge.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-10T12:00:00Z'))
    const events = [{ timestamp: new Date('2026-08-10T08:00:00Z'), dose: 2, unit: 'capsule', status: 'taken' as const }]
    const [koffein, theanin] = entries.map(e => buildEntryCurve(e, { events, interruptedAt: null }))
    vi.useRealTimers()
    expect(koffein.current).toBeGreaterThan(0)
    expect(theanin.current).toBeGreaterThan(0)
  })

  it('zeigt den zweiten Wirkstoff, auch wenn dem ersten die Staerke fehlt', async () => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    const base = legacyCycle()
    const ingredient = (base.stack_items as { ingredients: Array<Record<string, any>> }).ingredients[0]
    ;(base.stack_items as { ingredients: unknown[] }).ingredients = [0, 1].map(position => ({
      ...ingredient, position,
      amount_value: position === 1 ? 5 : null, amount_unit: position === 1 ? 'mg' : null, basis_value: 2, basis_unit: 'ml',
      substance_catalog: { canonical_name: `Zutat ${position}`, pk_profile_id: `pk-${position}`, pk_profiles: ingredient.substance_catalog.pk_profiles },
    }))
    const normalized = normalizedCycle(base)
    Object.assign(normalized.versions[0] as Record<string, unknown>, { unit: 'ml', dose: 0.2 })
    db.normalized = [normalized]
    const entries = await loadBlutspiegelEntries('user-1', NOW)
    expect(entries.map(e => [e.key, e.kind])).toEqual([['cycle-1:pk-0', 'unsupported'], ['cycle-1:pk-1', 'ready']])
  })

  it('meldet ein fehlendes PK-Profil, statt den Eintrag zu verschweigen', async () => {
    const base = legacyCycle()
    ;(base.stack_items as { ingredients: Array<Record<string, any>> }).ingredients[0].substance_catalog = null
    db.cycles = [base]
    const entries = await loadBlutspiegelEntries('user-1', NOW)
    expect(entries).toEqual([expect.objectContaining({ kind: 'unsupported', reason: 'profile', name: 'BPC-157' })])
  })

  it('meldet fehlende Angaben, statt eine Kurve zu versprechen', async () => {
    db.cycles = [legacyCycle({}, 'with_amount')]
    const [entry] = await loadBlutspiegelEntries('user-1', NOW)
    expect(entry).toMatchObject({ kind: 'missing', stackItemId: 'stack-1', name: 'BPC-157' })
    await loadEntryHistories([entry])
    expect(loadDoseHistory).not.toHaveBeenCalled()
  })

  it('nimmt das aktive Plansegment statt unvollstaendiger flacher Felder', async () => {
    db.cycles = [legacyCycle()]
    const entries = await loadBlutspiegelEntries('user-1', NOW)
    expect(entries.map(e => e.kind)).toEqual(['ready'])
    await loadEntryHistories(entries)
    expect(loadDoseHistory).toHaveBeenCalledWith('cycle-1')
  })

  it('rechnet nicht, wenn eine aktive Steigerung eine andere Einheit hat', async () => {
    db.cycles = [legacyCycle({ dose: 5, unit: 'mg', intake_time_custom: '08:00' })]
    db.escalations = [{ cycle_id: 'cycle-1', increase_amount: 500, unit: 'mcg', start_type: 'date', start_date: '2026-08-01', start_after_days: null }]
    const entries = await loadBlutspiegelEntries('user-1', NOW)
    expect(entries.map(e => e.kind)).toEqual(['missing'])
  })
})

describe('buildEntryCurve', () => {
  const entry: ReadyEntry = {
    kind: 'ready', key: 'c:p', cycleId: 'c', stackItemId: 's', name: 'X', profileId: 'p',
    profile: { name: 'X', half_life_hours: 4, tmax_hours: 1, bioavailability_sc: 1, iu_per_mg: null, category: 'peptide' },
    accent: '#00ccf5', umrechnung: {}, nextDoseAt: null,
   produkt: 'X', wirkstoff: 'X', pkProfileMethod: null,
  }

  it('liefert Kurve, Einnahmen und den Peak nach der letzten Einnahme', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-02T20:00:00Z'))
    const events = ['2026-08-01T08:00:00Z', '2026-08-02T08:00:00Z'].map(ts => ({
      timestamp: new Date(ts), dose: 5, unit: 'mg', status: 'taken' as const,
    }))
    const curve = buildEntryCurve(entry, { events, interruptedAt: null })
    vi.useRealTimers()
    expect(curve.intakes).toEqual(events.map(e => e.timestamp.getTime()))
    expect(curve.points.length).toBeGreaterThan(100)
    expect(curve.lastPeak!.ts).toBeGreaterThanOrEqual(events[1].timestamp.getTime())
    // Peak liegt bei tmax nach der Einnahme (15-min-Raster)
    expect(Math.abs(curve.lastPeak!.ts - (events[1].timestamp.getTime() + 3_600_000))).toBeLessThanOrEqual(15 * 60_000)
    expect(curve.current).toBe(curve.points[curve.points.length - 1].level)
  })

  it('bleibt leer ohne bestaetigte Einnahme', () => {
    expect(buildEntryCurve(entry, { events: [], interruptedAt: null }).points).toEqual([])
    expect(buildEntryCurve(entry, undefined).current).toBeNull()
  })
})

describe('nachProdukt / gruppeZu', () => {
  const entry = (cycleId: string, profileId: string): ReadyEntry => ({
    kind: 'ready', key: `${cycleId}:${profileId}`, cycleId, stackItemId: `s-${cycleId}`, name: profileId, produkt: `Produkt ${cycleId}`,
    wirkstoff: profileId, profileId, accent: '#000', umrechnung: {}, pkProfileMethod: null, nextDoseAt: null,
    profile: { name: profileId, half_life_hours: 4, tmax_hours: 1, bioavailability_sc: 1, iu_per_mg: null, category: 'peptide' },
  })

  it('fasst die Wirkstoffe eines Zyklus zu einem Produkt zusammen', () => {
    const gruppen = nachProdukt([entry('a', 'p1'), entry('b', 'p3'), entry('a', 'p2')])
    expect(gruppen.map(g => [g.key, g.name, g.wirkstoffe.map(w => w.profileId)])).toEqual([
      ['a', 'Produkt a', ['p1', 'p2']],
      ['b', 'Produkt b', ['p3']],
    ])
  })

  it('findet das Produkt ueber seine Adresse und alte Wirkstoff-Adressen', () => {
    const gruppen = nachProdukt([entry('a', 'p1'), entry('a', 'p2')])
    expect(gruppeZu(gruppen, 'a')?.wirkstoff.profileId).toBe('p1')
    // Alte Links (eine Detailseite je Wirkstoff) holen genau diesen nach vorn.
    expect(gruppeZu(gruppen, 'a:p2')?.wirkstoff.profileId).toBe('p2')
    expect(gruppeZu(gruppen, 'x')).toBeNull()
  })
})
