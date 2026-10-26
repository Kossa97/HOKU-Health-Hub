import type { DetailFeld } from './stackDetailSections'
import type { StackItem } from '../types'

/**
 * Woher die Angaben im Vollbild kommen — und was passiert, wenn sie an der
 * einen Stelle stehen und an der anderen gesucht werden.
 *
 * In My Stack schreiben ZWEI Wege dieselben Angaben:
 *
 *   Der Assistent (`saveStackItemSetup` → `save_stack_item_with_plan`) legt
 *   `stack_items` an, die Zutaten in `stack_item_ingredients` und den Bestand
 *   in `stack_item_inventory`.
 *
 *   Das fruehere Vial-Tracking-Formular (inzwischen entfernt) schrieb
 *   stattdessen die flachen Altspalten auf `stack_items` — `vial_amount_mg`,
 *   `reconstitution_ml`, `batch_number` … — und eine Zeile in
 *   `inventory_items`. Diese Werte liegen in Bestandsdaten weiter; die
 *   Leseschicht zeigt sie an, aendern laesst sie sich nur noch dort, wo
 *   der Assistent eine Entsprechung hat.
 *
 * Das Vollbild las bisher NUR den zweiten. Wer eine Substanz ueber den
 * Assistenten anlegte, sah deshalb ueberall „Nicht gesetzt", obwohl die
 * Angaben da waren, nur woanders.
 *
 * Diese Datei ist die Leseschicht dazwischen: je Feld die Altspalte zuerst
 * (sie ist die genauere Angabe, wo sie existiert), sonst das neue Modell. Sie
 * rechnet nur; wie eine Angabe HEISST und aussieht, entscheidet die
 * Oberflaeche — dieselbe Trennung wie in `stackDetailSections.ts`.
 *
 * Die Leseschicht ist ein Pflaster und kein Ziel. Sie macht das Vollbild fuer
 * beide Arten von Eintraegen richtig; die zwei Schreibwege bleiben. Das
 * aufzuloesen heisst, die Altspalten zu migrieren — eigene Welle, eigener
 * Trockenlauf.
 */

/** Welcher der beiden Wege die Angabe geliefert hat. */
export type Herkunft = 'alt' | 'neu' | 'zyklus'

/**
 * Warum nichts dasteht.
 *
 * `nicht_gesetzt`      — beide Wege kennen das Feld, keiner hat es gefuellt.
 *                        „Nicht gesetzt" ist hier eine Aufforderung.
 * `keine_entsprechung` — nur der ALTE Weg kann dieses Feld ueberhaupt fuellen.
 *                        Bei einem Eintrag aus dem Assistenten bleibt es leer,
 *                        und daran ist nichts auszufuellen. Siehe
 *                        `OHNE_NEUE_ENTSPRECHUNG`.
 */
export type LeerGrund = 'nicht_gesetzt' | 'keine_entsprechung'

/** Eine Zutat mit ihrer Staerke: 10 mg je 1 Vial. */
export interface Zutat {
  name: string
  wert: number | null
  einheit: string | null
  basis: number | null
  basisEinheit: string | null
}

export type Angabe =
  | { art: 'leer'; grund: LeerGrund }
  | { art: 'zutaten'; zutaten: Zutat[]; herkunft: Herkunft }
  | { art: 'menge'; wert: number; einheit: string | null; herkunft: Herkunft }
  | { art: 'vorrat'; rest: number; packung: number | null; einheit: string | null; herkunft: Herkunft }
  | { art: 'datum'; iso: string; herkunft: Herkunft }
  | { art: 'tage'; n: number; herkunft: Herkunft }
  | { art: 'text'; text: string; herkunft: Herkunft }
  | { art: 'datei'; url: string; herkunft: Herkunft }

/**
 * Die vier Felder, die nur der alte Weg fuellen kann.
 *
 * Fuer sie hat das neue Modell keine Spalte: das Anmischen (wie viel
 * Fluessigkeit, an welchem Tag) und die Herkunft des Batches (Quelle,
 * Analysedokument). Sie hier zu benennen ist der Punkt: die Welle, die die
 * Altspalten aufloest, muss genau diese vier erst anlegen — sonst verliert
 * sie Daten.
 */
export const OHNE_NEUE_ENTSPRECHUNG: readonly DetailFeld[] = [
  'fluessigkeit', 'rekonstituiert_am', 'quelle', 'analyse',
]

/** Die flachen Altspalten auf `stack_items`. Jede kann fehlen. */
export interface AltSpalten {
  vial_amount_mg?: number | null
  vial_amount_unit?: string | null
  reconstitution_ml?: number | null
  reconstitution_date?: string | null
  expiry_days?: number | null
  batch_number?: string | null
  batch_source?: string | null
  batch_file_url?: string | null
  default_method?: string | null
  inventory_item_id?: string | null
}

export interface AngabenQuellen {
  /** Die Zeile aus `stack_items`, mitsamt Zutaten, Bestand und Altspalten. */
  item: StackItem & AltSpalten
  /** Die verknuepfte Zeile aus `inventory_items`, wenn es eine gibt. */
  vorratsposten?: { vials_count: number } | null
  /** Die Methode des aktiven Zyklus — der Ersatz fuer `default_method`. */
  zyklusMethode?: string | null
}

const leer = (feld: DetailFeld): Angabe => ({
  art: 'leer',
  grund: OHNE_NEUE_ENTSPRECHUNG.includes(feld) ? 'keine_entsprechung' : 'nicht_gesetzt',
})

const text = (wert: string | null | undefined, herkunft: Herkunft): Angabe | null =>
  wert && wert.trim() ? { art: 'text', text: wert.trim(), herkunft } : null

/**
 * Der Wirkstoff.
 *
 * Alt steht EINE Zahl am Eintrag — sie gilt fuer die Substanz als Ganzes, also
 * bekommt sie den Anzeigenamen. Neu steht je Zutat eine, und ein
 * Kombipraeparat hat mehrere; deshalb ist das Ergebnis in beiden Faellen eine
 * Liste und nicht eine Zahl.
 */
function wirkstoff(q: AngabenQuellen): Angabe {
  const { item } = q
  if (item.vial_amount_mg != null) {
    return {
      art: 'zutaten',
      herkunft: 'alt',
      zutaten: [{
        name: item.display_name,
        wert: item.vial_amount_mg,
        einheit: item.vial_amount_unit ?? 'mg',
        basis: null,
        basisEinheit: null,
      }],
    }
  }
  const zutaten = (item.ingredients ?? [])
    .filter(z => z.amount_value != null)
    .map(z => ({
      name: z.custom_name || item.display_name,
      wert: z.amount_value,
      einheit: z.amount_unit,
      basis: z.basis_value,
      basisEinheit: z.basis_unit,
    }))
  if (zutaten.length === 0) return leer('wirkstoff')
  return { art: 'zutaten', zutaten, herkunft: 'neu' }
}

/**
 * Was noch da ist.
 *
 * Alt zaehlt der Bestand VIALS — eine Zahl ohne Einheit, weil die Form sie
 * vorgab. Neu zaehlt er, was auf der Packung steht: 30 von 60 Tabletten. Die
 * fehlende Einheit ist deshalb kein Versehen, sondern der Unterschied.
 */
function vorrat(q: AngabenQuellen): Angabe {
  if (q.item.inventory_item_id && q.vorratsposten) {
    return {
      art: 'vorrat', herkunft: 'alt',
      rest: q.vorratsposten.vials_count, packung: null, einheit: null,
    }
  }
  const inv = q.item.inventory
  if (inv?.enabled && inv.remaining_quantity != null) {
    return {
      art: 'vorrat', herkunft: 'neu',
      rest: inv.remaining_quantity,
      packung: inv.package_quantity,
      einheit: inv.package_unit,
    }
  }
  return leer('vorrat')
}

/**
 * Wie lange es nach dem Anmischen oder Oeffnen haelt — eine DAUER („28 Tage"),
 * alt am Eintrag, neu im Bestand. Das Datum auf der Packung ist eine eigene
 * Angabe (`ablauf`): nicht dieselbe Rechnung, und beide koennen zugleich gelten.
 */
function haltbarkeit(q: AngabenQuellen): Angabe {
  const tage = q.item.inventory?.use_within_days
  if (tage != null) return { art: 'tage', n: tage, herkunft: 'neu' }
  if (q.item.expiry_days != null) return { art: 'tage', n: q.item.expiry_days, herkunft: 'alt' }
  return leer('haltbarkeit')
}

/**
 * Alle Angaben des Vollbilds, je Feld mit ihrer Herkunft.
 *
 * Welche davon bei einer Form ueberhaupt gezeigt werden, entscheidet
 * `detailAbschnitte` — diese Funktion beantwortet nur, was drinsteht.
 */
export function produktAngaben(q: AngabenQuellen): Record<DetailFeld, Angabe> {
  const { item } = q
  return {
    wirkstoff: wirkstoff(q),
    kategorie: { art: 'text', text: item.category, herkunft: 'neu' },
    marke: text(item.brand, 'neu') ?? leer('marke'),
    // Zuerst der Bestand — dorthin schreibt „Bearbeiten" —, sonst die
    // Altspalte am Eintrag, die seit der Umstellung stillsteht.
    fluessigkeit: item.inventory?.reconstitution_ml != null
      ? { art: 'menge', wert: item.inventory.reconstitution_ml, einheit: 'ml', herkunft: 'neu' }
      : item.reconstitution_ml != null
        ? { art: 'menge', wert: item.reconstitution_ml, einheit: 'ml', herkunft: 'alt' }
        : leer('fluessigkeit'),
    rekonstituiert_am: item.inventory?.opened_at
      ? { art: 'datum', iso: item.inventory.opened_at, herkunft: 'neu' }
      : item.reconstitution_date
        ? { art: 'datum', iso: item.reconstitution_date, herkunft: 'alt' }
        : leer('rekonstituiert_am'),
    haltbarkeit: haltbarkeit(q),
    // Das Ablaufdatum auf der Packung — eine eigene Angabe neben der
    // Haltbarkeit nach dem Oeffnen, nicht eine Fassung davon.
    ablauf: item.inventory?.expires_at
      ? { art: 'datum', iso: item.inventory.expires_at, herkunft: 'neu' }
      : leer('ablauf'),
    vorrat: vorrat(q),
    // Die Methode steht neu am Zyklus, alt am Eintrag. Der laufende Plan
    // gilt zuerst: die Altspalte bekommt in der Seite ersatzweise „Andere"
    // (`asPeptide`), und das stand sonst ueber „Subkutan" aus dem Plan.
    // Ohne beides bleibt sie leer und wird nicht geraten.
    applikation: text(q.zyklusMethode, 'zyklus') ?? text(item.default_method, 'alt') ?? leer('applikation'),
    batch: text(item.inventory?.batch_number, 'neu') ?? text(item.batch_number, 'alt') ?? leer('batch'),
    quelle: text(item.inventory?.batch_source, 'neu') ?? text(item.batch_source, 'alt') ?? leer('quelle'),
    analyse: item.inventory?.batch_file_url
      ? { art: 'datei', url: item.inventory.batch_file_url, herkunft: 'neu' }
      : item.batch_file_url
        ? { art: 'datei', url: item.batch_file_url, herkunft: 'alt' }
        : leer('analyse'),
    // Eine Spalte, beide Wege schreiben sie.
    notizen: text(item.notes, 'neu') ?? leer('notizen'),
  }
}
