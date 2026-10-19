import { describe, expect, it } from 'vitest'
import type { SubstanceCatalogEntry } from '../types'
import { initialWizardState, wizardReducer, type WizardState } from './wizardState'
import {
  findeKatalogeintrag,
  formAusText,
  parseBarcodeProdukt,
  parseEtikett,
  scanAktionen,
  staerkeAusText,
  vorschlagAusEtikett,
  vorschlagAusProdukt,
  type ScanVorschlag,
} from './substanzScan'

const eintrag = (id: string, name: string, extra: Partial<SubstanceCatalogEntry> = {}): SubstanceCatalogEntry => ({
  id,
  canonical_name: name,
  aliases: [],
  default_category: 'vitamin',
  suggested_units: ['mg'],
  suggested_dosage_forms: [],
  pk_profile_id: null,
  active: true,
  ...extra,
})

const bpc = eintrag('bpc-157', 'BPC-157', { aliases: ['Body Protection Compound 157'], default_category: 'peptide', suggested_units: ['mcg', 'mg'] })
const vitaminD = eintrag('vitamin-d', 'Vitamin D', { suggested_units: ['IU'] })
const vitaminD3 = eintrag('vitamin-d3', 'Vitamin D3', { aliases: ['Cholecalciferol', 'D3'], suggested_units: ['IU', 'mcg'] })
const vitaminK2 = eintrag('vitamin-k2', 'Vitamin K2', { aliases: ['Menachinon'], suggested_units: ['mcg'] })
const d3k2 = eintrag('d3-k2', 'Vitamin D3 + K2', { suggested_units: ['IU', 'mcg'], component_names: ['Vitamin D3', 'Vitamin K2'] })
const zink = eintrag('zink', 'Zink', { aliases: ['Zinc'] })
const testoE = eintrag('testo-e', 'Testosteron Enantat', { default_category: 'hormone' })
const KATALOG = [bpc, vitaminD, vitaminD3, vitaminK2, d3k2, zink, testoE]

function anwenden(vorschlag: ScanVorschlag): WizardState {
  return scanAktionen(vorschlag, KATALOG).reduce(wizardReducer, initialWizardState())
}

const vorschlag = (extra: Partial<ScanVorschlag>): ScanVorschlag => ({
  quelle: 'foto', entry: null, name: 'X', brand: null, dosageForm: null, staerken: [], ...extra,
})

describe('findeKatalogeintrag', () => {
  it('erkennt Schreibweisen ohne Bindestrich, Leerzeichen und Gross/klein', () => {
    expect(findeKatalogeintrag('bpc 157', KATALOG)?.id).toBe('bpc-157')
    expect(findeKatalogeintrag('BPC157 5mg', KATALOG)?.id).toBe('bpc-157')
    expect(findeKatalogeintrag('Body Protection Compound 157', KATALOG)?.id).toBe('bpc-157')
  })
  it('findet den Namen im Produktnamen, der laengste gewinnt', () => {
    expect(findeKatalogeintrag('Vitamin D3 1000 I.E. Tabletten', KATALOG)?.id).toBe('vitamin-d3')
    expect(findeKatalogeintrag('Vitamin D 400', KATALOG)?.id).toBe('vitamin-d')
    expect(findeKatalogeintrag('Zinc 25 mg', KATALOG)?.id).toBe('zink')
  })
  it('ignoriert zu kurze Aliasse und Teile eines Wortes', () => {
    expect(findeKatalogeintrag('D3', KATALOG)).toBeNull()
    expect(findeKatalogeintrag('Zinkoxid-Salbe', KATALOG)).toBeNull()
    expect(findeKatalogeintrag('', KATALOG)).toBeNull()
  })
})

describe('formAusText und staerkeAusText', () => {
  it('liest die Form aus Produktnamen und Packungsinhalt', () => {
    expect(formAusText('Zink 25 mg Brausetabletten')).toBe('tablet')
    expect(formAusText('Omega 3 Softgels')).toBe('capsule')
    expect(formAusText('Nasenspray 10 ml')).toBe('nasal_spray')
    expect(formAusText('Vitamin D3 Tropfen')).toBe('drops')
    expect(formAusText('Magnesium')).toBeNull()
  })
  it('nimmt eine Staerke nur, wenn genau eine im Namen steht', () => {
    expect(staerkeAusText('Vitamin D3 1000 I.E.')).toEqual({ amount: 1000, unit: 'IU' })
    expect(staerkeAusText('Zink 25mg')).toEqual({ amount: 25, unit: 'mg' })
    expect(staerkeAusText('B12 500 µg')).toEqual({ amount: 500, unit: 'mcg' })
    expect(staerkeAusText('Vitamin C 1,5 mg')).toEqual({ amount: 1.5, unit: 'mg' })
    expect(staerkeAusText('D3 1000 IE + K2 100 µg')).toBeNull()
    expect(staerkeAusText('Kreatin 500 g')).toBeNull()
  })
  it('liest Tausenderpunkte bei I.E. richtig und raet bei mg nicht', () => {
    expect(staerkeAusText('Vitamin D3 20.000 I.E. Tabletten')).toEqual({ amount: 20000, unit: 'IU' })
    expect(staerkeAusText('Vitamin D3 1,000 IU')).toEqual({ amount: 1000, unit: 'IU' })
    expect(staerkeAusText('Vitamin C 1,000 mg')).toBeNull()
  })
  it('dieselbe Staerke in zwei Schreibweisen ist eine Angabe', () => {
    expect(staerkeAusText('Vitamin D3 1000 IE (1000 I.E.) Kapseln')).toEqual({ amount: 1000, unit: 'IU' })
  })
})

describe('parseEtikett und parseBarcodeProdukt', () => {
  it('prueft die Antwort aus dem Netz', () => {
    expect(parseEtikett({ label: { name: 'BPC-157', brand: null, dosage_form: 'vial', ingredients: [{ amount: 5, unit: 'mg' }, { amount: 'x', unit: 'mg' }] } }))
      .toEqual({ name: 'BPC-157', brand: null, dosage_form: 'vial', ingredients: [{ name: null, amount: 5, unit: 'mg', per_amount: null, per_unit: null }] })
    expect(parseEtikett({ label: { name: 'X', dosage_form: 'syringe', ingredients: [] } })?.dosage_form).toBeNull()
    expect(parseEtikett({ label: { name: ' ' } })).toBeNull()
    expect(parseEtikett(null)).toBeNull()
    expect(parseBarcodeProdukt({ item: { name: 'Zink 25 mg', brand: 'dm', barcode: '4058172312345', quantity: '100 Tabletten' } })?.name).toBe('Zink 25 mg')
    expect(parseBarcodeProdukt({ item: null })).toBeNull()
  })
})

describe('vorschlagAusEtikett', () => {
  it('nimmt den Katalogeintrag und behaelt die gelesenen Angaben', () => {
    const v = vorschlagAusEtikett({
      name: 'BPC 157', brand: 'Lab X', dosage_form: 'vial',
      ingredients: [{ name: null, amount: 5, unit: 'mg', per_amount: null, per_unit: null }],
    }, KATALOG)
    expect(v).toMatchObject({ quelle: 'foto', entry: bpc, name: 'BPC-157', brand: 'Lab X', dosageForm: 'vial' })
    expect(v.staerken).toEqual([{ name: null, amount: 5, unit: 'mg', perAmount: null, perUnit: null }])
  })
  it('ohne Katalogtreffer wird es eine eigene Substanz mit dem gelesenen Namen', () => {
    const v = vorschlagAusEtikett({ name: 'Neuropeptid Q', brand: null, dosage_form: null, ingredients: [] }, KATALOG)
    expect(v.entry).toBeNull()
    expect(v.name).toBe('Neuropeptid Q')
  })
  it('sucht notfalls ueber den einzigen Wirkstoff', () => {
    const v = vorschlagAusEtikett({
      name: 'Sustanon Depot', brand: null, dosage_form: 'ampoule',
      ingredients: [{ name: 'Testosteron Enantat', amount: 250, unit: 'mg', per_amount: 1, per_unit: 'ml' }],
    }, KATALOG)
    expect(v.entry?.id).toBe('testo-e')
  })
})

describe('vorschlagAusProdukt', () => {
  it('liest Form und Staerke je Stueck aus dem Produktnamen', () => {
    const v = vorschlagAusProdukt({ barcode: '1', name: 'Vitamin D3 1000 I.E.', brand: 'dm', quantity: '100 Tabletten' }, KATALOG)
    expect(v).toMatchObject({ quelle: 'barcode', entry: vitaminD3, dosageForm: 'tablet', brand: 'dm' })
    expect(v.staerken).toEqual([{ name: null, amount: 1000, unit: 'IU', perAmount: null, perUnit: null }])
  })
  it('bei Tropfen keine Staerke aus dem Namen — der Bezug ist unklar', () => {
    const v = vorschlagAusProdukt({ barcode: '1', name: 'Vitamin D3 Tropfen 1000 I.E.', brand: null, quantity: '10 ml' }, KATALOG)
    expect(v.dosageForm).toBe('drops')
    expect(v.staerken).toEqual([])
  })
})

describe('scanAktionen im Assistenten', () => {
  it('Peptid-Vial: Katalog, Form und Gesamtmenge — der Bezug wartet aufs Anmischen', () => {
    const { draft } = anwenden(vorschlag({
      entry: bpc, name: 'BPC-157', dosageForm: 'vial', brand: 'Lab X',
      staerken: [{ name: null, amount: 5, unit: 'mg', perAmount: 2, perUnit: 'ml' }],
    }))
    expect(draft).toMatchObject({ catalogEntryId: 'bpc-157', displayName: 'BPC-157', category: 'peptide', dosageForm: 'vial', brand: 'Lab X' })
    expect(draft.ingredients).toHaveLength(1)
    expect(draft.ingredients[0]).toMatchObject({ catalog_substance_id: 'bpc-157', amount_value: 5, amount_unit: 'mg', basis_value: null, basis_unit: 'ml' })
  })

  it('Ampulle: Konzentration je ml mit Bezug', () => {
    const { draft } = anwenden(vorschlag({
      entry: testoE, name: 'Testosteron Enantat', dosageForm: 'ampoule',
      staerken: [{ name: null, amount: 250, unit: 'mg', perAmount: 1, perUnit: 'ml' }],
    }))
    expect(draft.ingredients[0]).toMatchObject({ amount_value: 250, amount_unit: 'mg', basis_value: 1, basis_unit: 'ml' })
  })

  it('Tablette: ein unpassender Bezug wird nicht uebernommen', () => {
    const { draft } = anwenden(vorschlag({
      entry: zink, name: 'Zink', dosageForm: 'tablet',
      staerken: [{ name: null, amount: 25, unit: 'mg', perAmount: 3, perUnit: 'ml' }],
    }))
    expect(draft.ingredients[0]).toMatchObject({ amount_value: 25, amount_unit: 'mg', basis_value: 1, basis_unit: 'tablet' })
  })

  it('Mischung: jede Staerke zu ihrem Bestandteil, ueber den Namen', () => {
    const { draft } = anwenden(vorschlag({
      entry: d3k2, name: 'Vitamin D3 + K2', dosageForm: 'capsule',
      staerken: [
        { name: 'Menachinon', amount: 100, unit: 'mcg', perAmount: 1, perUnit: 'capsule' },
        { name: 'Cholecalciferol', amount: 2000, unit: 'IU', perAmount: 1, perUnit: 'capsule' },
      ],
    }))
    expect(draft.ingredients.map(i => [i.catalog_substance_id, i.amount_value, i.amount_unit])).toEqual([
      ['vitamin-d3', 2000, 'IU'],
      ['vitamin-k2', 100, 'mcg'],
    ])
  })

  it('Mischung ohne Namen: ueber die Reihenfolge, wenn die Anzahl stimmt', () => {
    const { draft } = anwenden(vorschlag({
      entry: d3k2, name: 'Vitamin D3 + K2', dosageForm: 'drops',
      staerken: [
        { name: null, amount: 1000, unit: 'IU', perAmount: 1, perUnit: 'drop' },
        { name: null, amount: 20, unit: 'mcg', perAmount: 1, perUnit: 'drop' },
      ],
    }))
    expect(draft.ingredients.map(i => [i.amount_value, i.basis_value, i.basis_unit])).toEqual([[1000, 1, 'drop'], [20, 1, 'drop']])
  })

  it('eigene Substanz: Name, Form und Staerke — die Kategorie waehlt der Nutzer', () => {
    const { draft } = anwenden(vorschlag({
      name: 'Neuropeptid Q', dosageForm: 'capsule',
      staerken: [{ name: null, amount: 10, unit: 'mg', perAmount: null, perUnit: null }],
    }))
    expect(draft).toMatchObject({ catalogEntryId: null, displayName: 'Neuropeptid Q', category: null, dosageForm: 'capsule' })
    expect(draft.ingredients[0]).toMatchObject({ custom_name: 'Neuropeptid Q', amount_value: 10, amount_unit: 'mg' })
  })

  it('ein zweiter Scan ersetzt den ersten, statt Reste stehen zu lassen', () => {
    const erster = anwenden(vorschlag({
      entry: d3k2, name: 'Vitamin D3 + K2', dosageForm: 'capsule', brand: 'Marke A',
      staerken: [{ name: null, amount: 1000, unit: 'IU', perAmount: null, perUnit: null }],
    }))
    const { draft } = scanAktionen(vorschlag({ name: 'Neuropeptid Q' }), KATALOG).reduce(wizardReducer, erster)
    expect(draft).toMatchObject({ catalogEntryId: null, displayName: 'Neuropeptid Q', dosageForm: null, brand: '' })
    expect(draft.ingredients).toHaveLength(1)
    expect(draft.ingredients[0]).toMatchObject({ catalog_substance_id: null, custom_name: 'Neuropeptid Q', amount_value: null })
  })

  it('mehrere Staerken fuer eine Zeile ohne passenden Namen: lieber keine', () => {
    const { draft } = anwenden(vorschlag({
      entry: zink, name: 'Zink', dosageForm: 'tablet',
      staerken: [
        { name: 'Vitamin C', amount: 100, unit: 'mg', perAmount: null, perUnit: null },
        { name: 'Selen', amount: 50, unit: 'mcg', perAmount: null, perUnit: null },
      ],
    }))
    expect(draft.ingredients[0].amount_value).toBeNull()
  })
})
