/**
 * Essen per Foto: Bild verkleinern, an die Edge Function `food-photo` schicken
 * (die fragt Anthropic) — zurück kommen nur die Namen der erkannten Zutaten.
 * Lebensmittel, Menge und damit die Nährwerte wählt der Nutzer selbst.
 */
import { supabase } from '../../../lib/supabase'
import { prepareFile } from '../../blutwerte/lib/imageResize'

export interface PhotoItem {
  /** Anzeige, z. B. „Spaghetti, gekocht". */
  name: string
  /** Kurzer Suchbegriff, z. B. „Spaghetti". */
  search: string
  confidence: 'low' | 'medium' | 'high'
}

export type PhotoErrorCode = 'consent_required' | 'rate_limit' | 'not_food' | 'too_large' | 'unreadable' | 'unavailable'

export class PhotoError extends Error {
  readonly code: PhotoErrorCode
  readonly resetsAt: string | null
  constructor(code: PhotoErrorCode, resetsAt: string | null = null) {
    super(code)
    this.code = code
    this.resetsAt = resetsAt
  }
}

async function errorFrom(context: unknown): Promise<PhotoError> {
  const response = context instanceof Response ? context : null
  let body: { error?: unknown; resetsAt?: unknown } = {}
  try { body = (await response?.clone().json()) ?? {} } catch { /* kein JSON */ }
  const code = body.error
  if (code === 'consent_required') return new PhotoError('consent_required')
  if (code === 'rate_limit' || response?.status === 429) return new PhotoError('rate_limit', typeof body.resetsAt === 'string' ? body.resetsAt : null)
  if (code === 'not_food') return new PhotoError('not_food')
  if (code === 'file_too_large' || response?.status === 413) return new PhotoError('too_large')
  return new PhotoError('unavailable')
}

export async function analyzePhoto(file: File, hint: string, lang: 'de' | 'en'): Promise<PhotoItem[]> {
  // Bilder, die der Browser nicht lesen kann (etwa HEIC außerhalb von Safari), gar nicht erst schicken.
  const prepared = await prepareFile(file).catch(() => { throw new PhotoError('unreadable') })
  const { data, error } = await supabase.functions.invoke('food-photo', {
    body: { image: prepared.base64, mimeType: prepared.mimeType, hint: hint.trim(), lang },
  })
  if (error) throw await errorFrom((error as { context?: unknown }).context)
  const items = (data as { items?: PhotoItem[] } | null)?.items
  if (!Array.isArray(items) || !items.length) throw new PhotoError('not_food')
  return items
}

// ─── Einwilligung (profiles.ai_food_consent_at) ─────────────────────────

/** Zeitpunkt der Einwilligung oder null. Wirft bei Lesefehlern. */
export async function loadFoodAiConsent(userId: string): Promise<string | null> {
  const { data, error } = await supabase.from('profiles').select('ai_food_consent_at').eq('id', userId).maybeSingle()
  if (error) throw error
  return (data?.ai_food_consent_at as string | null | undefined) ?? null
}

/**
 * Erteilen (true) oder widerrufen (false). Den Zeitpunkt setzt die Datenbank
 * (Trigger `profiles_stamp_ai_food_consent`). Trifft das Update kein Profil,
 * ist nichts gespeichert — das ist ein Fehler.
 */
export async function setFoodAiConsent(userId: string, granted: boolean): Promise<string | null> {
  const { data, error } = await supabase.from('profiles')
    .update({ ai_food_consent_at: granted ? new Date().toISOString() : null }).eq('id', userId).select('ai_food_consent_at')
  if (error) throw error
  if (!data?.length) throw new Error('profil_fehlt')
  return (data[0].ai_food_consent_at as string | null) ?? null
}
