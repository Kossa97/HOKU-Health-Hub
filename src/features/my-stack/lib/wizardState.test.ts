import { afterEach, describe, expect, it, vi } from 'vitest'
import { bestandteileAufloesen } from './kombination'
import { naechsterSlot } from './wizardState'
import { emptyRhythm } from './intakeRhythm'
import type { IntakePlanDraft, StackItem, StackItemIngredient, SubstanceCatalogEntry } from '../types'
import type { PlanScheduleSnapshot } from '../../../lib/planTimeline'
import {
  canContinue,
  changeKindFor,
  didIdentityChange,
  firstInvalidField,
  initialWizardState,
  wizardSteps,
  wizardReducer,
} from './wizardState'

const vitaminD3: SubstanceCatalogEntry = {
  id: 'vitamin-d3',
  canonical_name: 'Vitamin D3',
  aliases: ['Cholecalciferol'],
  default_category: 'vitamin',
  suggested_units: ['IU', 'mcg'],
  suggested_dosage_forms: ['capsule', 'drops'],
  pk_profile_id: null,
  active: true,
}

const vitaminK2: SubstanceCatalogEntry = {
  id: 'vitamin-k2',
  canonical_name: 'Vitamin K2',
  aliases: ['Menachinon'],
  default_category: 'vitamin',
  suggested_units: ['mcg', 'mg'],
  suggested_dosage_forms: ['capsule', 'drops'],
  pk_profile_id: null,
  active: true,
}

const d3k2: SubstanceCatalogEntry = {
  id: 'd3-k2',
  canonical_name: 'Vitamin D3 + K2',
  aliases: ['D3K2'],
  default_category: 'vitamin',
  suggested_units: ['IU', 'mcg'],
  suggested_dosage_forms: ['capsule', 'drops'],
  pk_profile_id: null,
  active: true,
  component_names: ['Vitamin D3', 'Vitamin K2'],
}

const existingVitaminD: StackItem = {
  id: 'stack-1',
  user_id: 'user-1',
  display_name: 'Vitamin D3',
  category: 'vitamin',
  dosage_form: 'capsule',
  brand: 'Example Brand',
  color_hex: '#abcdef',
  notes: 'With breakfast',
  configuration_status: 'complete',
  tracking_level: 'complete',
  pk_profile_method: null,
  archived: false,
  archived_at: null,
  created_at: '2026-07-21T10:00:00.000Z',
  updated_at: '2026-07-21T10:00:00.000Z',
  ingredients: [{
    id: 'ingredient-1',
    stack_item_id: 'stack-1',
    catalog_substance_id: 'vitamin-d3',
    custom_name: '',
    amount_value: 5000,
    amount_unit: 'IU',
    basis_value: 1,
    basis_unit: 'capsule',
    position: 0,
  }],
}

const activePlan: IntakePlanDraft = {
  id: 'cycle-1',
  name: 'Vitamin D breakfast',
  unit: 'IU',
  method: 'Oral',
  rhythm: { ...emptyRhythm(), kind: 'weekdays', weekdays: ['Mo', 'Di', 'Mi', 'Do', 'Fr'] },
  startDate: '2025-01-01',
  endDate: '2026-12-31',
  slots: [{ routineGroup: 'morning', time: '08:30', dose: 5000, weekdays: [] }],
  reminders: ['on_time'],
}

afterEach(() => vi.useRealTimers())

describe('wizard state', () => {
  it('opens a canonical powder vial with its saved solvent volume for editing', () => {
    const item = {
      ...existingVitaminD, category: 'peptide' as const, dosage_form: 'vial' as const,
      ingredients: [{ ...existingVitaminD.ingredients[0], amount_value: 10, amount_unit: 'mg', basis_value: 2, basis_unit: 'vial' }],
      inventory: { enabled: true, package_quantity: 2, package_unit: 'vial', remaining_quantity: 1.95, batch_number: null, expires_at: null, reconstitution_ml: 2 },
    }
    expect(initialWizardState(item).draft.ingredients[0]).toMatchObject({ amount_value: 5, amount_unit: 'mg', basis_value: 2, basis_unit: 'ml' })
    expect(item.ingredients[0]).toMatchObject({ amount_value: 10, basis_value: 2, basis_unit: 'vial' })
    const initial = initialWizardState(item)
    expect(didIdentityChange(item, { ...initial.draft, notes: 'New note' })).toBe(false)
    const changedSolvent = wizardReducer(initial, { type: 'inventory_changed', changes: { reconstitutionMl: 3 } })
    expect(changedSolvent.draft.ingredients[0].basis_value).toBe(3)
    const changedStrength = wizardReducer(initial, { type: 'ingredient_changed', index: 0, changes: { basis_value: 4 } })
    expect(changedStrength.draft.inventory.reconstitutionMl).toBe(4)
  })

  it('keeps canonical powder strength editable without a known solvent volume', () => {
    const item = { ...existingVitaminD, category: 'peptide' as const, dosage_form: 'vial' as const,
      ingredients: [{ ...existingVitaminD.ingredients[0], amount_value: 5, amount_unit: 'mg', basis_value: 1, basis_unit: 'vial' }] }
    const initial = initialWizardState(item)
    expect(initial.draft.ingredients[0]).toMatchObject({ amount_value: 5, basis_value: 1, basis_unit: 'vial' })
    expect(didIdentityChange(item, { ...initial.draft, notes: 'New note' })).toBe(false)
  })

  it('uses the legacy solvent volume to hydrate canonical powder strength', () => {
    const item = { ...existingVitaminD, category: 'peptide' as const, dosage_form: 'vial' as const, reconstitution_ml: 2,
      ingredients: [{ ...existingVitaminD.ingredients[0], amount_value: 5, amount_unit: 'mg', basis_value: 1, basis_unit: 'vial' }] }
    expect(initialWizardState(item).draft.ingredients[0]).toMatchObject({ amount_value: 5, basis_value: 2, basis_unit: 'ml' })
  })

  it('defaults a new plan start/effective date to the local current date', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 16, 12, 0, 0))

    expect(initialWizardState().draft.plan.startDate).toBe('2026-08-16')
    expect(initialWizardState().draft.plan.method).toBe('')
  })

  it('hydrates an active plan for edits but makes its effective date local today', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 16, 12, 0, 0))

    const state = initialWizardState(existingVitaminD, '', activePlan)

    // Ein gespeicherter Plan traegt seine Zeitpunkte womoeglich noch ohne Tag
    // — „an allen". Beim Oeffnen bekommt jeder Tag seinen eigenen, sonst
    // staende dieselbe Karte in jedem Reiter und aenderte sich ueberall auf
    // einmal.
    expect(state.draft.plan).toEqual({
      ...activePlan,
      startDate: '2026-08-16',
      slots: ['Mo', 'Di', 'Mi', 'Do', 'Fr'].map(tag => ({
        routineGroup: 'morning', time: '08:30', dose: 5000, weekdays: [tag],
      })),
    })
    expect(state.draft.plan).not.toBe(activePlan)
  })

  it('hydrates optional generic inventory for an existing stack item', () => {
    const existingWithInventory = {
      ...existingVitaminD,
      inventory: {
        enabled: true,
        package_quantity: 60,
        package_unit: 'capsule',
        remaining_quantity: 42,
        batch_number: 'A-42',
        expires_at: '2027-08-01',
      },
    }

    expect(initialWizardState(existingWithInventory).draft.inventory).toEqual({
      enabled: true,
      packageQuantity: 60,
      packageUnit: 'capsule',
      remainingQuantity: 42,
      brand: '',
      batchNumber: 'A-42',
      expiresAt: '2027-08-01',
      batchSource: '',
      batchFileUrl: null,
      reconstitutionMl: null,
      openedAt: null,
      useWithinDays: null,
    })
  })

  it.each([
    // Vier Seiten; die Zusammensetzung steht immer da (mit Haltbarkeit und
    // „Doch angeben"), die Zutatennamen nur mit Staerke.
    ['intake_only', ['substance', 'strength', 'plan', 'review']],
    ['with_amount', ['substance', 'strength', 'plan', 'review']],
    ['complete', ['substance', 'ingredients', 'strength', 'plan', 'review']],
  ] as const)('builds the %s path', (trackingLevel, expected) => {
    const state = wizardReducer(
      initialWizardState(),
      { type: 'tracking_level_selected', trackingLevel },
    )

    expect(wizardSteps(state)).toEqual(expected)
  })

  it('vergisst Oeffnungsdatum und Haltbarkeit, wenn die neue Form keine kennt', () => {
    const tropfen = wizardReducer(initialWizardState(), { type: 'dosage_form_selected', dosageForm: 'drops' })
    const eingetragen = wizardReducer(tropfen, { type: 'inventory_changed', changes: { openedAt: '2026-10-20', useWithinDays: 30, expiresAt: '2027-01-01' } })
    const kapsel = wizardReducer(eingetragen, { type: 'dosage_form_selected', dosageForm: 'capsule' })
    expect(kapsel.draft.inventory).toMatchObject({ openedAt: null, useWithinDays: null, expiresAt: '2027-01-01' })
    const spray = wizardReducer(eingetragen, { type: 'dosage_form_selected', dosageForm: 'spray' })
    expect(spray.draft.inventory).toMatchObject({ openedAt: '2026-10-20', useWithinDays: 30 })
  })

  it('fragt Form, Farbe und Tracking-Tiefe nicht mehr in eigenen Schritten', () => {
    // Form und Farbe stehen auf der Substanzseite, die Tiefe ergibt sich aus
    // der Zusammensetzung (ueberspringen = mit Menge).
    for (const dosageForm of ['patch', 'vial', 'tube', 'capsule', 'other'] as const) {
      const steps = wizardSteps(wizardReducer(initialWizardState(), { type: 'dosage_form_selected', dosageForm }))
      expect(steps, dosageForm).not.toContain('dosage_form')
      expect(steps, dosageForm).not.toContain('color')
      expect(steps, dosageForm).not.toContain('tracking_level')
    }
  })

  it('laesst den Zutatenschritt weg, wo der Katalog die Namen schon kennt', () => {
    // Der Schritt fragt nur nach NAMEN — die Mengen stehen im Schritt danach,
    // und der zeigt je Zutat eine eigene Karte mit ihrem Namen. Kommt jede
    // Zutat aus dem Katalog, bestaetigt der Schritt nur, was feststeht: seine
    // Pruefung kann gar nicht mehr ausschlagen, denn `validateIngredient`
    // verlangt einen Namen nur ohne Katalog-id.
    const mitZutaten = (ingredients: StackItemIngredient[]) => {
      const initial = initialWizardState()
      return wizardSteps({ ...initial, draft: { ...initial.draft, ingredients } })
    }
    const zutat = (position: number, catalogId: string | null, name = '') => ({
      catalog_substance_id: catalogId,
      custom_name: name,
      amount_value: null, amount_unit: null,
      basis_value: null, basis_unit: null,
      position,
    })

    // Einzelne Substanz und Kombipraeparat aus dem Katalog: kein Schritt.
    expect(mitZutaten([zutat(0, 'vitamin-d3')])).not.toContain('ingredients')
    expect(mitZutaten([zutat(0, 'vitamin-d3'), zutat(1, 'vitamin-k2')])).not.toContain('ingredients')
    // Die Staerke bleibt — dort steht die Frage, die der Katalog nicht
    // beantwortet.
    expect(mitZutaten([zutat(0, 'vitamin-d3')])).toContain('strength')

    // Manuell angelegt: der Schritt ist der einzige Ort, an dem „das ist
    // eigentlich eine Mischung aus zweien" ueberhaupt sagbar ist.
    expect(mitZutaten([zutat(0, null, 'Eigenmischung')])).toContain('ingredients')
    // Ein Kombieintrag, dessen zweiter Bestandteil sich nicht aufloesen liess
    // (`bestandteileAufloesen` laesst ihn benannt, aber ohne id stehen) —
    // damit man ihn geradeziehen kann.
    expect(mitZutaten([zutat(0, 'vitamin-d3'), zutat(1, null, 'Vitamin K2')])).toContain('ingredients')
    // Und solange noch gar nichts gewaehlt ist, bleibt er stehen.
    expect(mitZutaten([])).toContain('ingredients')
  })

  it('haelt die Schrittliste und den aktuellen Schritt beisammen', () => {
    // Faellt ein Schritt weg, waehrend er der aktuelle ist, waere
    // `steps.indexOf(step)` gleich -1 und „Weiter" spraenge an den Anfang
    // zurueck. Die Form wird einen Schritt VOR der Farbe gewaehlt, also darf
    // das nicht passieren — hier festgehalten, damit es so bleibt.
    let state = initialWizardState()
    for (const dosageForm of ['patch', 'vial', 'tube', 'capsule', 'other'] as const) {
      state = wizardReducer(state, { type: 'dosage_form_selected', dosageForm })
      expect(wizardSteps(state), dosageForm).toContain(state.step)
    }
  })

  it('startet neue Entwuerfe auf der tiefsten Stufe und uebernimmt sonst die gespeicherte', () => {
    // Die Tiefe war einmal eine Pflichtwahl ohne Vorgabe — samt offener
    // Schrittzahl, solange sie fehlte. Jetzt steht sie von Anfang an fest,
    // und damit auch die Schrittliste.
    const initial = initialWizardState()
    const trackingStep = { ...initial, step: 'plan' as const }

    expect(initial.draft.trackingLevel).toBe('complete')
    expect(wizardSteps(initial)).toEqual([
      'substance', 'ingredients', 'strength', 'plan', 'review',
    ])

    // Zuruecknehmen bleibt moeglich, und die Schrittliste folgt.
    const flacher = wizardReducer(
      trackingStep,
      { type: 'tracking_level_selected', trackingLevel: 'intake_only' },
    )
    expect(flacher.draft.trackingLevel).toBe('intake_only')
    expect(wizardSteps(flacher)).toEqual([
      'substance', 'strength', 'plan', 'review',
    ])

    // Ein bestehender Eintrag bringt seine eigene Stufe mit.
    expect(initialWizardState(existingVitaminD).draft.trackingLevel)
      .toBe(existingVitaminD.tracking_level)
  })

  it('keeps complete-only details when a lower tracking level hides their steps', () => {
    const initial = initialWizardState(existingVitaminD)
    const completeDraft = {
      ...initial.draft,
      inventory: {
        ...initial.draft.inventory,
        enabled: true,
        packageQuantity: 60,
        packageUnit: 'capsule',
        remainingQuantity: 42,
      },
      pkProfileMethod: 'oral',
    }
    const next = wizardReducer(
      { ...initial, draft: completeDraft },
      { type: 'tracking_level_selected', trackingLevel: 'intake_only' },
    )

    expect(next.draft.trackingLevel).toBe('intake_only')
    expect(next.draft.ingredients).toEqual(completeDraft.ingredients)
    expect(next.draft.brand).toBe('Example Brand')
    expect(next.draft.inventory).toEqual(completeDraft.inventory)
    expect(next.draft.pkProfileMethod).toBe('oral')
    expect(wizardSteps(next)).toEqual([
      'substance', 'strength', 'plan', 'review',
    ])
  })

  it('clears an incompatible capsule plan unit when the dosage form changes to liquid', () => {
    const initial = initialWizardState()
    const capsuleState = {
      ...initial,
      draft: {
        ...initial.draft,
        dosageForm: 'capsule' as const,
        plan: { ...initial.draft.plan, unit: 'capsule' },
      },
    }

    const next = wizardReducer(capsuleState, {
      type: 'dosage_form_selected',
      dosageForm: 'drops',
    })

    // Die alte Einheit passt nicht mehr — und statt einer leeren Zeile steht
    // jetzt die übliche der neuen Form da. Getippt hat der Nutzer sie vorher
    // ohnehin selbst, obwohl der erste Vorschlag fast immer stimmt.
    expect(next.draft.plan.unit).toBe('drop')
  })

  it('preserves a plan unit that remains compatible with the new dosage form', () => {
    const initial = initialWizardState()
    const capsuleState = {
      ...initial,
      draft: {
        ...initial.draft,
        dosageForm: 'capsule' as const,
        plan: { ...initial.draft.plan, unit: 'IU' },
      },
    }

    const next = wizardReducer(capsuleState, {
      type: 'dosage_form_selected',
      dosageForm: 'drops',
    })

    expect(next.draft.plan.unit).toBe('IU')
  })
  it('übernimmt die bisherige Zufallsfarbe nur für neue Einträge', () => {
    expect(initialWizardState(undefined, '#123456').draft.colorHex).toBe('#123456')
    expect(initialWizardState(existingVitaminD, '#123456').draft.colorHex).toBe('#abcdef')
  })


  it('übernimmt beim Katalogtreffer Name, Kategorie und einen Inhaltsstoff', () => {
    const next = wizardReducer(initialWizardState(), { type: 'catalog_selected', entry: vitaminD3 })

    expect(next.draft.displayName).toBe('Vitamin D3')
    expect(next.draft.category).toBe('vitamin')
    expect(next.draft.ingredients).toHaveLength(1)
    expect(next.draft.ingredients[0]).toMatchObject({
      catalog_substance_id: 'vitamin-d3',
      custom_name: '',
      amount_value: null,
      amount_unit: 'IU',
      basis_value: null,
      basis_unit: null,
      position: 0,
    })
  })

  it('legt beim Kombipräparat je Bestandteil eine Zutat an', () => {
    // Der ganze Zweck eines Kombi-Eintrags: „Vitamin D3 + K2" wählen und
    // beide Wirkstoffe stehen da. Die Zeilen tragen die ids der BESTANDTEILE,
    // nicht die des Produkts — nur so hängt jeder an seinem eigenen PK-Profil.
    const next = wizardReducer(initialWizardState(), {
      type: 'catalog_selected',
      entry: d3k2,
      components: bestandteileAufloesen(d3k2, [vitaminD3, vitaminK2, d3k2]),
    })

    expect(next.draft.displayName).toBe('Vitamin D3 + K2')
    expect(next.draft.catalogEntryId).toBe('d3-k2')
    expect(next.draft.ingredients.map(zutat => [
      zutat.catalog_substance_id, zutat.custom_name, zutat.amount_unit, zutat.position,
    ])).toEqual([
      ['vitamin-d3', 'Vitamin D3', 'IU', 0],
      ['vitamin-k2', 'Vitamin K2', 'mcg', 1],
    ])
  })

  it('merkt sich beim Kombipräparat, welcher Eintrag gewählt wurde', () => {
    // Ohne dieses Feld ließe sich das Produkt nicht mehr von seinem ersten
    // Bestandteil unterscheiden: an den Zutaten steht seine id nirgends.
    const gewaehlt = wizardReducer(initialWizardState(), {
      type: 'catalog_selected',
      entry: d3k2,
      components: bestandteileAufloesen(d3k2, [vitaminD3, vitaminK2, d3k2]),
    })

    expect(gewaehlt.draft.ingredients.some(zutat => zutat.catalog_substance_id === 'd3-k2'))
      .toBe(false)
    expect(gewaehlt.draft.catalogEntryId).toBe('d3-k2')
    expect(wizardReducer(gewaehlt, { type: 'catalog_detached' }).draft.catalogEntryId).toBeNull()
  })

  it('lässt ein gelöstes Kombipräparat auf eine freie Zeile zurückfallen', () => {
    // Die Bestandteile stehen zu lassen, während oben der Produktname frei
    // eingetippt wird, hieße: unten Vitamin D3 und K2, oben etwas anderes.
    const gewaehlt = wizardReducer(initialWizardState(), {
      type: 'catalog_selected',
      entry: d3k2,
      components: bestandteileAufloesen(d3k2, [vitaminD3, vitaminK2, d3k2]),
    })
    const geloest = wizardReducer(gewaehlt, { type: 'catalog_detached' })

    expect(geloest.draft.ingredients).toHaveLength(1)
    expect(geloest.draft.ingredients[0].custom_name).toBe('Vitamin D3 + K2')
    expect(geloest.draft.ingredients[0].catalog_substance_id).toBeNull()
  })

  it('lässt selbst hinzugefügte Zutaten beim Lösen stehen', () => {
    // Die Gegenprobe: hier ist die erste Zeile der Eintrag selbst, die zweite
    // hat jemand von Hand angelegt. Sie darf nicht verschwinden.
    const gewaehlt = wizardReducer(initialWizardState(), { type: 'catalog_selected', entry: vitaminD3 })
    const mitZweiter = wizardReducer(gewaehlt, { type: 'ingredient_added' })
    const geloest = wizardReducer(mitZweiter, { type: 'catalog_detached' })

    expect(geloest.draft.ingredients).toHaveLength(2)
    expect(geloest.draft.ingredients[0].catalog_substance_id).toBeNull()
    expect(geloest.draft.ingredients[0].custom_name).toBe('Vitamin D3')
  })

  it('lässt mehrere Einnahmen am Tag unabhängig von der Frequenz zu', () => {
    // Der Fehler im ersten Anlauf: die Tageszahl steckte in der Frequenz.
    // „Wochentage wählen" hatte damit zwingend genau eine Einnahme — Mo/Mi/Fr
    // morgens UND abends war nicht ausdrückbar, obwohl das ein normaler Plan
    // ist. An welchen Tagen und wie oft am Tag sind zwei Fragen.
    const wochentage = wizardReducer(initialWizardState(), {
      type: 'plan_changed',
      changes: { rhythm: { ...emptyRhythm(), kind: 'weekdays', weekdays: ['Mo', 'Mi', 'Fr'] } },
    })
    // Ein Zeitpunkt JE TAG: das ist die Form, in der das Formular ihn zeigt
    // (ein Reiter je Tag) und in der `slot_days` ihn speichert. Drei Tage
    // anzuwaehlen heisst nicht, dreimal von vorn zu tippen — jeder neue Tag
    // uebernimmt das Muster des ersten.
    expect(wochentage.draft.plan.slots).toHaveLength(3)
    expect(wochentage.draft.plan.slots.map(slot => slot.weekdays)).toEqual([['Mo'], ['Mi'], ['Fr']])
    expect(new Set(wochentage.draft.plan.slots.map(slot => slot.routineGroup))).toEqual(new Set(['morning']))

    const zweiMal = wizardReducer(wochentage, {
      type: 'plan_changed',
      changes: { slots: [
        { routineGroup: 'morning', time: '08:00', dose: null, weekdays: [] },
        { routineGroup: 'evening', time: '20:00', dose: null, weekdays: [] },
      ] },
    })

    expect(zweiMal.draft.plan.rhythm.kind).toBe('weekdays')
    expect(zweiMal.draft.plan.rhythm.weekdays).toEqual(['Mo', 'Mi', 'Fr'])
    expect(zweiMal.draft.plan.slots).toHaveLength(2)
  })

  it('gibt einem neu gewählten Tag das Muster des ersten', () => {
    // Drei Tage anzuwählen soll nicht heißen, dreimal von vorn zu tippen.
    const montags = wizardReducer(initialWizardState(), {
      type: 'plan_changed',
      changes: { rhythm: { ...emptyRhythm(), kind: 'weekdays', weekdays: ['Mo'] } },
    })
    const zweiMalMontags = wizardReducer(montags, {
      type: 'plan_changed',
      changes: { slots: [
        { routineGroup: 'morning', time: '08:00', dose: 500, weekdays: ['Mo'] },
        { routineGroup: 'evening', time: '20:00', dose: 250, weekdays: ['Mo'] },
      ] },
    })

    const plusFreitag = wizardReducer(zweiMalMontags, {
      type: 'plan_changed',
      changes: { rhythm: { ...emptyRhythm(), kind: 'weekdays', weekdays: ['Mo', 'Fr'] } },
    })

    expect(plusFreitag.draft.plan.slots).toHaveLength(4)
    expect(plusFreitag.draft.plan.slots.map(slot => (
      `${slot.weekdays.join('')} ${slot.routineGroup} ${slot.time} ${slot.dose}`
    ))).toEqual([
      'Mo morning 08:00 500',
      'Mo evening 20:00 250',
      'Fr morning 08:00 500',
      'Fr evening 20:00 250',
    ])

    // Und ein Tag, der wieder herausfällt, nimmt seine Einnahmen mit.
    const ohneMontag = wizardReducer(plusFreitag, {
      type: 'plan_changed',
      changes: { rhythm: { ...emptyRhythm(), kind: 'weekdays', weekdays: ['Fr'] } },
    })
    expect(ohneMontag.draft.plan.slots.map(slot => slot.weekdays)).toEqual([['Fr'], ['Fr']])
  })

  it('legt die Tage ab, sobald der Rhythmus keine einzelnen mehr kennt', () => {
    // „Täglich" oder „alle 3 Wochen" hat keine Tage, unter denen ein
    // Zeitpunkt liegen könnte — ein „nur montags" käme dort nirgends an.
    const montagsUndFreitags = wizardReducer(initialWizardState(), {
      type: 'plan_changed',
      changes: { rhythm: { ...emptyRhythm(), kind: 'weekdays', weekdays: ['Mo', 'Fr'] } },
    })
    expect(montagsUndFreitags.draft.plan.slots).toHaveLength(2)

    const taeglich = wizardReducer(montagsUndFreitags, {
      type: 'plan_changed',
      changes: { rhythm: emptyRhythm() },
    })

    expect(taeglich.draft.plan.slots.every(slot => slot.weekdays.length === 0)).toBe(true)
  })

  it('sammelt selbst hinzugefügte Zeitpunkte nicht bei der nächsten Planänderung wieder ein', () => {
    // Nur ein Rhythmuswechsel fasst die Zeitpunkte an. Sonst hätte jede
    // Änderung an Methode oder Ende die zweite Einnahme gelöscht.
    const zweiMal = wizardReducer(initialWizardState(), {
      type: 'plan_changed',
      changes: { slots: [
        { routineGroup: 'morning', time: null, dose: null, weekdays: [] },
        { routineGroup: 'evening', time: null, dose: null, weekdays: [] },
      ] },
    })
    const spaeter = wizardReducer(zweiMal, { type: 'plan_changed', changes: { method: 'Oral' } })

    expect(spaeter.draft.plan.slots).toHaveLength(2)
  })

  it('gibt einem weiteren Zeitpunkt die Tageszeit, die noch frei ist', () => {
    // Zweimal „morgens" ist selten gemeint. Sind alle drei belegt, bleibt nur
    // die Wiederholung — dann setzt man die Uhrzeiten von Hand.
    expect(naechsterSlot([]).routineGroup).toBe('morning')
    expect(naechsterSlot([{ routineGroup: 'morning', time: null, dose: null, weekdays: [] }]).routineGroup).toBe('midday')
    expect(naechsterSlot([
      { routineGroup: 'morning', time: null, dose: null, weekdays: [] },
      { routineGroup: 'midday', time: null, dose: null, weekdays: [] },
    ]).routineGroup).toBe('evening')
    expect(naechsterSlot([
      { routineGroup: 'morning', time: null, dose: null, weekdays: [] },
      { routineGroup: 'midday', time: null, dose: null, weekdays: [] },
      { routineGroup: 'evening', time: null, dose: null, weekdays: [] },
    ]).routineGroup).toBe('evening')
  })

  it('lässt den Rhythmuswechsel die Zeitpunkte in Ruhe', () => {
    // An welchen Tagen etwas ansteht, sagt nichts darüber, wie oft am Tag.
    // Von „täglich" auf „alle 3 Wochen" zu wechseln darf die zweite Einnahme
    // nicht kosten.
    const zweiMal = wizardReducer(initialWizardState(), {
      type: 'plan_changed',
      changes: { slots: [
        { routineGroup: 'morning', time: '08:00', dose: 1, weekdays: [] },
        { routineGroup: 'evening', time: '20:00', dose: 2, weekdays: [] },
      ] },
    })
    const alleDreiWochen = wizardReducer(zweiMal, {
      type: 'plan_changed',
      changes: { rhythm: { ...emptyRhythm(), kind: 'interval', intervalValue: 3, intervalUnit: 'week' } },
    })

    expect(alleDreiWochen.draft.plan.slots).toHaveLength(2)
    expect(alleDreiWochen.draft.plan.slots[1].dose).toBe(2)
  })

  it('lässt „Bei Bedarf" genau einen Zeitpunkt — für die Menge', () => {
    // Kein Plan heißt: keine Tageszeit, nach der zu fragen wäre. Eine Menge
    // braucht es trotzdem — 400 mg je Einnahme —, und sie braucht einen Ort.
    const zweiMal = wizardReducer(initialWizardState(), {
      type: 'plan_changed',
      changes: { slots: [
        { routineGroup: 'morning', time: '08:00', dose: 400, weekdays: [] },
        { routineGroup: 'evening', time: '20:00', dose: 400, weekdays: [] },
      ] },
    })
    const beiBedarf = wizardReducer(zweiMal, {
      type: 'plan_changed',
      changes: { rhythm: { ...emptyRhythm(), kind: 'on_demand' } },
    })

    expect(beiBedarf.draft.plan.slots).toHaveLength(1)
    expect(beiBedarf.draft.plan.slots[0].dose).toBe(400)
    expect(canContinue({ ...beiBedarf, step: 'plan' })).toBe(false) // Methode fehlt noch
  })

  it('erlaubt freie Eingabe ohne Katalog-ID', () => {
    const next = wizardReducer(initialWizardState(), { type: 'custom_started', name: 'Eigene Mischung' })

    expect(next.draft.displayName).toBe('Eigene Mischung')
    expect(next.draft.ingredients[0].catalog_substance_id).toBeNull()
    expect(next.draft.ingredients[0].custom_name).toBe('Eigene Mischung')
  })

  it('resets the catalog category when switching to custom input', () => {
    const catalogState = wizardReducer(initialWizardState(), {
      type: 'catalog_selected',
      entry: vitaminD3,
    })
    const next = wizardReducer(catalogState, { type: 'custom_started', name: 'Eigene Mischung' })

    expect(next.draft.category).toBeNull()
    expect(canContinue(next)).toBe(false)
    expect(firstInvalidField(next)).toBe('category')
  })

  it('keeps selected form suggestion when catalog selection replaces ingredients', () => {
    const stateWithDosageForm = wizardReducer(
      wizardReducer(initialWizardState(), { type: 'catalog_selected', entry: vitaminD3 }),
      { type: 'dosage_form_selected', dosageForm: 'capsule' },
    )
    const next = wizardReducer(stateWithDosageForm, { type: 'catalog_selected', entry: vitaminD3 })

    expect(next.draft.dosageForm).toBe('capsule')
    expect(next.draft.ingredients[0].basis_unit).toBe('capsule')
  })

  it('keeps selected form suggestion when custom input replaces ingredients', () => {
    const stateWithDosageForm = wizardReducer(
      wizardReducer(initialWizardState(), { type: 'catalog_selected', entry: vitaminD3 }),
      { type: 'dosage_form_selected', dosageForm: 'capsule' },
    )
    const next = wizardReducer(stateWithDosageForm, {
      type: 'custom_started',
      name: 'Eigene Mischung',
    })

    expect(next.draft.dosageForm).toBe('capsule')
    expect(next.draft.ingredients[0].basis_unit).toBe('capsule')
  })

  it('fügt Mehrfachwirkstoffe hinzu und hält Positionen stabil', () => {
    const stateWithOneIngredient = wizardReducer(initialWizardState(), {
      type: 'catalog_selected',
      entry: vitaminD3,
    })
    const next = wizardReducer(stateWithOneIngredient, { type: 'ingredient_added' })

    expect(next.draft.ingredients.map(row => row.position)).toEqual([0, 1])
  })

  it('uses the selected form suggestion for ingredients added later', () => {
    const stateWithDosageForm = wizardReducer(
      wizardReducer(initialWizardState(), { type: 'catalog_selected', entry: vitaminD3 }),
      { type: 'dosage_form_selected', dosageForm: 'capsule' },
    )
    const next = wizardReducer(stateWithDosageForm, { type: 'ingredient_added' })

    expect(next.draft.ingredients[1].basis_unit).toBe('capsule')
  })

  it('nummeriert Positionen nach dem Entfernen stabil neu', () => {
    const stateWithTwoIngredients = wizardReducer(
      wizardReducer(initialWizardState(), { type: 'catalog_selected', entry: vitaminD3 }),
      { type: 'ingredient_added' },
    )
    const next = wizardReducer(stateWithTwoIngredients, { type: 'ingredient_removed', index: 0 })

    expect(next.draft.ingredients).toHaveLength(1)
    expect(next.draft.ingredients[0].position).toBe(0)
  })

  it('setzt formabhängige Bezugsgrößen nur als editierbaren Vorschlag', () => {
    const stateWithVitaminD = wizardReducer(initialWizardState(), {
      type: 'catalog_selected',
      entry: vitaminD3,
    })
    const withDosageForm = wizardReducer(stateWithVitaminD, {
      type: 'dosage_form_selected',
      dosageForm: 'capsule',
    })
    const next = wizardReducer(withDosageForm, {
      type: 'ingredient_changed',
      index: 0,
      changes: { basis_unit: 'portion' },
    })

    expect(withDosageForm.draft.ingredients[0].basis_unit).toBe('capsule')
    // Die Wirkstoffmenge bleibt leer — sie steht auf der Packung, nicht in
    // der Form. Die PRODUKTMENGE dagegen sagt die Form: eine Kapsel traegt
    // ihre Staerke „pro 1 Kapsel". Wer ein anderes Produkt vor sich hat,
    // aendert die Zahl; vorgeschlagen ist sie trotzdem.
    expect(withDosageForm.draft.ingredients[0].amount_value).toBeNull()
    expect(withDosageForm.draft.ingredients[0].basis_value).toBe(1)
    expect(next.draft.ingredients[0].basis_unit).toBe('portion')
  })

  it.each([
    ['ampoule', 'ampoule'],
    ['vial', 'ml'],
  ] as const)('preserves an existing %s product unit when its already-selected form is clicked again', (dosageForm, basisUnit) => {
    const existing = {
      ...existingVitaminD,
      dosage_form: dosageForm,
      ingredients: [{ ...existingVitaminD.ingredients[0], basis_unit: basisUnit }],
    }

    const next = wizardReducer(initialWizardState(existing), {
      type: 'dosage_form_selected',
      dosageForm,
    })

    expect(next.draft.ingredients[0].basis_unit).toBe(basisUnit)
  })

  it('continues to reset the product unit when the dosage form actually changes', () => {
    const existingAmpoule = {
      ...existingVitaminD,
      dosage_form: 'ampoule' as const,
      ingredients: [{ ...existingVitaminD.ingredients[0], basis_value: 1, basis_unit: 'ampoule' }],
    }

    const next = wizardReducer(initialWizardState(existingAmpoule), {
      type: 'dosage_form_selected',
      dosageForm: 'vial',
    })

    // Die Staerke steht am Ende „pro ml" — aber pro wie vielen, haengt daran,
    // was im Vial liegt. Vitamin D3 ist kein Peptid: das Vial traegt eine
    // fertige Loesung, und „pro 1 ml" ist die Zeile vom Etikett.
    expect(next.draft.ingredients[0].basis_unit).toBe('ml')
    expect(next.draft.ingredients[0].basis_value).toBe(1)
  })

  it('laesst die Loesungsmittelzeile leer, wenn im Vial ein Peptid liegt', () => {
    // Dasselbe Vial, andere Substanz: ein Peptid liegt als Pulver darin und
    // wird aufgeloest. Wie viel Loesungsmittel dazukommt, steht auf keinem
    // Etikett — eine vorbelegte 1 waere eine Behauptung ueber die
    // Rekonstitution.
    const existingPeptid = {
      ...existingVitaminD,
      category: 'peptide' as const,
      dosage_form: 'ampoule' as const,
      ingredients: [{ ...existingVitaminD.ingredients[0], basis_value: 1, basis_unit: 'ampoule' }],
    }

    const next = wizardReducer(initialWizardState(existingPeptid), {
      type: 'dosage_form_selected',
      dosageForm: 'vial',
    })

    expect(next.draft.ingredients[0].basis_unit).toBe('ml')
    expect(next.draft.ingredients[0].basis_value).toBeNull()
  })

  it('deutet dasselbe Vial neu, wenn die Kategorie wechselt', () => {
    // Der Fall aus dem Formular: jemand legt Testosteron Enantat als Vial an.
    // Solange „Peptid" eingestellt ist, fragt der Schritt nach dem
    // Loesungsmittel; sobald „Hormon" dasteht, ist es eine fertige Loesung
    // und die Produktmenge steht auf 1 ml.
    const peptid = wizardReducer(
      wizardReducer(
        wizardReducer(initialWizardState(), { type: 'custom_started', name: 'Testosteron Enantat' }),
        { type: 'category_selected', category: 'peptide' },
      ),
      { type: 'dosage_form_selected', dosageForm: 'vial' },
    )
    expect(peptid.draft.ingredients[0].basis_value).toBeNull()

    const hormon = wizardReducer(peptid, { type: 'category_selected', category: 'hormone' })
    expect(hormon.draft.ingredients[0].basis_value).toBe(1)
    expect(hormon.draft.ingredients[0].basis_unit).toBe('ml')

    // Und zurueck: die Zeile wird wieder frei fuer die Rekonstitution.
    const wiederPeptid = wizardReducer(hormon, { type: 'category_selected', category: 'peptide' })
    expect(wiederPeptid.draft.ingredients[0].basis_value).toBeNull()
  })

  it('unterscheidet Update und neue Variante beim Editieren', () => {
    const editState = initialWizardState(existingVitaminD)

    expect(editState.saveMode).toBe('update')
    expect(wizardReducer(editState, { type: 'save_mode_selected', mode: 'duplicate' }).saveMode)
      .toBe('duplicate')
  })

  it('befüllt beim Editieren alle Entwurfsfelder ohne die Quelle zu teilen', () => {
    const editState = initialWizardState(existingVitaminD)

    expect(editState.draft).toEqual({
      id: 'stack-1',
      displayName: 'Vitamin D3',
      category: 'vitamin',
      trackingLevel: 'complete',
      dosageForm: 'capsule',
      brand: 'Example Brand',
      colorHex: '#abcdef',
      notes: 'With breakfast',
      ingredients: existingVitaminD.ingredients,
      plan: {
        name: 'Vitamin D3',
        // Route und Einheit bringt die Form mit: die Kapsel wird geschluckt.
        // Die Route ist gar kein sichtbares Feld mehr — bliebe sie leer,
        // blockierte der Planschritt lautlos.
        unit: 'capsule',
        method: 'Oral',
        rhythm: emptyRhythm(),
        startDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        endDate: null,
        slots: [{ routineGroup: 'morning', time: null, dose: null, weekdays: [] }],
        reminders: [],
      },
      inventory: {
        enabled: false,
        packageQuantity: null,
        packageUnit: null,
        remainingQuantity: null,
        brand: '',
        batchNumber: '',
        expiresAt: null,
        batchSource: '',
        batchFileUrl: null,
        reconstitutionMl: null,
        openedAt: null,
        useWithinDays: null,
      },
      pkProfileMethod: null,
    })
    expect(editState.draft.ingredients).not.toBe(existingVitaminD.ingredients)
    expect(editState.draft.ingredients[0]).not.toBe(existingVitaminD.ingredients[0])
  })

  it('lässt erst nach einer identifizierbaren Substanz weitergehen', () => {
    const initial = initialWizardState()
    const custom = wizardReducer(initial, { type: 'custom_started', name: 'Eigene Mischung' })

    expect(canContinue(initial)).toBe(false)
    expect(firstInvalidField(initial)).toBe('displayName')
    expect(canContinue(custom)).toBe(false)
    expect(firstInvalidField(custom)).toBe('category')
    // Die Form steht auf derselben Seite — ohne sie geht es nicht weiter.
    const mitKategorie = wizardReducer(custom, { type: 'category_selected', category: 'supplement' })
    expect(firstInvalidField(mitKategorie)).toBe('dosageForm')
    expect(canContinue(wizardReducer(mitKategorie, { type: 'dosage_form_selected', dosageForm: 'capsule' })))
      .toBe(true)
  })

  it('fokussiert bei Mehrfachwirkstoffen die erste unbenannte Zeile', () => {
    const state = wizardReducer(
      wizardReducer(initialWizardState(), { type: 'catalog_selected', entry: vitaminD3 }),
      { type: 'ingredient_added' },
    )
    const ingredientStep = wizardReducer(state, { type: 'step_selected', step: 'ingredients' })

    expect(canContinue(ingredientStep)).toBe(false)
    expect(firstInvalidField(ingredientStep)).toBe('ingredients.1.name')
  })

  it('verwendet die Entwurfsvalidierung für Form und Stärke', () => {
    const catalogState = wizardReducer(initialWizardState(), {
      type: 'catalog_selected',
      entry: vitaminD3,
    })
    const dosageFormStep = wizardReducer(catalogState, {
      type: 'step_selected',
      step: 'substance',
    })
    const withDosageForm = wizardReducer(dosageFormStep, {
      type: 'dosage_form_selected',
      dosageForm: 'capsule',
    })
    const strengthStep = wizardReducer(withDosageForm, { type: 'step_selected', step: 'strength' })
    const complete = wizardReducer(strengthStep, {
      type: 'ingredient_changed',
      index: 0,
      changes: { amount_value: 5000, basis_value: 1 },
    })

    expect(canContinue(dosageFormStep)).toBe(false)
    expect(firstInvalidField(dosageFormStep)).toBe('dosageForm')
    expect(canContinue(withDosageForm)).toBe(true)
    expect(canContinue(strengthStep)).toBe(false)
    expect(firstInvalidField(strengthStep)).toBe('ingredients.0.amountValue')
    expect(canContinue(complete)).toBe(true)
    expect(firstInvalidField(complete)).toBeNull()
  })

  it('validates the rendered plan according to tracking depth', () => {
    const initial = initialWizardState()
    const base = {
      ...initial,
      step: 'plan' as const,
      draft: {
        ...initial.draft,
        displayName: 'Vitamin D3',
        category: 'vitamin' as const,
        dosageForm: 'capsule' as const,
        plan: { ...initial.draft.plan, name: 'Vitamin D3', method: 'Oral' },
        ingredients: [{
          catalog_substance_id: 'vitamin-d3',
          custom_name: '',
          amount_value: null,
          amount_unit: 'IU',
          basis_value: null,
          basis_unit: 'capsule',
          position: 0,
        }],
      },
    }

    expect(firstInvalidField({
      ...base,
      draft: { ...base.draft, trackingLevel: 'intake_only' },
    })).toBeNull()
    expect(firstInvalidField({
      ...base,
      draft: { ...base.draft, trackingLevel: 'with_amount' },
    })).toBe('plan.dose')
  })
})

describe('didIdentityChange', () => {
  it('ignoriert reine Produktdetail- und Metadatenänderungen', () => {
    const draft = initialWizardState(existingVitaminD).draft

    expect(didIdentityChange(existingVitaminD, {
      ...draft,
      displayName: 'Vitamin D3 Premium',
      category: 'supplement',
      brand: 'Another Brand',
      colorHex: '#123456',
      notes: 'Updated notes',
    })).toBe(false)
  })

  it('erkennt Form- und Stärkeänderungen als neue Identität', () => {
    const draft = initialWizardState(existingVitaminD).draft

    expect(didIdentityChange(existingVitaminD, { ...draft, dosageForm: 'drops' })).toBe(true)
    expect(didIdentityChange(existingVitaminD, {
      ...draft,
      ingredients: [{ ...draft.ingredients[0], amount_value: 10000 }],
    })).toBe(true)
  })
})

describe('changeKindFor', () => {
  const plan: PlanScheduleSnapshot = {
    frequency: 'Täglich',
    x_days_interval: null,
    interval_unit: null,
    cycle_on_days: null,
    cycle_off_days: null,
    schedule_days: [],
    intake_time: 'morgens,abends',
    intake_time_custom: '08:00,20:00',
    slot_doses: '250,250',
    slot_days: null,
    dose: 250,
    unit: 'mcg',
    method: 'Subkutan',
  }

  it('keeps the dose-only kind while only amounts change', () => {
    expect(changeKindFor(plan, { ...plan, dose: 500, slot_doses: '500,250' }, 'titration')).toBe('titration')
    expect(changeKindFor(plan, { ...plan, dose: 1, unit: 'mg' }, 'dose')).toBe('dose')
    expect(changeKindFor(plan, plan, 'dose')).toBe('dose')
  })

  it.each([
    ['a moved time', { intake_time_custom: '09:00,20:00' }],
    ['other weekdays', { slot_days: ',Mo|Mi' }],
    ['another rhythm', { frequency: 'Wochentage wählen', schedule_days: ['Mo', 'Di'] }],
    ['an added intake', { intake_time: 'morgens,mittags,abends' }],
    ['another route', { method: 'Oral' }],
  ])('turns %s into a schedule change', (_label, changes) => {
    expect(changeKindFor(plan, { ...plan, ...changes }, 'titration')).toBe('schedule')
  })
})
