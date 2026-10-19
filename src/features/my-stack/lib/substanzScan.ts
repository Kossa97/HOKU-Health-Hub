import type { DosageFormKey, StackItemIngredient, SubstanceCatalogEntry } from '../types'
import { DOSAGE_FORMS, getDosageForm, strengthShapeFor } from './dosageForms'
import { bestandteileAufloesen } from './kombination'
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
  name: string
  brand: string | null
  dosageForm: DosageFormKey | null
  staerken: ScanStaerke[]
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
  return { barcode: text(i.barcode, 14), name, brand: text(i.brand), quantity: text(i.quantity, 40) }
}

// „BPC-157", „bpc 157" und „BPC157" sind dasselbe; „Vitamin D3 1000 I.E." enthaelt
// „Vitamin D3". Verglichen wird ohne Gross/klein, Akzente und Satzzeichen.
function woerter(s: string): string[] {
  return s
    .toLocaleLowerCase('de')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
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
  let bester: { entry: SubstanceCatalogEntry; wertung: number } | null = null
  for (const entry of entries) {
    const kanonisch = passung(textEingabe, [entry.canonical_name])
    const wertung = Math.max(kanonisch * 2 + (kanonisch > 0 ? 1 : 0), passung(textEingabe, entry.aliases) * 2)
    if (wertung > 0 && (!bester || wertung > bester.wertung)) bester = { entry, wertung }
  }
  return bester?.entry ?? null
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
  const einzigerWirkstoff = etikett.ingredients.length === 1 ? etikett.ingredients[0].name : null
  const entry = findeKatalogeintrag(etikett.name, entries)
    ?? (einzigerWirkstoff ? findeKatalogeintrag(einzigerWirkstoff, entries) : null)
  return {
    quelle: 'foto',
    entry,
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
  const dosageForm = formAusText(`${produkt.name} ${produkt.quantity ?? ''}`)
  // Aus dem Namen nur, wo die Staerke je Stueck gilt (Tablette, Kapsel, Spray):
  // „1000 I.E." an einer Tropfflasche koennte je Tropfen oder je ml heissen.
  const staerke = dosageForm && strengthShapeFor(dosageForm, entry?.default_category ?? null) === 'per_unit'
    ? staerkeAusText(produkt.name)
    : null
  return {
    quelle: 'barcode',
    entry,
    name: entry?.canonical_name ?? produkt.name,
    brand: produkt.brand,
    dosageForm,
    staerken: staerke ? [{ name: null, ...staerke, perAmount: null, perUnit: null }] : [],
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
  return aktionen
}
