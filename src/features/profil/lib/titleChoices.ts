/**
 * Was das Sheet „Dein Titel“ zeigt und wie eine Wahl die Titel-Einstellungen
 * ändert (Spec Titel 3 und 4). Rein; die Namen stehen in `titles.ts`.
 *
 * Leitern erscheinen als eine Zeile: verdient mit der höchsten Stufe, offen
 * mit der ersten. Gespeichert wird bei Leitern die erste Stufe — der getragene
 * Titel (`wornStage`) steigt dann von selbst mit.
 */
import type { BadgeState } from './badges'
import type { BadgeId } from './badgeIds'
import type { Visibility } from './profileVisibility'
import {
  RANKS, TITLE_BADGE_IDS, TITLE_LADDERS, isPersonalTitle, ladderOf,
  type LadderId, type PersonalTitleId, type ProfileTitle, type TitleBadgeId, type TitleSettings,
} from './titles'

export interface TitleOption {
  /** Was gespeichert wird (`title_choice`): bei Leitern die erste Stufe. */
  choice: TitleBadgeId
  /** Was gezeigt wird: höchste verdiente Stufe, sonst die erste. */
  shown: TitleBadgeId
  ladder: LadderId | null
  earned: boolean
  personal: boolean
  /** Verdiente Stufe einer Leiter (1–3), sonst 0. */
  level: number
  /** Nächste Stufe einer verdienten Leiter. */
  next: TitleBadgeId | null
  /** Stand des gezeigten Abzeichens (offen: bis zur ersten Stufe). */
  state: BadgeState | undefined
}

/** Alle tragbaren Titel in fester Reihenfolge, Leitern als eine Zeile. */
export function titleOptions(states: readonly BadgeState[]): TitleOption[] {
  const byId = new Map(states.map(s => [s.id, s]))
  const earned = (id: BadgeId) => byId.get(id)?.earned === true
  const out: TitleOption[] = []
  for (const id of TITLE_BADGE_IDS) {
    const ladder = ladderOf(id)
    if (!ladder) {
      out.push({ choice: id, shown: id, ladder: null, earned: earned(id), personal: isPersonalTitle(id), level: 0, next: null, state: byId.get(id) })
      continue
    }
    const stages = TITLE_LADDERS[ladder] as readonly TitleBadgeId[]
    if (stages[0] !== id) continue
    const level = stages.filter(earned).length
    const shown = level > 0 ? [...stages].reverse().find(earned)! : stages[0]
    const next = level > 0 ? stages.find(s => !earned(s)) ?? null : null
    out.push({ choice: stages[0], shown, ladder, earned: level > 0, personal: false, level, next, state: byId.get(shown) })
  }
  return out
}

const closeness = (o: TitleOption) =>
  o.state?.have !== undefined && o.state.need ? o.state.have / o.state.need : -1

/** Offene (nicht persönliche) Titel, am nächsten dran zuerst; ohne Stand ans Ende. */
export function openTitles(options: readonly TitleOption[]): TitleOption[] {
  return options.filter(o => !o.earned && !o.personal)
    .map((o, i) => ({ o, i }))
    .sort((a, b) => closeness(b.o) - closeness(a.o) || a.i - b.i)
    .map(({ o }) => o)
}

/** Trägt man gerade diese Zeile? Bei Leitern zählt jede Stufe. */
export function isWorn(option: TitleOption, worn: ProfileTitle | null): boolean {
  if (worn?.kind !== 'badge') return false
  return option.ladder ? ladderOf(worn.id) === option.ladder : worn.id === option.choice
}

/** Die Zeile eines Abzeichens (auch einer höheren Stufe). */
export function optionOf(options: readonly TitleOption[], id: BadgeId): TitleOption | undefined {
  const ladder = ladderOf(id)
  return options.find(o => (ladder ? o.ladder === ladder : o.choice === id))
}

// ─── Rang ───────────────────────────────────────────────────────────────────

export type RankStep = { id: BadgeId; days: number; stage: 'done' | 'cur' | 'todo' }

/** Rangleiter für `entryDays` Tage mit Eintrag; `frac` = Weg vom aktuellen zum nächsten Rang. */
export function rankLadder(entryDays: number): {
  steps: RankStep[]
  current: BadgeId | null
  next: { id: BadgeId; days: number; missing: number; frac: number } | null
} {
  const idx = RANKS.reduce((i, r, k) => (entryDays >= r.days ? k : i), -1)
  const steps = RANKS.map((r, k): RankStep => ({ id: r.id, days: r.days, stage: k < idx ? 'done' : k === idx ? 'cur' : 'todo' }))
  const nr = RANKS[idx + 1]
  const from = idx < 0 ? 0 : RANKS[idx].days
  return {
    steps,
    current: idx < 0 ? null : RANKS[idx].id,
    next: nr ? { id: nr.id, days: nr.days, missing: nr.days - entryDays, frac: Math.min(1, Math.max(0, (entryDays - from) / (nr.days - from))) } : null,
  }
}

// ─── Einstellungen ändern ───────────────────────────────────────────────────

/** `null` = Rang tragen. */
export const withChoice = (s: TitleSettings, choice: TitleBadgeId | null): TitleSettings => ({ ...s, choice })

/**
 * Schalter „Persönliche Titel erlauben“. Aus ist ein Widerruf: alle
 * Bestätigungen fallen weg, ein getragener persönlicher Titel wird zum Rang.
 * Beim erneuten Einschalten braucht jeder persönliche Titel eine neue Bestätigung.
 */
export function withPersonalAllowed(s: TitleSettings, on: boolean): TitleSettings {
  if (on) return { ...s, personalAllowed: true }
  return { choice: s.choice && isPersonalTitle(s.choice) ? null : s.choice, personalAllowed: false, consents: {} }
}

/** Bestätigt (Tag `day`) und trägt einen persönlichen Titel. */
export function withConsent(s: TitleSettings, id: PersonalTitleId, day: string): TitleSettings {
  return { ...s, personalAllowed: true, choice: id, consents: { ...s.consents, [id]: day } }
}

/** Braucht diese Wahl vorher die Bestätigung? */
export const needsConsent = (s: TitleSettings, id: TitleBadgeId): id is PersonalTitleId =>
  isPersonalTitle(id) && !Object.hasOwn(s.consents, id)

const ORDER: readonly Visibility[] = ['me', 'friends', 'all']

/** Die strengere zweier Stufen (persönlicher Titel: höchstens wie sein Quellfeld). */
export const stricter = (a: Visibility, b: Visibility): Visibility =>
  ORDER[Math.min(ORDER.indexOf(a), ORDER.indexOf(b))]

export const DEFAULT_TITLE_SETTINGS: TitleSettings = { choice: null, personalAllowed: false, consents: {} }
