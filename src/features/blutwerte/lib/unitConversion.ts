/**
 * Umrechnung von Laboreinheiten.
 *
 * Innerhalb einer Familie (Masse-, Stoffmengen-, IE-Konzentration, Zellzahl,
 * Enzymaktivitaet) genuegt ein fester Faktor. Zwischen Masse und Stoffmenge
 * (z.B. ng/dL ↔ nmol/L) haengt der Faktor vom Stoff ab: das geht nur fuer
 * Marker mit veroeffentlichtem Faktor (MARKER_BRIDGES) und nur, wenn der
 * Marker angegeben ist. Ohne dieses Wissen wird nicht geraten — convert()
 * gibt dann null zurueck. Biologische IE werden nie in Masse umgerechnet.
 */
import { MARKER_CATALOG } from './markerCatalog'
import { MARKER_BRIDGES } from './unitBridges'

type Family = 'mass' | 'molar' | 'iu' | 'enzyme' | 'cells' | 'anteil'

/** Faktor je Einheit zur Basis ihrer Familie. */
const FAMILIES: Record<Family, Record<string, number>> = {
  // Basis ng/mL (= µg/L)
  mass: {
    'g/dl': 1e7, 'g/l': 1e6, 'mg/dl': 1e4, 'mg/l': 1e3, 'mg/ml': 1e6,
    'µg/dl': 10, 'µg/ml': 1e3, 'ng/ml': 1, 'µg/l': 1,
    'ng/dl': 0.01, 'ng/l': 1e-3, 'pg/ml': 1e-3, 'pg/dl': 1e-5,
  },
  // Basis nmol/L
  molar: { 'mol/l': 1e9, 'mmol/l': 1e6, 'µmol/l': 1e3, 'nmol/l': 1, 'pmol/l': 1e-3 },
  // Basis IU/L (= mIU/mL); U und IE stehen bei Hormonen fuer IU.
  iu: {
    'iu/l': 1, 'iu/ml': 1e3, 'miu/ml': 1, 'miu/l': 1e-3, 'µiu/ml': 1e-3,
    'mu/ml': 1, 'mu/l': 1e-3, 'µu/ml': 1e-3, 'ie/l': 1, 'mie/ml': 1, 'mie/l': 1e-3, 'µie/ml': 1e-3,
    // „E“ = Einheit, so schreiben deutsche Labore: µE/ml ist µIU/mL.
    'e/l': 1, 'me/ml': 1, 'me/l': 1e-3, 'µe/ml': 1e-3,
  },
  // Basis U/L (1 U = 1 µmol/min = 1/60 µkat)
  enzyme: { 'u/l': 1, 'ku/l': 1e3, 'µkat/l': 60, 'nkat/l': 0.06 },
  // Volumenanteil (Hämatokrit): 0,45 l/l = 45 %. Ein „%“ bei Zellzahlen ist
  // ein relativer Anteil und bleibt ohne Umrechnung in G/l.
  anteil: { 'l/l': 1, '%': 0.01 },
  // Basis /nL (= 10^9/L = G/L)
  cells: {
    '/nl': 1, '10^9/l': 1, 'tsd/µl': 1, '/µl': 1e-3, '/pl': 1e3,
    'mio/µl': 1e3, '10^12/l': 1e3, 't/l': 1e3,
  },
}

/** Normalisiert eine Einheit fuer den Vergleich: klein, ohne Leerzeichen, µ/mc/u vereinheitlicht. */
export function normalizeUnitString(unit: string): string {
  return unit
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/^mc/, 'µ')          // mcg -> µg
    .replace(/^u(?=g\/)/, 'µ')    // ug/... -> µg/...
    .replace(/^u(?=(iu|u|e|ie)\/)/, 'µ') // uIU/mL, uU/mL, uE/ml -> µ...
    .replace(/^u(?=mol\/)/, 'µ')  // umol/L -> µmol/L
    .replace(/×/g, 'x')
    .replace(/^x?10\*?\^?9\/l$/, '10^9/l')
    .replace(/^x?10\*?\^?12\/l$/, '10^12/l')
    .replace(/^g\/nl$/, '/nl')
}

/**
 * Bekannte Verschreiber, je Marker. TSH steht im Blut bei rund 0,4–4 mIU/L;
 * „mIU/mL“ waere tausendmal mehr und kommt so nicht vor — gemeint ist µIU/mL
 * (= mIU/L). Woertlich genommen sprang der Bereich um den Faktor 1000.
 */
const VERSCHRIEBEN: Record<string, Record<string, string>> = {
  TSH: { 'miu/ml': 'µiu/ml', 'mu/ml': 'µu/ml', 'mie/ml': 'µie/ml', 'me/ml': 'µe/ml' },
}

function gemeinteEinheit(unit: string, marker: string | undefined): string {
  return (marker && VERSCHRIEBEN[marker]?.[unit]) || unit
}

/** Familie der Katalog-Einheit eines Markers — klaert mehrdeutige Kuerzel. */
let familyByMarker: Map<string, Family | null> | null = null
function markerFamily(marker: string | undefined): Family | null {
  if (!marker) return null
  // einmal aufgebaut; convert() laeuft je Punkt, Grenze und Trendwert
  familyByMarker ??= new Map(MARKER_CATALOG.map(d => [d.name, d.einheit ? familyOf(normalizeUnitString(d.einheit), null) : null]))
  return familyByMarker.get(marker) ?? null
}

/**
 * Familie und Faktor einer (normalisierten) Einheit. „G/l" heisst bei
 * Zellzahlen Giga pro Liter, sonst Gramm pro Liter; „U/l" bei Hormonen
 * Internationale Einheiten, sonst Enzymaktivitaet.
 */
function familyOf(unit: string, context: Family | null): Family | null {
  if (context === 'cells' && unit === 'g/l') return 'cells'
  if (context === 'iu' && (unit === 'u/l' || unit === 'ku/l')) return 'iu'
  for (const family of Object.keys(FAMILIES) as Family[]) {
    if (unit in FAMILIES[family]) return family
  }
  return null
}

function factorOf(unit: string, family: Family): number {
  if (family === 'cells' && unit === 'g/l') return 1
  if (family === 'iu' && unit === 'u/l') return 1
  if (family === 'iu' && unit === 'ku/l') return 1e3
  return FAMILIES[family][unit]
}

/**
 * Rechnet value von der Einheit `from` in die Einheit `to` um. `marker` ist der
 * kanonische Katalogname; er erlaubt die stoffabhaengige Umrechnung zwischen
 * Masse und Stoffmenge und klaert mehrdeutige Kuerzel. Gibt null zurueck, wenn
 * die Einheiten nicht sicher umrechenbar sind.
 */
export function convert(value: number, from: string, to: string, marker?: string): number | null {
  if (!Number.isFinite(value)) return null
  const a = gemeinteEinheit(normalizeUnitString(from), marker)
  const b = gemeinteEinheit(normalizeUnitString(to), marker)
  if (a === b) return value
  if (!a || !b) return null
  const context = markerFamily(marker)
  const fa = familyOf(a, context)
  const fb = familyOf(b, context)
  if (!fa || !fb) return null
  if (fa === fb) return (value * factorOf(a, fa)) / factorOf(b, fb)

  // Masse ↔ Stoffmenge nur mit veroeffentlichtem Faktor des Markers.
  const bridge = marker ? MARKER_BRIDGES[marker] : undefined
  if (!bridge) return null
  const massUnit = normalizeUnitString(bridge.from)
  const molarUnit = normalizeUnitString(bridge.to)
  if (familyOf(massUnit, null) !== 'mass' || familyOf(molarUnit, null) !== 'molar') return null
  if (fa === 'mass' && fb === 'molar') {
    const conventional = (value * factorOf(a, 'mass')) / factorOf(massUnit, 'mass')
    const si = conventional * bridge.factor
    return (si * factorOf(molarUnit, 'molar')) / factorOf(b, 'molar')
  }
  if (fa === 'molar' && fb === 'mass') {
    const si = (value * factorOf(a, 'molar')) / factorOf(molarUnit, 'molar')
    const conventional = si / bridge.factor
    return (conventional * factorOf(massUnit, 'mass')) / factorOf(b, 'mass')
  }
  return null
}

export function canConvert(from: string, to: string, marker?: string): boolean {
  return convert(1, from, to, marker) != null
}

/** Einheitensystem fuer die Anzeige. */
export type UnitSystem = 'konventionell' | 'si'

/**
 * Die Einheit eines Markers im gewaehlten System: konventionell ist die
 * Katalog-Einheit, SI die Zieleinheit des veroeffentlichten Faktors. Ohne
 * Faktor gibt es nur eine Einheit.
 */
export function systemUnit(marker: string, catalogUnit: string, system: UnitSystem): string {
  if (system === 'si') {
    const bridge = MARKER_BRIDGES[marker]
    if (bridge && canConvert(catalogUnit, bridge.to, marker)) return bridge.to
  }
  return catalogUnit
}

/**
 * Einheiten, in denen ein Marker angezeigt werden kann: Katalog- und SI-Einheit
 * sowie die Einheiten der eigenen Messungen, soweit umrechenbar. Ohne Dubletten
 * (mU/l und mIU/L zaehlen als verschieden geschrieben, aber gleich).
 */
export function unitChoices(marker: string, catalogUnit: string, dataUnits: string[]): string[] {
  const base = catalogUnit || dataUnits[0] || ''
  if (!base) return []
  const candidates = [base, systemUnit(marker, base, 'si'), ...dataUnits]
  const seen = new Set<string>()
  const result: string[] = []
  for (const unit of candidates) {
    if (!unit.trim()) continue
    // gleicher Wert bei 1 → gleiche Einheit, nur anders geschrieben
    const factor = convert(1, unit, base, marker)
    if (factor == null) continue
    const key = factor.toPrecision(9)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(unit)
  }
  return result
}
