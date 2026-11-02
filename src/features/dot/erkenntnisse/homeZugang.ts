import type { supabase } from '../../../lib/supabase'
import { darfErkenntnisseSehen, ERKENNTNISSE_FREI } from '../lib/zugang'

/**
 * Darf die Home-Karte überhaupt nach einem Wochen-Update sehen (Freischaltung
 * und Einwilligung)? Einmal je Nutzer und Sitzung gefragt: weitere Besuche auf
 * Home fragen `profiles` nicht noch einmal. `select('*')` wie in `zugang.ts`,
 * damit es vor und nach der Migration geht. Schlägt die Abfrage fehl, wird
 * nichts gemerkt; ändert sich die Einwilligung, vergisst die Seite den Eintrag.
 */

const gemerkt = new Map<string, Promise<boolean>>()

export function erkenntnisseAktivFuer(client: typeof supabase, userId: string): Promise<boolean> {
  const bekannt = gemerkt.get(userId)
  if (bekannt) return bekannt
  const frage = (async () => {
    const { data, error } = await client.from('profiles').select('*').eq('id', userId).maybeSingle()
    if (error) throw new Error(error.message)
    const p = (data ?? {}) as Record<string, unknown>
    return darfErkenntnisseSehen(ERKENNTNISSE_FREI, p.is_admin === true, import.meta.env.DEV) && !!p.erkenntnisse_consent_at
  })()
  gemerkt.set(userId, frage)
  frage.catch(() => { if (gemerkt.get(userId) === frage) gemerkt.delete(userId) })
  return frage
}

export function vergissErkenntnisseZugang(userId: string): void {
  gemerkt.delete(userId)
}
