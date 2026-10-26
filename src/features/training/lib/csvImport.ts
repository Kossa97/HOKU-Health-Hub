/**
 * CSV-Import und -Export fuer den Workout-Tracker.
 *
 * Gelesen werden die Exporte von Hevy und Strong, geschrieben wird im
 * Hevy-Format: so koennen Nutzer ihre Daten jederzeit mitnehmen, und ein
 * eigener Export laesst sich wieder einlesen (Rundreise).
 *
 * Formate (Stand Oktober 2026, siehe Tests fuer Beispiele):
 * - Hevy: `title,start_time,end_time,description,exercise_title,superset_id,
 *   exercise_notes,set_index,set_type,weight_kg|weight_lbs,reps,
 *   distance_km|distance_miles,duration_seconds,rpe`. Zeiten als lokale
 *   Uhrzeit ohne Zeitzone, z. B. `15 Oct 2026, 18:02`. `set_index` beginnt bei 0,
 *   `set_type` ist `normal|warmup|dropset|failure`.
 * - Strong: `Date;Workout Name;Duration;Exercise Name;Set Order;Weight;Reps;
 *   Distance;Seconds;Notes;Workout Notes;RPE` (Komma oder Semikolon). `Duration`
 *   wie `1h 5m`, `Set Order` ist eine Zahl oder `W`/`D`/`F`, Zeilen mit
 *   `Rest Timer` tragen die Pause. Die Gewichtseinheit steht nicht in der Datei
 *   (Option `weightUnit`). Neuere Exporte nennen die Spalten `Weight (kg)`,
 *   `Distance (meters)`, `Duration (sec)` — beides wird erkannt.
 *
 * Alle Zeitangaben der Dateien sind Wanduhrzeit des Geraets, auf dem trainiert
 * wurde. Sie werden in der Zeitzone des importierenden Geraets gedeutet.
 */
import type {
  SessionExercise,
  SessionKind,
  SetType,
  TrainingSession,
  TrainingSet,
  WeightUnit,
} from '../types'

export type CsvFormat = 'hevy' | 'strong'
type Delimiter = ',' | ';'

export type ImportedSession = Omit<TrainingSession, 'id'>

export interface ParseWorkoutCsvOptions {
  /** Katalog-Kennung zu einem Uebungsnamen aus der Datei, sonst null. */
  resolveExercise: (name: string) => string | null
  /** Einheit der Strong-Spalte `Weight` (die Datei sagt es nicht). Standard: kg. */
  weightUnit?: WeightUnit
  /**
   * Einheit der Strong-Spalte `Distance` ohne Einheitenangabe. Standard: Meter.
   * Spalten wie `Distance (km)` oder eine Spalte `Distance Unit` gehen vor.
   */
  distanceUnit?: 'm' | 'km' | 'mi'
}

export interface ParseWorkoutCsvResult {
  sessions: ImportedSession[]
  /** Uebungsnamen ohne Treffer im Katalog, in Reihenfolge des ersten Auftretens. */
  unknownExercises: string[]
  errors: string[]
}

/** Praefix fuer Uebungen, die der Katalog nicht kennt. Die UI ersetzt die ID spaeter. */
export const UNKNOWN_EXERCISE_PREFIX = 'unknown:'

const LB_TO_KG = 0.45359237
const MILE_TO_M = 1609.344

// ---------------------------------------------------------------------------
// CSV-Grundlage
// ---------------------------------------------------------------------------

export interface CsvRecord {
  /** Zeile in der Datei, in der der Datensatz beginnt (1-basiert). */
  line: number
  fields: string[]
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

/**
 * Trennzeichen aus der ersten Zeile (ausserhalb von Anfuehrungszeichen):
 * mehr Semikolons als Kommas → Semikolon.
 */
export function detectDelimiter(text: string): Delimiter {
  const src = stripBom(text)
  let commas = 0
  let semicolons = 0
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (ch === '"') {
      quoted = !quoted
    } else if (!quoted) {
      if (ch === '\n' || ch === '\r') break
      if (ch === ',') commas++
      else if (ch === ';') semicolons++
    }
  }
  return semicolons > commas ? ';' : ','
}

/**
 * RFC-4180-Parser: Felder in Anfuehrungszeichen duerfen Trennzeichen,
 * Zeilenumbrueche und verdoppelte `""` enthalten. BOM, CRLF und CR werden
 * verstanden, leere Zeilen uebersprungen.
 */
export function parseCsv(text: string, delimiter?: Delimiter, maxRecords = Infinity): CsvRecord[] {
  const src = stripBom(text)
  const sep = delimiter ?? detectDelimiter(src)
  const records: CsvRecord[] = []
  let fields: string[] = []
  let field = ''
  let quoted = false
  let line = 1
  let recordLine = 1
  let fieldStarted = false

  const endRecord = () => {
    fields.push(field)
    const empty = fields.length === 1 && fields[0] === '' && !fieldStarted
    if (!empty) records.push({ line: recordLine, fields })
    fields = []
    field = ''
    fieldStarted = false
  }

  for (let i = 0; i < src.length && records.length < maxRecords; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else {
          quoted = false
        }
      } else {
        if (ch === '\n' || (ch === '\r' && src[i + 1] !== '\n')) line++
        field += ch === '\r' && src[i + 1] === '\n' ? '' : ch
      }
      continue
    }
    if (ch === '"' && field === '') {
      quoted = true
      fieldStarted = true
    } else if (ch === sep) {
      fields.push(field)
      field = ''
      fieldStarted = true
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      endRecord()
      line++
      recordLine = line
    } else {
      field += ch
    }
  }
  if (records.length < maxRecords && (field !== '' || fields.length > 0 || fieldStarted)) endRecord()
  return records
}

function headerKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

function headerIndex(header: string[]): Map<string, number> {
  const map = new Map<string, number>()
  header.forEach((h, i) => {
    const key = headerKey(h)
    if (!map.has(key)) map.set(key, i)
  })
  return map
}

function formatFromHeader(header: string[]): CsvFormat | null {
  const keys = new Set(header.map(headerKey))
  if (keys.has('title') && keys.has('start_time') && keys.has('exercise_title')) return 'hevy'
  if (keys.has('date') && keys.has('exercise name') && keys.has('set order')) return 'strong'
  return null
}

/** Erkennt das Format an der Kopfzeile. */
export function detectFormat(text: string): CsvFormat | null {
  const [first] = parseCsv(text, undefined, 1)
  return first ? formatFromHeader(first.fields) : null
}

// ---------------------------------------------------------------------------
// Werte
// ---------------------------------------------------------------------------

/** Lokale Wanduhrzeit, wie sie in der Datei steht. */
interface WallTime {
  y: number
  mo: number
  d: number
  h: number
  mi: number
  s: number
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  // Falls ein Export die Monate eingedeutscht hat.
  mär: 3, mrz: 3, mai: 5, okt: 10, dez: 12,
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function to24h(hour: number, ampm: string | undefined): number {
  if (!ampm) return hour
  const pm = ampm.toUpperCase() === 'PM'
  if (pm && hour !== 12) return hour + 12
  if (!pm && hour === 12) return 0
  return hour
}

function validWall(w: WallTime): WallTime | null {
  if (w.mo < 1 || w.mo > 12 || w.d < 1 || w.d > 31 || w.h > 23 || w.mi > 59 || w.s > 59) return null
  return w
}

/**
 * Datum/Uhrzeit aus Hevy (`15 Oct 2026, 18:02`, auch `Oct 15, 2026, 6:02 PM`),
 * Strong (`2026-10-15 18:02:11`) oder ISO. Ein ISO-Wert mit Zeitzone wird
 * in lokale Zeit umgerechnet.
 */
function parseWallTime(raw: string): WallTime | null {
  const s = raw.trim()
  if (!s) return null
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[T ](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/)
  if (m) {
    return validWall({ y: +m[1], mo: +m[2], d: +m[3], h: +m[4], mi: +m[5], s: m[6] ? +m[6] : 0 })
  }
  if (/^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:?\d{2})$/.test(s)) {
    const date = new Date(s)
    if (Number.isNaN(date.getTime())) return null
    return {
      y: date.getFullYear(), mo: date.getMonth() + 1, d: date.getDate(),
      h: date.getHours(), mi: date.getMinutes(), s: date.getSeconds(),
    }
  }
  m = s.match(/^(\d{1,2})\.?\s+([A-Za-zäÄ]{3,})\.?\s+(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i)
  if (m) {
    const mo = MONTHS[m[2].toLowerCase().slice(0, 3)]
    if (!mo) return null
    return validWall({ y: +m[3], mo, d: +m[1], h: to24h(+m[4], m[7]), mi: +m[5], s: m[6] ? +m[6] : 0 })
  }
  m = s.match(/^([A-Za-z]{3,})\.?\s+(\d{1,2}),?\s+(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i)
  if (m) {
    const mo = MONTHS[m[1].toLowerCase().slice(0, 3)]
    if (!mo) return null
    return validWall({ y: +m[3], mo, d: +m[2], h: to24h(+m[4], m[7]), mi: +m[5], s: m[6] ? +m[6] : 0 })
  }
  return null
}

function wallToDate(w: WallTime): Date {
  return new Date(w.y, w.mo - 1, w.d, w.h, w.mi, w.s)
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** Zeitzonenunabhaengiger Schluessel, damit `externalId` auf jedem Geraet gleich ist. */
function wallKey(w: WallTime): string {
  return `${w.y}-${pad2(w.mo)}-${pad2(w.d)}T${pad2(w.h)}:${pad2(w.mi)}:${pad2(w.s)}`
}

/** Strong-Dauer: `1h 5m`, `45m`, `1h 5m 20s`, `1:05:00` oder Sekunden. */
function parseDurationText(raw: string): number | null {
  const s = raw.trim().toLowerCase()
  if (!s) return null
  let m = s.match(/^(?:(\d+)\s*h)?\s*(?:(\d+)\s*m(?:in)?)?\s*(?:(\d+)\s*s)?$/)
  if (m && (m[1] || m[2] || m[3])) return (+(m[1] ?? 0)) * 3600 + (+(m[2] ?? 0)) * 60 + (+(m[3] ?? 0))
  m = s.match(/^(\d+):(\d{2}):(\d{2})$/)
  if (m) return +m[1] * 3600 + +m[2] * 60 + +m[3]
  m = s.match(/^(\d+):(\d{2})$/)
  if (m) return +m[1] * 60 + +m[2]
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null
}

function round(n: number, digits: number): number {
  const f = 10 ** digits
  return Math.round(n * f) / f
}

type NumberResult = { ok: true; value: number | null } | { ok: false }

/** Zahl aus einem Feld; leer → null. Dezimalkomma (`82,5`) wird verstanden. */
function readNumber(raw: string | undefined): NumberResult {
  const s = (raw ?? '').trim()
  if (!s) return { ok: true, value: null }
  const normalized = /^-?\d+,\d+$/.test(s) ? s.replace(',', '.') : s
  const n = Number(normalized)
  return Number.isFinite(n) ? { ok: true, value: n } : { ok: false }
}

// ---------------------------------------------------------------------------
// Einheitliche Zeile → Einheiten
// ---------------------------------------------------------------------------

/** Eine Zeile beider Formate, auf ein gemeinsames Mass gebracht. */
interface NormRow {
  line: number
  title: string
  start: WallTime
  end: WallTime | null
  sessionDurationS: number | null
  sessionNotes: string | null
  /** Leer = Zeile ohne Uebung (Einheit ohne Saetze, z. B. ein Lauf aus dem eigenen Export). */
  exerciseName: string
  supersetGroup: number | null
  exerciseNotes: string | null
  /** Laufende Nummer des Satzes; ein Rueckschritt beginnt einen neuen Uebungsblock. */
  setOrder: number | null
  /** Strong `Rest Timer`: Pause fuer die laufende Uebung, kein Satz. */
  isRest: boolean
  restS: number | null
  set: TrainingSet | null
  sessionDistanceM: number | null
}

class RowErrors {
  readonly list: string[] = []
  add(line: number, message: string) {
    this.list.push(`Zeile ${line}: ${message}`)
  }
}

function cell(fields: string[], idx: Map<string, number>, ...names: string[]): string | undefined {
  for (const name of names) {
    const i = idx.get(name)
    if (i !== undefined) return fields[i]
  }
  return undefined
}

function hasColumn(idx: Map<string, number>, ...names: string[]): boolean {
  return names.some((n) => idx.has(n))
}

function textOrNull(raw: string | undefined): string | null {
  const s = (raw ?? '').trim()
  return s ? s : null
}

function num(
  raw: string | undefined,
  line: number,
  column: string,
  errors: RowErrors,
): number | null {
  const r = readNumber(raw)
  if (!r.ok) {
    errors.add(line, `„${raw}“ in ${column} ist keine Zahl.`)
    return null
  }
  return r.value
}

function hevySetType(raw: string | undefined): SetType {
  switch ((raw ?? '').trim().toLowerCase()) {
    case 'warmup':
    case 'warm_up':
    case 'warm-up':
      return 'warmup'
    case 'dropset':
    case 'drop_set':
    case 'drop':
      return 'drop'
    case 'failure':
      return 'failure'
    default:
      return 'normal'
  }
}

function normalizeHevy(rec: CsvRecord, idx: Map<string, number>, errors: RowErrors): NormRow | null {
  const f = rec.fields
  const line = rec.line
  const startRaw = cell(f, idx, 'start_time') ?? ''
  const start = parseWallTime(startRaw)
  if (!start) {
    errors.add(line, `Startzeit „${startRaw}“ nicht lesbar, Zeile übersprungen.`)
    return null
  }
  const endRaw = cell(f, idx, 'end_time') ?? ''
  const end = parseWallTime(endRaw)
  if (endRaw.trim() && !end) errors.add(line, `Endzeit „${endRaw}“ nicht lesbar.`)

  const kg = num(cell(f, idx, 'weight_kg'), line, 'weight_kg', errors)
  const lbs = num(cell(f, idx, 'weight_lbs'), line, 'weight_lbs', errors)
  const km = num(cell(f, idx, 'distance_km'), line, 'distance_km', errors)
  const miles = num(cell(f, idx, 'distance_miles'), line, 'distance_miles', errors)
  const reps = num(cell(f, idx, 'reps'), line, 'reps', errors)
  const durationS = num(cell(f, idx, 'duration_seconds'), line, 'duration_seconds', errors)
  const rpe = num(cell(f, idx, 'rpe'), line, 'rpe', errors)
  const setIndex = num(cell(f, idx, 'set_index'), line, 'set_index', errors)
  const superset = num(cell(f, idx, 'superset_id'), line, 'superset_id', errors)

  const weightKg = kg ?? (lbs != null ? round(lbs * LB_TO_KG, 3) : null)
  const distanceM = km != null ? round(km * 1000, 2) : miles != null ? round(miles * MILE_TO_M, 2) : null
  const exerciseName = (cell(f, idx, 'exercise_title') ?? '').trim()
  const isEmptySet =
    setIndex == null && weightKg == null && reps == null && distanceM == null && durationS == null

  return {
    line,
    title: (cell(f, idx, 'title') ?? '').trim(),
    start,
    end,
    sessionDurationS: null,
    sessionNotes: textOrNull(cell(f, idx, 'description')),
    exerciseName,
    supersetGroup: superset,
    exerciseNotes: textOrNull(cell(f, idx, 'exercise_notes')),
    setOrder: setIndex,
    isRest: false,
    restS: null,
    set:
      !exerciseName || isEmptySet
        ? null
        : {
            type: hevySetType(cell(f, idx, 'set_type')),
            weightKg,
            reps,
            durationS,
            distanceM,
            rpe,
            done: true,
          },
    sessionDistanceM: !exerciseName ? distanceM : null,
  }
}

function strongUnitFactor(unit: string | undefined): { weight?: number; distance?: number } {
  switch ((unit ?? '').trim().toLowerCase()) {
    case 'kg':
      return { weight: 1 }
    case 'lb':
    case 'lbs':
      return { weight: LB_TO_KG }
    case 'm':
      return { distance: 1 }
    case 'km':
      return { distance: 1000 }
    case 'mi':
    case 'miles':
      return { distance: MILE_TO_M }
    case 'ft':
      return { distance: 0.3048 }
    default:
      return {}
  }
}

function normalizeStrong(
  rec: CsvRecord,
  idx: Map<string, number>,
  errors: RowErrors,
  opts: ParseWorkoutCsvOptions,
): NormRow | null {
  const f = rec.fields
  const line = rec.line
  const dateRaw = cell(f, idx, 'date') ?? ''
  const start = parseWallTime(dateRaw)
  if (!start) {
    errors.add(line, `Datum „${dateRaw}“ nicht lesbar, Zeile übersprungen.`)
    return null
  }

  // Dauer der Einheit: `Duration` (1h 5m) oder `Duration (sec)`.
  let sessionDurationS: number | null = null
  const durRaw = cell(f, idx, 'duration (sec)', 'duration', 'workout duration')
  if (durRaw && durRaw.trim()) {
    sessionDurationS = parseDurationText(durRaw)
    if (sessionDurationS == null) errors.add(line, `Dauer „${durRaw}“ nicht lesbar.`)
  }

  // Gewicht: Spalte mit Einheit > Spalte `Weight Unit` > Option.
  let weightKg: number | null
  if (hasColumn(idx, 'weight (kg)')) {
    weightKg = num(cell(f, idx, 'weight (kg)'), line, 'Weight (kg)', errors)
  } else if (hasColumn(idx, 'weight (lbs)', 'weight (lb)')) {
    const lbs = num(cell(f, idx, 'weight (lbs)', 'weight (lb)'), line, 'Weight (lbs)', errors)
    weightKg = lbs != null ? lbs * LB_TO_KG : null
  } else {
    const w = num(cell(f, idx, 'weight'), line, 'Weight', errors)
    const rowFactor = strongUnitFactor(cell(f, idx, 'weight unit')).weight
    const factor = rowFactor ?? (opts.weightUnit === 'lb' ? LB_TO_KG : 1)
    weightKg = w != null ? w * factor : null
  }

  let distanceM: number | null
  if (hasColumn(idx, 'distance (meters)', 'distance (m)')) {
    distanceM = num(cell(f, idx, 'distance (meters)', 'distance (m)'), line, 'Distance', errors)
  } else if (hasColumn(idx, 'distance (km)')) {
    const d = num(cell(f, idx, 'distance (km)'), line, 'Distance (km)', errors)
    distanceM = d != null ? d * 1000 : null
  } else if (hasColumn(idx, 'distance (miles)', 'distance (mi)')) {
    const d = num(cell(f, idx, 'distance (miles)', 'distance (mi)'), line, 'Distance (miles)', errors)
    distanceM = d != null ? d * MILE_TO_M : null
  } else {
    const d = num(cell(f, idx, 'distance'), line, 'Distance', errors)
    const rowFactor = strongUnitFactor(cell(f, idx, 'distance unit')).distance
    const factor = rowFactor ?? strongUnitFactor(opts.distanceUnit ?? 'm').distance ?? 1
    distanceM = d != null ? d * factor : null
  }

  // Strong schreibt fehlende Werte gern als 0.
  const zeroToNull = (n: number | null) => (n == null || n === 0 ? null : n)
  weightKg = zeroToNull(weightKg != null ? round(weightKg, 3) : null)
  distanceM = zeroToNull(distanceM != null ? round(distanceM, 2) : null)
  const reps = zeroToNull(num(cell(f, idx, 'reps'), line, 'Reps', errors))
  const seconds = zeroToNull(num(cell(f, idx, 'seconds'), line, 'Seconds', errors))
  const rpe = zeroToNull(num(cell(f, idx, 'rpe'), line, 'RPE', errors))

  const orderRaw = (cell(f, idx, 'set order') ?? '').trim()
  const orderKey = orderRaw.toLowerCase()
  let type: SetType = 'normal'
  let setOrder: number | null = null
  let restS: number | null = null
  if (orderKey === 'rest timer') {
    restS = seconds
  } else if (orderKey === 'w') {
    type = 'warmup'
  } else if (orderKey === 'd') {
    type = 'drop'
  } else if (orderKey === 'f') {
    type = 'failure'
  } else if (/^\d+$/.test(orderKey)) {
    setOrder = +orderKey
  } else if (orderKey) {
    errors.add(line, `Unbekannte Satz-Kennung „${orderRaw}“, als normaler Satz übernommen.`)
  }
  // Ein eigenes Feld `Set Type` (manche Exporte) geht vor.
  const typeRaw = (cell(f, idx, 'set type') ?? '').trim().toLowerCase()
  if (typeRaw) {
    if (typeRaw.startsWith('warm')) type = 'warmup'
    else if (typeRaw.startsWith('drop')) type = 'drop'
    else if (typeRaw.includes('failure')) type = 'failure'
  }

  const exerciseName = (cell(f, idx, 'exercise name') ?? '').trim()
  return {
    line,
    title: (cell(f, idx, 'workout name') ?? '').trim(),
    start,
    end: null,
    sessionDurationS,
    sessionNotes: textOrNull(cell(f, idx, 'workout notes')),
    exerciseName,
    supersetGroup: null,
    exerciseNotes: textOrNull(cell(f, idx, 'notes')),
    setOrder,
    isRest: orderKey === 'rest timer',
    restS,
    set:
      !exerciseName || orderKey === 'rest timer'
        ? null
        : { type, weightKg, reps, durationS: seconds, distanceM, rpe, done: true },
    sessionDistanceM: null,
  }
}

interface ExerciseBlock {
  name: string
  lastOrder: number | null
  notes: string[]
  exercise: SessionExercise
}

interface SessionDraft {
  key: string
  title: string
  start: WallTime
  end: WallTime | null
  durationS: number | null
  notes: string | null
  distanceM: number | null
  blocks: ExerciseBlock[]
}

function sessionKind(exercises: SessionExercise[]): SessionKind {
  const sets = exercises.flatMap((e) => e.sets)
  if (sets.length === 0) return exercises.length === 0 ? 'other' : 'strength'
  const lifting = sets.some((s) => (s.weightKg ?? 0) > 0 || (s.reps ?? 0) > 0)
  const cardio = sets.some((s) => (s.distanceM ?? 0) > 0 || (s.durationS ?? 0) > 0)
  return !lifting && cardio ? 'other' : 'strength'
}

/**
 * Liest einen Hevy- oder Strong-Export. Die Einheiten haben noch keine `id`;
 * unbekannte Uebungen tragen `unknown:<Name>` als exerciseId.
 */
export function parseWorkoutCsv(text: string, opts: ParseWorkoutCsvOptions): ParseWorkoutCsvResult {
  const errors = new RowErrors()
  const records = parseCsv(text)
  if (records.length === 0) {
    return { sessions: [], unknownExercises: [], errors: ['Die Datei ist leer.'] }
  }
  const [header, ...rows] = records
  const format = formatFromHeader(header.fields)
  if (!format) {
    return {
      sessions: [],
      unknownExercises: [],
      errors: ['Unbekanntes Format: erwartet wird ein CSV-Export aus Hevy oder Strong.'],
    }
  }
  const idx = headerIndex(header.fields)
  if (format === 'hevy' && !hasColumn(idx, 'weight_kg', 'weight_lbs')) {
    errors.list.push('Spalte weight_kg bzw. weight_lbs fehlt, Gewichte werden nicht übernommen.')
  }

  const drafts = new Map<string, SessionDraft>()
  const resolved = new Map<string, string>()
  const unknown: string[] = []
  const resolve = (name: string): string => {
    const hit = resolved.get(name)
    if (hit) return hit
    const id = opts.resolveExercise(name)
    const finalId = id ?? `${UNKNOWN_EXERCISE_PREFIX}${name}`
    if (!id) unknown.push(name)
    resolved.set(name, finalId)
    return finalId
  }

  for (const rec of rows) {
    if (rec.fields.every((v) => v.trim() === '')) continue
    const row =
      format === 'hevy' ? normalizeHevy(rec, idx, errors) : normalizeStrong(rec, idx, errors, opts)
    if (!row) continue

    const key = format === 'hevy'
      ? `${wallKey(row.start)}|${row.end ? wallKey(row.end) : ''}|${row.title}`
      : `${wallKey(row.start)}|${row.title}`
    let draft = drafts.get(key)
    if (!draft) {
      draft = {
        key,
        title: row.title,
        start: row.start,
        end: row.end,
        durationS: row.sessionDurationS,
        notes: null,
        distanceM: null,
        blocks: [],
      }
      drafts.set(key, draft)
    }
    if (!draft.notes && row.sessionNotes) draft.notes = row.sessionNotes
    if (draft.durationS == null && row.sessionDurationS != null) draft.durationS = row.sessionDurationS

    if (!row.exerciseName) {
      if (row.sessionDistanceM != null) draft.distanceM = row.sessionDistanceM
      continue
    }

    const last = draft.blocks[draft.blocks.length - 1]
    const sameAsLast = last?.name === row.exerciseName
    if (row.isRest || (row.set == null && sameAsLast)) {
      // Rest-Timer-Zeile oder Zeile ohne Satz zur laufenden Uebung.
      if (last && sameAsLast) {
        if (row.restS != null) last.exercise.restS = row.restS
        if (row.exerciseNotes && !last.notes.includes(row.exerciseNotes)) last.notes.push(row.exerciseNotes)
      }
      continue
    }

    const startsNewBlock =
      !last ||
      last.name !== row.exerciseName ||
      (last.exercise.supersetGroup ?? null) !== row.supersetGroup ||
      (row.setOrder != null && last.lastOrder != null && row.setOrder <= last.lastOrder)

    let block = last
    if (startsNewBlock) {
      block = {
        name: row.exerciseName,
        lastOrder: null,
        notes: [],
        exercise: { exerciseId: resolve(row.exerciseName), supersetGroup: row.supersetGroup, sets: [] },
      }
      draft.blocks.push(block)
    }
    if (row.setOrder != null) block.lastOrder = row.setOrder
    if (row.exerciseNotes && !block.notes.includes(row.exerciseNotes)) block.notes.push(row.exerciseNotes)
    if (row.set) block.exercise.sets.push(row.set)
  }

  const source = format === 'hevy' ? 'import_hevy' : 'import_strong'
  const sessions: ImportedSession[] = []
  for (const d of drafts.values()) {
    const exercises: SessionExercise[] = d.blocks.map((b) => ({
      ...b.exercise,
      restS: b.exercise.restS ?? null,
      notes: b.notes.length ? b.notes.join('\n') : null,
    }))
    const startDate = wallToDate(d.start)
    let durationS = d.durationS
    let endedAt: string | null = null
    if (d.end) {
      const endDate = wallToDate(d.end)
      if (endDate.getTime() >= startDate.getTime()) {
        endedAt = endDate.toISOString()
        if (durationS == null) durationS = Math.round((endDate.getTime() - startDate.getTime()) / 1000)
      }
    } else if (durationS != null) {
      endedAt = new Date(startDate.getTime() + durationS * 1000).toISOString()
    }
    const kind = sessionKind(exercises)
    let distanceM = d.distanceM
    if (distanceM == null && kind === 'other') {
      const sum = exercises.flatMap((e) => e.sets).reduce((acc, s) => acc + (s.distanceM ?? 0), 0)
      distanceM = sum > 0 ? round(sum, 2) : null
    }
    sessions.push({
      kind,
      title: d.title,
      startedAt: startDate.toISOString(),
      endedAt,
      durationS,
      distanceM,
      kcal: null,
      avgHr: null,
      rpe: null,
      notes: d.notes,
      routineId: null,
      exercises,
      source,
      externalId: `${format}:${wallKey(d.start)}|${d.title}`,
    })
  }

  return { sessions, unknownExercises: unknown, errors: errors.list }
}

// ---------------------------------------------------------------------------
// Export (Hevy-kompatibel)
// ---------------------------------------------------------------------------

export const HEVY_HEADER = [
  'title', 'start_time', 'end_time', 'description', 'exercise_title', 'superset_id',
  'exercise_notes', 'set_index', 'set_type', 'weight_kg', 'reps', 'distance_km',
  'duration_seconds', 'rpe',
] as const

function csvField(value: string | number | null | undefined): string {
  if (value == null) return ''
  const s = String(value)
  return /[",\r\n]|^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** `15 Oct 2026, 18:02` in lokaler Zeit, wie Hevy es schreibt. */
function formatHevyDate(date: Date): string {
  return `${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}, ${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

function hevySetTypeOut(type: SetType): string {
  return type === 'drop' ? 'dropset' : type
}

function numOut(n: number | null | undefined, digits = 3): string {
  return n == null ? '' : String(round(n, digits))
}

/**
 * Schreibt Einheiten im Hevy-Exportformat (kg, km). Einheiten ohne Uebung
 * (z. B. ein Lauf) bekommen eine Zeile ohne `exercise_title` mit Strecke;
 * Uebungen ohne Satz eine Zeile ohne `set_index`. Zeiten werden auf Minuten
 * gekuerzt, wie bei Hevy.
 */
export function toCsv(
  sessions: ReadonlyArray<ImportedSession | TrainingSession>,
  nameOf: (exerciseId: string) => string,
): string {
  const lines: string[] = [HEVY_HEADER.join(',')]
  for (const s of sessions) {
    const start = new Date(s.startedAt)
    const end = s.endedAt
      ? new Date(s.endedAt)
      : s.durationS != null
        ? new Date(start.getTime() + s.durationS * 1000)
        : start
    const head = [s.title, formatHevyDate(start), formatHevyDate(end), s.notes ?? '']
    const push = (cells: Array<string | number | null | undefined>) =>
      lines.push([...head, ...cells].map(csvField).join(','))

    if (s.exercises.length === 0) {
      push(['', '', '', '', '', '', '', numOut(s.distanceM != null ? s.distanceM / 1000 : null, 5), '', ''])
      continue
    }
    for (const ex of s.exercises) {
      const exHead = [nameOf(ex.exerciseId), ex.supersetGroup ?? '', ex.notes ?? '']
      if (ex.sets.length === 0) {
        push([...exHead, '', '', '', '', '', '', ''])
        continue
      }
      ex.sets.forEach((set, i) => {
        push([
          ...exHead,
          i,
          hevySetTypeOut(set.type),
          numOut(set.weightKg),
          numOut(set.reps),
          numOut(set.distanceM != null ? set.distanceM / 1000 : null, 5),
          numOut(set.durationS),
          numOut(set.rpe),
        ])
      })
    }
  }
  return lines.join('\n') + '\n'
}
