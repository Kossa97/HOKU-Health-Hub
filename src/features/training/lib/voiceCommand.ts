import type { SessionExercise, TrackingMode, TrainingSet, WeightUnit } from '../types'
import { fromDisplayWeight } from './stats'
import { usesDistance, usesDuration, usesReps, usesWeight } from './exerciseLookup'

/**
 * Sprechen und Schreiben im laufenden Training — ohne KI. Die Spracherkennung
 * des Geräts macht aus dem Gesagten Text; hier wird daraus ein fester Befehl
 * („80 kg 8", „gleich wie eben", „Pause 2 Minuten", „nächste Übung",
 * „Kniebeuge hinzufügen", „Rückgängig"). Was keiner dieser Formen entspricht,
 * ergibt `null`: dann wird nichts eingetragen.
 *
 * `parseCommand` versteht nur den Text (Deutsch und Englisch, egal welche
 * Oberflächensprache), `planSet` wendet einen Satz-Befehl auf den nächsten
 * offenen Satz an — beides ohne React, damit jede Form getestet ist.
 */

export type WeightSpoken = { value: number; unit: WeightUnit | null }

export type VoiceCommand =
  | { kind: 'set'; weight: WeightSpoken | null; reps: number | null; durationS: number | null; distanceM: number | null; bare: number[] }
  | { kind: 'same' }
  | { kind: 'add_set' }
  | { kind: 'rest'; seconds: number | null }
  | { kind: 'skip_rest' }
  | { kind: 'next_exercise' }
  | { kind: 'add_exercise'; query: string }
  | { kind: 'undo' }

const UNITS: Record<string, number> = {
  eins: 1, zwei: 2, zwo: 2, drei: 3, vier: 4, fünf: 5, fuenf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10,
  elf: 11, zwölf: 12, zwoelf: 12, dreizehn: 13, vierzehn: 14, fünfzehn: 15, fuenfzehn: 15, sechzehn: 16, siebzehn: 17,
  achtzehn: 18, neunzehn: 19,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
}
const TENS: Record<string, number> = {
  zwanzig: 20, dreißig: 30, dreissig: 30, vierzig: 40, fünfzig: 50, fuenfzig: 50, sechzig: 60, siebzig: 70, achtzig: 80,
  neunzig: 90, hundert: 100, einhundert: 100,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100,
}
const HALVES: Record<string, number> = { eineinhalb: 1.5, anderthalb: 1.5, zweieinhalb: 2.5, dreieinhalb: 3.5 }

/** Zahlwörter zu Ziffern: „acht" → 8, „zweiundzwanzig" → 22, „twenty two" → 22. */
function numberWords(text: string): string {
  const words = text.split(' ')
  const out: string[] = []
  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    if (w in HALVES) { out.push(String(HALVES[w])); continue }
    const und = w.match(/^(\p{L}+)und(\p{L}+)$/u)
    if (und && und[1] in UNITS && und[2] in TENS && TENS[und[2]] < 100) { out.push(String(UNITS[und[1]] + TENS[und[2]])); continue }
    if (w in TENS) {
      const nextUnit = words[i + 1]
      if (TENS[w] < 100 && nextUnit && nextUnit in UNITS && UNITS[nextUnit] < 10) { out.push(String(TENS[w] + UNITS[nextUnit])); i++; continue }
      out.push(String(TENS[w]))
      continue
    }
    if (w in UNITS) { out.push(String(UNITS[w])); continue }
    out.push(w)
  }
  return out.join(' ')
}

/** Kleinbuchstaben, Dezimalkomma als Punkt, Satzzeichen weg, Zahlwörter als Ziffern. */
export function normalizeSpoken(raw: string): string {
  let t = raw.toLowerCase().normalize('NFC')
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/[„“"'!?;]/g, ' ')
    .replace(/[×*]/g, ' x ')
    .replace(/,/g, ' ')
    .replace(/\.(?!\d)|(?<!\d)\./g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  t = numberWords(t)
  // „82 komma 5" / „82 point 5"
  t = t.replace(/(\d+)\s+(?:komma|point)\s+(\d+)/g, '$1.$2')
  // Zahl direkt vor der Einheit trennen: „80kg" → „80 kg"
  t = t.replace(/(\d)([a-zäöü])/g, '$1 $2')
  return t.replace(/\s+/g, ' ').trim()
}

const NUM = '(\\d+(?:\\.\\d+)?)'
const KG_WORDS = 'kg|kilo|kilos|kilogramm|kilogram|kilograms|kilogramms'
const LB_WORDS = 'lb|lbs|pfund|pound|pounds'
const REP_WORDS = 'wdh|wiederholungen|wiederholung|reps|rep|repetitions|repetition|mal wiederholt'
const SEC_WORDS = 's|sek|sec|secs|sekunde|sekunden|second|seconds'
const MIN_WORDS = 'min|minute|minuten|minutes|mins'
const DIST_WORDS = 'm|meter|metern|metre|metres|meters|km|kilometer|kilometern|kilometre|kilometres|kilometers'

/** Dauer aus „2 minuten", „90 sekunden", „1 minute 30", „1:30". */
function parseDuration(t: string): number | null {
  const clock = t.match(/\b(\d{1,2}):([0-5]\d)\b/)
  if (clock) return Number(clock[1]) * 60 + Number(clock[2])
  const min = t.match(new RegExp(`${NUM}\\s*(?:${MIN_WORDS})\\b`))
  const sec = t.match(new RegExp(`(\\d+)\\s*(?:${SEC_WORDS})\\b`))
  // „1 minute 30" ohne Sekundenwort
  const minThenBare = t.match(new RegExp(`${NUM}\\s*(?:${MIN_WORDS})\\s+(\\d{1,2})\\b(?!\\s*(?:${SEC_WORDS}))`))
  if (!min && !sec) return null
  const total = (min ? Number(min[1]) * 60 : 0) + (sec ? Number(sec[1]) : minThenBare ? Number(minThenBare[2]) : 0)
  return Math.round(total)
}

const has = (t: string, re: RegExp) => re.test(t)

/** Text → Befehl, oder null (nicht verstanden). */
export function parseCommand(raw: string): VoiceCommand | null {
  const t = normalizeSpoken(raw)
  if (!t) return null

  if (has(t, /^(rückgängig|rueckgaengig|rückgängig machen|undo|zurück|zurueck|widerrufen)$/)) return { kind: 'undo' }

  if (has(t, /\b(pause|rest|break)\b/) && has(t, /(?:^|\s)(überspringen|ueberspringen|beenden|stopp|stop|skip|end|vorbei|weg|aus)(?:\s|$)/)) return { kind: 'skip_rest' }
  if (has(t, /^(skip|weiter|überspringen|ueberspringen)$/)) return { kind: 'skip_rest' }
  if (has(t, /\b(pause|rest|break)\b/)) {
    const s = parseDuration(t)
    const bare = !s ? t.match(/\b(\d{1,3})\b/) : null
    // „Pause 90" ohne Einheit: Sekunden; „Pause 2" ohne Einheit: Minuten
    const seconds = s ?? (bare ? (Number(bare[1]) <= 10 ? Number(bare[1]) * 60 : Number(bare[1])) : null)
    return { kind: 'rest', seconds: seconds != null && seconds > 0 && seconds <= 3600 ? seconds : null }
  }

  if (has(t, /(?:^|\s)(nächste|naechste|next)\s+(übung|uebung|exercise)(?:\s|$)/)) return { kind: 'next_exercise' }

  if (has(t, /^((noch )?(ein|einen|1) (satz|set)( (mehr|dazu|hinzufügen|hinzufuegen))?|satz (hinzufügen|hinzufuegen|dazu)|weiterer satz|(one|1) more set|another set|add (a|1|one|another) set|add set|extra set)$/)) {
    return { kind: 'add_set' }
  }

  if (!/\d/.test(t) && has(t, /^(gleich wie (eben|vorher|davor|zuvor|letztes mal)|wie eben|wie vorher|nochmal|noch mal|noch einmal|dasselbe|das gleiche|gleich|selbe|same|same again|same as before|same as last( set)?|again|repeat|wiederholen)( bitte| please)?$/)) {
    return { kind: 'same' }
  }

  const addA = t.match(/^(?:füge|fuege|nimm)\s+(.+?)\s+(?:hinzu|dazu|auf)$/)
  const addB = t.match(/^(.+?)\s+(?:hinzufügen|hinzufuegen|dazu|dazunehmen|adden)$/)
  const addC = t.match(/^add\s+(.+)$/)
  const query = (addA?.[1] ?? addB?.[1] ?? addC?.[1])?.replace(/^(die|der|das|eine|einen|ein|the|an|a)\s+/, '').replace(/\s+(übung|uebung|exercise)$/, '').trim()
  if (query && !/^\d/.test(query)) return { kind: 'add_exercise', query }

  return parseSet(t)
}

function parseSet(t: string): VoiceCommand | null {
  if (!/\d/.test(t)) return null
  let rest = ` ${t} `
  const take = (re: RegExp): RegExpMatchArray | null => {
    const m = rest.match(re)
    if (m) rest = rest.replace(m[0], ' ')
    return m
  }

  let durationS: number | null = null
  const clock = take(/\s(\d{1,2}):([0-5]\d)\s/)
  if (clock) durationS = Number(clock[1]) * 60 + Number(clock[2])
  const min = take(new RegExp(`\\s${NUM}\\s*(?:${MIN_WORDS})\\s`))
  const sec = take(new RegExp(`\\s(\\d+)\\s*(?:${SEC_WORDS})\\s`))
  if (min || sec) durationS = (durationS ?? 0) + (min ? Number(min[1]) * 60 : 0) + (sec ? Number(sec[1]) : 0)

  let weight: WeightSpoken | null = null
  const kg = take(new RegExp(`\\s${NUM}\\s*(?:${KG_WORDS})\\s`))
  const lb = !kg ? take(new RegExp(`\\s${NUM}\\s*(?:${LB_WORDS})\\s`)) : null
  if (kg) weight = { value: Number(kg[1]), unit: 'kg' }
  else if (lb) weight = { value: Number(lb[1]), unit: 'lb' }

  let distanceM: number | null = null
  const dist = take(new RegExp(`\\s${NUM}\\s*(${DIST_WORDS})\\s`))
  if (dist) distanceM = Math.round(Number(dist[1]) * (dist[2].startsWith('k') ? 1000 : 1))

  let reps: number | null = null
  const repsM = take(new RegExp(`\\s(\\d+)\\s*(?:${REP_WORDS})\\s`))
  if (repsM) reps = Number(repsM[1])

  // Übrige Zahlen in Reihenfolge („80 x 8", „80 mal 8", „80 for 8")
  const bare = [...rest.matchAll(/\d+(?:\.\d+)?/g)].map(m => Number(m[0]))
  // Was außer Zahlen und Füllwörtern übrig bleibt, ist kein Satz („Satz 3 Kaffee 2")
  const leftover = rest.replace(/\d+(?:\.\d+)?/g, ' ')
    .replace(/\b(x|mal|by|for|times|at|mit|with|und|and|auf|bei|zu|satz|set|bitte|please|ich|i|habe|hab|did|done|gemacht|geschafft|ok|okay|also|so|kilo|kg)\b/g, ' ')
    .trim()
  if (leftover) return null
  if (weight == null && reps == null && durationS == null && distanceM == null && bare.length === 0) return null
  if (bare.length > 2) return null
  return { kind: 'set', weight, reps, durationS, distanceM, bare }
}

/** Grenzen, damit ein Verhörer („800 kg") nicht eingetragen wird. */
const MAX_KG = 700
const MAX_REPS = 300
const MAX_DURATION_S = 6 * 3600
const MAX_DISTANCE_M = 100_000

export type SetPlan =
  | { ok: true; patch: Partial<TrainingSet> }
  | { ok: false; reason: 'missing' | 'implausible' }

/**
 * Ein Satz-Befehl für eine Übung mit dieser Erfassungsart: was in den Satz
 * kommt. Fehlt der Hauptwert (Wdh. bzw. Zeit) und steht er auch nicht schon im
 * Satz, wird nichts eingetragen. Gewicht ohne Einheit gilt in der Einheit der
 * Einstellungen.
 */
export function planSet(
  cmd: Extract<VoiceCommand, { kind: 'set' }>,
  tracking: TrackingMode,
  current: TrainingSet,
  unit: WeightUnit,
): SetPlan {
  let weight = cmd.weight
  let reps = cmd.reps
  let durationS = cmd.durationS
  let distanceM = cmd.distanceM
  const bare = [...cmd.bare]

  const wantsWeight = usesWeight(tracking)
  const wantsReps = usesReps(tracking)
  const wantsDuration = usesDuration(tracking)
  const wantsDistance = usesDistance(tracking)

  // Freie Zahlen der Reihe nach verteilen: erst Gewicht/Strecke, dann Wdh./Zeit
  if (bare.length === 2) {
    const [a, b] = bare
    if (wantsWeight && weight == null && (wantsReps ? reps == null : durationS == null)) {
      weight = { value: a, unit: null }
      if (wantsReps) reps = b
      else durationS = b
    } else if (wantsDistance && distanceM == null && durationS == null) {
      distanceM = a
      durationS = b
    } else return { ok: false, reason: 'missing' }
  } else if (bare.length === 1) {
    const [a] = bare
    if (wantsReps && reps == null && (weight != null || !wantsWeight || (Number.isInteger(a) && a <= 50))) reps = a
    else if (wantsWeight && weight == null) weight = { value: a, unit: null }
    else if (wantsDuration && durationS == null) durationS = a
    else if (wantsDistance && distanceM == null) distanceM = a
    else return { ok: false, reason: 'missing' }
  }

  const patch: Partial<TrainingSet> = {}
  if (weight != null) {
    if (!wantsWeight) return { ok: false, reason: 'missing' }
    const kg = fromDisplayWeight(weight.value, weight.unit ?? unit)
    if (!(kg >= 0 && kg <= MAX_KG)) return { ok: false, reason: 'implausible' }
    patch.weightKg = kg
  }
  if (reps != null) {
    if (!wantsReps) return { ok: false, reason: 'missing' }
    if (!Number.isInteger(reps) || reps < 1 || reps > MAX_REPS) return { ok: false, reason: 'implausible' }
    patch.reps = reps
  }
  if (durationS != null) {
    if (!wantsDuration) return { ok: false, reason: 'missing' }
    if (durationS < 1 || durationS > MAX_DURATION_S) return { ok: false, reason: 'implausible' }
    patch.durationS = Math.round(durationS)
  }
  if (distanceM != null) {
    if (!wantsDistance) return { ok: false, reason: 'missing' }
    if (distanceM < 1 || distanceM > MAX_DISTANCE_M) return { ok: false, reason: 'implausible' }
    patch.distanceM = Math.round(distanceM)
  }

  const merged = { ...current, ...patch }
  if (wantsReps && merged.reps == null) return { ok: false, reason: 'missing' }
  if (wantsDuration && merged.durationS == null) return { ok: false, reason: 'missing' }
  if (wantsDistance && !wantsDuration && merged.distanceM == null) return { ok: false, reason: 'missing' }
  return { ok: true, patch }
}

/**
 * Wohin der nächste Eintrag geht: der erste offene Satz ab der Übung `from`
 * (nach „nächste Übung"), sonst der erste offene überhaupt.
 */
export function voiceTarget(exercises: readonly SessionExercise[], from = 0): { index: number; setIndex: number } | null {
  const search = (start: number) => {
    for (let index = start; index < exercises.length; index++) {
      const setIndex = exercises[index].sets.findIndex(s => !s.done)
      if (setIndex >= 0) return { index, setIndex }
    }
    return null
  }
  return (from > 0 ? search(from) : null) ?? search(0)
}

/** „Gleich wie eben": der zuletzt abgehakte Satz dieser Übung vor dem Ziel. */
export function lastDoneBefore(exercise: SessionExercise, setIndex: number): TrainingSet | null {
  for (let i = setIndex - 1; i >= 0; i--) if (exercise.sets[i].done) return exercise.sets[i]
  for (let i = exercise.sets.length - 1; i > setIndex; i--) if (exercise.sets[i].done) return exercise.sets[i]
  return null
}
