import { describe, expect, it } from 'vitest'
import type { TrainingRoutine, TrainingSession } from '../types'
import { trainingText, type TrainingTextKey } from '../i18n'
import { dotHint } from './dotHint'
import type { NextInPlan } from './planRotation'

const tt = (key: TrainingTextKey, vars?: Record<string, string | number>) => trainingText('de', key, vars)
const routine = { id: 'r1', name: 'Push', kind: 'strength', weekdays: [1], exercises: [], sortOrder: 0, folder: null } as TrainingRoutine
const next = (plannedToday: boolean): NextInPlan => ({ routine, folder: null, rotation: [routine], lastTrainedAt: null, plannedToday })
const session = { id: 's', kind: 'strength', title: 'Beine' } as TrainingSession
const base = { tt, todaySessions: [], hasRoutines: true, next: null, restDay: false, lowReadiness: false, week: { sessions: 1, goal: 3 } }

describe('dotHint', () => {
  it('heute geplant, dazu die Woche', () => {
    expect(dotHint({ ...base, next: next(true) })).toBe('Heute ist Push dran. Noch 2 Einheiten bis zu deinem Wochenziel.')
  })
  it('heute geplant, aber niedrige Bereitschaft: lieber locker statt Wochenziel', () => {
    expect(dotHint({ ...base, next: next(true), lowReadiness: true })).toBe('Heute ist Push dran. Deine Bereitschaft ist heute niedrig, mach lieber locker.')
  })
  it('heute schon trainiert, Wochenziel geschafft', () => {
    expect(dotHint({ ...base, todaySessions: [session], week: { sessions: 3, goal: 3 } })).toBe('Beine ist heute erledigt. Stark! Wochenziel geschafft!')
  })
  it('Ruhetag, naechste Routine, ohne Routinen', () => {
    expect(dotHint({ ...base, next: next(false), restDay: true })).toBe('Heute ist Ruhetag. Erholung gehört zum Training.')
    expect(dotHint({ ...base, next: next(false), week: { sessions: 2, goal: 3 } })).toBe('Als Nächstes im Plan: Push. Noch eine Einheit bis zu deinem Wochenziel.')
    expect(dotHint({ ...base, hasRoutines: false })).toMatch(/^Leg los/)
  })
})
