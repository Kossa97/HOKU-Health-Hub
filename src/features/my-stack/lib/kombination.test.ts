import { describe, expect, it } from 'vitest'
import { bestandteileAufloesen, istKombination, kombiNameNachfuehren } from './kombination'
import type { SubstanceCatalogEntry } from '../types'

function eintrag(teile: Partial<SubstanceCatalogEntry> & { id: string; canonical_name: string }): SubstanceCatalogEntry {
  return {
    aliases: [],
    default_category: 'peptide',
    suggested_units: ['mg'],
    suggested_dosage_forms: ['vial'],
    pk_profile_id: null,
    active: true,
    ...teile,
  }
}

const cjc = eintrag({
  id: 'cjc',
  canonical_name: 'CJC-1295 ohne DAC',
  aliases: ['CJC-1295 no DAC', 'Mod GRF 1-29'],
  suggested_units: ['mcg', 'mg'],
  pk_profile_id: 'pk-cjc',
})
const ipamorelin = eintrag({
  id: 'ipa',
  canonical_name: 'Ipamorelin',
  suggested_units: ['mcg', 'mg'],
  pk_profile_id: 'pk-ipa',
})
const blend = eintrag({
  id: 'blend',
  canonical_name: 'CJC-1295 ohne DAC + Ipamorelin',
  suggested_units: ['mg', 'mcg'],
  component_names: ['CJC-1295 ohne DAC', 'Ipamorelin'],
})

const KATALOG = [cjc, ipamorelin, blend]

describe('Kombipräparate im Katalog', () => {
  it('erkennt eine Kombination an ihren Bestandteilen', () => {
    expect(istKombination(blend)).toBe(true)
    expect(istKombination(cjc)).toBe(false)
    // Eine ältere Abfrage liest die Spalte gar nicht mit.
    expect(istKombination({ ...blend, component_names: undefined })).toBe(false)
    expect(istKombination({ ...blend, component_names: null })).toBe(false)
  })

  it('löst jeden Bestandteil zu seinem Katalogeintrag auf', () => {
    expect(bestandteileAufloesen(blend, KATALOG)).toEqual([
      { catalogId: 'cjc', name: 'CJC-1295 ohne DAC', unit: 'mcg', category: 'peptide' },
      { catalogId: 'ipa', name: 'Ipamorelin', unit: 'mcg', category: 'peptide' },
    ])
  })

  it('findet einen Bestandteil auch über seinen Alias', () => {
    const ueberAlias = { ...blend, component_names: ['Mod GRF 1-29', 'Ipamorelin'] }

    expect(bestandteileAufloesen(ueberAlias, KATALOG).map(teil => teil.catalogId))
      .toEqual(['cjc', 'ipa'])
    // Der kanonische Name steht danach da, nicht der Alias, unter dem gesucht
    // wurde — sonst hieße die Zutat anders als im Katalog.
    expect(bestandteileAufloesen(ueberAlias, KATALOG)[0].name).toBe('CJC-1295 ohne DAC')
  })

  it('behält einen unauffindbaren Namen als benannte Zutat', () => {
    // Der Katalog war beim Laden nicht erreichbar. Der Wirkstoff soll dann
    // wenigstens dastehen, statt lautlos zu verschwinden.
    const teile = bestandteileAufloesen(blend, [blend])

    expect(teile).toEqual([
      { catalogId: null, name: 'CJC-1295 ohne DAC', unit: null, category: null },
      { catalogId: null, name: 'Ipamorelin', unit: null, category: null },
    ])
  })

  it('gibt für eine einzelne Substanz nichts zurück', () => {
    expect(bestandteileAufloesen(cjc, KATALOG)).toEqual([])
  })
})

describe('kombiNameNachfuehren', () => {
  const namen = { bpc: 'BPC-157', tb: 'TB-500' }
  const zeile = (catalog_substance_id: string | null, custom_name = '') => ({ catalog_substance_id, custom_name })

  it('macht aus einer Substanz mit weiterem Wirkstoff eine benannte Kombination', () => {
    expect(kombiNameNachfuehren([zeile('bpc')], [zeile('bpc'), zeile('tb', 'TB-500')], 'BPC-157', namen)).toBe('BPC-157 + TB-500')
    // Eine leere neue Zeile aendert noch nichts.
    expect(kombiNameNachfuehren([zeile('bpc')], [zeile('bpc'), zeile(null)], 'BPC-157', namen)).toBeNull()
    // Ein eigenes Produkt behaelt seinen Namen.
    expect(kombiNameNachfuehren([zeile(null, 'Foo')], [zeile(null, 'Foo'), zeile(null, 'Bar')], 'Foo', namen)).toBeNull()
    // Eigene Zutat ohne Katalog zaehlt mit ihrem Namen.
    expect(kombiNameNachfuehren([zeile('bpc')], [zeile('bpc'), zeile(null, 'GHK-Cu')], 'BPC-157', namen)).toBe('BPC-157 + GHK-Cu')
    // Entfernt man ihn wieder, kehrt der Name zurueck.
    expect(kombiNameNachfuehren([zeile('bpc'), zeile('tb')], [zeile('bpc')], 'BPC-157 + TB-500', namen)).toBe('BPC-157')
  })

  it('laesst einen selbst vergebenen Namen stehen', () => {
    expect(kombiNameNachfuehren([zeile('bpc')], [zeile('bpc'), zeile('tb')], 'Wolverine', namen)).toBeNull()
  })
})
