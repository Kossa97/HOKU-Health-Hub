import { supabase } from '../../../lib/supabase'
import {
  DEFAULT_TRAINING_SETTINGS,
  ROUTINE_FOLDER_MAX,
  type CustomExercise,
  type SessionExercise,
  type TrainingRoutine,
  type TrainingSession,
  type TrainingSettings,
} from '../types'

/**
 * Lesen und Schreiben des Workout-Trackers in Supabase.
 *
 * Zeilen (snake_case) werden hier und nur hier in die App-Typen (camelCase)
 * uebersetzt. RLS sorgt dafuer, dass jeder nur seine Zeilen sieht; `user_id`
 * setzt die Datenbank ueber `auth.uid()`, wir schicken sie trotzdem mit, damit
 * eine falsch konfigurierte Policy laut scheitert statt still fremd zu schreiben.
 */

const PAGE = 1000

interface SessionRow {
  id: string
  kind: TrainingSession['kind']
  title: string
  started_at: string
  ended_at: string | null
  duration_s: number | null
  distance_m: number | string | null
  kcal: number | null
  avg_hr: number | null
  rpe: number | string | null
  notes: string | null
  routine_id: string | null
  exercises: SessionExercise[] | null
  source: TrainingSession['source']
  external_id: string | null
}

const SESSION_COLUMNS = 'id, kind, title, started_at, ended_at, duration_s, distance_m, kcal, avg_hr, rpe, notes, routine_id, exercises, source, external_id'

const num = (value: number | string | null): number | null =>
  value == null || value === '' ? null : Number(value)

export function sessionFromRow(row: SessionRow): TrainingSession {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title ?? '',
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationS: row.duration_s,
    distanceM: num(row.distance_m),
    kcal: row.kcal,
    avgHr: row.avg_hr,
    rpe: num(row.rpe),
    notes: row.notes,
    routineId: row.routine_id,
    exercises: Array.isArray(row.exercises) ? row.exercises : [],
    source: row.source,
    externalId: row.external_id,
  }
}

export function sessionToRow(session: Omit<TrainingSession, 'id'>, userId: string) {
  return {
    user_id: userId,
    kind: session.kind,
    title: session.title.slice(0, 80),
    started_at: session.startedAt,
    ended_at: session.endedAt,
    duration_s: session.durationS == null ? null : Math.round(session.durationS),
    distance_m: session.distanceM,
    kcal: session.kcal == null ? null : Math.round(session.kcal),
    avg_hr: session.avgHr == null ? null : Math.round(session.avgHr),
    rpe: session.rpe,
    notes: session.notes,
    routine_id: session.routineId,
    exercises: session.exercises,
    source: session.source,
    external_id: session.externalId,
    updated_at: new Date().toISOString(),
  }
}

/** Fehlt die Tabelle noch (Migration nicht eingespielt)? PostgREST meldet 42P01/PGRST205. */
export function isMissingTable(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  return error.code === '42P01' || error.code === 'PGRST205' || /does not exist|schema cache/i.test(error.message ?? '')
}

export async function loadSessions(userId: string): Promise<TrainingSession[]> {
  const all: TrainingSession[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('training_sessions')
      .select(SESSION_COLUMNS)
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    const rows = (data ?? []) as SessionRow[]
    all.push(...rows.map(sessionFromRow))
    if (rows.length < PAGE) break
  }
  return all
}

export async function insertSession(userId: string, session: Omit<TrainingSession, 'id'>): Promise<TrainingSession> {
  const { data, error } = await supabase
    .from('training_sessions')
    .insert(sessionToRow(session, userId))
    .select(SESSION_COLUMNS)
    .single()
  if (error) throw error
  return sessionFromRow(data as SessionRow)
}

export async function updateSession(userId: string, session: TrainingSession): Promise<TrainingSession> {
  const { id, ...rest } = session
  const { data, error } = await supabase
    .from('training_sessions')
    .update(sessionToRow(rest, userId))
    .eq('id', id)
    .eq('user_id', userId)
    .select(SESSION_COLUMNS)
    .single()
  if (error) throw error
  return sessionFromRow(data as SessionRow)
}

/** Nur kcal und Puls nachtragen — fuer Uhr-Daten zu einem schon geloggten Training. */
export async function enrichSession(userId: string, id: string, patch: { kcal: number | null; avgHr: number | null }) {
  const update: Record<string, number | string> = { updated_at: new Date().toISOString() }
  if (patch.kcal != null) update.kcal = Math.round(patch.kcal)
  if (patch.avgHr != null) update.avg_hr = Math.round(patch.avgHr)
  const { error } = await supabase.from('training_sessions').update(update).eq('id', id).eq('user_id', userId)
  if (error) throw error
}

export async function deleteSession(userId: string, id: string) {
  const { error } = await supabase.from('training_sessions').delete().eq('id', id).eq('user_id', userId)
  if (error) throw error
}

/**
 * Viele Einheiten auf einmal (Import). Doppelte `external_id` werden von der
 * Datenbank uebersprungen, nicht ueberschrieben: was der Nutzer nach einem
 * Import bearbeitet hat, bleibt so.
 */
export async function importSessions(userId: string, sessions: Array<Omit<TrainingSession, 'id'>>): Promise<number> {
  let inserted = 0
  for (let i = 0; i < sessions.length; i += 200) {
    const chunk = sessions.slice(i, i + 200).map(s => sessionToRow(s, userId))
    const { data, error } = await supabase
      .from('training_sessions')
      .upsert(chunk, { onConflict: 'user_id,external_id', ignoreDuplicates: true })
      .select('id')
    if (error) throw error
    inserted += data?.length ?? 0
  }
  return inserted
}

// ─── Routinen ───────────────────────────────────────────────────────────────

interface RoutineRow {
  id: string
  name: string
  kind: TrainingRoutine['kind']
  exercises: TrainingRoutine['exercises'] | null
  weekdays: number[] | null
  sort_order: number
  folder?: string | null
}

/**
 * `folder` kommt mit `supabase-training-v2.sql`; die Migration gehoert VOR das
 * Frontend-Deploy. Fehlt sie doch, liest `loadRoutines` ohne die Spalte weiter,
 * `saveRoutine` scheitert (Fehler-Toast in der Oberflaeche).
 */
const ROUTINE_COLUMNS = 'id, name, kind, exercises, weekdays, sort_order, folder'
const ROUTINE_COLUMNS_V1 = 'id, name, kind, exercises, weekdays, sort_order'

/** Postgres 42703: Spalte gibt es nicht. */
export const isUndefinedColumn = (error: { code?: string } | null | undefined): boolean => error?.code === '42703'

export const routineFromRow = (row: RoutineRow): TrainingRoutine => ({
  id: row.id,
  name: row.name,
  kind: row.kind,
  exercises: Array.isArray(row.exercises) ? row.exercises : [],
  weekdays: row.weekdays ?? [],
  sortOrder: row.sort_order,
  folder: normalizeFolder(row.folder),
})

/** Ordnername wie die Datenbank ihn prueft: getrimmt, 1–40 Zeichen, sonst null. */
export function normalizeFolder(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().slice(0, ROUTINE_FOLDER_MAX)
  return trimmed.length > 0 ? trimmed : null
}

export async function loadRoutines(userId: string): Promise<TrainingRoutine[]> {
  const select = (columns: string) => supabase
    .from('training_routines')
    .select(columns)
    .eq('user_id', userId)
    .order('sort_order')
    .order('created_at')
  let { data, error } = await select(ROUTINE_COLUMNS)
  // Frontend vor der v2-Migration ausgerollt: Routinen trotzdem zeigen, Ordner leer.
  if (isUndefinedColumn(error)) ({ data, error } = await select(ROUTINE_COLUMNS_V1))
  if (error) throw error
  return ((data ?? []) as unknown as RoutineRow[]).map(routineFromRow)
}

export async function saveRoutine(userId: string, routine: Omit<TrainingRoutine, 'id'> & { id?: string }): Promise<TrainingRoutine> {
  const row = {
    user_id: userId,
    name: routine.name.trim().slice(0, 60),
    kind: routine.kind,
    exercises: routine.exercises,
    weekdays: [...new Set(routine.weekdays)].sort(),
    sort_order: routine.sortOrder,
    folder: normalizeFolder(routine.folder),
    updated_at: new Date().toISOString(),
  }
  const query = routine.id
    ? supabase.from('training_routines').update(row).eq('id', routine.id).eq('user_id', userId)
    : supabase.from('training_routines').insert(row)
  const { data, error } = await query.select(ROUTINE_COLUMNS).single()
  if (error) throw error
  return routineFromRow(data as RoutineRow)
}

export async function deleteRoutine(userId: string, id: string) {
  const { error } = await supabase.from('training_routines').delete().eq('id', id).eq('user_id', userId)
  if (error) throw error
}

// ─── Eigene Uebungen ────────────────────────────────────────────────────────

interface CustomRow {
  id: string
  name: string
  category: CustomExercise['category']
  equipment: CustomExercise['equipment']
  tracking: CustomExercise['tracking']
  primary_muscles: CustomExercise['primary'] | null
  secondary_muscles: CustomExercise['secondary'] | null
}

const customFromRow = (row: CustomRow): CustomExercise => ({
  id: row.id,
  name: row.name,
  category: row.category,
  equipment: row.equipment,
  tracking: row.tracking,
  primary: row.primary_muscles ?? [],
  secondary: row.secondary_muscles ?? [],
})

const CUSTOM_COLUMNS = 'id, name, category, equipment, tracking, primary_muscles, secondary_muscles'

export async function loadCustomExercises(userId: string): Promise<CustomExercise[]> {
  const { data, error } = await supabase
    .from('training_custom_exercises')
    .select(CUSTOM_COLUMNS)
    .eq('user_id', userId)
    .order('name')
  if (error) throw error
  return ((data ?? []) as CustomRow[]).map(customFromRow)
}

export async function insertCustomExercise(userId: string, exercise: Omit<CustomExercise, 'id'>): Promise<CustomExercise> {
  const { data, error } = await supabase
    .from('training_custom_exercises')
    .insert({
      user_id: userId,
      name: exercise.name.trim().slice(0, 80),
      category: exercise.category,
      equipment: exercise.equipment,
      tracking: exercise.tracking,
      primary_muscles: exercise.primary,
      secondary_muscles: exercise.secondary,
    })
    .select(CUSTOM_COLUMNS)
    .single()
  if (error) throw error
  return customFromRow(data as CustomRow)
}

// ─── Einstellungen ──────────────────────────────────────────────────────────

export const MAX_DISMISSED = 100

export function normalizeSettings(raw: unknown): TrainingSettings {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Partial<TrainingSettings>
  const d = DEFAULT_TRAINING_SETTINGS
  const positive = (v: unknown, fallback: number, max: number) =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? v : fallback
  return {
    unit: value.unit === 'lb' ? 'lb' : 'kg',
    defaultRestS: positive(value.defaultRestS, d.defaultRestS, 900),
    weeklyGoal: Math.round(positive(value.weeklyGoal, d.weeklyGoal, 14)),
    barKg: positive(value.barKg, d.barKg, 50),
    platesKg: Array.isArray(value.platesKg) && value.platesKg.every(p => typeof p === 'number' && p > 0)
      ? [...value.platesKg].sort((a, b) => b - a)
      : d.platesKg,
    healthImport: value.healthImport === true,
    glp1Mode: value.glp1Mode === true || value.glp1Mode === false ? value.glp1Mode : null,
    dismissedExternalIds: Array.isArray(value.dismissedExternalIds)
      ? value.dismissedExternalIds.filter((id): id is string => typeof id === 'string' && id.length <= 200).slice(-MAX_DISMISSED)
      : [],
    // Fehlt der Schluessel (Einstellungen aus v1), gilt der Standard „an".
    restSound: value.restSound !== false,
    restNotify: value.restNotify === true,
  }
}

export async function loadSettings(userId: string): Promise<TrainingSettings> {
  const { data, error } = await supabase
    .from('training_settings')
    .select('settings')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return normalizeSettings(data?.settings)
}

export async function saveSettings(userId: string, settings: TrainingSettings) {
  const { error } = await supabase
    .from('training_settings')
    .upsert({ user_id: userId, settings, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  if (error) throw error
}
