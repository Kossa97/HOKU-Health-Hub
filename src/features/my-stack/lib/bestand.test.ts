import { describe, expect, it } from 'vitest'
import type { CyclePlanVersion, CycleTimeline } from '../../../lib/planTimeline'
import type { StackItemIngredient, StackItemInventory } from '../types'
import {
  anbruchArt,
  aufzuziehendeEinheiten,
  bestandAufteilen,
  bestandZusammensetzen,
  buchtEinnahmenAb,
  dosisInPackungseinheit,
  haltbarBis,
  istLoesungsVial,
  reichweite,
  spritzenEinheitenProMl,
  spritzenRechnung,
  stueckRechnung,
  stueckZahl,
  vialBuchtUeberBestand,
  vorratTeile,
} from './bestand'

function inventory(changes: Partial<StackItemInventory> = {}): StackItemInventory {
  return {
    enabled: true,
    package_quantity: 5,
    package_unit: 'vial',
    remaining_quantity: 2.95,
    batch_number: null,
    expires_at: null,
    reconstitution_ml: 2,
    ...changes,
  }
}

function ingredient(changes: Partial<StackItemIngredient> = {}): StackItemIngredient {
  return {
    catalog_substance_id: null,
    custom_name: 'Wirkstoff',
    amount_value: 10,
    amount_unit: 'mg',
    basis_value: 1,
    basis_unit: 'vial',
    position: 0,
    ...changes,
  }
}

function version(id: string, localDate: string, changes: Partial<CyclePlanVersion> = {}): CyclePlanVersion {
  return {
    id,
    cycle_id: 'cycle-1',
    effective_kind: 'local_date',
    effective_at: null,
    effective_local_date: localDate,
    change_kind: 'initial',
    frequency: 'Täglich',
    x_days_interval: null,
    interval_unit: null,
    cycle_on_days: null,
    cycle_off_days: null,
    schedule_days: [],
    intake_time: 'morgens',
    intake_time_custom: '08:00',
    slot_doses: null,
    slot_days: null,
    dose: 1,
    unit: 'mg',
    method: 'Subkutan',
    ...changes,
  }
}

function timeline(versions: CyclePlanVersion[]): CycleTimeline {
  return {
    cycle: { id: 'cycle-1', stack_item_id: 'stack-1', started_at: '2026-08-31T22:00:00.000Z', ended_at: null, start_local_date: '2026-09-01' },
    versions,
    pauses: [],
  }
}

// 10:00 in Berlin: die Einnahme um 08:00 ist heute schon vorbei.
const now = new Date('2026-09-25T08:00:00.000Z')

describe('anbruchArt', () => {
  it('knows which forms get opened and which do not', () => {
    expect(anbruchArt('vial')).toBe('vial')
    expect(anbruchArt('pen')).toBe('pen')
    expect(anbruchArt('drops')).toBe('flasche')
    expect(anbruchArt('tablet')).toBeNull()
    expect(anbruchArt('ampoule')).toBeNull()
  })
})

describe('vorratTeile', () => {
  it('splits vials into full ones and the mixed one', () => {
    expect(vorratTeile(inventory())).toEqual({ rest: 2.95, voll: 2, angebrochen: 0.95, angebrochenAnteil: 0.95 })
    expect(vorratTeile(inventory({ remaining_quantity: 3 }))).toMatchObject({ voll: 3, angebrochen: 0, angebrochenAnteil: null })
  })

  it('splits an opened bottle by its size', () => {
    const drops = inventory({ package_unit: 'ml', package_quantity: 30, remaining_quantity: 36, opened_at: '2026-09-01' })
    expect(vorratTeile(drops)).toEqual({ rest: 36, voll: 1, angebrochen: 6, angebrochenAnteil: 0.2 })
  })

  it('leaves tablets as one number', () => {
    const tablets = inventory({ package_unit: 'tablet', package_quantity: 60, remaining_quantity: 42 })
    expect(vorratTeile(tablets)).toMatchObject({ voll: 42, angebrochen: 0, angebrochenAnteil: null })
  })
})

describe('bestandAufteilen', () => {
  it('teilt Vials in ungeöffnete und das angemischte in Prozent', () => {
    expect(bestandAufteilen(inventory({ package_unit: 'vial', remaining_quantity: 2.95 }), 'vial')).toEqual({ groesse: 1, voll: 2, prozent: 95 })
  })

  it('teilt Pens nach ihrer Größe, auch ohne Öffnungsdatum', () => {
    expect(bestandAufteilen(inventory({ package_unit: 'ml', package_quantity: 3, remaining_quantity: 7.5, opened_at: null }), 'pen')).toEqual({ groesse: 3, voll: 2, prozent: 50 })
  })

  it('gibt es nicht, wo nichts angebrochen wird oder die Größe fehlt', () => {
    expect(bestandAufteilen(inventory({ package_unit: 'tablet', remaining_quantity: 42 }), null)).toBeNull()
    expect(bestandAufteilen(inventory({ package_unit: 'ml', package_quantity: null, remaining_quantity: 7 }), 'flasche')).toBeNull()
  })

  it('setzt sich wieder zusammen', () => {
    const vial = { remaining_quantity: 2.955, package_unit: 'vial' }
    const vorher = { groesse: 1, voll: 2, prozent: 96 }
    expect(bestandZusammensetzen(vorher, 3, 40, vial)).toBe(3.4)
    // Prozent unverändert: der genaue Rest bleibt, nicht die gerundete Zahl.
    expect(bestandZusammensetzen(vorher, 2, 96, vial)).toBe(2.955)
    expect(bestandZusammensetzen(vorher, 4, 96, vial)).toBe(4.955)
  })

  it('lässt gezählte Einheiten ganz', () => {
    const spray = { remaining_quantity: 181, package_unit: 'spray' }
    const vorher = { groesse: 120, voll: 1, prozent: 51 }
    expect(bestandZusammensetzen(vorher, 1, 51, spray)).toBe(181)
    expect(bestandZusammensetzen(vorher, 1, 33, spray)).toBe(160)
  })
})

describe('haltbarBis', () => {
  it('adds the shelf life to the day it was opened', () => {
    expect(haltbarBis(inventory({ opened_at: '2026-09-15', use_within_days: 28 }))).toBe('2026-10-13')
    expect(haltbarBis(inventory({ opened_at: null, use_within_days: 28 }))).toBeNull()
  })
})

describe('dosisInPackungseinheit', () => {
  it('converts like the database does', () => {
    expect(dosisInPackungseinheit(500, 'mcg', [ingredient()], inventory())).toBe(0.05)
    expect(dosisInPackungseinheit(1, 'mg', [ingredient()], inventory())).toBe(0.1)
    expect(dosisInPackungseinheit(0.2, 'ml', [ingredient()], inventory())).toBe(0.1)
    expect(dosisInPackungseinheit(2, 'IU', [ingredient()], inventory())).toBeNull()
  })

  it('counts tablets and refuses an ambiguous blend', () => {
    const tablets = inventory({ package_unit: 'tablet' })
    expect(dosisInPackungseinheit(2, 'tablet', [ingredient({ basis_unit: 'tablet', amount_value: 50 })], tablets)).toBe(2)
    expect(dosisInPackungseinheit(100, 'mg', [ingredient({ basis_unit: 'tablet', amount_value: 50 })], tablets)).toBe(2)
    expect(dosisInPackungseinheit(1, 'mg', [ingredient(), ingredient({ amount_value: 5 })], inventory())).toBeNull()
  })
})

describe('reichweite', () => {
  it('counts the days the stock still covers, starting after today\'s past intakes', () => {
    // 1 mg taeglich aus 10-mg-Vials = 0,1 Vial pro Tag; 1 Vial reicht 10 Tage.
    const result = reichweite({ inventory: inventory({ remaining_quantity: 1 }), ingredients: [ingredient()], timelines: [timeline([version('v1', '2026-09-01')])], now, timeZone: 'Europe/Berlin' })
    // Heute ist schon genommen: morgen bis in zehn Tagen.
    expect(result).toEqual({ art: 'tage', tage: 11, bis: '2026-10-05' })
  })

  it('includes a planned step that raises the dose', () => {
    const plan = timeline([version('v1', '2026-09-01'), version('v2', '2026-09-28', { dose: 2, change_kind: 'titration' })])
    const result = reichweite({ inventory: inventory({ remaining_quantity: 1 }), ingredients: [ingredient()], timelines: [plan], now, timeZone: 'Europe/Berlin' })
    // 26.–27.: 0,2; ab 28.: 0,2 pro Tag → 0,8 / 0,2 = 4 Tage bis 01.10.
    expect(result).toEqual({ art: 'tage', tage: 7, bis: '2026-10-01' })
  })

  it('says when there is no plan, no stock or no conversion', () => {
    const plan = [timeline([version('v1', '2026-09-01')])]
    expect(reichweite({ inventory: inventory(), ingredients: [ingredient()], timelines: [], now, timeZone: 'Europe/Berlin' })).toEqual({ art: 'kein_plan' })
    expect(reichweite({ inventory: inventory({ remaining_quantity: 0 }), ingredients: [ingredient()], timelines: plan, now, timeZone: 'Europe/Berlin' })).toEqual({ art: 'leer' })
    expect(reichweite({ inventory: inventory(), ingredients: [ingredient({ amount_unit: 'IU' })], timelines: plan, now, timeZone: 'Europe/Berlin' })).toEqual({ art: 'unbekannt' })
  })

  it('stops counting at the horizon', () => {
    const result = reichweite({ inventory: inventory({ remaining_quantity: 100 }), ingredients: [ingredient()], timelines: [timeline([version('v1', '2026-09-01')])], now, timeZone: 'Europe/Berlin', horizonDays: 30 })
    expect(result).toEqual({ art: 'laenger', tage: 30 })
  })
})

describe('Spritzeneinheiten', () => {
  it('reads both stored syringe formats and falls back to U-100', () => {
    expect(spritzenEinheitenProMl('1:100')).toBe(100)
    expect(spritzenEinheitenProMl('0,5:50')).toBe(100)
    expect(spritzenEinheitenProMl('1 mL (40 Einheiten)')).toBe(40)
    expect(spritzenEinheitenProMl(null)).toBe(100)
  })

  it('turns a dose into syringe units: 50 mg on 1.5 ml, 1 mg = 3 E', () => {
    const rechnung = spritzenRechnung([ingredient({ amount_value: 50 })], 1.5, '1 mL (100 Einheiten)')!
    expect(aufzuziehendeEinheiten(1, 'mg', rechnung)).toBe(3)
    expect(aufzuziehendeEinheiten(2000, 'mcg', rechnung)).toBe(6)
    expect(aufzuziehendeEinheiten(0.1, 'ml', rechnung)).toBe(10)
    expect(aufzuziehendeEinheiten(2, 'IU', rechnung)).toBeNull()
  })

  it('has no answer without liquid or for a blend', () => {
    expect(spritzenRechnung([ingredient()], null, null)).toBeNull()
    expect(spritzenRechnung([ingredient(), ingredient()], 2, null)).toBeNull()
  })
})

describe('vialBuchtUeberBestand', () => {
  it('matches the database rule: stock in vials and exactly one ingredient per vial', () => {
    expect(vialBuchtUeberBestand(inventory(), [ingredient()])).toBe(true)
    expect(vialBuchtUeberBestand(inventory({ package_unit: 'ml' }), [ingredient()])).toBe(false)
    expect(vialBuchtUeberBestand(inventory(), [ingredient(), ingredient({ amount_value: 5 })])).toBe(false)
    expect(vialBuchtUeberBestand(null, [ingredient()])).toBe(false)
  })
})

describe('buchtEinnahmenAb', () => {
  const item = (changes: Partial<Parameters<typeof buchtEinnahmenAb>[0]> = {}) => ({
    dosage_form: 'vial' as const,
    tracking_level: 'complete',
    inventory: inventory(),
    ingredients: [ingredient()],
    ...changes,
  })

  it('in Vials gefuehrt: nur mit eindeutiger Umrechnung, unabhaengig von der Erfassungstiefe', () => {
    expect(buchtEinnahmenAb(item({ tracking_level: 'basic' }))).toBe(true)
    expect(buchtEinnahmenAb(item({ ingredients: [ingredient(), ingredient({ amount_value: 5 })] }))).toBe(false)
  })

  it('fertige Loesung in ml: wie jede andere Form mit erfasster Staerke', () => {
    const ml = inventory({ package_unit: 'ml', package_quantity: 10, remaining_quantity: 8 })
    expect(buchtEinnahmenAb(item({ inventory: ml }))).toBe(true)
    expect(buchtEinnahmenAb(item({ inventory: ml, tracking_level: 'basic' }))).toBe(false)
  })
})

describe('istLoesungsVial', () => {
  it('nur Peptid-Vials werden angemischt', () => {
    expect(istLoesungsVial('vial', 'hormone')).toBe(true)
    expect(istLoesungsVial('vial', 'peptide')).toBe(false)
    expect(istLoesungsVial('pen', 'hormone')).toBe(false)
    expect(istLoesungsVial('vial', null)).toBe(false)
  })
})

describe('dosisInPackungseinheit mit Gleitkomma', () => {
  it('treats deltas that are equal in exact arithmetic as equal', () => {
    const blend = [ingredient({ amount_value: 0.3, basis_value: 3 }), ingredient({ amount_value: 0.1, basis_value: 1 })]
    expect(dosisInPackungseinheit(0.2, 'mg', blend, inventory())).toBe(2)
  })
})

describe('stueckRechnung / stueckZahl', () => {
  const spray = ingredient({ amount_value: 300, amount_unit: 'mcg', basis_value: 1, basis_unit: 'spray' })

  it('rechnet eine Einnahme in Stueck um — auch ueber mg und mcg', () => {
    const rechnung = stueckRechnung([spray])!
    expect(rechnung).toEqual({ proStueck: 300, einheit: 'mcg', stueck: 'spray' })
    expect(stueckZahl(600, 'mcg', rechnung)).toBe(2)
    expect(stueckZahl(0.6, 'mg', rechnung)).toBe(2)
    expect(stueckZahl(250, 'mcg', rechnung)).toBe(0.8)
  })

  it('halbe Tabletten gibt es', () => {
    const rechnung = stueckRechnung([ingredient({ amount_value: 500, amount_unit: 'mg', basis_value: 1, basis_unit: 'tablet' })])!
    expect(stueckZahl(250, 'mg', rechnung)).toBe(0.5)
  })

  it('nichts, wenn die Menge schon in Stueck steht oder sich nicht umrechnen laesst', () => {
    const rechnung = stueckRechnung([spray])!
    expect(stueckZahl(2, 'spray', rechnung)).toBeNull()
    expect(stueckZahl(5, 'IU', rechnung)).toBeNull()
  })

  it('nur bei genau einem Wirkstoff je Stueck', () => {
    expect(stueckRechnung([spray, spray])).toBeNull()
    expect(stueckRechnung([ingredient()])).toBeNull() // je Vial: dafuer gibt es die Spritze
    expect(stueckRechnung([ingredient({ basis_unit: 'ml' })])).toBeNull()
  })
})
