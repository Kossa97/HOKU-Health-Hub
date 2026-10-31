/**
 * Tageswerte aus Apple Health / Health Connect im eigenen Konto (`health_daily`)
 * und die Einwilligung dazu (`profiles.health_store_consent_at`).
 *
 * Geschrieben wird nur mit Einwilligung (Art. 9 Abs. 2 lit. a DSGVO); das
 * prueft der Abgleich vor jedem Lauf frisch (hooks/useHealthDailySync.ts).
 */
import { supabase } from '../../../lib/supabase'
import type { HealthDailyRow } from '../lib/healthDaily'

export type HealthDailySource = 'healthkit' | 'health_connect'

const CHUNK = 100
const FIRST_SYNC_DAYS = 30

// ─── Einwilligung ───────────────────────────────────────────────────────

/** Zeitpunkt der Einwilligung oder null. Wirft bei Lesefehlern. */
export async function loadHealthStoreConsent(userId: string): Promise<string | null> {
  const { data, error } = await supabase.from('profiles').select('health_store_consent_at').eq('id', userId).maybeSingle()
  if (error) throw error
  return (data?.health_store_consent_at as string | null | undefined) ?? null
}

/** Erteilen (true) oder widerrufen (false). Trifft das Update kein Profil, ist nichts gespeichert — das ist ein Fehler. */
export async function setHealthStoreConsent(userId: string, granted: boolean): Promise<string | null> {
  const { data, error } = await supabase.from('profiles')
    .update({ health_store_consent_at: granted ? new Date().toISOString() : null }).eq('id', userId).select('health_store_consent_at')
  if (error) throw error
  if (!data?.length) throw new Error('profil_fehlt')
  return (data[0].health_store_consent_at as string | null) ?? null
}

// ─── Tageswerte ─────────────────────────────────────────────────────────

/** Schreibt die Tage per Upsert auf (user_id, day), in Bloecken zu 100. */
export async function upsertHealthDaily(userId: string, rows: HealthDailyRow[], source: HealthDailySource): Promise<void> {
  const updatedAt = new Date().toISOString()
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK).map(row => ({ ...row, user_id: userId, source, updated_at: updatedAt }))
    const { error } = await supabase.from('health_daily').upsert(chunk, { onConflict: 'user_id,day' })
    if (error) throw error
  }
}

/** Loescht alle gespeicherten Tageswerte des Nutzers. Workouts im Training bleiben. */
export async function deleteHealthDaily(userId: string): Promise<void> {
  const { error } = await supabase.from('health_daily').delete().eq('user_id', userId)
  if (error) throw error
}

/** Wie viele Tage gespeichert sind — nur die Zahl, keine Werte. */
export async function countHealthDaily(userId: string): Promise<number> {
  const { count, error } = await supabase.from('health_daily').select('day', { count: 'exact', head: true }).eq('user_id', userId)
  if (error) throw error
  return count ?? 0
}

// ─── Abgleichsfenster ───────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0')

/** `yyyy-MM-dd` um `days` verschoben (Kalendertage, ohne Zeitzone). */
function shiftDay(day: string, days: number): string {
  const [y, m, d] = day.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + days))
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

/**
 * Welche Tage ein Lauf neu liest. Ohne Stand 30 Tage zurueck; sonst ab dem Tag
 * vor dem letzten Stand, damit ein damals angefangener Tag nachgezogen wird.
 */
export function syncWindow(lastSyncedDay: string | null, today: string): { from: string; to: string } {
  const from = lastSyncedDay ? shiftDay(lastSyncedDay, -1) : shiftDay(today, -FIRST_SYNC_DAYS)
  return { from: from < today ? from : today, to: today }
}
