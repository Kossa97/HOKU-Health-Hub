import { describe, expect, test } from 'vitest'
import { OHNE_NEUE_ENTSPRECHUNG, produktAngaben, type AngabenQuellen } from './produktAngaben'
import { detailAbschnitte } from './stackDetailSections'
import { getDosageForm } from './dosageForms'
import type { StackItem } from '../types'

/**
 * Die Leseschicht vor den zwei Schreibwegen.
 *
 * Der Fehler, den diese Datei festhaelt: das Vollbild las nur die Altspalten,
 * die die Tracking-Details schreiben. Alles, was der Assistent anlegte, stand
 * in `stack_item_ingredients` und `stack_item_inventory` — und im Vollbild
 * stand „Nicht gesetzt".
 */

const leeresItem = (): StackItem => ({
  id: 'i1',
  user_id: 'u1',
  display_name: 'Testsubstanz',
  category: 'peptide',
  dosage_form: 'vial',
  brand: null,
  color_hex: null,
  notes: null,
  configuration_status: 'complete',
  archived: false,
  tracking_level: 'complete',
  pk_profile_method: null,
  archived_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ingredients: [],
  inventory: null,
})

/** Ein Eintrag, wie ihn der ASSISTENT hinterlaesst: nichts in den Altspalten. */
const ausDemAssistenten = (): AngabenQuellen => ({
  item: {
    ...leeresItem(),
    brand: 'Beispiel Pharma',
    notes: 'Kühl lagern',
    ingredients: [{
      catalog_substance_id: null, custom_name: 'BPC-157',
      amount_value: 10, amount_unit: 'mg',
      basis_value: 1, basis_unit: 'Vial',
      position: 0,
    }],
    inventory: {
      enabled: true,
      package_quantity: 30, package_unit: 'Tabletten',
      remaining_quantity: 12,
      batch_number: 'B-77',
      expires_at: '2027-03-01',
    },
  },
})

/** Ein Eintrag, wie ihn die TRACKING-DETAILS hinterlassen: nur Altspalten. */
const ausDenTrackingDetails = (): AngabenQuellen => ({
  item: {
    ...leeresItem(),
    vial_amount_mg: 5, vial_amount_unit: 'mg',
    reconstitution_ml: 2,
    reconstitution_date: '2026-09-01',
    expiry_days: 28,
    batch_number: 'A-1', batch_source: 'Labor Nord',
    batch_file_url: 'https://example.test/pfad/analyse.pdf',
    default_method: 'Subkutan',
    inventory_item_id: 'inv-1',
  },
  vorratsposten: { vials_count: 3 },
})

describe('produktAngaben', () => {
  test('liest Öffnen, Haltbarkeit und Charge eines Pens aus dem Bestand', () => {
    const q = ausDemAssistenten()
    q.item.inventory = {
      ...q.item.inventory!,
      opened_at: '2026-09-20',
      use_within_days: 28,
      reconstitution_ml: null,
      batch_source: 'Apotheke',
      batch_file_url: 'https://synthetic.invalid/analyse.pdf',
    }
    const angaben = produktAngaben(q)
    expect(angaben.rekonstituiert_am).toMatchObject({ art: 'datum', iso: '2026-09-20', herkunft: 'neu' })
    expect(angaben.haltbarkeit).toMatchObject({ art: 'tage', n: 28, herkunft: 'neu' })
    expect(angaben.quelle).toMatchObject({ art: 'text', text: 'Apotheke', herkunft: 'neu' })
    expect(angaben.analyse).toMatchObject({ art: 'datei', url: 'https://synthetic.invalid/analyse.pdf' })
    expect(angaben.fluessigkeit.art).toBe('leer')
  })

  test('füllt einen Eintrag aus dem Assistenten, statt „Nicht gesetzt" zu zeigen', () => {
    const a = produktAngaben(ausDemAssistenten())

    expect(a.wirkstoff).toEqual({
      art: 'zutaten', herkunft: 'neu',
      zutaten: [{ name: 'BPC-157', wert: 10, einheit: 'mg', basis: 1, basisEinheit: 'Vial' }],
    })
    expect(a.vorrat).toEqual({
      art: 'vorrat', herkunft: 'neu',
      rest: 12, packung: 30, einheit: 'Tabletten',
    })
    expect(a.batch).toEqual({ art: 'text', text: 'B-77', herkunft: 'neu' })
    expect(a.marke).toEqual({ art: 'text', text: 'Beispiel Pharma', herkunft: 'neu' })
    expect(a.notizen).toEqual({ art: 'text', text: 'Kühl lagern', herkunft: 'neu' })
    // Die Packung nennt ein Ablaufdatum, kein „haltbar noch n Tage". Beides
    // ist eine Haltbarkeit, aber nicht dieselbe Rechnung — die Angabe behaelt
    // ihre Form, damit die Oberflaeche sie richtig benennen kann.
    expect(a.haltbarkeit).toEqual({ art: 'leer', grund: 'nicht_gesetzt' })
    expect(a.ablauf).toEqual({ art: 'datum', iso: '2027-03-01', herkunft: 'neu' })
  })

  test('liest weiterhin die Altspalten und lässt ihnen den Vortritt', () => {
    const a = produktAngaben(ausDenTrackingDetails())

    expect(a.wirkstoff).toEqual({
      art: 'zutaten', herkunft: 'alt',
      zutaten: [{ name: 'Testsubstanz', wert: 5, einheit: 'mg', basis: null, basisEinheit: null }],
    })
    expect(a.fluessigkeit).toEqual({ art: 'menge', wert: 2, einheit: 'ml', herkunft: 'alt' })
    expect(a.rekonstituiert_am).toEqual({ art: 'datum', iso: '2026-09-01', herkunft: 'alt' })
    expect(a.haltbarkeit).toEqual({ art: 'tage', n: 28, herkunft: 'alt' })
    expect(a.vorrat).toEqual({ art: 'vorrat', herkunft: 'alt', rest: 3, packung: null, einheit: null })
    expect(a.quelle).toEqual({ art: 'text', text: 'Labor Nord', herkunft: 'alt' })
    expect(a.analyse).toEqual({ art: 'datei', url: 'https://example.test/pfad/analyse.pdf', herkunft: 'alt' })
    expect(a.applikation).toEqual({ art: 'text', text: 'Subkutan', herkunft: 'alt' })
  })

  test('nimmt die Altspalte, wenn beide Wege etwas geschrieben haben', () => {
    // Ein Eintrag, den jemand erst im Assistenten angelegt und danach in den
    // Tracking-Details nachgetragen hat. Die Altspalte ist die genauere
    // Angabe: sie meint DIESES Vial, die Zutat die Substanz allgemein.
    const beides = ausDemAssistenten()
    Object.assign(beides.item, { vial_amount_mg: 5, vial_amount_unit: 'mg', batch_number: 'A-1' })
    beides.item.inventory_item_id = 'inv-1'
    beides.vorratsposten = { vials_count: 3 }

    const a = produktAngaben(beides)
    expect(a.wirkstoff.art === 'zutaten' && a.wirkstoff.herkunft).toBe('alt')
    // Die Charge dagegen aus dem Bestand: dorthin schreibt „Bearbeiten",
    // die Altspalte steht still.
    expect(a.batch).toEqual({ art: 'text', text: 'B-77', herkunft: 'neu' })
    expect(a.vorrat.art === 'vorrat' && a.vorrat.herkunft).toBe('alt')
  })

  test('nennt die vier Felder, die nur der alte Weg füllen kann', () => {
    // Das ist der Punkt dieser Liste: die Welle, die die Altspalten
    // aufloest, muss fuer genau diese vier erst eine Spalte anlegen. Steht
    // sie nicht hier, geht sie beim Umzug still verloren.
    expect([...OHNE_NEUE_ENTSPRECHUNG].sort()).toEqual(
      ['analyse', 'fluessigkeit', 'quelle', 'rekonstituiert_am'],
    )

    const a = produktAngaben(ausDemAssistenten())
    for (const feld of OHNE_NEUE_ENTSPRECHUNG) {
      expect(a[feld]).toEqual({ art: 'leer', grund: 'keine_entsprechung' })
    }
  })

  test('unterscheidet „noch nicht ausgefüllt" von „gibt es hier nicht"', () => {
    const a = produktAngaben({ item: leeresItem() })

    // Beide Wege kennen den Wirkstoff — hier fehlt er wirklich nur.
    expect(a.wirkstoff).toEqual({ art: 'leer', grund: 'nicht_gesetzt' })
    expect(a.vorrat).toEqual({ art: 'leer', grund: 'nicht_gesetzt' })
    expect(a.batch).toEqual({ art: 'leer', grund: 'nicht_gesetzt' })
    expect(a.haltbarkeit).toEqual({ art: 'leer', grund: 'nicht_gesetzt' })
  })

  test('nimmt die Methode des aktiven Zyklus, wenn keine am Eintrag steht', () => {
    // Im neuen Modell steht die Methode am Plan, nicht am Eintrag. Ohne
    // Zyklus bleibt sie leer statt geraten.
    const mitZyklus = { ...ausDemAssistenten(), zyklusMethode: 'Intramuskulär' }
    expect(produktAngaben(mitZyklus).applikation)
      .toEqual({ art: 'text', text: 'Intramuskulär', herkunft: 'zyklus' })
    expect(produktAngaben(ausDemAssistenten()).applikation)
      .toEqual({ art: 'leer', grund: 'nicht_gesetzt' })
  })

  test('der laufende Plan schlaegt die Altspalte — auch ihr Ersatzwert „Andere"', () => {
    // Die Seite fuellt eine leere Altspalte mit „Andere"; das stand im
    // Vollbild ueber „Subkutan" aus dem Plan.
    const angaben = produktAngaben({
      ...ausDemAssistenten(),
      item: { ...ausDemAssistenten().item, default_method: 'Andere' },
      zyklusMethode: 'Subkutan',
    })
    expect(angaben.applikation).toEqual({ art: 'text', text: 'Subkutan', herkunft: 'zyklus' })
  })

  test('führt ein Kombipräparat mit allen Zutaten', () => {
    const kombi = ausDemAssistenten()
    kombi.item.ingredients = [
      { catalog_substance_id: null, custom_name: 'CJC-1295', amount_value: 2, amount_unit: 'mg', basis_value: 1, basis_unit: 'Vial', position: 0 },
      { catalog_substance_id: null, custom_name: 'Ipamorelin', amount_value: 5, amount_unit: 'mg', basis_value: 1, basis_unit: 'Vial', position: 1 },
    ]
    const a = produktAngaben(kombi)
    expect(a.wirkstoff.art === 'zutaten' && a.wirkstoff.zutaten.map(z => z.name))
      .toEqual(['CJC-1295', 'Ipamorelin'])
  })

  test('beantwortet jedes Feld, das ein Abschnitt zeigen kann', () => {
    // Die beiden Dateien muessen dieselbe Feldliste kennen: was
    // `detailAbschnitte` zeigt, muss `produktAngaben` beantworten koennen.
    // Sonst steht irgendwo `undefined` in einer Kachel.
    const a = produktAngaben(ausDemAssistenten())
    for (const abschnitt of detailAbschnitte(getDosageForm('vial'))) {
      for (const feld of abschnitt.felder) {
        expect(a[feld], feld).toBeDefined()
      }
    }
  })
})
