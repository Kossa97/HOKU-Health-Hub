import { describe, expect, it } from 'vitest'
import { BADGE_IDS, BADGE_IDS_BY_GROUP } from './badgeIds'
import { BADGES, BADGE_BY_ID, badgeName, earnedOrder, evaluateBadges, type BadgeFacts } from './badges'
import { addDays } from './progressScore'

const TODAY = '2026-11-02'

const facts = (x: Partial<BadgeFacts> = {}): BadgeFacts => ({
  today: TODAY, entryDays: [], sessionDays: [], weightDays: [], intakeDays: [], dailyLogDays: [], measurementDays: [],
  bloodReports: [], cycleEndDays: [], wearableSince: null, profileChecks: { have: 0, need: 9 }, photoDays: [],
  reviewDays: [], bodyFat: [], weight: [], prDays: [], restingHr: null, stepWeeks: [], progressTotal: null, history: [],
  ...x,
})

const range = (from: string, n: number, step = 1) => Array.from({ length: n }, (_, i) => addDays(from, i * step))
const check = (id: keyof typeof BADGE_BY_ID, f: BadgeFacts) => BADGE_BY_ID[id].check(f)

describe('Liste', () => {
  it('39 Abzeichen, genau die IDs aus badgeIds.ts, in ihrer Gruppe, mit Symbol und Namen de/en', () => {
    expect(BADGES).toHaveLength(39)
    expect(BADGES.map(b => b.id)).toEqual([...BADGE_IDS])
    for (const b of BADGES) {
      expect((BADGE_IDS_BY_GROUP[b.group] as readonly string[]).includes(b.id)).toBe(true)
      expect(b.icon).not.toBe('')
      expect(b.name.de).not.toBe('')
      expect(b.name.en).not.toBe('')
    }
    expect(badgeName('streak_7', 'de-DE')).toBe('7 Tage ohne Lücke')
    expect(badgeName('streak_7', 'fr')).toBe('7 days in a row')
  })
})

describe('Bedingungen', () => {
  it('Tage ohne Luecke: verdient am Tag, an dem die Folge 7 erreicht; Stand = laufende Folge', () => {
    const days = [...range('2026-10-01', 7), ...range('2026-10-20', 3), ...range('2026-10-30', 4)]
    expect(check('streak_7', facts({ entryDays: days }))).toMatchObject({ earnedOn: '2026-10-07' })
    expect(check('streak_30', facts({ entryDays: days }))).toEqual({ earnedOn: null, have: 4, need: 30, unit: 'count' })
    // Folge endet vorgestern: laeuft nicht mehr
    expect(check('streak_30', facts({ entryDays: range('2026-10-01', 31) }))).toMatchObject({ earnedOn: '2026-10-30', have: 0 })
  })

  it('Wochen Training in Folge: Woche = Montag; verdient am ersten Training der vollen Woche', () => {
    const sessions = ['2026-10-06', '2026-10-08', '2026-10-14', '2026-10-21', '2026-10-30', '2026-10-31']
    expect(check('training_weeks_4', facts({ sessionDays: sessions }))).toMatchObject({ earnedOn: '2026-10-30' })
    expect(check('training_weeks_12', facts({ sessionDays: sessions }))).toMatchObject({ earnedOn: null, have: 4, need: 12 })
  })

  it('30 Tage alle Einnahmen bestaetigt: ein Tag mit Auslassung unterbricht', () => {
    const intake = range('2026-09-20', 40).map((day, i) => ({ day, all: i !== 5 }))
    expect(check('intake_all_30', facts({ intakeDays: intake }))).toMatchObject({ earnedOn: addDays('2026-09-26', 29) })
  })

  it('Meilensteine zaehlen: n-tes Workout, Blutbilder, erste Eintraege', () => {
    const sessions = range('2026-01-01', 12, 3)
    expect(check('workouts_10', facts({ sessionDays: sessions }))).toEqual({ earnedOn: sessions[9], have: 10, need: 10, unit: 'count' })
    expect(check('workouts_50', facts({ sessionDays: sessions }))).toMatchObject({ earnedOn: null, have: 12, need: 50 })
    const reports = [{ day: '2026-03-01', inRange: 12, of: 24 }, { day: '2026-06-20', inRange: 19, of: 24 }]
    expect(check('first_bloodwork', facts({ bloodReports: reports })).earnedOn).toBe('2026-03-01')
    expect(check('bloodwork_3', facts({ bloodReports: reports }))).toMatchObject({ earnedOn: null, have: 2, need: 3 })
    expect(check('first_daily_log', facts({ dailyLogDays: ['2026-05-02', '2026-04-01'] })).earnedOn).toBe('2026-04-01')
    expect(check('profile_complete', facts({ profileChecks: { have: 7, need: 9 } }))).toMatchObject({ earnedOn: null, have: 7, need: 9 })
    expect(check('profile_complete', facts({ profileChecks: { have: 9, need: 9 } })).earnedOn).toBe(TODAY)
    // ohne Prüfpunkte (z. B. nichts geladen) nie verdient
    expect(check('profile_complete', facts({ profileChecks: { have: 0, need: 0 } })).earnedOn).toBeNull()
  })

  it('−x % Koerperfett relativ wie die Rechnung, fruehestens 14 Tage nach der ersten Messung', () => {
    const bf = [{ day: '2026-03-14', value: 19.4 }, { day: '2026-03-20', value: 17 }, { day: '2026-04-01', value: 18.2 }, { day: '2026-10-30', value: 15.8 }]
    expect(check('body_fat_5', facts({ bodyFat: bf }))).toMatchObject({ earnedOn: '2026-04-01' })
    expect(check('body_fat_10', facts({ bodyFat: bf })).earnedOn).toBe('2026-10-30')
    expect(check('body_fat_20', facts({ bodyFat: bf }))).toEqual({ earnedOn: null, have: 18.6, need: 20, unit: 'percent_drop' })
  })

  it('Bestleistungen: erste und drei in einem Kalendermonat', () => {
    expect(check('first_pr', facts({ prDays: ['2026-05-03', '2026-04-10'] })).earnedOn).toBe('2026-04-10')
    const prs = ['2026-04-10', '2026-05-01', '2026-05-15', '2026-05-29', '2026-11-01']
    expect(check('pr_3_month', facts({ prDays: prs }))).toMatchObject({ earnedOn: '2026-05-29', have: 1, need: 3 })
  })

  it('Alle Blutwerte im Bereich: erster Befund mit allen; Stand = letzter Befund', () => {
    const reports = [{ day: '2026-03-01', inRange: 12, of: 24 }, { day: '2026-06-20', inRange: 19, of: 24 }]
    expect(check('all_markers_in_range', facts({ bloodReports: reports }))).toEqual({ earnedOn: null, have: 19, need: 24, unit: 'count' })
    expect(check('all_markers_in_range', facts({ bloodReports: [...reports, { day: '2026-09-01', inRange: 20, of: 20 }] })).earnedOn).toBe('2026-09-01')
  })

  it('Ruhepuls −5, Schrittwoche, Gesamtfortschritt aus der Wochenreihe', () => {
    expect(check('resting_hr_5', facts({ restingHr: { start: 61, now: 54 } })).earnedOn).toBe(TODAY)
    expect(check('resting_hr_5', facts({ restingHr: { start: 61, now: 58 } }))).toMatchObject({ earnedOn: null, have: 3 })
    const weeks = [{ week: '2026-10-19', avg: 10_400, days: 4 }, { week: '2026-10-26', avg: 10_100, days: 7 }]
    expect(check('steps_week_10k', facts({ stepWeeks: weeks })).earnedOn).toBe('2026-11-01')
    expect(check('steps_week_10k', facts({ stepWeeks: weeks.slice(0, 1) }))).toMatchObject({ earnedOn: null, have: 10_400 })
    const history = [{ week: '2026-03-16', total: 4, areas: {} }, { week: '2026-05-04', total: 12.5, areas: {} }]
    expect(check('progress_10', facts({ history, progressTotal: 28.3 })).earnedOn).toBe('2026-05-10')
    expect(check('progress_25', facts({ history, progressTotal: 28.3 })).earnedOn).toBe(TODAY)
    expect(check('progress_50', facts({ history, progressTotal: 28.3 }))).toEqual({ earnedOn: null, have: 28.3, need: 50, unit: 'percent' })
  })

  it('Freunde-Abzeichen und „Profil geteilt“ folgen nie aus Daten', () => {
    const f = facts({ reviewDays: range('2026-01-01', 30) })
    expect(check('first_friend', f).earnedOn).toBeNull()
    expect(check('profile_shared', f).earnedOn).toBeNull()
    expect(check('reviews_25', f).earnedOn).toBe(addDays('2026-01-01', 24))
  })
})

describe('evaluateBadges', () => {
  it('einmal verdient bleibt verdient, mit dem gespeicherten Tag; neu verdiente kommen dazu', () => {
    const f = facts({ entryDays: range('2026-10-27', 7), progressTotal: -5 })
    const r = evaluateBadges(f, { progress_10: '2026-05-10', profile_shared: '2026-06-01' })
    expect(r.added).toEqual(['streak_7'])
    expect(r.earned).toEqual({ progress_10: '2026-05-10', profile_shared: '2026-06-01', streak_7: TODAY })
    expect(r.states.find(s => s.id === 'progress_10')).toMatchObject({ earned: true, on: '2026-05-10' })
    expect(r.states.find(s => s.id === 'first_friend')).toMatchObject({ earned: false, on: null })
    expect(r.states).toHaveLength(39)
  })

  it('earnedOrder: zuletzt verdiente zuerst', () => {
    expect(earnedOrder({ streak_7: '2026-03-21', first_pr: '2026-05-01', streak_30: '2026-05-01' }))
      .toEqual(['first_pr', 'streak_30', 'streak_7'])
  })
})
