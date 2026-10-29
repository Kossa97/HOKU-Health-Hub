import { supabase } from '../../../lib/supabase'
import type { DotKontext } from '../lib/dotKontext'
import type { Meldung } from './meldungen'
import { liesAnlagen, type DotAnlage } from '../../my-stack/lib/dotAnlage'

/**
 * Der Draht zur Edge Function `coach`. Sie prüft Anmeldung, Zugang (Pro oder
 * Tester), Einwilligung und Tageslimit und fragt dann Claude; zurück kommen
 * Antwort und Meldungen zu Einnahmen. Gespeichert wird
 * auf dem Server nur die Zahl der Fragen je Tag.
 */

/** `lokal`: von der App selbst (Fehler, Hinweise) — geht nie als Antwort an Claude. */
export interface CoachNachricht {
  rolle: 'ich' | 'dot'; text: string; lokal?: boolean
  /** Karte einer ausgeführten Meldung mit „Rückgängig" (nur im Speicher, nie gesichert). */
  karte?: string
  /** Von Dot vorbereitete Substanz mit „Ansehen und speichern" (reine Daten, wird mitgesichert). */
  anlage?: DotAnlage
}

export type CoachFehler = 'consent_required' | 'no_access' | 'limit_reached' | 'offline' | 'server_error'

/** `meldungen`: was der Nutzer über Einnahmen gesagt hat, zum Ausführen in der App (`meldungen.ts`). */
export type CoachAntwort = { ok: true; text: string; meldungen: Meldung[]; anlagen: DotAnlage[] } | { ok: false; fehler: CoachFehler }

/** Höchstens so viele Nachrichten gehen als Verlauf mit (die letzten). */
export const VERLAUF_MAX = 12

export async function frageCoach(
  verlauf: CoachNachricht[],
  kontext: DotKontext | null,
  seite: string,
  sprache: 'de' | 'en',
): Promise<CoachAntwort> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ok: false, fehler: 'offline' }
  const { data, error } = await supabase.functions.invoke('coach', {
    body: { nachrichten: verlauf.filter(n => !n.lokal).map(({ rolle, text }) => ({ rolle, text })).slice(-VERLAUF_MAX), kontext, seite, sprache },
  })
  if (error) {
    // Bei 4xx steckt der Code im Antwortkörper
    const ctx = (error as { context?: Response }).context
    try {
      const body = ctx ? await ctx.json() : null
      const code = body?.error as string | undefined
      if (code === 'consent_required' || code === 'no_access' || code === 'limit_reached') return { ok: false, fehler: code }
    } catch { /* kein JSON */ }
    return { ok: false, fehler: navigator.onLine === false ? 'offline' : 'server_error' }
  }
  const text = typeof data?.antwort === 'string' ? data.antwort.trim() : ''
  const meldungen = liesMeldungen(data?.meldungen)
  const anlagen = liesAnlagen(data?.anlagen)
  return text || meldungen.length || anlagen.length ? { ok: true, text, meldungen, anlagen } : { ok: false, fehler: 'server_error' }
}

/** Nimmt vom Server nur, was die Form hat; geprüft hat er schon, hier zählt nur der Typ. */
export function liesMeldungen(roh: unknown): Meldung[] {
  if (!Array.isArray(roh)) return []
  return roh.flatMap(m => {
    if (!m || typeof m !== 'object') return []
    const { ref, art, uhrzeit } = m as Record<string, unknown>
    if (typeof ref !== 'string' || (art !== 'genommen' && art !== 'vergessen' && art !== 'spaeter')) return []
    return [{ ref, art, uhrzeit: typeof uhrzeit === 'string' ? uhrzeit : null }]
  })
}

/** Einwilligung setzen (Zeitpunkt setzt der Server) oder widerrufen (null). */
export async function setzeCoachEinwilligung(userId: string, an: boolean): Promise<string | null> {
  const { data, error } = await supabase.from('profiles')
    .update({ coach_consent_at: an ? new Date().toISOString() : null })
    .eq('id', userId)
    .select('coach_consent_at')
  if (error) throw new Error(error.message)
  if (!data || data.length === 0) throw new Error('profil_fehlt')
  return (data[0] as { coach_consent_at: string | null }).coach_consent_at
}

/** Verlauf nur auf diesem Gerät, je Konto. */
const verlaufSchluessel = (userId: string) => `tyd.dot.verlauf.${userId}`

export function ladeVerlauf(userId: string): CoachNachricht[] {
  try {
    const roh = JSON.parse(localStorage.getItem(verlaufSchluessel(userId)) || '[]')
    return Array.isArray(roh)
      ? roh.filter(n => n && (n.rolle === 'ich' || n.rolle === 'dot') && typeof n.text === 'string')
        .map(n => {
          const anlage = n.rolle === 'dot' ? liesAnlagen([n.anlage])[0] : undefined
          return { rolle: n.rolle, text: n.text, ...(n.lokal ? { lokal: true } : {}), ...(anlage ? { anlage } : {}) }
        }).slice(-40)
      : []
  } catch { return [] }
}
export function speichereVerlauf(userId: string, verlauf: CoachNachricht[]) {
  try { localStorage.setItem(verlaufSchluessel(userId), JSON.stringify(verlauf.slice(-40).map(n => ({ rolle: n.rolle, text: n.text, ...(n.lokal ? { lokal: true } : {}), ...(n.anlage ? { anlage: n.anlage } : {}) })))) } catch { /* kein Speicher */ }
}
export function loescheVerlauf(userId: string) {
  try { localStorage.removeItem(verlaufSchluessel(userId)) } catch { /* kein Speicher */ }
}
/** Beim Abmelden: jeden Dot-Verlauf auf diesem Gerät vergessen. */
export function vergissDotVerlauf() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i)
      if (k?.startsWith('tyd.dot.verlauf.')) localStorage.removeItem(k)
    }
  } catch { /* kein Speicher */ }
}
