/**
 * Laedt die eigenen Rohdaten, rechnet den Schnappschuss und schreibt ihn nach
 * `profile_snapshots` (eine Zeile je Nutzer, RLS nur der Nutzer selbst).
 *
 * Gelesen wird nur, was `user_id = eigene id` hat — wie die uebrigen Dienste.
 * Scheitert eine Abfrage, wird nichts geschrieben: ein halber Schnappschuss
 * wuerde freigegebene Werte bei anderen verschwinden lassen. Vor der Migration
 * Profil 2a fehlen Spalten und Tabelle; dann wird ohne die neuen Spalten
 * gelesen, und das Schreiben scheitert (der Aufrufer schluckt das still).
 */
import { supabase } from '../../../lib/supabase'
import { isMissingColumn } from '../../../lib/dbErrors'
import { collectPagedRows } from '../../fortschritt/lib/pagination'
import type { BodyMeasurementEntry, DailyLogEntry, WeightLogEntry } from '../../fortschritt/types'
import type { BloodworkEntry } from '../../blutwerte/types'
import { parseBioProfile } from '../../blutwerte/lib/bioProfile'
import type { HealthDailyRow } from '../../wearables/lib/healthDaily'
import { localDay } from '../../wearables/lib/healthDaily'
import { isMissingTable, loadCustomExercises, loadRoutines, loadSessions } from '../../training/services/trainingRepo'
import {
  buildProfileSnapshot, shiftDay, STREAK_MAX_DAYS, ADHERENCE_DAYS,
  type ProfileSnapshotData, type ProfileSnapshotInput, type SnapshotDoseLog,
} from '../lib/profileSnapshot'

type QueryError = { code?: string; message?: string } | null

function fail(error: QueryError, what: string): never {
  throw new Error(`profileSnapshot.${what}: ${error?.message ?? 'unbekannt'}`)
}

const num = (v: unknown): number | null => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

type Rows = { data: Record<string, unknown>[] | null; error: QueryError }
/** Spalten als Laufzeit-Text: der Abfragetyp kennt sie nicht, die Zeilen sind schlichte Objekte. */
const asRows = (query: PromiseLike<unknown>) => query as PromiseLike<Rows>

/** Erst mit, bei fehlender Spalte (Migration noch nicht gelaufen) ohne die neuen Spalten. */
async function withFallback<T>(
  query: (columns: string) => PromiseLike<{ data: T | null; error: QueryError }>,
  columns: string,
  fallbackColumns: string,
): Promise<{ data: T | null; error: QueryError }> {
  const first = await query(columns)
  return isMissingColumn(first.error) ? query(fallbackColumns) : first
}

export async function loadProfileSnapshotInput(userId: string, now: Date, lang: 'de' | 'en'): Promise<ProfileSnapshotInput> {
  const today = localDay(now)
  // Einnahmen: so weit, wie Streak und Einnahmetreue zurueckschauen (+1 Tag Zeitzone)
  const doseFrom = shiftDay(today, -(Math.max(STREAK_MAX_DAYS, ADHERENCE_DAYS) + 1))

  const [profile, weights, daily, measurements, doses, stackCount, cycleCount, blood, health, reviews] = await Promise.all([
    withFallback<Record<string, unknown>>(
      columns => supabase.from('profiles').select(columns).eq('id', userId).maybeSingle() as PromiseLike<{ data: Record<string, unknown> | null; error: QueryError }>,
      'birth_date, bio_sex, height_cm, weight_kg, favorite_exercise, profile_routine_id',
      'birth_date, bio_sex, height_cm, weight_kg',
    ),
    collectPagedRows((from, to) => supabase
      .from('weight_logs').select('id, logged_at, weight_kg').eq('user_id', userId)
      .order('logged_at', { ascending: true }).order('id', { ascending: true }).range(from, to)),
    withFallback<Record<string, unknown>[]>(
      columns => collectPagedRows((from, to) => asRows(supabase
        .from('daily_logs').select(columns).eq('user_id', userId)
        .order('log_date', { ascending: true }).range(from, to))),
      'log_date, body_fat_pct, muscle_mass_kg',
      'log_date, body_fat_pct',
    ),
    collectPagedRows((from, to) => supabase
      .from('body_measurements').select('measured_on, site, value_cm').eq('user_id', userId)
      .order('measured_on', { ascending: true }).order('site', { ascending: true }).range(from, to)),
    withFallback<Record<string, unknown>[]>(
      columns => collectPagedRows((from, to) => asRows(supabase
        .from('dose_logs').select(columns).eq('user_id', userId).gte('logged_at', `${doseFrom}T00:00:00`)
        .order('logged_at', { ascending: true }).order('id', { ascending: true }).range(from, to))),
      'stack_item_id, logged_at, taken, auto_logged',
      'stack_item_id, logged_at, taken',
    ),
    // Nur Zahlen: keine Namen, keine Zeilen
    supabase.from('stack_items').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('archived', false),
    supabase.from('cycles').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('active', true),
    collectPagedRows((from, to) => supabase
      .from('bloodwork').select('*').eq('user_id', userId)
      .order('tested_at', { ascending: false }).order('id', { ascending: true }).range(from, to)),
    collectPagedRows((from, to) => supabase
      .from('health_daily').select('day, steps, resting_hr, sleep_min, active_kcal, spo2_pct, resp_rate, bp_sys, bp_dia')
      .eq('user_id', userId).order('day', { ascending: true }).range(from, to)),
    supabase.from('reviews').select('rating').eq('user_id', userId).eq('is_public', true).eq('hidden_by_moderation', false),
  ])

  if (profile.error) fail(profile.error, 'profile')
  if (weights.error) fail(weights.error, 'weight')
  if (daily.error) fail(daily.error, 'daily')
  if (measurements.error) fail(measurements.error, 'measurements')
  if (doses.error) fail(doses.error, 'doses')
  if (stackCount.error) fail(stackCount.error, 'stack')
  if (cycleCount.error) fail(cycleCount.error, 'cycles')
  if (blood.error) fail(blood.error, 'bloodwork')
  if (reviews.error) fail(reviews.error, 'reviews')
  // Tageswerte gibt es erst nach Teilprojekt 1; fehlt die Tabelle, ohne sie weiter.
  if (health.error && !isMissingTable(health.error)) fail(health.error, 'health')

  // Training: fehlende Tabellen zaehlen als „kein Training", andere Fehler nicht
  const orEmpty = <T,>(promise: Promise<T[]>) =>
    promise.catch((error: QueryError) => { if (isMissingTable(error)) return [] as T[]; throw error })
  const [sessions, routines, customExercises] = await Promise.all([
    orEmpty(loadSessions(userId)),
    orEmpty(loadRoutines(userId)),
    orEmpty(loadCustomExercises(userId)),
  ])

  const p = profile.data ?? {}
  const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null)

  return {
    lang,
    profile: {
      birthDate: parseBioProfile(p).birthDate,
      heightCm: num(p.height_cm),
      weightKg: num(p.weight_kg),
      favoriteExercise: text(p.favorite_exercise),
      routineId: text(p.profile_routine_id),
    },
    bio: parseBioProfile(p),
    weightLogs: (weights.data ?? []).flatMap((row: Record<string, unknown>): WeightLogEntry[] => {
      const kg = num(row.weight_kg)
      return kg == null ? [] : [{ id: String(row.id), logged_at: String(row.logged_at), weight_kg: kg }]
    }),
    dailyLogs: (daily.data ?? []).map((row): DailyLogEntry => ({
      log_date: String(row.log_date),
      energie: null, schlaf: null, wohlbefinden: null, libido: null,
      body_fat_pct: num(row.body_fat_pct),
      muscle_mass_kg: num(row.muscle_mass_kg),
    })),
    measurements: (measurements.data ?? []).flatMap((row: Record<string, unknown>): BodyMeasurementEntry[] => {
      const cm = num(row.value_cm)
      return cm == null ? [] : [{ measured_on: String(row.measured_on), site: row.site as BodyMeasurementEntry['site'], value_cm: cm }]
    }),
    doseLogs: (doses.data ?? []).map((row): SnapshotDoseLog => ({
      stack_item_id: row.stack_item_id == null ? null : String(row.stack_item_id),
      logged_at: String(row.logged_at),
      taken: typeof row.taken === 'boolean' ? row.taken : null,
      auto_logged: row.auto_logged === true,
    })),
    stackItemCount: stackCount.count ?? 0,
    activeCycleCount: cycleCount.count ?? 0,
    bloodwork: (blood.data ?? []) as BloodworkEntry[],
    healthDaily: health.error ? [] : (health.data ?? []) as HealthDailyRow[],
    sessions,
    routines,
    customExercises,
    reviewRatings: (reviews.data ?? []).flatMap((row: { rating: unknown }) => {
      const r = num(row.rating)
      return r == null ? [] : [r]
    }),
  }
}

// ─── Schreiben nur bei Aenderung ───────────────────────────────────────────

/** Ohne Aenderung wird trotzdem einmal am Tag geschrieben (falls die Zeile verloren ging). */
export const SNAPSHOT_REFRESH_MS = 24 * 60 * 60 * 1000

const lastKey = (userId: string) => `hoku.profileSnapshot.last.${userId}`

/** Kurzer, stabiler Fingerabdruck (FNV-1a, 32 bit) des JSON. */
export function snapshotHash(data: ProfileSnapshotData): string {
  const json = JSON.stringify(data)
  let h = 0x811c9dc5
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return `${json.length.toString(36)}-${(h >>> 0).toString(36)}`
}

function readLast(userId: string): { hash: string; at: number } | null {
  try {
    const raw = localStorage.getItem(lastKey(userId))
    const parsed = raw ? JSON.parse(raw) as { hash?: unknown; at?: unknown } : null
    return parsed && typeof parsed.hash === 'string' && typeof parsed.at === 'number' ? { hash: parsed.hash, at: parsed.at } : null
  } catch {
    return null
  }
}

function writeLast(userId: string, hash: string, at: number) {
  try { localStorage.setItem(lastKey(userId), JSON.stringify({ hash, at })) } catch { /* kein Speicher */ }
}

/** Schreibt den Schnappschuss, wenn er sich geaendert hat. Liefert true, wenn geschrieben wurde. */
export async function writeProfileSnapshot(userId: string, data: ProfileSnapshotData, now: Date): Promise<boolean> {
  const hash = snapshotHash(data)
  const last = readLast(userId)
  if (last && last.hash === hash && now.getTime() - last.at < SNAPSHOT_REFRESH_MS) return false
  const { error } = await supabase
    .from('profile_snapshots')
    .upsert({ user_id: userId, data, updated_at: now.toISOString() }, { onConflict: 'user_id' })
  if (error) fail(error, 'write')
  writeLast(userId, hash, now.getTime())
  return true
}

/** Ein ganzer Lauf: laden, rechnen, bei Aenderung schreiben. */
export async function syncProfileSnapshot(userId: string, lang: 'de' | 'en', now = new Date()): Promise<boolean> {
  const input = await loadProfileSnapshotInput(userId, now, lang)
  return writeProfileSnapshot(userId, buildProfileSnapshot(input, now), now)
}
