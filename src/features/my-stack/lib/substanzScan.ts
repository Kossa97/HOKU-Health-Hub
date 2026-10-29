import type { DosageFormKey, StackItemIngredient, SubstanceCatalogEntry } from '../types'
import { DOSAGE_FORMS, getDosageForm, strengthShapeFor } from './dosageForms'
import { bestandteileAufloesen } from './kombination'
import type { Packungscode } from './packungscode'
import type { WizardAction } from './wizardState'

/**
 * Substanz-Scan im Assistenten: aus einem Barcode-Treffer (Open Food Facts)
 * oder einem ausgelesenen Etikett (Edge Function `label-extract`) wird ein
 * Vorschlag, und aus dem Vorschlag die Schritte, die der Assistent sonst von
 * Hand bekaeme. Gespeichert wird nichts — der Nutzer geht danach wie immer
 * durch die Schritte und prueft.
 */

export interface ScanStaerke {
  /** Wirkstoff, wenn das Etikett ihn nennt — wichtig nur bei Mischungen. */
  name: string | null
  amount: number
  unit: string
  perAmount: number | null
  perUnit: string | null
}

export interface ScanVorschlag {
  quelle: 'barcode' | 'foto'
  /** Der Katalogeintrag, wenn einer passt. Sonst wird es eine eigene Substanz. */
  entry: SubstanceCatalogEntry | null
  /**
   * Mehrere Eintraege einer Familie, und das Etikett sagt nicht, welcher:
   * „Testosteron" ohne Ester. Dann waehlt der Nutzer, bevor es weitergeht.
   * Leer, wenn der Treffer eindeutig ist.
   */
  kandidaten?: SubstanceCatalogEntry[]
  name: string
  brand: string | null
  dosageForm: DosageFormKey | null
  staerken: ScanStaerke[]
  /** Aus dem Data-Matrix-Code einer Arzneimittelpackung, vor dem Etikettfoto gelesen. */
  packung?: Packungscode
}

/** Antwort von `label-extract`, wie sie die Funktion liefert. */
export interface Etikett {
  name: string
  brand: string | null
  dosage_form: DosageFormKey | null
  ingredients: { name: string | null; amount: number; unit: string; per_amount: number | null; per_unit: string | null }[]
}

/** Antwort von `food-lookup` mit `kind: 'item'`. */
export interface BarcodeProdukt {
  barcode: string | null
  name: string
  brand: string | null
  quantity: string | null
  /** Gramm Eiweiss je `per` Gramm (Portion oder 100 g), wo Open Food Facts es kennt. */
  protein?: { amount: number; per: number } | null
}

const FORMEN: readonly DosageFormKey[] = DOSAGE_FORMS.map(form => form.key)
const EINHEITEN = ['mcg', 'mg', 'g', 'IU', 'ml']

const text = (v: unknown, max = 120): string | null => {
  if (typeof v !== 'string') return null
  const s = v.replace(/\s+/g, ' ').trim()
  return s ? s.slice(0, max) : null
}
const positiv = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null

/** Die Antwort der Edge Function noch einmal pruefen — sie kommt aus dem Netz. */
export function parseEtikett(data: unknown): Etikett | null {
  const label = data && typeof data === 'object' ? (data as { label?: unknown }).label : null
  if (!label || typeof label !== 'object') return null
  const l = label as Record<string, unknown>
  const name = text(l.name)
  if (!name) return null
  const form = FORMEN.find(f => f === l.dosage_form) ?? null
  const ingredients = (Array.isArray(l.ingredients) ? l.ingredients : []).flatMap(item => {
    if (!item || typeof item !== 'object') return []
    const i = item as Record<string, unknown>
    const amount = positiv(i.amount)
    const unit = EINHEITEN.find(u => u === i.unit)
    if (amount == null || !unit) return []
    const perUnit = text(i.per_unit, 20)
    return [{ name: text(i.name), amount, unit, per_amount: perUnit ? positiv(i.per_amount) ?? 1 : null, per_unit: perUnit }]
  })
  return { name, brand: text(l.brand), dosage_form: form, ingredients }
}

export function parseBarcodeProdukt(data: unknown): BarcodeProdukt | null {
  const item = data && typeof data === 'object' ? (data as { item?: unknown }).item : null
  if (!item || typeof item !== 'object') return null
  const i = item as Record<string, unknown>
  const name = text(i.name)
  if (!name) return null
  const p = i.protein && typeof i.protein === 'object' ? i.protein as Record<string, unknown> : null
  const amount = positiv(p?.amount)
  const per = positiv(p?.per)
  const protein = amount != null && per != null && amount <= per ? { amount, per } : null
  return { barcode: text(i.barcode, 14), name, brand: text(i.brand), quantity: text(i.quantity, 40), protein }
}

// Proteinpulver: dort ist das Eiweiss die Staerke. Bei allem anderen (Riegel,
// Muesli, Kapseln) waere es eine Naehrwertangabe, keine Dosis.
const PROTEIN = /protein|whey|casein|kasein|molke|eiweiss|eiweiß|isolat|isolate/i
const KEIN_PULVER = /riegel|\bbars?\b|drink|shake|pudding|joghurt|yogh?urt|m[uü]e?sli|chips|keks|cookie|crisp|quark/i

// „BPC-157", „bpc 157" und „BPC157" sind dasselbe; „Vitamin D3 1000 I.E." enthaelt
// „Vitamin D3". Verglichen wird ohne Gross/klein, Akzente und Satzzeichen.
// Englisch und Deutsch schreiben Ester verschieden — „Testosterone Enanthate",
// „Testosteron Enantat" —, deshalb zaehlt „th" wie „t" und ein End-„e" langer
// Woerter nicht.
function woerter(s: string): string[] {
  return s
    .toLocaleLowerCase('de')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map(wort => {
      const ohneTh = wort.replace(/th/g, 't')
      return ohneTh.length >= 5 && ohneTh.endsWith('e') ? ohneTh.slice(0, -1) : ohneTh
    })
}

const zusammen = (s: string) => woerter(s).join('')

/** Alle zusammenhaengenden Wortfolgen bis zu `max` Woertern, ohne Leerzeichen. */
function wortfolgen(s: string, max = 5): Set<string> {
  const w = woerter(s)
  const folgen = new Set<string>()
  for (let start = 0; start < w.length; start++) {
    for (let ende = start + 1; ende <= Math.min(w.length, start + max); ende++) {
      folgen.add(w.slice(start, ende).join(''))
    }
  }
  return folgen
}

/**
 * Wie gut `namen` im Text stehen: 0 = gar nicht, sonst die Laenge des laengsten
 * passenden Namens; der ganze Text als Name zaehlt mehr als ein Teil davon.
 * Namen unter drei Zeichen zaehlen nicht, sie stecken in zu vielem.
 */
function passung(textEingabe: string, namen: readonly string[]): number {
  const ganz = zusammen(textEingabe)
  if (!ganz) return 0
  const folgen = wortfolgen(textEingabe)
  let beste = 0
  for (const name of namen) {
    const schluessel = zusammen(name)
    if (schluessel.length < 3) continue
    const punkte = schluessel === ganz ? 10_000 + schluessel.length : folgen.has(schluessel) ? schluessel.length : 0
    beste = Math.max(beste, punkte)
  }
  return beste
}

/**
 * Der Katalogeintrag, dessen Name (oder Alias) im Text steht. Bei mehreren
 * gewinnt der laengste Name — „Vitamin D3" vor „Vitamin D"; bei Gleichstand
 * der kanonische Name vor dem Alias eines anderen Eintrags.
 */
export function findeKatalogeintrag(
  textEingabe: string,
  entries: readonly SubstanceCatalogEntry[],
): SubstanceCatalogEntry | null {
  return treffer(textEingabe, entries)?.entry ?? null
}

interface Treffer {
  entry: SubstanceCatalogEntry
  /** Laenge des passenden Namens — je laenger, desto genauer. */
  laenge: number
  wertung: number
}

function treffer(textEingabe: string, entries: readonly SubstanceCatalogEntry[]): Treffer | null {
  let bester: Treffer | null = null
  for (const entry of entries) {
    const kanonisch = passung(textEingabe, [entry.canonical_name])
    const alias = passung(textEingabe, entry.aliases)
    const wertung = Math.max(kanonisch * 2 + (kanonisch > 0 ? 1 : 0), alias * 2)
    if (wertung > 0 && (!bester || wertung > bester.wertung)) {
      bester = { entry, wertung, laenge: Math.max(kanonisch, alias) % 10_000 }
    }
  }
  return bester
}

/**
 * Der genaueste Treffer aus mehreren Texten (Produktname, Wirkstoffe): der
 * laengere Name gewinnt. Ein Etikett „Testosterone 250" mit dem Wirkstoff
 * „Testosterone Enanthate" ist Enantat, nicht Testosteron.
 */
function genauesterTreffer(texte: readonly string[], entries: readonly SubstanceCatalogEntry[]): SubstanceCatalogEntry | null {
  let bester: Treffer | null = null
  for (const textEingabe of texte) {
    const t = treffer(textEingabe, entries)
    if (t && (!bester || t.laenge > bester.laenge || (t.laenge === bester.laenge && t.wertung > bester.wertung))) bester = t
  }
  return bester?.entry ?? null
}

/**
 * Die Familie eines Treffers: Eintraege, deren Name mit allen Woertern des
 * Treffers beginnt und weitere hat — zu „Testosteron" die Ester. Steht keiner
 * davon im Text, ist offen, welcher es ist, und der Nutzer waehlt. „Vitamin D3"
 * gehoert nicht zu „Vitamin D": „d3" ist ein anderes Wort als „d".
 */
export function familienKandidaten(
  entry: SubstanceCatalogEntry,
  texte: readonly string[],
  entries: readonly SubstanceCatalogEntry[],
): SubstanceCatalogEntry[] {
  if (entry.component_names?.length) return []
  const stamm = woerter(entry.canonical_name)
  const kinder = entries.filter(kind => {
    if (kind.id === entry.id || kind.component_names?.length) return false
    const w = woerter(kind.canonical_name)
    return w.length > stamm.length && stamm.every((wort, i) => w[i] === wort)
  })
  if (kinder.length === 0) return []
  const genannt = kinder.some(kind => texte.some(t => passung(t, [kind.canonical_name, ...kind.aliases]) > 0))
  return genannt ? [] : [entry, ...kinder]
}

const FORM_WOERTER: readonly [RegExp, DosageFormKey][] = [
  [/nasenspray|nasal ?spray/, 'nasal_spray'],
  [/kapsel|capsule|softgel|\bcaps\b/, 'capsule'],
  [/tablette|tablet|\btabs?\b|dragee/, 'tablet'],
  [/tropfen|\bdrops\b/, 'drops'],
  [/spray/, 'spray'],
  [/pflaster|\bpatch/, 'patch'],
  [/ampulle|ampoule/, 'ampoule'],
  [/durchstechflasche|\bvials?\b/, 'vial'],
  [/\bpen\b/, 'pen'],
  [/creme|salbe|cream|ointment/, 'tube'],
  [/\bgel\b/, 'gel'],
  [/pulver|powder/, 'powder'],
]

/** Darreichungsform aus einem Produktnamen wie „Zink 25 mg Tabletten". */
export function formAusText(s: string): DosageFormKey | null {
  const klein = s.toLocaleLowerCase('de')
  return FORM_WOERTER.find(([muster]) => muster.test(klein))?.[1] ?? null
}

/**
 * Staerke aus einem Produktnamen — nur wenn genau eine Angabe darin steht.
 * Gramm zaehlt nicht: „500 g" ist bei Pulver der Packungsinhalt.
 */
export function staerkeAusText(s: string): { amount: number; unit: string } | null {
  const angaben = new Map<string, { amount: number; unit: string } | null>()
  for (const [, zahl, rohEinheit] of s.matchAll(/(\d+(?:[.,]\d+)*)\s*(µg|μg|mcg|ug|mg|i\.\s?e\.|ie|iu|i\.u\.)(?![a-zäöü])/gi)) {
    const klein = rohEinheit.toLowerCase()
    const unit = /^(µg|μg|mcg|ug)$/.test(klein) ? 'mcg' : klein === 'mg' ? 'mg' : 'IU'
    const amount = zahlAusText(zahl, unit)
    // Gleich geschrieben oder nicht: „1000 IE (1000 I.E.)" ist EINE Angabe.
    angaben.set(amount == null ? `?${zahl}` : `${amount}|${unit}`, amount == null ? null : { amount, unit })
  }
  if (angaben.size !== 1) return null
  return [...angaben.values()][0]
}

/**
 * „1.000" und „1,000" sind bei I.E. Tausender — Einheiten gibt es nicht in
 * Bruchteilen von Tausendsteln. Bei mg/mcg ist die Schreibweise mehrdeutig
 * („1,000 mg" englisch 1000, deutsch 1): dann lieber keine Zahl als eine
 * tausendfach falsche.
 */
function zahlAusText(zahl: string, unit: string): number | null {
  const tausender = /^\d{1,3}([.,]\d{3})+$/.test(zahl)
  if (tausender && unit !== 'IU') return null
  const wert = tausender ? Number(zahl.replace(/[.,]/g, '')) : Number(zahl.replace(',', '.'))
  return Number.isFinite(wert) && wert > 0 ? wert : null
}

export function vorschlagAusEtikett(etikett: Etikett, entries: readonly SubstanceCatalogEntry[]): ScanVorschlag {
  const wirkstoffe = etikett.ingredients.flatMap(i => (i.name ? [i.name] : []))
  const nachName = findeKatalogeintrag(etikett.name, entries)
  // Ein Kombipraeparat aus dem Katalog traegt seine Bestandteile selbst.
  // Sonst: mehrere benannte Wirkstoffe sind ein eigenes Produkt mit je einer
  // Zeile (siehe `scanAktionen`); bei einem gewinnt der genauere Name.
  // Wirkstoff heisst: Menge in Masse oder I.E. — „Benzylbenzoat 0,2 ml" im
  // Testosteron-Vial ist Traegerstoff, kein zweiter Wirkstoff.
  const dosiert = etikett.ingredients.filter(i => i.name && i.unit !== 'ml')
  const mehrere = dosiert.length >= 2 && etikett.ingredients.every(i => i.name)
  const entry = nachName?.component_names?.length
    ? nachName
    : mehrere ? null : genauesterTreffer([etikett.name, ...wirkstoffe], entries)
  const kandidaten = entry ? familienKandidaten(entry, [etikett.name, ...wirkstoffe], entries) : []
  return {
    quelle: 'foto',
    entry,
    ...(kandidaten.length > 0 ? { kandidaten } : {}),
    name: entry?.canonical_name ?? etikett.name,
    brand: etikett.brand,
    dosageForm: etikett.dosage_form,
    staerken: etikett.ingredients.map(i => ({
      name: i.name, amount: i.amount, unit: i.unit, perAmount: i.per_amount, perUnit: i.per_unit,
    })),
  }
}

export function vorschlagAusProdukt(produkt: BarcodeProdukt, entries: readonly SubstanceCatalogEntry[]): ScanVorschlag {
  const entry = findeKatalogeintrag(produkt.name, entries)
  const kandidaten = entry ? familienKandidaten(entry, [produkt.name], entries) : []
  const proteinpulver = Boolean(produkt.protein) && PROTEIN.test(`${produkt.name} ${entry?.canonical_name ?? ''}`)
    && !KEIN_PULVER.test(produkt.name)
  const dosageForm = formAusText(`${produkt.name} ${produkt.quantity ?? ''}`)
    ?? (proteinpulver ? 'powder' : null)
  // Aus dem Namen nur, wo die Staerke je Stueck gilt (Tablette, Kapsel, Spray):
  // „1000 I.E." an einer Tropfflasche koennte je Tropfen oder je ml heissen.
  const staerke = dosageForm && strengthShapeFor(dosageForm, entry?.default_category ?? null) === 'per_unit'
    ? staerkeAusText(produkt.name)
    : null
  const eiweiss: ScanStaerke | null = proteinpulver && dosageForm === 'powder' && produkt.protein
    ? { name: null, amount: produkt.protein.amount, unit: 'g', perAmount: produkt.protein.per, perUnit: 'g' }
    : null
  return {
    quelle: 'barcode',
    entry,
    ...(kandidaten.length > 0 ? { kandidaten } : {}),
    name: entry?.canonical_name ?? produkt.name,
    brand: produkt.brand,
    dosageForm,
    staerken: eiweiss ? [eiweiss] : staerke ? [{ name: null, ...staerke, perAmount: null, perUnit: null }] : [],
  }
}

/** Wirkstoffmenge und — wenn er zur Form passt — Bezug fuer eine Zutatenzeile. */
function zeilenAenderung(
  staerke: ScanStaerke,
  form: DosageFormKey | null,
  entry: SubstanceCatalogEntry | null,
): Partial<Omit<StackItemIngredient, 'position'>> {
  const menge = { amount_value: staerke.amount, amount_unit: staerke.unit }
  if (!form || !staerke.perUnit || staerke.perAmount == null) return menge
  const shape = strengthShapeFor(form, entry?.default_category ?? null)
  // Beim Pulver-Vial ist der Bezug das Loesungsmittel — das kommt erst beim
  // Anmischen, nicht vom Etikett.
  if (shape === 'reconstituted' || shape === 'free') return menge
  const erlaubt = new Set<string>(getDosageForm(form).basisUnits)
  if (shape === 'per_volume') erlaubt.add('ml')
  if (shape === 'per_mass') erlaubt.add('g')
  if (!erlaubt.has(staerke.perUnit)) return menge
  return { ...menge, basis_value: staerke.perAmount, basis_unit: staerke.perUnit }
}

/**
 * Die Schritte fuer den Assistenten, in dieser Reihenfolge: ein leerer
 * Entwurf, dann die Substanz (sie legt die Zeilen an), dann die Form (sie
 * setzt den Bezug jeder Zeile zurueck), zuletzt die Staerken.
 */
export function scanAktionen(
  vorschlag: ScanVorschlag,
  entries: readonly SubstanceCatalogEntry[],
  farbe = '',
): WizardAction[] {
  const { entry, dosageForm } = vorschlag
  // Ein Scan ersetzt den Entwurf, statt ihn zu ergaenzen.
  const aktionen: WizardAction[] = [{ type: 'draft_restarted', colorHex: farbe }]
  const bestandteile = entry ? bestandteileAufloesen(entry, entries) : []

  aktionen.push(entry
    ? { type: 'catalog_selected', entry, components: bestandteile }
    : { type: 'custom_started', name: vorschlag.name })

  if (dosageForm) {
    aktionen.push({ type: 'dosage_form_selected', dosageForm, catalogSuggestedUnits: entry?.suggested_units })
  }

  if (bestandteile.length > 0) {
    // Mischung: jede Staerke zu ihrem Bestandteil, ueber den Namen — oder
    // ueber die Reihenfolge, wenn das Etikett keine Namen nennt und die
    // Anzahl stimmt.
    const nachReihenfolge = vorschlag.staerken.length === bestandteile.length
      && vorschlag.staerken.every(s => !s.name)
    vorschlag.staerken.forEach((staerke, reihe) => {
      const index = nachReihenfolge
        ? reihe
        : bestandteile.findIndex(b => staerke.name && passung(staerke.name, [
            b.name, ...(entries.find(e => e.id === b.catalogId)?.aliases ?? []),
          ]) > 0)
      if (index >= 0) aktionen.push({ type: 'ingredient_changed', index, changes: zeilenAenderung(staerke, dosageForm, entry) })
    })
  } else if (!entry && vorschlag.staerken.length >= 2 && vorschlag.staerken.every(s => s.name)) {
    // Eigenes Produkt mit mehreren Wirkstoffen: je eine Zeile, mit dem Katalog
    // verknuepft, wo der Name passt.
    vorschlag.staerken.forEach((staerke, index) => {
      if (index > 0) aktionen.push({ type: 'ingredient_added' })
      const katalog = findeKatalogeintrag(staerke.name!, entries)
      aktionen.push({
        type: 'ingredient_changed',
        index,
        changes: {
          catalog_substance_id: katalog?.id ?? null,
          custom_name: katalog?.canonical_name ?? staerke.name!,
          ...zeilenAenderung(staerke, dosageForm, katalog),
        },
      })
    })
  } else if (vorschlag.staerken.length > 0) {
    // Eine Zeile: die eine Staerke — oder bei mehreren die, deren Name passt.
    // Eine fremde Staerke in der einzigen Zeile waere eine falsche Angabe.
    const passend = vorschlag.staerken.length === 1
      ? vorschlag.staerken[0]
      : entry
        ? vorschlag.staerken.find(s => s.name && passung(s.name, [entry.canonical_name, ...entry.aliases]) > 0)
        : undefined
    if (passend) aktionen.push({ type: 'ingredient_changed', index: 0, changes: zeilenAenderung(passend, dosageForm, entry) })
  }

  if (vorschlag.brand) aktionen.push({ type: 'details_changed', changes: { brand: vorschlag.brand } })
  const { packung } = vorschlag
  if (packung && (packung.charge || packung.verfall)) {
    aktionen.push({
      type: 'inventory_changed',
      changes: {
        ...(packung.charge ? { batchNumber: packung.charge } : {}),
        ...(packung.verfall ? { expiresAt: packung.verfall } : {}),
      },
    })
  }
  return aktionen
}
