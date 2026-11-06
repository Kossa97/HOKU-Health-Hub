import { describe, expect, it } from 'vitest'
import { SHOWN_BADGE_IDS } from './badgeIds'
import { BADGES_WEB_RANK, firstName, memberForText, webBadgeRow } from './webProfile'

describe('Rangfolge der Abzeichen im Web', () => {
  it('enthält jedes Abzeichen genau einmal', () => {
    expect(new Set(BADGES_WEB_RANK).size).toBe(BADGES_WEB_RANK.length)
    expect([...BADGES_WEB_RANK].sort()).toEqual([...SHOWN_BADGE_IDS].sort())
  })

  it('bis drei: alle offen, schwerste zuerst', () => {
    expect(webBadgeRow(['streak_7', 'streak_365', 'workouts_10'])).toEqual({ open: ['streak_365', 'streak_7', 'workouts_10'], more: 0 })
    expect(webBadgeRow([])).toEqual({ open: [], more: 0 })
  })

  it('ab vier: zwei offen, „+x“ zählt die verdeckte Kachel mit', () => {
    const row = webBadgeRow(['profile_shared', 'streak_7', 'workouts_250', 'streak_30', 'first_pr'])
    expect(row.open).toEqual(['workouts_250', 'streak_30'])
    expect(row.more).toBe(3)
  })

  it('doppelte IDs zählen einmal', () => {
    expect(webBadgeRow(['streak_7', 'streak_7'])).toEqual({ open: ['streak_7'], more: 0 })
  })
})

describe('Texte', () => {
  it('„Seit … dabei“ nur aus der Dauer', () => {
    expect(memberForText({ unit: 'days', n: 0 })).toEqual({ key: 'web_seit_heute', count: 0 })
    expect(memberForText({ unit: 'days', n: 12 })).toEqual({ key: 'web_seit_days', count: 12 })
    expect(memberForText({ unit: 'months', n: 7 })).toEqual({ key: 'web_seit_months', count: 7 })
    expect(memberForText({ unit: 'years', n: 2 })).toEqual({ key: 'web_seit_years', count: 2 })
  })

  it('Vorname aus dem Anzeigenamen, sonst Nutzername', () => {
    expect(firstName('Mara  Muster', 'mara')).toBe('Mara')
    expect(firstName(null, 'mara')).toBe('mara')
    expect(firstName('   ', 'mara')).toBe('mara')
  })
})
