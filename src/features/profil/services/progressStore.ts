/**
 * Gesamtfortschritt und Abzeichen (Teilprojekt 2b): eigene Daten laden,
 * `progress_settings` lesen und schreiben, verdiente Abzeichen festhalten.
 *
 * Gelesen werden nur eigene Zeilen (RLS und `user_id = eigene id`). Vor der
 * Migration 2b fehlt `progress_settings`; dann gilt „kein Start gesetzt“, und
 * Schreiben scheitert mit einer Meldung.
 */
import { supabase } from '../../../lib/supabase'
import { isMissingColumn } from '../../../lib/dbErrors'
import { isMissingTable } from '../../training/services/trainingRepo'
import { localDay } from '../../wearables/lib/healthDaily'
import type { BadgeExtras } from '../lib/badgeFacts'
import type { BadgeId } from '../lib/badgeIds'
import { GOAL_TAGS } from '../lib/profileFields'
import { mergedHistory, type ProgressData, type ProgressState } from '../lib/progressState'
import { parseProgressSettings, settingsRow, type ProgressSettings } from '../lib/progressSettings'

type QueryError = { code?: string; message?: string } | null

const SETTINGS_COLUMNS = 'start_on, previous_starts, directions, baselines, history, earned_badges'

/** Eigene Einstellungen; ohne Zeile (oder vor der Migration) die leeren. */
export async function loadProgressSettings(userId: string): Promise<ProgressSettings> {
  const first = await supabase.from('progress_settings').select(SETTINGS_COLUMNS).eq('user_id', userId).maybeSingle()
  // Ohne die Spalte der Abzeichen (aeltere Fassung der Migration) ohne sie weiter
  const res = isMissingColumn(first.error)
    ? await supabase.from('progress_settings').select('start_on, previous_starts, directions, baselines, history').eq('user_id', userId).maybeSingle()
    : first
  if (res.error) {
    if (isMissingTable(res.error)) return parseProgressSettings(null)
    throw res.error
  }
  return parseProgressSettings(res.data as Record<string, unknown> | null)
}

/** Schreibt nur die uebergebenen Teile; die uebrigen Spalten bleiben. */
export async function saveProgressSettings(userId: string, part: Partial<ProgressSettings>): Promise<void> {
  const { error } = await supabase.from('progress_settings')
    .upsert({ user_id: userId, ...settingsRow(part), updated_at: new Date().toISOString() }, { onConflict: 'user_id', defaultToNull: false })
  if (error) throw error
}

const PROFILE_COLUMNS = 'goals, avatar_path, cover_path, display_name, public_bio, country, profile_gender, birth_date, height_cm, health_store_consent_at'

/** Was es neben den Schnappschuss-Daten braucht. Fehlende Tabellen zaehlen als leer. */
async function loadExtras(userId: string, today: string): Promise<{ extras: BadgeExtras; goals: string[] }> {
  const rows = async (query: PromiseLike<{ data: unknown; error: QueryError }>) => {
    const { data, error } = await query
    if (error) {
      if (isMissingTable(error) || isMissingColumn(error)) return [] as Record<string, unknown>[]
      throw error
    }
    return (data ?? []) as Record<string, unknown>[]
  }
  const [profile, cycles, photos, reviews] = await Promise.all([
    rows(supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', userId).limit(1)),
    rows(supabase.from('cycles').select('end_date').eq('user_id', userId).not('end_date', 'is', null).lte('end_date', today)),
    rows(supabase.from('progress_photos').select('taken_at').eq('user_id', userId)),
    rows(supabase.from('reviews').select('created_at').eq('user_id', userId)),
  ])
  const p = profile[0] ?? {}
  const filled = (v: unknown) => (typeof v === 'string' ? v.trim() !== '' : v != null)
  const goals = Array.isArray(p.goals) ? GOAL_TAGS.filter(g => (p.goals as unknown[]).includes(g)) : []
  const str = (rs: Record<string, unknown>[], key: string) => rs.flatMap(r => (typeof r[key] === 'string' ? [r[key] as string] : []))
  return {
    goals,
    extras: {
      cycleEndDays: str(cycles, 'end_date'),
      photoDays: str(photos, 'taken_at'),
      reviewDays: str(reviews, 'created_at'),
      healthConsentAt: typeof p.health_store_consent_at === 'string' ? p.health_store_consent_at : null,
      // Profil vollstaendig: Bild, Titelbild, Name, Bio, Ziele, Land, Geschlecht, Geburtsdatum, Groesse
      profileChecks: [
        filled(p.avatar_path), filled(p.cover_path), filled(p.display_name), filled(p.public_bio), goals.length > 0,
        filled(p.country), filled(p.profile_gender), filled(p.birth_date), filled(p.height_cm),
      ],
    },
  }
}

/** Einstellungen, Ziele und was die Abzeichen ausser den Schnappschuss-Daten brauchen. */
export async function loadProgressParts(userId: string, now: Date): Promise<Omit<ProgressData, 'input'>> {
  const [settings, extra] = await Promise.all([loadProgressSettings(userId), loadExtras(userId, localDay(now))])
  return { settings, extras: extra.extras, goals: extra.goals }
}

/**
 * Nach dem Rechnen: Wochenreihe und neu verdiente Abzeichen festhalten, wenn
 * sich etwas geaendert hat. Liefert die geschriebenen Einstellungen.
 */
export async function persistProgress(userId: string, data: ProgressData, state: ProgressState): Promise<ProgressSettings> {
  const history = mergedHistory(data.settings.history, state)
  const changed = state.badges.added.length > 0 || JSON.stringify(history) !== JSON.stringify(data.settings.history)
  if (!changed) return data.settings
  const part = { history, earnedBadges: state.badges.earned }
  await saveProgressSettings(userId, part)
  return { ...data.settings, ...part }
}

/**
 * Ein Abzeichen, das nicht aus Daten folgt (etwa „Profil geteilt“), sofort
 * vergeben. Schon verdiente bleiben mit ihrem Tag. Fehler bleiben still.
 */
export async function awardBadge(userId: string, id: BadgeId, now = new Date()): Promise<boolean> {
  try {
    const settings = await loadProgressSettings(userId)
    if (settings.earnedBadges[id]) return false
    await saveProgressSettings(userId, { earnedBadges: { ...settings.earnedBadges, [id]: localDay(now) } })
    return true
  } catch {
    return false
  }
}
