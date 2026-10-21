import type { IntakeRhythm, IntervalUnit } from '../types'

// Der Rhythmus — an welchen TAGEN etwas ansteht.
//
// Vorher war das eine Liste aus acht festen Texten („Täglich", „Mo-Fr",
// „5 Tage an / 2 aus" …). Eine Liste deckt aber immer nur ab, was jemand
// vorher hineingeschrieben hat: ein Depot alle zehn Wochen, Denosumab alle
// sechs Monate, die Pille mit drei Wochen an und einer Woche Pause — alles
// nicht ausdrueckbar, und jeder neue Fall haette einen neunten Eintrag
// gebraucht.
//
// Vier Formen decken alles ab, was ein Kalender ueberhaupt hergibt:
//
//   daily      jeden Tag
//   weekdays   an bestimmten Wochentagen
//   interval   im Abstand von N Tagen / Wochen / Monaten
//   cycle      X Tage an, Y Tage aus, dann von vorn
//
// Dazu „on_demand", das kein Rhythmus ist, sondern dessen Abwesenheit.
//
// GESPEICHERT wird weiterhin ein Text in `cycles.frequency` plus die Zahlen
// in eigenen Spalten. Die alten Texte bleiben gueltig und werden weiter
// verstanden — bestehende Zyklen muessen nicht angefasst werden.

export const INTERVAL_UNITS: readonly IntervalUnit[] = ['day', 'week', 'month']

/** Grenzen je Einheit. Ein Abstand von null Tagen ist kein Abstand. */
export const INTERVAL_BOUNDS: Record<IntervalUnit, { min: number; max: number }> = {
  day: { min: 1, max: 90 },
  week: { min: 1, max: 52 },
  month: { min: 1, max: 12 },
}

/** Ein Wechselzyklus braucht mindestens einen Tag an und einen aus. */
export const CYCLE_BOUNDS = { min: 1, max: 90 }

/** Die Texte, unter denen die vier Formen in `cycles.frequency` landen. */
export const RHYTHM_FREQUENCY = {
  daily: 'Täglich',
  weekdays: 'Wochentage wählen',
  interval: 'Alle X Tage',
  cycle: 'Im Wechsel',
  on_demand: 'Bei Bedarf',
} as const

export const WEEKDAY_KEYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const

/**
 * Wochentage in Wochenfolge: „Mo, Fr" statt in der Reihenfolge, in der sie
 * angetippt wurden. Unbekannte Werte bleiben am Ende erhalten.
 */
export function inWochenfolge(tage: readonly string[]): string[] {
  const rang = (tag: string) => {
    const index = (WEEKDAY_KEYS as readonly string[]).indexOf(tag)
    return index < 0 ? WEEKDAY_KEYS.length : index
  }
  return [...tage].sort((a, b) => rang(a) - rang(b))
}

export function emptyRhythm(): IntakeRhythm {
  return {
    kind: 'daily',
    intervalValue: 2,
    intervalUnit: 'day',
    onDays: 5,
    offDays: 2,
    weekdays: [],
  }
}

/** Was in `cycles` geschrieben wird. Alles andere bleibt null. */
export interface RhythmStorage {
  frequency: string
  x_days_interval: number | null
  interval_unit: IntervalUnit | null
  cycle_on_days: number | null
  cycle_off_days: number | null
  schedule_days: string[]
}

export function rhythmToStorage(rhythm: IntakeRhythm): RhythmStorage {
  const leer: RhythmStorage = {
    frequency: RHYTHM_FREQUENCY[rhythm.kind],
    x_days_interval: null,
    interval_unit: null,
    cycle_on_days: null,
    cycle_off_days: null,
    schedule_days: [],
  }
  if (rhythm.kind === 'weekdays') return { ...leer, schedule_days: [...rhythm.weekdays] }
  if (rhythm.kind === 'interval') {
    return { ...leer, x_days_interval: rhythm.intervalValue, interval_unit: rhythm.intervalUnit }
  }
  if (rhythm.kind === 'cycle') {
    return { ...leer, cycle_on_days: rhythm.onDays, cycle_off_days: rhythm.offDays }
  }
  return leer
}

/** Was aus einem gespeicherten Zyklus gelesen wird — auch aus einem alten. */
export interface RhythmSource {
  frequency: string
  x_days_interval?: number | null
  interval_unit?: string | null
  cycle_on_days?: number | null
  cycle_off_days?: number | null
  schedule_days?: string[] | null
}

/**
 * Die alten Frequenztexte auf die vier Formen abgebildet. Sie bedeuten
 * dasselbe — „Wöchentlich" ist ein Abstand von einer Woche, „Mo-Fr" sind fuenf
 * Wochentage —, und ein bestehender Zyklus verliert beim Oeffnen nichts.
 */
export function rhythmFromStorage(quelle: RhythmSource): IntakeRhythm {
  const basis = emptyRhythm()
  const tage = [...(quelle.schedule_days ?? [])]
  const frequenz = quelle.frequency?.trim() ?? ''

  switch (frequenz) {
    case 'Bei Bedarf':
      return { ...basis, kind: 'on_demand' }
    case 'Wochentage wählen':
      return { ...basis, kind: 'weekdays', weekdays: tage }
    case 'Mo-Fr':
      return { ...basis, kind: 'weekdays', weekdays: ['Mo', 'Di', 'Mi', 'Do', 'Fr'] }
    case 'Jeden 2. Tag':
      return { ...basis, kind: 'interval', intervalValue: 2, intervalUnit: 'day' }
    case 'Wöchentlich':
      return { ...basis, kind: 'interval', intervalValue: 1, intervalUnit: 'week' }
    case '5 Tage an / 2 aus':
      return { ...basis, kind: 'cycle', onDays: 5, offDays: 2 }
    case 'Im Wechsel':
      return {
        ...basis,
        kind: 'cycle',
        onDays: quelle.cycle_on_days ?? 5,
        offDays: quelle.cycle_off_days ?? 2,
      }
    case 'Alle X Tage':
      return {
        ...basis,
        kind: 'interval',
        intervalValue: quelle.x_days_interval ?? 2,
        // Ohne Einheit ist es ein alter Zyklus: dort waren es immer Tage.
        intervalUnit: istIntervalUnit(quelle.interval_unit) ? quelle.interval_unit : 'day',
      }
    default:
      // „Täglich", „2x täglich", „3x täglich" und alles Unbekannte. Die
      // Tageszahl der beiden alten Mehrfachfrequenzen steckt in den
      // Einnahmezeitpunkten, nicht hier.
      return { ...basis, kind: 'daily', weekdays: tage }
  }
}

export function istIntervalUnit(value: unknown): value is IntervalUnit {
  return typeof value === 'string' && (INTERVAL_UNITS as readonly string[]).includes(value)
}

/** „Bei Bedarf" ist kein Plan: nichts wird faellig, nichts gilt als verpasst. */
export function isOnDemandRhythm(rhythm: IntakeRhythm): boolean {
  return rhythm.kind === 'on_demand'
}

/**
 * Die fuehrende Menge eines Plans — die des ersten Zeitpunkts. Wo EINE Zahl
 * gebraucht wird (die PK-Kurve rechnet mit einem Startzeitpunkt), ist das die
 * ehrlichste: die erste Einnahme des Tages.
 */
export function fuehrendeMenge(slots: readonly { dose: number | null }[]): number | null {
  return slots.find(slot => slot.dose != null)?.dose ?? null
}

/**
 * Der Rhythmus als Satz — als Schluessel plus Werte, nicht als fertiger Text.
 * Die App laeuft auf Deutsch UND Englisch; ein hier zusammengebauter deutscher
 * Satz waere in der englischen Oberflaeche ein Fremdkoerper.
 */
export interface RhythmSatz {
  key: string
  defaultValue: string
  values?: Record<string, string | number>
}

export function rhythmSummary(rhythm: IntakeRhythm): RhythmSatz {
  switch (rhythm.kind) {
    case 'on_demand':
      return { key: 'my_stack_rhythm_on_demand', defaultValue: 'Nur bei Bedarf' }
    case 'weekdays':
      return rhythm.weekdays.length > 0
        ? { key: 'my_stack_rhythm_summary_weekdays', defaultValue: '{{tage}}', values: { tage: inWochenfolge(rhythm.weekdays).join(', ') } }
        : { key: 'my_stack_rhythm_weekdays', defaultValue: 'Wochentage' }
    case 'interval': {
      const n = rhythm.intervalValue ?? 0
      if (n === 1) {
        if (rhythm.intervalUnit === 'week') return { key: 'my_stack_rhythm_summary_every_week', defaultValue: 'Jede Woche' }
        if (rhythm.intervalUnit === 'month') return { key: 'my_stack_rhythm_summary_every_month', defaultValue: 'Jeden Monat' }
        return { key: 'my_stack_rhythm_daily', defaultValue: 'Täglich' }
      }
      const einheit = {
        day: { key: 'my_stack_rhythm_unit_day', defaultValue: 'Tagen' },
        week: { key: 'my_stack_rhythm_unit_week', defaultValue: 'Wochen' },
        month: { key: 'my_stack_rhythm_unit_month', defaultValue: 'Monaten' },
      }[rhythm.intervalUnit]
      return {
        key: 'my_stack_rhythm_summary_interval',
        defaultValue: 'Alle {{n}} {{einheit}}',
        values: { n, einheit: einheit.key },
      }
    }
    case 'cycle':
      return {
        key: 'my_stack_rhythm_summary_cycle',
        defaultValue: '{{an}} Tage an, {{aus}} Tage Pause',
        values: { an: rhythm.onDays ?? 0, aus: rhythm.offDays ?? 0 },
      }
    default:
      return { key: 'my_stack_rhythm_daily', defaultValue: 'Täglich' }
  }
}

/** Minimal, damit die Bibliothek nicht von react-i18next abhaengt. */
type Uebersetzer = (key: string, options?: Record<string, unknown>) => unknown

/**
 * Den Satz uebersetzen. Die Einheit ist selbst ein Schluessel und wird zuerst
 * aufgeloest — sonst staende „Alle 10 my_stack_rhythm_unit_week" da.
 */
export function rhythmText(satz: RhythmSatz, t: Uebersetzer): string {
  const werte: Record<string, string | number> = { ...satz.values }
  if (typeof werte.einheit === 'string') {
    werte.einheit = String(t(werte.einheit, { defaultValue: werte.einheit }))
  }
  return String(t(satz.key, { defaultValue: satz.defaultValue, ...werte }))
}
