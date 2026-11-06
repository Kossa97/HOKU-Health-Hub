import { describe, expect, it, vi } from 'vitest'
import type { BadgeId } from './badgeIds'
import { titleMomentFor } from './titleMoment'
import { titleMomentStore } from './titleMomentStore'
import { PERSONAL_TITLE_SOURCE } from './titles'

const DAY = '2026-11-01'
const stored = (...ids: BadgeId[]) => Object.fromEntries(ids.map(id => [id, DAY])) as Partial<Record<BadgeId, string>>

describe('titleMomentFor', () => {
  it('neuer Rang: der Moment zeigt ihn', () => {
    expect(titleMomentFor(['rank_2'], stored('rank_1'))).toEqual({ kind: 'rank', id: 'rank_2' })
  })

  it('neues tragbares Abzeichen und neue Leiter-Stufe', () => {
    expect(titleMomentFor(['streak_100'], stored('rank_3'))).toEqual({ kind: 'badge', id: 'streak_100' })
    expect(titleMomentFor(['run_50'], stored('rank_3', 'run_10'))).toEqual({ kind: 'badge', id: 'run_50' })
  })

  it('nicht tragbare Abzeichen lösen nichts aus', () => {
    expect(titleMomentFor(['first_daily_log', 'streak_7', 'workouts_10'], stored('rank_1'))).toBeNull()
    expect(titleMomentFor([], stored('rank_1'))).toBeNull()
  })

  it('persönliche Titel nie', () => {
    const personal = Object.keys(PERSONAL_TITLE_SOURCE) as BadgeId[]
    expect(titleMomentFor(personal, stored('rank_2'))).toBeNull()
    // auch nicht, wenn sie neben einem normalen Titel stehen
    expect(titleMomentFor(['body_fat_20', 'sleep_rested_100', 'swim_10'], stored('rank_2'))).toEqual({ kind: 'badge', id: 'swim_10' })
  })

  it('mehrere auf einmal: ein Moment, der wichtigste', () => {
    // Rang geht vor jedem Titel
    expect(titleMomentFor(['run_10', 'rank_3', 'streak_100'], stored('rank_2'))).toEqual({ kind: 'rank', id: 'rank_3' })
    // zwei Ränge in einem Lauf: der höhere
    expect(titleMomentFor(['rank_3', 'rank_4'], stored('rank_1', 'rank_2'))).toEqual({ kind: 'rank', id: 'rank_4' })
    // ohne Rang: die höchste neue Stufe
    expect(titleMomentFor(['run_10', 'workouts_50', 'workouts_100'], stored('rank_2'))).toEqual({ kind: 'badge', id: 'workouts_100' })
    // gleiche Stufe: das erste in der Liste der tragbaren
    expect(titleMomentFor(['run_10', 'streak_100'], stored('rank_2'))).toEqual({ kind: 'badge', id: 'streak_100' })
  })

  it('erster Start nach dem Titel-Update: nur der aktuelle Rang, keine Zwischenstufen, keine alten Titel', () => {
    const before = stored('streak_7', 'streak_30', 'workouts_50')
    const added: BadgeId[] = ['rank_1', 'rank_2', 'rank_3', 'rank_4', 'run_10', 'run_50', 'streak_100']
    expect(titleMomentFor(added, before)).toEqual({ kind: 'rank', id: 'rank_4' })
    // noch kein Rang verdient (keine Tage mit Eintrag): gar kein Moment, auch kein Titel
    expect(titleMomentFor(['run_10'], before)).toBeNull()
  })

  it('erster Eintrag überhaupt: Neuling', () => {
    expect(titleMomentFor(['rank_1', 'first_daily_log'], {})).toEqual({ kind: 'rank', id: 'rank_1' })
  })

  it('schon gespeichert zählt nicht als neu', () => {
    expect(titleMomentFor(['rank_2'], stored('rank_1', 'rank_2'))).toBeNull()
  })
})

describe('titleMomentStore', () => {
  it('hält höchstens einen; ein neuer ersetzt den alten, Schließen nur des gezeigten', () => {
    const listener = vi.fn()
    const off = titleMomentStore.subscribe(listener)
    titleMomentStore.announce('u1', { kind: 'rank', id: 'rank_2' })
    const first = titleMomentStore.get()!
    titleMomentStore.announce('u1', { kind: 'badge', id: 'run_10' })
    const second = titleMomentStore.get()!
    expect(second).toMatchObject({ kind: 'badge', id: 'run_10', userId: 'u1' })
    expect(second.seq).toBeGreaterThan(first.seq)
    titleMomentStore.dismiss(first.seq)
    expect(titleMomentStore.get()).toBe(second)
    titleMomentStore.dismiss(second.seq)
    expect(titleMomentStore.get()).toBeNull()
    expect(listener).toHaveBeenCalledTimes(3)
    off()
  })
})
