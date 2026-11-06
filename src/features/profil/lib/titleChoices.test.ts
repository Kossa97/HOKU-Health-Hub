import { describe, expect, it } from 'vitest'
import type { BadgeState } from './badges'
import { BADGE_IDS, type BadgeId } from './badgeIds'
import { TITLE_BADGE_IDS, TITLE_LADDERS } from './titles'
import {
  isWorn, needsConsent, openTitles, optionOf, rankLadder, stricter, titleOptions,
  withChoice, withConsent, withPersonalAllowed,
} from './titleChoices'

/** Alle Abzeichen offen; `have` je ID, verdient, wenn in `earned`. */
function states(earned: BadgeId[] = [], have: Partial<Record<BadgeId, [number, number]>> = {}): BadgeState[] {
  return BADGE_IDS.map(id => {
    const e = earned.includes(id)
    const [h, n] = have[id] ?? [0, 10]
    return { id, earned: e, on: e ? '2026-09-01' : null, earnedOn: e ? '2026-09-01' : null, have: h, need: n, unit: 'count' }
  })
}

describe('titleOptions', () => {
  it('Leitern als eine Zeile: gespeichert wird die erste Stufe, gezeigt die höchste verdiente', () => {
    const opts = titleOptions(states(['run_10', 'run_50']))
    const lauf = opts.find(o => o.ladder === 'run')!
    expect(lauf).toMatchObject({ choice: 'run_10', shown: 'run_50', earned: true, level: 2, next: 'run_150' })
    expect(opts.filter(o => o.ladder === 'run')).toHaveLength(1)
    // eine Zeile je Leiter, je tragbarem Einzelabzeichen
    const leitern = Object.keys(TITLE_LADDERS).length
    const stufen = Object.values(TITLE_LADDERS).flat().length
    expect(opts).toHaveLength(TITLE_BADGE_IDS.length - stufen + leitern)
  })

  it('offene Leiter zeigt die erste Stufe; oberste Stufe hat keine nächste', () => {
    const opts = titleOptions(states(['yoga_10', 'yoga_50', 'yoga_150']))
    expect(optionOf(opts, 'hike_25')).toMatchObject({ shown: 'hike_10', earned: false, level: 0, next: null })
    expect(optionOf(opts, 'yoga_50')).toMatchObject({ shown: 'yoga_150', level: 3, next: null })
  })

  it('persönliche Titel sind markiert', () => {
    const opts = titleOptions(states(['body_fat_5']))
    expect(optionOf(opts, 'body_fat_5')).toMatchObject({ personal: true, earned: true })
    expect(optionOf(opts, 'streak_100')?.personal).toBe(false)
  })
})

describe('openTitles', () => {
  it('am nächsten dran zuerst, ohne persönliche und ohne verdiente', () => {
    const opts = titleOptions(states(['streak_100'], { hike_10: [9, 10], entries_1000: [500, 1000], streak_365: [40, 365] }))
    const offen = openTitles(opts).map(o => o.shown)
    expect(offen.slice(0, 3)).toEqual(['hike_10', 'entries_1000', 'streak_365'])
    expect(offen).not.toContain('streak_100')
    expect(offen).not.toContain('body_fat_5')
  })
})

describe('isWorn', () => {
  it('jede Stufe einer Leiter zählt, Rang nie', () => {
    const opts = titleOptions(states(['run_10', 'run_50']))
    const lauf = optionOf(opts, 'run_10')!
    expect(isWorn(lauf, { kind: 'badge', id: 'run_50' })).toBe(true)
    expect(isWorn(lauf, { kind: 'rank', id: 'rank_2' })).toBe(false)
    expect(isWorn(optionOf(opts, 'streak_100')!, { kind: 'badge', id: 'run_50' })).toBe(false)
  })
})

describe('rankLadder', () => {
  it('ohne Eintrag: noch 1 Tag bis Neuling', () => {
    const r = rankLadder(0)
    expect(r.current).toBeNull()
    expect(r.next).toMatchObject({ id: 'rank_1', missing: 1, frac: 0 })
    expect(r.steps.every(s => s.stage === 'todo')).toBe(true)
  })

  it('150 Tage: Routinier aktuell, 50 bis Veteran, halber Weg', () => {
    const r = rankLadder(150)
    expect(r.current).toBe('rank_4')
    expect(r.steps.map(s => s.stage)).toEqual(['done', 'done', 'done', 'cur', 'todo', 'todo'])
    expect(r.next).toMatchObject({ id: 'rank_5', missing: 50, frac: 0.5 })
  })

  it('ab 365: Legende, kein nächster', () => {
    expect(rankLadder(400)).toMatchObject({ current: 'rank_6', next: null })
  })
})

describe('Einstellungen', () => {
  const base = { choice: null, personalAllowed: true, consents: { body_fat_5: '2026-09-01' } } as const

  it('Schalter aus: Widerruf aller Bestätigungen, getragener persönlicher Titel wird zum Rang', () => {
    expect(withPersonalAllowed({ ...base, choice: 'body_fat_5' }, false)).toEqual({ choice: null, personalAllowed: false, consents: {} })
    // ein normaler Titel bleibt
    expect(withPersonalAllowed({ ...base, choice: 'run_10' }, false)).toEqual({ choice: 'run_10', personalAllowed: false, consents: {} })
  })

  it('wieder an: jeder persönliche Titel braucht eine neue Bestätigung', () => {
    const wieder = withPersonalAllowed(withPersonalAllowed(base, false), true)
    expect(wieder).toEqual({ choice: null, personalAllowed: true, consents: {} })
    expect(needsConsent(wieder, 'body_fat_5')).toBe(true)
  })

  it('Bestätigung trägt den Titel und merkt den Tag; normale brauchen keine', () => {
    const s = withConsent({ ...base, consents: {} }, 'weight_5', '2026-09-28')
    expect(s).toEqual({ choice: 'weight_5', personalAllowed: true, consents: { weight_5: '2026-09-28' } })
    expect(needsConsent(s, 'weight_5')).toBe(false)
    expect(needsConsent(s, 'run_10')).toBe(false)
    expect(withChoice(s, null).choice).toBeNull()
  })

  it('stricter: die engere Stufe', () => {
    expect(stricter('all', 'friends')).toBe('friends')
    expect(stricter('me', 'all')).toBe('me')
    expect(stricter('all', 'all')).toBe('all')
  })
})
