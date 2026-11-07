/**
 * Sheet „Profil teilen“ (Spec 2c, 4.4/4.5): in welchem Stand der Web-Link ist
 * und welche Link-Karte ein Messenger gerade zeigen würde (Spec 3.3).
 *
 * Spiegelt die Regel von `profile_view` in der Stufe web
 * (supabase-profil-p2c-web.sql) und der Kartenwahl in `api/_lib/profileCard.js`,
 * ohne eigene Anfrage: Das Sheet zeigt den Stand sofort, auch direkt nach dem
 * Schalter „Web-Link einschalten“. Der Server bleibt maßgeblich; die Zeile ist
 * ein Hinweis, keine Zusage.
 *
 * - Web-Link aus, privat → neutrale Karte (die Web-Stufe gibt es dann nicht).
 * - Gesamtfortschritt auf „Alle“, mindestens 10 % und von Körper, Training oder
 *   Erholung getragen (Schutzregel Spec 1.1) → Karte mit Fortschritt.
 * - sonst → Rückfall: Karte mit Bild und Name.
 */
import type { ProgressArea } from './progressScore'
import type { Visibility } from './profileVisibility'

export type TeilenStand = 'an' | 'aus' | 'privat'
export type LinkKarte = 'fortschritt' | 'rueckfall' | 'neutral'

/** Ab hier gibt es eine Stufe „über X %“ (`profile_web_progress_tier`). */
export const WEB_PROGRESS_MIN = 10

/** Bereiche, die im Web zählen; Blut und Einnahmen allein tragen keine Stufe. */
const WEB_AREAS: readonly ProgressArea[] = ['koerper', 'training', 'erholung']

/** Privat geht vor: dann hilft auch ein eingeschalteter Web-Link nicht. */
export function teilenStand({ webLink, privat }: { webLink: boolean; privat: boolean }): TeilenStand {
  if (privat) return 'privat'
  return webLink ? 'an' : 'aus'
}

export function linkKarte({ stand, progressVisibility, progress }: {
  stand: TeilenStand
  progressVisibility: Visibility
  progress: { total: number | null; areas: Partial<Record<ProgressArea, number | null>> } | null
}): LinkKarte {
  if (stand !== 'an') return 'neutral'
  const total = progress?.total
  const traegt = !!progress && WEB_AREAS.some(a => typeof progress.areas[a] === 'number' && Number.isFinite(progress.areas[a]))
  return progressVisibility === 'all' && typeof total === 'number' && Number.isFinite(total) && total >= WEB_PROGRESS_MIN && traegt
    ? 'fortschritt'
    : 'rueckfall'
}
