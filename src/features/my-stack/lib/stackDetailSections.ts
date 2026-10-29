import { anbruchArt, haltbarkeitArt } from './bestand'
import type { DosageFormDefinition } from './dosageForms'

/**
 * Welche Angaben im Vollbild einer Substanz stehen.
 *
 * Das Vollbild zeigt, WAS eine Substanz ist (Kategorie, Methode, Marke,
 * Charge) und woraus sie besteht (Wirkstoff, beim Anmischen oder Oeffnen auch
 * Fluessigkeit, Datum und Haltbarkeit danach). Den Vorrat zeigt die
 * Bestand-Anzeige darueber (`BestandCard`).
 *
 * Eine Angabe, die die FORM nicht kennt, faellt weg: bei einem Pflaster steht
 * keine Kachel „Zugefuegte Fluessigkeit: Nicht gesetzt". Eine, die sie kennt
 * und die nur LEER ist, bleibt stehen — dort ist „Nicht gesetzt" eine
 * Aufforderung und keine Panne. Ausnahme: `LEER_AUSBLENDEN`.
 *
 * Wie die Staerke heisst, sagt weiterhin die Form (`strengthShape` in
 * `dosageForms.ts`, siehe `wirkstoffBezug`).
 */

export type DetailFeld =
  | 'wirkstoff'
  | 'kategorie'
  | 'marke'
  | 'fluessigkeit'
  | 'rekonstituiert_am'
  | 'haltbarkeit'
  | 'ablauf'
  | 'vorrat'
  | 'applikation'
  | 'batch'
  | 'quelle'
  | 'analyse'
  | 'notizen'

/**
 * `substanz` sagt, WAS das ist — Kategorie, Methode, Herkunft. Das gilt fuer
 * jede Packung derselben Substanz gleich.
 *
 * `produkt` („Zusammensetzung") sagt, woraus diese Darreichung besteht — und
 * wo angemischt oder geoeffnet wird, womit, wann und wie lange es haelt.
 */
export type AbschnittId = 'substanz' | 'produkt'

export interface DetailAbschnitt {
  id: AbschnittId
  felder: readonly DetailFeld[]
}

/**
 * Wie die Staerke dieser Form heisst.
 *
 * „Wirkstoff pro Vial" stimmt beim Vial und sonst nirgends. Der Marker kommt
 * aus `strengthShape`; den Text dazu setzt die Oberflaeche, denn er gehoert
 * zur Sprache und nicht zur Rechnung.
 */
export type WirkstoffBezug = 'pro_vial' | 'pro_volumen' | 'pro_einheit' | 'pro_masse' | 'roh'

export function wirkstoffBezug(form: DosageFormDefinition | undefined): WirkstoffBezug {
  switch (form?.strengthShape) {
    case 'reconstituted': return 'pro_vial'
    case 'per_volume': return 'pro_volumen'
    case 'per_unit': return 'pro_einheit'
    case 'per_mass': return 'pro_masse'
    default: return 'roh'
  }
}

/**
 * Angaben, die leer KEINE Kachel bekommen. Ein Ablaufdatum steht auf vielen
 * Packungen gar nicht drauf — „Nicht gesetzt" waere dort keine Aufforderung,
 * sondern Dauerrauschen. Eintragen laesst es sich unter „Bearbeiten".
 */
export const LEER_AUSBLENDEN: ReadonlySet<DetailFeld> = new Set(['ablauf'])

export function detailAbschnitte(form: DosageFormDefinition | undefined): DetailAbschnitt[] {
  // Die Wirkstoffmenge beschreibt die Zusammensetzung dieser Darreichung,
  // nicht die Identitaet der Substanz.
  const produkt: DetailFeld[] = ['wirkstoff']
  // Aufloesen heisst: Pulver im Glas, das man selbst anmischt — nur dort gibt
  // es eine zugefuegte Fluessigkeit. Ein Datum und eine Haltbarkeit danach
  // hat alles, was angebrochen wird (Vial, Pen, Flasche).
  if (form?.capabilities.includes('reconstitutable')) produkt.push('fluessigkeit')
  // Dieselbe Regel wie im Assistenten (`haltbarkeitArt`): auch Gel, Tube
  // und Pulverdose haben ein Oeffnungsdatum.
  if (form?.capabilities.includes('reconstitutable') || anbruchArt(form?.key) || haltbarkeitArt(form?.key, null)) {
    produkt.push('rekonstituiert_am', 'haltbarkeit')
  }

  const substanz: DetailFeld[] = [
    'kategorie', 'applikation', 'marke',
    'batch', 'quelle', 'analyse', 'ablauf', 'notizen',
  ]

  // Zuerst WAS es ist, dann woraus es besteht.
  return [
    { id: 'substanz', felder: substanz },
    { id: 'produkt', felder: produkt },
  ]
}
