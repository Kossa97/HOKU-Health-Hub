/** Pfade, die ein Link von außen (Mail-Knopf) in der App öffnen darf. */
const ERLAUBT = ['/auth']

/**
 * Pfad samt Abfrage aus einem Link, der die App geöffnet hat — nur für unsere Domain und
 * erlaubte Pfade, sonst null. `https://hokuhealth.app/auth?bestaetigen=…` → `/auth?bestaetigen=…`
 */
export function zielAusLink(url: string, domains: string[] = ['hokuhealth.app', 'www.hokuhealth.app']): string | null {
  let u: URL
  try { u = new URL(url) } catch { return null }
  if (u.protocol !== 'https:' || !domains.includes(u.hostname)) return null
  if (!ERLAUBT.includes(u.pathname.replace(/\/+$/, ''))) return null
  return `${u.pathname}${u.search}`
}
