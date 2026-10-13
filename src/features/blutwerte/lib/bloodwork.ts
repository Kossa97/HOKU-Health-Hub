import type { BloodworkEntry } from '../types'
import type { Kategorie, KategorieFilter, MarkerDef } from './markerCatalog'
import { KATEGORIEN, MARKER_CATALOG, SONSTIGE, normalizeMarker } from './markerCatalog'
import { convert, normalizeUnitString, systemUnit, type UnitSystem } from './unitConversion'
import { markerName } from './markerCatalog.en'
import { aktiveSprache } from './sprache'
import type { BioProfile } from './bioProfile'
import { REFERENZBEREICHE, profilBereich, type RangeGroup } from './referenzbereiche'

export interface EffectiveRange {
  min: number | null
  max: number | null
  /** Woher der Bereich stammt: Labor-Referenz, Katalog oder gar nicht vorhanden. */
  source: 'lab' | 'catalog' | 'none'
  /**
   * Nur bei source 'catalog': der Bereich gilt für diese Gruppe (Geschlecht,
   * Alter). Fehlt sie, ist es der allgemeine Bereich.
   */
  gruppe?: RangeGroup
  /**
   * Für diese Gruppe gibt es keinen einzelnen Standardbereich (etwa
   * Östradiol bei Frauen); dann ist source 'none'.
   */
  keinStandard?: RangeGroup
}

export type Trend = 'up' | 'down' | 'same' | null

export type SortMode = 'kategorie' | 'name' | 'zuletzt' | 'status'

export interface MarkerPoint {
  entry: BloodworkEntry
  /** Wert in displayUnit; null, wenn die Einheit nicht sicher umrechenbar ist. */
  value: number | null
}

export interface MarkerSummary {
  /** Kanonischer Name (Katalog) oder Rohname (Custom-Marker). */
  name: string
  def: MarkerDef | null
  kategorie: KategorieFilter
  /** Alle Einträge, absteigend nach Datum. */
  entries: BloodworkEntry[]
  latest: BloodworkEntry | null
  /** Einheit, in der Chart, Trend und aktueller Wert dargestellt werden. */
  displayUnit: string
  /** Neuester Wert in displayUnit. null, wenn nicht umrechenbar. */
  displayValue: number | null
  /** Einträge (neueste zuerst) mit Wert in displayUnit. */
  points: MarkerPoint[]
  range: EffectiveRange
  inRange: boolean | null
  trend: Trend
  diff: number
}

export function toNumber(value: number | string): number {
  return typeof value === 'number' ? value : Number(String(value).replace(',', '.'))
}

/**
 * Reihenfolge: zuerst der Bereich aus der Quelle — fuer Geschlecht und Alter
 * am Messtag (IQWiG, MedlinePlus; wenn im Profil angegeben), sonst der
 * allgemeine Katalogbereich. Der Laborbereich am Eintrag gilt nur, wo es
 * keinen Quellbereich gibt.
 *
 * Warum nicht das Labor zuerst: jedes Labor hat seinen eigenen Bereich, und
 * ueber einen Verlauf aus mehreren Laboren sprang das Band dann von Messung
 * zu Messung. Ein Bereich aus einer festen Quelle macht die Werte ueber die
 * Zeit vergleichbar. Der Laborbereich bleibt an der Messung sichtbar.
 *
 * Hat ein Marker Bereiche je Geschlecht, gilt der allgemeine Katalogbereich
 * ohne Profilangabe nicht — er waere fuer das andere Geschlecht falsch; dann
 * lieber der Bereich des Labors.
 */
export function effectiveRange(
  entry: Pick<BloodworkEntry, 'ref_min' | 'ref_max' | 'tested_at' | 'menopause'> | null,
  def: MarkerDef | null,
  profil?: BioProfile | null,
): EffectiveRange {
  const labor = entry && (entry.ref_min != null || entry.ref_max != null)
    ? { min: entry.ref_min ?? null, max: entry.ref_max ?? null, source: 'lab' as const }
    : null
  const gruppe = def && entry ? profilBereich(def.name, profil, entry.tested_at, entry.menopause ?? null) : null
  if (gruppe?.art === 'bereich') return { min: gruppe.min, max: gruppe.max, source: 'catalog', gruppe: gruppe.gruppe }
  if (gruppe?.art === 'keinStandard') return labor ?? { min: null, max: null, source: 'none', keinStandard: gruppe.gruppe }
  const jeGeschlecht = def != null && def.name in REFERENZBEREICHE
  if (def && !(jeGeschlecht && labor) && (def.refMin != null || def.refMax != null)) {
    return { min: def.refMin ?? null, max: def.refMax ?? null, source: 'catalog' }
  }
  return labor ?? { min: null, max: null, source: 'none' }
}

/**
 * Rundet einen umgerechneten Wert laborueblich: ab 100 ganzzahlig, ab 10 auf
 * eine, ab 1 auf zwei Stellen, darunter drei gueltige Stellen. Umrechnungs-
 * faktoren erzeugen sonst Scheingenauigkeit wie 733,631.
 */
export function roundConverted(value: number): number {
  const abs = Math.abs(value)
  if (abs === 0 || !Number.isFinite(value)) return value
  const decimals = abs >= 100 ? 0 : abs >= 10 ? 1 : abs >= 1 ? 2 : Math.min(6, 2 - Math.floor(Math.log10(abs)))
  const f = 10 ** decimals
  return Math.round(value * f) / f
}

/** convert(), aber umgerechnete Werte gerundet; ein Wert in seiner eigenen Einheit bleibt, wie er ist. */
export function convertForDisplay(value: number, from: string, to: string, marker?: string): number | null {
  const converted = convert(value, from, to, marker)
  if (converted == null || normalizeUnitString(from) === normalizeUnitString(to)) return converted
  return roundConverted(converted)
}

export function isInRange(value: number, range: EffectiveRange): boolean | null {
  if (range.min == null && range.max == null) return null
  if (!Number.isFinite(value)) return null
  if (range.min != null && value < range.min) return false
  if (range.max != null && value > range.max) return false
  return true
}

/**
 * Erwartet Einträge absteigend nach Datum. Vergleicht die zwei jüngsten Werte,
 * die sich in displayUnit umrechnen lassen (nicht umrechenbare werden übersprungen).
 * Ohne displayUnit wird die Einheit des neuesten Eintrags verwendet.
 */
export function computeTrend(entries: BloodworkEntry[], displayUnit?: string, marker?: string): { trend: Trend; diff: number } {
  const unit = displayUnit ?? entries[0]?.unit ?? ''
  const values: number[] = []
  for (const e of entries) {
    const v = convertForDisplay(toNumber(e.value), e.unit, unit, marker)
    if (v != null) values.push(v)
    if (values.length === 2) break
  }
  if (values.length < 2) return { trend: null, diff: 0 }
  const diff = values[0] - values[1]
  if (diff > 0) return { trend: 'up', diff }
  if (diff < 0) return { trend: 'down', diff }
  return { trend: 'same', diff: 0 }
}

/**
 * Zieleinheit für die Anzeige eines Markers: die Katalog-Einheit, wenn der neueste
 * Wert dorthin umrechenbar ist — sonst die Einheit der Daten selbst. So läuft eine
 * konsistent in einer Nicht-Katalog-Einheit erfasste Historie (z.B. mmol/L, G/l)
 * nicht leer, während umrechenbare Werte weiterhin in der Standard-Einheit erscheinen.
 */
export function pickDisplayUnit(
  def: MarkerDef | null,
  latestValue: number | string | null,
  latestUnit: string,
): string {
  if (!latestUnit) return def?.einheit ?? ''
  const catalog = def?.einheit
  if (!catalog) return latestUnit
  if (latestValue == null) return catalog
  return convert(toNumber(latestValue), latestUnit, catalog, def?.name) != null ? catalog : latestUnit
}

/**
 * Gewaehlte Anzeige-Einheiten: ein System fuer alle Marker, dazu je Marker
 * eine eigene Einheit, die das System fuer diesen Marker ueberschreibt.
 * Gespeichert in `profiles.bloodwork_units`.
 */
export interface UnitPrefs {
  system?: UnitSystem
  marker?: Record<string, string>
}

/**
 * Anzeige-Einheit unter Beruecksichtigung der Wahl des Nutzers. Laesst sich der
 * neueste Wert nicht in die gewuenschte Einheit umrechnen, bleibt es bei
 * pickDisplayUnit — es wird nie eine Einheit gezeigt, in der der Wert fehlt.
 */
export function chooseDisplayUnit(
  def: MarkerDef | null,
  name: string,
  latestValue: number | string | null,
  latestUnit: string,
  prefs: UnitPrefs = {},
): string {
  const fallback = pickDisplayUnit(def, latestValue, latestUnit)
  const wanted = prefs.marker?.[name]
    ?? (def?.einheit && prefs.system ? systemUnit(def.name, def.einheit, prefs.system) : null)
  if (!wanted || latestValue == null || !latestUnit) return fallback
  return convert(toNumber(latestValue), latestUnit, wanted, def?.name) != null ? wanted : fallback
}

/**
 * Drückt einen Referenzbereich in displayUnit aus. sourceUnit ist die Einheit, in
 * der die Grenzen vorliegen (Eintrags-Einheit bei Labor, Katalog-Einheit bei Katalog).
 * Lässt sich der Bereich nicht sicher umrechnen, gibt es keinen anzeigbaren Bereich.
 */
function rangeInDisplayUnit(range: EffectiveRange, sourceUnit: string, toUnit: string, marker?: string, rounded = true): EffectiveRange {
  if (range.source === 'none') return range
  if (normalizeUnitString(sourceUnit) === normalizeUnitString(toUnit)) return range
  const conv = rounded ? convertForDisplay : convert
  const min = range.min != null ? conv(range.min, sourceUnit, toUnit, marker) : null
  const max = range.max != null ? conv(range.max, sourceUnit, toUnit, marker) : null
  if ((range.min != null && min == null) || (range.max != null && max == null)) {
    return { min: null, max: null, source: 'none' }
  }
  return { ...range, min, max }
}

/** Bereich eines einzelnen Eintrags (Labor, Gruppe oder Katalog) in toUnit. */
export function entryRange(entry: BloodworkEntry, def: MarkerDef | null, toUnit: string, profil?: BioProfile | null, rounded = true): EffectiveRange {
  const raw = effectiveRange(entry, def, profil)
  const sourceUnit = raw.source === 'lab' ? entry.unit : (def?.einheit ?? '')
  return rangeInDisplayUnit(raw, sourceUnit, toUnit, def?.name, rounded)
}

/**
 * Lage eines einzelnen Eintrags gegenueber seinem eigenen Bereich (Labor am
 * Eintrag, sonst Katalog) — in displayUnit, aus ungerundeten Werten.
 */
export function entryInRange(entry: BloodworkEntry, def: MarkerDef | null, displayUnit: string, profil?: BioProfile | null): boolean | null {
  // Ungerundet: die Rundung ist nur Anzeige und darf einen knapp auffaelligen
  // Wert nicht in den Bereich schieben.
  const range = entryRange(entry, def, displayUnit, profil, false)
  const value = convert(toNumber(entry.value), entry.unit, displayUnit, def?.name)
  return value != null ? isInRange(value, range) : null
}

/**
 * Baut je eine Zusammenfassung pro Katalog-Marker plus je eine pro Custom-Marker,
 * für den Einträge existieren.
 */
export function buildMarkerSummaries(entries: BloodworkEntry[], prefs: UnitPrefs = {}, profil?: BioProfile | null): MarkerSummary[] {
  const byName = new Map<string, { def: MarkerDef | null; entries: BloodworkEntry[] }>()

  MARKER_CATALOG.forEach(def => byName.set(def.name, { def, entries: [] }))

  entries.forEach(entry => {
    const def = normalizeMarker(entry.marker)
    const key = def ? def.name : entry.marker.trim()
    if (!key) return
    const bucket = byName.get(key) ?? { def, entries: [] }
    bucket.entries.push(entry)
    byName.set(key, bucket)
  })

  return Array.from(byName.entries()).map(([name, bucket]) => {
    const sorted = bucket.entries.slice().sort((a, b) => b.tested_at.localeCompare(a.tested_at))
    const latest = sorted[0] ?? null
    const markerKey = bucket.def?.name
    const displayUnit = chooseDisplayUnit(bucket.def, name, latest ? latest.value : null, latest?.unit ?? '', prefs)

    const points: MarkerPoint[] = sorted.map(e => ({
      entry: e,
      value: convertForDisplay(toNumber(e.value), e.unit, displayUnit, markerKey),
    }))
    // Der neueste Wert ist per Konstruktion von chooseDisplayUnit immer umrechenbar.
    const displayValue = latest ? convertForDisplay(toNumber(latest.value), latest.unit, displayUnit, markerKey) : null

    const range = latest
      ? entryRange(latest, bucket.def, displayUnit, profil)
      : rangeInDisplayUnit(effectiveRange(null, bucket.def), bucket.def?.einheit ?? '', displayUnit, markerKey)

    const { trend, diff } = computeTrend(sorted, displayUnit, markerKey)

    // Urteil aus ungerundeten Werten in displayUnit; ein nicht umrechenbarer
    // Bereich liefert kein (falsches) Urteil.
    const inRange = latest ? entryInRange(latest, bucket.def, displayUnit, profil) : null

    return {
      name,
      def: bucket.def,
      kategorie: bucket.def ? bucket.def.kategorie : SONSTIGE,
      entries: sorted,
      latest,
      displayUnit,
      displayValue,
      points,
      range,
      inRange,
      trend,
      diff,
    }
  })
}

/** Filter-Chip „Auffällige“ in der Marker-Ansicht — neben den Kategorien. */
export const AUFFAELLIG = 'auffaellig' as const
export type MarkerFilter = KategorieFilter | null | typeof AUFFAELLIG

export function filterByKategorie(
  summaries: MarkerSummary[],
  kategorie: MarkerFilter,
): MarkerSummary[] {
  if (kategorie === AUFFAELLIG) return auffaelligeWerte(summaries)
  if (!kategorie) return summaries
  return summaries.filter(s => s.kategorie === kategorie)
}

/** Sonstige landet ans Ende, Katalog-Kategorien in Katalog-Reihenfolge. */
const kategorieRang = (kategorie: KategorieFilter): number => {
  const index = KATEGORIEN.indexOf(kategorie as Kategorie)
  return index === -1 ? KATEGORIEN.length : index
}

/** Nach dem angezeigten Namen (auf Englisch: dem englischen), in der aktiven Sprache. */
const vergleicheNamen = (a: MarkerSummary, b: MarkerSummary): number =>
  markerName(a.name).localeCompare(markerName(b.name), aktiveSprache())

export function sortSummaries(summaries: MarkerSummary[], mode: SortMode): MarkerSummary[] {
  const sorted = summaries.slice()
  switch (mode) {
    case 'name':
      return sorted.sort((a, b) => vergleicheNamen(a, b))
    case 'zuletzt':
      return sorted.sort((a, b) => {
        if (!a.latest && !b.latest) return vergleicheNamen(a, b)
        if (!a.latest) return 1
        if (!b.latest) return -1
        return b.latest.tested_at.localeCompare(a.latest.tested_at)
      })
    case 'status':
      return sorted.sort((a, b) => {
        const rang = (s: MarkerSummary) => (s.inRange === false ? 0 : s.latest ? 1 : 2)
        const diff = rang(a) - rang(b)
        return diff !== 0 ? diff : vergleicheNamen(a, b)
      })
    case 'kategorie':
    default:
      return sorted.sort((a, b) => {
        const diff = kategorieRang(a.kategorie) - kategorieRang(b.kategorie)
        return diff !== 0 ? diff : vergleicheNamen(a, b)
      })
  }
}

/** Marker, deren letzter Wert außerhalb der effektiven Referenz liegt. */
export function auffaelligeWerte(summaries: MarkerSummary[]): MarkerSummary[] {
  return summaries.filter(s => s.inRange === false)
}

/** Gemessen, aber ohne nutzbaren Referenzbereich — also weder auffaellig noch im Bereich. */
export function ungepruefteWerte(summaries: MarkerSummary[]): MarkerSummary[] {
  return summaries.filter(s => s.latest !== null && s.inRange === null)
}
