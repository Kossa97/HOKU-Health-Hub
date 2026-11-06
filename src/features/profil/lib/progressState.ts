/**
 * Alles, was die Seiten und der Schnappschuss vom Gesamtfortschritt brauchen,
 * in einem reinen Lauf: Eingabe, Ergebnis, Wochenreihe und Abzeichen.
 */
import type { ProfileSnapshotInput } from './profileSnapshot'
import { badgeFacts, type BadgeExtras } from './badgeFacts'
import { earnedOrder, evaluateBadges, type BadgeEvaluation } from './badges'
import { RANKS } from './titles'
import type { BadgeId } from './badgeIds'
import { progressSetup, type ProgressSetup } from './progressInput'
import {
  progressHistory, progressSnapshot, scoreProgress, buildProgressValues, withHistory, weekOf,
  type ProgressHistoryEntry, type ProgressResult, type ProgressSnapshot,
} from './progressScore'
import type { ProgressSettings } from './progressSettings'

export interface ProgressData {
  input: ProfileSnapshotInput
  extras: BadgeExtras
  settings: ProgressSettings
  goals: string[]
}

export interface ProgressState {
  setup: ProgressSetup | null
  result: ProgressResult | null
  /** Wochenreihe seit dem Start (mit den aktuellen Richtungen gerechnet). */
  history: ProgressHistoryEntry[]
  badges: BadgeEvaluation
  /** Fuer den Schnappschuss (`progress`); fehlt, solange kein Bereich zaehlt. */
  snapshot: ProgressSnapshot | undefined
  /** Verdiente Abzeichen, zuletzt verdiente zuerst. */
  badgeIds: BadgeId[]
  /** Tage mit eigenem Eintrag, ohne Doppelte (Rang des Titels). */
  entryDays: number
}

export function computeProgressState(data: ProgressData, today: string): ProgressState {
  const setup = progressSetup(data.input, data.settings, data.goals, today)
  const result = setup ? scoreProgress(buildProgressValues(setup.input), setup.input.goals, setup.input.overrides) : null
  const history = setup ? progressHistory(setup.input) : []
  const facts = badgeFacts(data.input, data.extras, setup, result, history, today)
  const badges = evaluateBadges(facts, data.settings.earnedBadges)
  return {
    setup,
    result,
    history,
    badges,
    snapshot: result && setup ? progressSnapshot(result, setup.startOn) : undefined,
    badgeIds: earnedOrder(badges.earned),
    // wie die Rang-Abzeichen (`rank` in badges.ts)
    // Einnahmen laedt der Schnappschuss nur fuer 366 Tage: nie weniger Tage zeigen,
    // als der hoechste schon verdiente Rang verlangt (verdient bleibt verdient)
    entryDays: Math.max(facts.ownEntryDays.length, ...RANKS.filter(r => badges.earned[r.id]).map(r => r.days)),
  }
}

/** Gespeicherte Reihe + neu gerechnete Wochen seit dem Start (fruehere Starts bleiben stehen). */
export function mergedHistory(stored: readonly ProgressHistoryEntry[], state: ProgressState): ProgressHistoryEntry[] {
  if (!state.setup) return [...stored]
  const from = weekOf(state.setup.startOn)
  return withHistory(stored.filter(e => e.week < from), state.history)
}
