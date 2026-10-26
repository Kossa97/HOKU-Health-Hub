import { describe, expect, it } from 'vitest'
import type { SubstanceCatalogEntry } from '../types'
import { initialWizardState, wizardReducer } from './wizardState'
import { anlageAktionen, liesAnlagen, tageszeitVon, type DotAnlage } from './dotAnlage'

const bpc: SubstanceCatalogEntry = {
  id: 'bpc-157', canonical_name: 'BPC-157', aliases: ['Body Protection Compound 157'], default_category: 'peptide',
  suggested_units: ['mcg', 'mg'], suggested_dosage_forms: [], pk_profile_id: null, active: true,
}
const anlage = (o: Partial<DotAnlage> = {}): DotAnlage => ({
  name: 'BPC-157', form: null, menge: null, einheit: null, zeiten: [], rhythmus: null, wochentage: [], alleNTage: null, ...o,
})
const anwenden = (a: DotAnlage) => anlageAktionen(a, [bpc]).reduce(wizardReducer, initialWizardState())

describe('Dot legt eine Substanz an', () => {
  it('„leg BPC-157 an, Vial, 250 mcg morgens": Katalog, Form, Menge, Einheit, Zeitpunkt', () => {
    const s = anwenden(anlage({ form: 'vial', menge: 250, einheit: 'mcg', zeiten: [{ tageszeit: 'morning', uhrzeit: null }], rhythmus: 'taeglich' }))
    expect(s.draft.catalogEntryId).toBe('bpc-157')
    expect(s.draft.dosageForm).toBe('vial')
    expect(s.draft.plan.unit).toBe('mcg')
    expect(s.draft.plan.rhythm.kind).toBe('daily')
    expect(s.draft.plan.slots).toEqual([{ routineGroup: 'morning', time: null, dose: 250, weekdays: [] }])
  })

  it('nur, was gesagt wurde: ohne Menge und Zeit bleibt der Plan, wie er ist', () => {
    const leer = initialWizardState()
    const s = anwenden(anlage())
    expect(s.draft.catalogEntryId).toBe('bpc-157')
    expect(s.draft.plan.slots).toEqual(leer.draft.plan.slots)
    expect(s.draft.plan.unit).toBe(leer.draft.plan.unit)
  })

  it('Uhrzeiten und Wochentage: jeder Zeitpunkt an jedem genannten Tag', () => {
    const s = anwenden(anlage({ menge: 2, einheit: 'mg', zeiten: [{ tageszeit: null, uhrzeit: '07:30' }, { tageszeit: null, uhrzeit: '19:00' }], rhythmus: 'wochentage', wochentage: ['Mo', 'Do'] }))
    expect(s.draft.plan.rhythm).toMatchObject({ kind: 'weekdays', weekdays: ['Mo', 'Do'] })
    expect(s.draft.plan.slots.map(x => `${x.weekdays.join('')} ${x.time} ${x.routineGroup} ${x.dose}`)).toEqual([
      'Mo 07:30 morning 2', 'Mo 19:00 evening 2', 'Do 07:30 morning 2', 'Do 19:00 evening 2',
    ])
  })

  it('alle 3 Tage; eigene Substanz, wenn der Katalog sie nicht kennt', () => {
    const s = anwenden(anlage({ name: 'Mein Tee', rhythmus: 'alle_n_tage', alleNTage: 3, menge: 1, einheit: 'Tasse' }))
    expect(s.draft.catalogEntryId).toBeNull()
    expect(s.draft.displayName).toBe('Mein Tee')
    expect(s.draft.plan.rhythm).toMatchObject({ kind: 'interval', intervalValue: 3 })
  })

  it('Tageszeit einer Uhrzeit und das Lesen der Serverantwort', () => {
    expect([tageszeitVon('06:00'), tageszeitVon('12:30'), tageszeitVon('21:00')]).toEqual(['morning', 'midday', 'evening'])
    expect(liesAnlagen([{ name: 'BPC-157', menge: 250, zeiten: [{ tageszeit: 'morning', uhrzeit: null }, { kaputt: 1 }] }, { name: '' }, 'x'])).toEqual([
      anlage({ menge: 250, zeiten: [{ tageszeit: 'morning', uhrzeit: null }] }),
    ])
  })
})
