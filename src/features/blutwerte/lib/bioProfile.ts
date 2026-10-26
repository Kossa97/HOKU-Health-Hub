/**
 * Geburtsdatum und biologisches Geschlecht aus dem eigenen Profil
 * (`profiles.birth_date`, `profiles.bio_sex`). Beide freiwillig; sie wählen
 * nur den passenden Referenzbereich, wenn ein Befund keinen eigenen hat.
 * Gelesen von Blutwerten, /health und dem eigenen PDF-Export; das öffentliche
 * Profil liest sie nicht.
 */
import { supabase } from '../../../lib/supabase'
import { alterAm } from './referenzbereiche'

export type BioSex = 'male' | 'female'

export interface BioProfile {
  /** ISO-Datum YYYY-MM-DD oder null (keine Angabe). */
  birthDate: string | null
  sex: BioSex | null
}

export const LEERES_BIO_PROFIL: BioProfile = { birthDate: null, sex: null }

/** Gleiche Grenzen wie die Prüfung in der Datenbank. */
export const GEBURTSDATUM_MIN = '1900-01-01'

export function parseBioProfile(raw: unknown): BioProfile {
  if (!raw || typeof raw !== 'object') return LEERES_BIO_PROFIL
  const value = raw as { birth_date?: unknown; bio_sex?: unknown }
  const birthDate = typeof value.birth_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.birth_date.slice(0, 10))
    ? value.birth_date.slice(0, 10)
    : null
  const sex = value.bio_sex === 'male' || value.bio_sex === 'female' ? value.bio_sex : null
  return { birthDate, sex }
}

/** Ein Geburtsdatum ist gültig, wenn es ein echtes Datum zwischen 1900 und heute ist. */
export function geburtsdatumGueltig(value: string, heute: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) return false
  return value >= GEBURTSDATUM_MIN && value <= heute
}

/**
 * Biologisches Geschlecht aus der alten Freitext-Angabe `profiles.gender`
 * (von /health: 'männlich' / 'weiblich' / 'divers'). „divers“ und Unbekanntes
 * ergeben null — dafuer gibt es keinen Referenzbereich.
 */
export function geschlechtAusAltangabe(gender: unknown): BioSex | null {
  if (typeof gender !== 'string') return null
  const g = gender.trim().toLowerCase()
  if (g === 'männlich' || g === 'male') return 'male'
  if (g === 'weiblich' || g === 'female') return 'female'
  return null
}

/**
 * Die alten Felder `age`/`gender` passend zu den neuen Angaben. Wird beim
 * Speichern mitgeschrieben, damit der Rueckfall auf die alten Felder (/health,
 * PDF) nie eine Angabe zurueckholt, die gerade geleert wurde.
 */
export function altfelderAus(p: BioProfile, heute: string): { age: number | null; gender: string | null } {
  return {
    age: alterAm(p.birthDate, heute),
    gender: p.sex === 'male' ? 'männlich' : p.sex === 'female' ? 'weiblich' : null,
  }
}

const heuteIso = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const bioVollstaendig = (p: BioProfile): boolean => !!p.birthDate && !!p.sex

export async function loadBioProfile(userId: string): Promise<BioProfile> {
  const { data, error } = await supabase.from('profiles').select('birth_date, bio_sex').eq('id', userId).maybeSingle()
  if (error) throw new Error(error.message)
  return parseBioProfile(data)
}

export async function saveBioProfile(userId: string, profile: BioProfile): Promise<void> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ birth_date: profile.birthDate, bio_sex: profile.sex, ...altfelderAus(profile, heuteIso()) })
    .eq('id', userId)
    .select('id')
  if (error) throw new Error(error.message)
  // Ohne Profilzeile aendert update nichts und meldet keinen Fehler.
  if (!data?.length) throw new Error('profile row missing')
}
