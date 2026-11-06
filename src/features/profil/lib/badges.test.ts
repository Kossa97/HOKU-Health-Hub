import { describe, expect, it } from 'vitest'
import { BADGE_IDS, BADGE_IDS_BY_GROUP } from './badgeIds'
import { BADGES, BADGE_BY_ID, badgeName, earnedOrder, evaluateBadges, type BadgeFacts } from './badges'
import { addDays } from './progressScore'

const TODAY = '2026-11-02'

const facts = (x: Partial<BadgeFacts> = {}): BadgeFacts => ({
  today: TODAY, entryDays: [], sessionDays: [], weightDays: [], intakeDays: [], dailyLogDays: [], measurementDays: [],
  bloodReports: [], cycleEndDays: [], wearableSince: null, profileChecks: { have: 0, need: 9 }, photoDays: [],
  reviewDays: [], bodyFat: [], weight: [], prDays: [], restingHr: null, stepWeeks: [], progressTotal: null, history: [],
  ownEntryDays: [], entryStamps: [], sessionsByKind: {}, sleepNights: [],
  ...x,
})

const range = (from: string, n: number, step = 1) => Array.from({ length: n }, (_, i) => addDays(from, i * step))
const check = (id: keyof typeof BADGE_BY_ID, f: BadgeFacts) => BADGE_BY_ID[id].check(f)

describe('Liste', () => {
  it('81 Abzeichen (39 aus 2b, 42 Titel-Zusatz), genau die IDs aus badgeIds.ts, in ihrer Gruppe, mit Symbol und Namen de/en', () => {
    expect(BADGES).toHaveLength(81)
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
    expect(r.states).toHaveLength(81)
  })

  it('earnedOrder: zuletzt verdiente zuerst', () => {
    expect(earnedOrder({ streak_7: '2026-03-21', first_pr: '2026-05-01', streak_30: '2026-05-01' }))
      .toEqual(['first_pr', 'streak_30', 'streak_7'])
  })
})

describe('Titel-Zusatz: Ränge', () => {
  it('zählen Tage mit eigenem Eintrag zusammen, Lücken erlaubt (1 · 10 · 50 · 100 · 200 · 365)', () => {
    const tage = range('2025-01-01', 100, 3) // jeder dritte Tag
    const f = facts({ ownEntryDays: tage })
    expect(check('rank_1', f).earnedOn).toBe(tage[0])
    expect(check('rank_2', f).earnedOn).toBe(tage[9])
    expect(check('rank_3', f).earnedOn).toBe(tage[49])
    expect(check('rank_4', f).earnedOn).toBe(tage[99])
    expect(check('rank_5', f)).toMatchObject({ earnedOn: null, have: 100, need: 200 })
    expect(check('rank_6', f).need).toBe(365)
  })

  it('doppelte Tage zählen einmal; Wearable-Tage (nur entryDays) zählen nicht', () => {
    const f = facts({ ownEntryDays: ['2026-01-01', '2026-01-01'], entryDays: range('2025-01-01', 400) })
    expect(check('rank_1', f).earnedOn).toBe('2026-01-01')
    expect(check('rank_2', f)).toMatchObject({ earnedOn: null, have: 1 })
  })

  it('erscheinen nicht in earnedOrder (Schnappschuss, Profilzeile)', () => {
    expect(earnedOrder({ rank_3: '2026-05-01', streak_7: '2026-03-21' })).toEqual(['streak_7'])
  })
})

describe('Titel-Zusatz: Sportarten und weitere', () => {
  it('Sportart-Stufen zählen Einheiten der Art, Yoga und Mobility zusammen', () => {
    const f = facts({ sessionsByKind: { run: range('2026-01-01', 50), yoga: range('2026-01-01', 6), mobility: range('2026-02-01', 4) } })
    expect(check('run_10', f).earnedOn).toBe(addDays('2026-01-01', 9))
    expect(check('run_50', f).earnedOn).toBe(addDays('2026-01-01', 49))
    expect(check('run_150', f)).toMatchObject({ earnedOn: null, have: 50 })
    expect(check('yoga_10', f).earnedOn).toBe(addDays('2026-02-01', 3))
    expect(check('cycle_10', f).earnedOn).toBeNull()
  })

  it('Allrounder: fünf Sportarten mit je zehn Einheiten, verdient mit der zehnten der fünften', () => {
    const kinds = ['run', 'cycle', 'swim', 'row', 'hike'] as const
    const f = facts({ sessionsByKind: Object.fromEntries(kinds.map((k, i) => [k, range(addDays('2026-01-01', i), 10, 5)])) })
    expect(check('allrounder', f).earnedOn).toBe(addDays(addDays('2026-01-01', 4), 45))
    const vier = facts({ sessionsByKind: Object.fromEntries(kinds.slice(0, 4).map(k => [k, range('2026-01-01', 10)])) })
    expect(check('allrounder', vier)).toMatchObject({ earnedOn: null, have: 4, need: 5 })
  })

  it('Bestleistungen 5/25/100, Tagebuch nur Tage, 1.000 Einträge zählen Doppelte mit', () => {
    const f = facts({
      prDays: range('2026-01-01', 25),
      dailyLogDays: [...range('2026-01-01', 30), '2026-01-01'],
      entryStamps: Array.from({ length: 1000 }, (_, i) => addDays('2024-01-01', Math.floor(i / 3))),
    })
    expect(check('prs_5', f).earnedOn).toBe(addDays('2026-01-01', 4))
    expect(check('prs_25', f).earnedOn).toBe(addDays('2026-01-01', 24))
    expect(check('journal_30', f).earnedOn).toBe(addDays('2026-01-01', 29))
    expect(check('entries_1000', f).earnedOn).toBe(addDays('2024-01-01', 333))
  })

  it('Schlaf: 30 Nächte getrackt; 7–9 Stunden für die persönlichen Schlaf-Titel', () => {
    const naechte = range('2026-01-01', 30).map((day, i) => ({ day, min: i % 2 === 0 ? 480 : 300 }))
    const f = facts({ sleepNights: naechte })
    expect(check('sleep_tracked_30', f).earnedOn).toBe(addDays('2026-01-01', 29))
    expect(check('sleep_rested_30', f)).toMatchObject({ earnedOn: null, have: 15 })
  })

  it('12 Wochen in Folge Ø ≥ 10.000 Schritte, verdient am Sonntag der zwölften', () => {
    const wochen = range('2026-01-05', 12, 7).map(week => ({ week, avg: 11_000, days: 7 }))
    const f = facts({ stepWeeks: wochen, today: '2026-12-31' })
    expect(check('steps_weeks_12', f).earnedOn).toBe(addDays(wochen[11].week, 6))
    const luecke = facts({ stepWeeks: wochen.map((w, i) => i === 5 ? { ...w, avg: 8_000 } : w), today: '2026-12-31' })
    expect(check('steps_weeks_12', luecke).earnedOn).toBeNull()
  })
})

