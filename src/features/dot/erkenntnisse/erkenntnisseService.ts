import { supabase } from '../../../lib/supabase'
import type { Datenlage, Fund, FundId } from '../../../../supabase/functions/_shared/erkenntnisse/typen.ts'

/**
 * Der Draht zu `hoku_funde` und `hoku_wochen`. Geschrieben wird beides nur von
 * der Edge Function `erkenntnisse`; die App liest, blendet Funde aus und
 * markiert Wochen als gelesen (Spaltenrechte und Policies in
 * supabase-hoku-erkenntnisse.sql).
 */

export interface GespeicherterFund { id: string; fund: Fund; datenlage: Datenlage }

export interface Woche {
  /** Lokaler Sonntag, YYYY-MM-DD. */
  woche: string
  tageEingeflossen: number
  gelesen: boolean
  funde: GespeicherterFund[]
}

/** Dieselben fünf wie `FundId` (Kern); der Test hält beide zusammen. */
export const FUND_IDS = ['H1', 'E2', 'W1', 'T7', 'R4'] as const satisfies readonly FundId[]

const RICHTUNGEN = ['positiv', 'kritisch', 'neutral']
const DATENLAGEN = ['hinweis', 'deutlich']

/** Prüft das jsonb gegen den Typ `Fund`; was nicht passt, gibt null. */
export function liesFund(roh: unknown): Fund | null {
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return null
  const f = roh as Record<string, unknown>
  if (!(FUND_IDS as readonly unknown[]).includes(f.id)) return null
  if (typeof f.schluessel !== 'string') return null
  if (f.bezug !== null && typeof f.bezug !== 'string') return null
  if (!RICHTUNGEN.includes(f.richtung as string)) return null
  if (!DATENLAGEN.includes(f.datenlage as string)) return null
  if (typeof f.staerke !== 'number' || !Number.isFinite(f.staerke)) return null
  const z = f.zeitraum as Record<string, unknown> | null
  if (!z || typeof z !== 'object' || typeof z.von !== 'string' || typeof z.bis !== 'string') return null
  const w = f.werte
  if (!w || typeof w !== 'object' || Array.isArray(w)) return null
  for (const v of Object.values(w)) {
    if (typeof v === 'string') continue
    if (typeof v !== 'number' || !Number.isFinite(v)) return null
  }
  return f as unknown as Fund
}

interface FundZeile { id: string; fund: unknown; datenlage: string }

function inGespeichert(z: FundZeile): GespeicherterFund | null {
  const fund = liesFund(z.fund)
  return fund ? { id: z.id, fund, datenlage: z.datenlage === 'deutlich' ? 'deutlich' : 'hinweis' } : null
}

/** Funde in der Reihenfolge von `fundIds`; fehlende Zeilen und ungültige Funde fallen weg. */
export function ordneFunde(fundIds: string[], zeilen: FundZeile[]): GespeicherterFund[] {
  const nachId = new Map(zeilen.map(z => [z.id, z]))
  return fundIds.flatMap(id => {
    const z = nachId.get(id)
    const g = z ? inGespeichert(z) : null
    return g ? [g] : []
  })
}

/** Jüngster sichtbarer Wochenzettel samt seinen Funden, oder null. */
export async function ladeWoche(userId: string, jetzt = new Date()): Promise<Woche | null> {
  const { data, error } = await supabase.from('hoku_wochen')
    .select('woche, fund_ids, tage_eingeflossen, gelesen_am')
    .eq('user_id', userId)
    .lte('sichtbar_ab', jetzt.toISOString())
    .order('woche', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const w = data as { woche: string; fund_ids: string[]; tage_eingeflossen: number; gelesen_am: string | null }
  let funde: GespeicherterFund[] = []
  if (w.fund_ids.length > 0) {
    const r = await supabase.from('hoku_funde').select('id, fund, datenlage').eq('user_id', userId).in('id', w.fund_ids)
    if (r.error) throw new Error(r.error.message)
    funde = ordneFunde(w.fund_ids, (r.data ?? []) as FundZeile[])
  }
  return { woche: w.woche, tageEingeflossen: w.tage_eingeflossen, gelesen: w.gelesen_am !== null, funde }
}

/** Alle gültigen, nicht ausgeblendeten Funde, die zuletzt aktualisierten zuerst. */
export async function ladeFunde(userId: string): Promise<GespeicherterFund[]> {
  const { data, error } = await supabase.from('hoku_funde')
    .select('id, fund, datenlage')
    .eq('user_id', userId)
    .eq('gueltig', true)
    .is('ausgeblendet_am', null)
    .order('aktualisiert_am', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as FundZeile[]).flatMap(z => inGespeichert(z) ?? [])
}

export async function blendeAus(id: string): Promise<void> {
  const { error } = await supabase.from('hoku_funde').update({ ausgeblendet_am: new Date().toISOString() }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function markiereGelesen(userId: string, woche: string): Promise<void> {
  const { error } = await supabase.from('hoku_wochen').update({ gelesen_am: new Date().toISOString() }).eq('user_id', userId).eq('woche', woche)
  if (error) throw new Error(error.message)
}

/**
 * Einwilligung setzen oder widerrufen (null). Beim Setzen merkt sich das
 * Profil die Zeitzone des Geräts, nach der die Nacht-Auswertung die Tage
 * schneidet. Der Widerruf löscht Funde und Wochen per Trigger in der Datenbank.
 */
export async function setzeErkenntnisseEinwilligung(userId: string, an: boolean): Promise<string | null> {
  const felder = an
    ? { erkenntnisse_consent_at: new Date().toISOString(), hoku_zeitzone: Intl.DateTimeFormat().resolvedOptions().timeZone }
    : { erkenntnisse_consent_at: null }
  const { data, error } = await supabase.from('profiles').update(felder).eq('id', userId).select('erkenntnisse_consent_at')
  if (error) throw new Error(error.message)
  if (!data || data.length === 0) throw new Error('profil_fehlt')
  return (data[0] as { erkenntnisse_consent_at: string | null }).erkenntnisse_consent_at
}

/** Wenn sich die Zeitzone des Geräts geändert hat. */
export async function aktualisiereZeitzone(userId: string, zone: string): Promise<void> {
  const { error } = await supabase.from('profiles').update({ hoku_zeitzone: zone }).eq('id', userId)
  if (error) throw new Error(error.message)
}
