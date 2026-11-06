/**
 * Moment „Neuer Rang“ / „Neuer Titel freigeschaltet“ (Spec Titel 4, Offene
 * Frage 3): Welcher Moment folgt aus den neu verdienten Abzeichen eines Laufs?
 * Rein; gezeigt wird höchstens einer, nie eine Kette.
 *
 * - Ein neuer Rang geht vor: der höchste neue.
 * - Sonst ein neues tragbares Abzeichen (auch eine neue Stufe einer Leiter);
 *   bei mehreren die höchste Stufe, bei Gleichstand das erste in der Liste.
 * - Persönliche Titel nie (ab Werk aus, nur stiller Hinweis im Sheet).
 * - Erster Start nach dem Titel-Update: Wer schon Tage mit Eintrag hat, bekommt
 *   den aktuellen Rang (der neue Rang geht vor), keine Zwischenstufen und keine
 *   Abzeichen-Titel daneben. Wer nur eingeführte Einheiten hat (nie ein Rang),
 *   bekommt Abzeichen-Titel trotzdem — sonst sähe er nie einen Moment.
 */
import { RANK_IDS, type BadgeId } from './badgeIds'
import { isPersonalTitle, isTitleBadgeId, ladderOf, TITLE_BADGE_IDS, TITLE_LADDERS, type TitleBadgeId } from './titles'

export type TitleMoment =
  | { kind: 'rank'; id: BadgeId }
  | { kind: 'badge'; id: TitleBadgeId }

/** Stufe in der Leiter (1–3), ohne Leiter 1. */
function stage(id: TitleBadgeId): number {
  const ladder = ladderOf(id)
  return ladder ? (TITLE_LADDERS[ladder] as readonly BadgeId[]).indexOf(id) + 1 : 1
}

/**
 * @param added neu verdiente IDs dieses Laufs (`evaluateBadges(...).added`)
 * @param before gespeicherte Abzeichen vor dem Lauf (`earned_badges`)
 */
export function titleMomentFor(added: readonly BadgeId[], before: Partial<Record<BadgeId, string>>): TitleMoment | null {
  const fresh = new Set(added.filter(id => !before[id]))
  const rank = [...RANK_IDS].reverse().find(id => fresh.has(id))
  if (rank) return { kind: 'rank', id: rank }
  let best: TitleBadgeId | null = null
  for (const id of TITLE_BADGE_IDS) {
    if (!fresh.has(id) || !isTitleBadgeId(id) || isPersonalTitle(id)) continue
    if (!best || stage(id) > stage(best)) best = id
  }
  return best ? { kind: 'badge', id: best } : null
}
