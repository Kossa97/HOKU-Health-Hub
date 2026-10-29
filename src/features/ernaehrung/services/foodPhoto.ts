/**
 * Essen per Foto und/oder Notiz: Bild verkleinern, an die Edge Function
 * `food-photo` schicken (die fragt Anthropic) — zurück kommen Gericht und
 * mögliche Zutaten, nur Namen. Lebensmittel, Menge und damit die Nährwerte
 * wählt der Nutzer selbst.
 */
import { FUNKTIONS_REGION, supabase } from '../../../lib/supabase'
import { prepareFile } from '../../blutwerte/lib/imageResize'
import type { IngredientKind } from '../lib/photoRows'

export interface MealAnalysis {
  /** Name des Gerichts, leer bei mehreren einzelnen Lebensmitteln. */
  dish: string
  /** Ohne Notiz kaum zu erkennen (Suppe, Eintopf …) — die App bittet dann um den Namen. */
  needsNote: boolean
  ingredients: { name: string; search: string; kind: IngredientKind; group: string }[]
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

/** Foto und/oder Notiz auswerten. Ohne Foto ist die Notiz Pflicht. */
export async function analyzeMeal(file: File | null, hint: string, lang: 'de' | 'en'): Promise<MealAnalysis> {
  // Bilder, die der Browser nicht lesen kann (etwa HEIC außerhalb von Safari), gar nicht erst schicken.
  const prepared = file ? await prepareFile(file).catch(() => { throw new PhotoError('unreadable') }) : null
  const { data, error } = await supabase.functions.invoke('food-photo', {
    region: FUNKTIONS_REGION,
    body: { ...(prepared ? { image: prepared.base64, mimeType: prepared.mimeType } : {}), hint: hint.trim(), lang },
  })
  if (error) throw await errorFrom((error as { context?: unknown }).context)
  const result = data as Partial<MealAnalysis> | null
  if (!result || !Array.isArray(result.ingredients) || !result.ingredients.length) throw new PhotoError('not_food')
  return { dish: result.dish ?? '', needsNote: result.needsNote === true, ingredients: result.ingredients }
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
