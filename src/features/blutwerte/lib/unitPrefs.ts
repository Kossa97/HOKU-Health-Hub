/**
 * Gewaehlte Anzeige-Einheiten der Blutwerte, gespeichert im eigenen Profil
 * (`profiles.bloodwork_units`, jsonb). Gilt damit auf allen Geraeten.
 *
 * Form: { system?: 'konventionell' | 'si', marker?: { [Markername]: Einheit } }.
 * Was aus der Datenbank kommt, wird geprueft; Unbekanntes faellt weg.
 */
import { supabase } from '../../../lib/supabase'
import type { UnitPrefs } from './bloodwork'

export function parseUnitPrefs(raw: unknown): UnitPrefs {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const value = raw as Record<string, unknown>
  const prefs: UnitPrefs = {}
  if (value.system === 'konventionell' || value.system === 'si') prefs.system = value.system
  if (value.marker && typeof value.marker === 'object' && !Array.isArray(value.marker)) {
    const marker: Record<string, string> = {}
    for (const [name, unit] of Object.entries(value.marker as Record<string, unknown>)) {
      if (typeof unit === 'string' && unit.trim() && unit.length <= 40 && name.length <= 120) marker[name] = unit
    }
    if (Object.keys(marker).length) prefs.marker = marker
  }
  return prefs
}

/** Einheit fuer einen Marker setzen; null nimmt die eigene Wahl zurueck (dann gilt das System). */
export function withMarkerUnit(prefs: UnitPrefs, name: string, unit: string | null): UnitPrefs {
  const marker = { ...prefs.marker }
  if (unit) marker[name] = unit
  else delete marker[name]
  const next: UnitPrefs = { ...prefs, marker }
  if (!Object.keys(marker).length) delete next.marker
  return next
}

export async function loadUnitPrefs(userId: string): Promise<UnitPrefs> {
  const { data, error } = await supabase.from('profiles').select('bloodwork_units').eq('id', userId).maybeSingle()
  if (error) throw new Error(error.message)
  return parseUnitPrefs((data as { bloodwork_units?: unknown } | null)?.bloodwork_units)
}

export async function saveUnitPrefs(userId: string, prefs: UnitPrefs): Promise<void> {
  const { error } = await supabase.from('profiles').update({ bloodwork_units: prefs }).eq('id', userId)
  if (error) throw new Error(error.message)
}
