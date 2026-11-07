/**
 * Baseline der Wearable-Werte fuer den Gesamtfortschritt (Teilprojekt 2b, Spec
 * Abschnitt 2): beim Setzen des Starts einmal die 60 Tage davor lesen und in
 * `progress_settings.baselines` speichern. Danach aendert sie sich nicht mehr.
 *
 * - Mindestens 14 Tage (Schlaf: Naechte) mit Daten → Startwert = deren Mittel
 *   (Schlaf: Anteil der Naechte mit 7–9 h), `source: 'before'`.
 * - Sonst `source: 'after_start'`: die ersten 28 Tage nach dem Start werden die
 *   Baseline, wenn darin mindestens 14 Tage (Naechte) Daten liegen; sonst
 *   sammelt der Wert weiter (rechnet `progressScore.wearableValue`). Kein
 *   Rueckfall auf „erste 7 Tage“.
 *
 * Gelesen wird nur mit Einwilligung (`profiles.health_store_consent_at`), vor dem
 * Lesen und vor dem Speichern frisch geladen. Nach Berechtigungen fragt diese
 * Datei nie (wie `useHealthDailySync`); fehlt eine, liefert die Abfrage nichts
 * und der Wert faellt auf die 28-Tage-Regel. Android liest ohne die
 * Zusatzberechtigung READ_HEALTH_DATA_HISTORY hoechstens 30 Tage vor der
 * Freigabe — dann gibt es weniger Tage, und unter 14 gilt ebenso die 28-Tage-Regel.
 * Dazu kommen die schon abgeglichenen Tage aus `health_daily` (eigene Zeilen).
 */
import {
  getActiveEnergy, getBloodPressure, getRestingHeartRate, getSleep, getStepsByDay, isNative,
} from '../../../lib/health'
import { supabase } from '../../../lib/supabase'
import { aggregateHealthDaily, type HealthDailyRow } from '../../wearables/lib/healthDaily'
import { loadHealthStoreConsent } from '../../wearables/services/healthStore'
import {
  BASELINE_BEFORE_DAYS, BASELINE_MIN_DAYS, addDays, wearableDays, wearableStat,
  type StoredBaselines, type WearableMetricId,
} from '../lib/progressScore'

/** Werte, deren Baseline aus Health kommt (HRV und VO2max erst mit Schritt 1b). */
export const BASELINE_READ_METRICS = ['steps', 'active_kcal', 'resting_hr', 'bp_sys', 'sleep_nights'] as const satisfies readonly WearableMetricId[]

/** Die 60 Tage vor dem Start (ohne den Starttag). */
export function baselineWindow(startOn: string): { from: string; to: string } {
  return { from: addDays(startOn, -BASELINE_BEFORE_DAYS), to: addDays(startOn, -1) }
}

/** Rein: Baselines aus Tageswerten; Tage ausserhalb des Fensters zaehlen nicht. */
export function computeBaselines(rows: readonly HealthDailyRow[], startOn: string): StoredBaselines {
  const { from, to } = baselineWindow(startOn)
  const out: StoredBaselines = {}
  for (const id of BASELINE_READ_METRICS) {
    const values = wearableDays(rows, id, from, to)
    const value = wearableStat(id, values)
    out[id] = values.length >= BASELINE_MIN_DAYS && value !== null
      ? { source: 'before', on: startOn, value: Math.round(value * 1000) / 1000, days: values.length }
      : { source: 'after_start', on: startOn, days: values.length }
  }
  return out
}

type Column = Exclude<keyof HealthDailyRow, 'day'>
const COLUMNS: readonly Column[] = ['steps', 'resting_hr', 'sleep_min', 'active_kcal', 'spo2_pct', 'resp_rate', 'bp_sys', 'bp_dia']

/** Je Tag und Spalte zaehlt der frisch gelesene Wert, sonst der gespeicherte. */
export function mergeRows(device: readonly HealthDailyRow[], stored: readonly HealthDailyRow[]): HealthDailyRow[] {
  const byDay = new Map<string, HealthDailyRow>(stored.map(r => [r.day, { ...r }]))
  for (const r of device) {
    const row = byDay.get(r.day)
    if (!row) { byDay.set(r.day, { ...r }); continue }
    for (const c of COLUMNS) if (r[c] != null) row[c] = r[c]
  }
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day))
}

const localDate = (day: string) => {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/**
 * Liest das Fenster aus Apple Health / Health Connect. Eine scheiternde Abfrage
 * (etwa ohne Berechtigung) liefert keine Werte; gefragt wird nicht.
 */
async function readDeviceRows(from: string, to: string): Promise<HealthDailyRow[]> {
  // Ab Mitternacht des Vortags: Schlaf, der dort nach 18 Uhr endet, zaehlt zu `from`.
  const options = { startDate: localDate(addDays(from, -1)), endDate: localDate(addDays(to, 1)) }
  const read = <T,>(query: Promise<T[]>) => query.catch(() => [] as T[])
  const [steps, restingHr, sleep, activeEnergy, bloodPressure] = await Promise.all([
    read(getStepsByDay(options)),
    read(getRestingHeartRate(options)),
    read(getSleep(options)),
    read(getActiveEnergy(options)),
    read(getBloodPressure(options)),
  ])
  return aggregateHealthDaily({ steps, restingHr, sleep, activeEnergy, spo2: [], respRate: [], bloodPressure })
    .filter(r => r.day >= from && r.day <= to)
}

/** Schon abgeglichene eigene Tageswerte im Fenster. */
async function loadStoredRows(userId: string, from: string, to: string): Promise<HealthDailyRow[]> {
  const { data, error } = await supabase.from('health_daily')
    .select('day, steps, resting_hr, sleep_min, active_kcal, spo2_pct, resp_rate, bp_sys, bp_dia')
    .eq('user_id', userId).gte('day', from).lte('day', to)
  if (error) throw error
  return (data ?? []) as HealthDailyRow[]
}

/** Schreibt nur `baselines` (und `updated_at`); Start und uebrige Spalten bleiben. */
export async function saveBaselines(userId: string, baselines: StoredBaselines): Promise<void> {
  const { error } = await supabase.from('progress_settings')
    .upsert({ user_id: userId, baselines, updated_at: new Date().toISOString() }, { onConflict: 'user_id', defaultToNull: false })
  if (error) throw error
}

export type BaselineReadResult =
  | { status: 'saved'; baselines: StoredBaselines }
  /** Keine (oder widerrufene) Einwilligung: nichts gelesen, alle Werte nach der 28-Tage-Regel. */
  | { status: 'no_consent'; baselines: StoredBaselines }

/**
 * Beim Setzen des Starts aufrufen. Liest einmal die 60 Tage davor und
 * speichert das Ergebnis; ohne Einwilligung wird eine alte Baseline geleert.
 */
export async function readStartBaseline(userId: string, startOn: string): Promise<BaselineReadResult> {
  const consent = await loadHealthStoreConsent(userId)
  if (!consent) {
    await saveBaselines(userId, {})
    return { status: 'no_consent', baselines: {} }
  }
  const { from, to } = baselineWindow(startOn)
  const [device, stored] = await Promise.all([
    isNative ? readDeviceRows(from, to) : Promise.resolve([] as HealthDailyRow[]),
    loadStoredRows(userId, from, to),
  ])
  const baselines = computeBaselines(mergeRows(device, stored), startOn)
  // Widerruf auf einem anderen Geraet waehrend des Lesens: nichts aus Health speichern.
  if ((await loadHealthStoreConsent(userId)) !== consent) {
    await saveBaselines(userId, {})
    return { status: 'no_consent', baselines: {} }
  }
  await saveBaselines(userId, baselines)
  return { status: 'saved', baselines }
}
