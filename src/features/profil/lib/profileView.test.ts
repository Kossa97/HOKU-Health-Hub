import { describe, expect, it } from 'vitest'
import {
  isWebProgress, localProfileView, parseFields, parseProfileTitle, parseProfileView, parseTitleSettings, parseWebCard, profileUrl, shownFields,
} from './profileView'

describe('parseFields', () => {
  it('übernimmt nur bekannte Felder in erwarteter Form', () => {
    const f = parseFields({
      age: { v: 29 }, weight: { v: 81, unit: 'kg', delta: -3.2, extra: 'x' },
      routine: { name: 'Upper / Lower', x: 'leck' }, unbekannt: { v: 1 },
      steps: { v: 'viele' }, goals: ['kraft', 'quatsch'], country: 'XX', gender: 'female',
      e1rm: { unit: 'kg', top: [{ id: 'a', name: 'Kreuzheben', v: 142 }, { name: 'ohne Zahl' }, 5] },
    })
    expect(f).toEqual({
      age: { v: 29 }, weight: { v: 81, unit: 'kg', delta: -3.2 }, routine: { name: 'Upper / Lower' },
      goals: ['kraft'], gender: 'female', e1rm: { unit: 'kg', top: [{ id: 'a', name: 'Kreuzheben', v: 142 }] },
    })
  })

  it('leere Zähler und Nicht-Objekte fallen weg', () => {
    expect(parseFields({ reviews: { count: 0, avgRating: 4 }, streak: { days: 0 }, markers: 3 })).toEqual({})
    expect(parseFields(null)).toEqual({})
    expect(parseFields([1, 2])).toEqual({})
  })
})

describe('parseFields, Formen der Stufe web (2c)', () => {
  it('progress nur {tier} aus den sechs Stufen; Zusaetzliches faellt weg', () => {
    expect(parseFields({ progress: { tier: 30 } })).toEqual({ progress: { tier: 30 } })
    expect(parseFields({ progress: { tier: 100, total: 128.3, areas: { blut: 90 }, since: '2026-03-14' } }))
      .toEqual({ progress: { tier: 100 } })
    for (const tier of [10, 20, 30, 50, 75, 100]) expect(parseFields({ progress: { tier } }).progress).toEqual({ tier })
  })

  it('ungueltige Stufe: kein progress (auch kein Rueckfall auf die 2b-Form)', () => {
    for (const tier of [0, 5, 25, 40, 99, 101, -10, '30', null, 30.5]) {
      expect(parseFields({ progress: { tier } })).toEqual({})
    }
    expect(parseFields({ progress: { tier: 'x', total: 28, areas: {}, since: '2026-03-14' } })).toEqual({})
  })

  it('2b-Form bleibt, wie sie war, und ist keine Web-Form', () => {
    const f = parseFields({ progress: { total: 28.4, areas: { koerper: 7.7, nase: 1 }, since: '2026-03-14', counts: { koerper: 4 } } })
    expect(f.progress).toEqual({ total: 28.4, areas: { koerper: 7.7 }, since: '2026-03-14' })
    expect(isWebProgress(f.progress!)).toBe(false)
    expect(isWebProgress({ tier: 10 })).toBe(true)
  })

  it('reviews im Web nur {count}: keine erfundene Bewertung 0', () => {
    expect(parseFields({ reviews: { count: 12 } })).toEqual({ reviews: { count: 12 } })
    expect(parseFields({ reviews: { count: 3, avgRating: 4.5 } })).toEqual({ reviews: { count: 3, avgRating: 4.5 } })
    expect(parseFields({ reviews: { count: 0 } })).toEqual({})
    expect(parseFields({ reviews: { count: '12' } })).toEqual({})
  })
})

describe('parseWebCard', () => {
  it('liest member_since als Dauer, web_value_count und entry_count', () => {
    expect(parseWebCard({ member_since: { unit: 'months', n: 7 }, web_value_count: 9, entry_count: 1240 }))
      .toEqual({ memberFor: { unit: 'months', n: 7 }, webValueCount: 9, entryCount: 1240 })
    expect(parseWebCard({ member_since: { unit: 'days', n: 0 } })).toEqual({ memberFor: { unit: 'days', n: 0 } })
  })

  it('ungueltige Angaben fallen einzeln weg; ohne gueltige Angabe null', () => {
    expect(parseWebCard({
      member_since: { unit: 'weeks', n: 3 }, web_value_count: 9, entry_count: 2.5, extra: 'x',
    })).toEqual({ webValueCount: 9 })
    expect(parseWebCard({ member_since: { unit: 'years', n: -1 }, web_value_count: 0, entry_count: '12' })).toBeNull()
    expect(parseWebCard({ member_since: '2026-03' })).toBeNull()
    expect(parseWebCard({ member_since: { unit: 'months', n: 1.5 } })).toBeNull()
    expect(parseWebCard(null)).toBeNull()
    expect(parseWebCard([1])).toBeNull()
    expect(parseWebCard({})).toBeNull()
  })
})

describe('parseProfileView', () => {
  it('liest die Antwort von profile_view', () => {
    const v = parseProfileView({
      username: 'mara', display_name: 'Mara', own: true, avatar: 'u/a.jpg',
      fields: { bio: 'Hallo' }, visibility: { bio: 'all', nase: 'all' }, profile_private: false, web_link_enabled: true,
    })
    expect(v).toMatchObject({ username: 'mara', displayName: 'Mara', own: true, avatar: 'u/a.jpg', fields: { bio: 'Hallo' }, visibility: { bio: 'all' }, profilePrivate: false, webLinkEnabled: true })
  })

  it('ohne Benutzername oder bei null: nicht gefunden', () => {
    expect(parseProfileView(null)).toBeNull()
    expect(parseProfileView({ own: true })).toBeNull()
  })

  it('liest Stufe der Antwort und Bildstatus; Unbekanntes wird null', () => {
    expect(parseProfileView({ username: 'mara', own: true, as: 'web', avatar_status: 'pending', cover_status: 'rejected' }))
      .toMatchObject({ as: 'web', avatarStatus: 'pending', coverStatus: 'rejected' })
    expect(parseProfileView({ username: 'mara', own: true, as: 'admin', avatar_status: 'ok' }))
      .toMatchObject({ as: null, avatarStatus: null, coverStatus: null })
  })

  it('fremde Sicht ohne Stufen', () => {
    expect(parseProfileView({ username: 'max', own: false, fields: {} })?.visibility).toBeNull()
  })

  it('Antwort der Stufe web (wie Probe W2 im Trockenlauf)', () => {
    const v = parseProfileView({
      username: 'mara', display_name: 'Mara K.', own: false, blocked: false, private: false, avatar: 'u/a.jpg',
      fields: {
        cover: 'u/c.jpg', country: 'DE', goals: ['kraft'], bio: 'Hallo', streak: { days: 12 },
        progress: { tier: 20 }, badges: ['streak_7', 'unbekannt'], reviews: { count: 12 },
      },
      card: { member_since: { unit: 'months', n: 7 }, web_value_count: 9, entry_count: 25 },
      web_indexable: false,
      neu_vom_server: { x: 1 },
    })
    expect(v).toMatchObject({
      username: 'mara', own: false, card: { memberFor: { unit: 'months', n: 7 }, webValueCount: 9, entryCount: 25 },
      webIndexable: false, webBadges: null, visibility: null,
    })
    expect(v?.fields).toEqual({
      cover: 'u/c.jpg', country: 'DE', goals: ['kraft'], bio: 'Hallo', streak: { days: 12 },
      progress: { tier: 20 }, badges: ['streak_7'], reviews: { count: 12 },
    })
    expect(v).not.toHaveProperty('neu_vom_server')
  })

  it('Eigentuemer: web_badges (nur gueltige Abweichungen) und web_indexable', () => {
    const v = parseProfileView({
      username: 'mara', own: true, as: 'owner', web_indexable: true,
      web_badges: { first_bloodwork: true, workouts_10: false, streak_7: true, hack: true, weight_5: 'ja' },
    })
    expect(v).toMatchObject({ webIndexable: true, webBadges: { first_bloodwork: true, workouts_10: false }, card: null })
  })

  it('falsche Formen: null statt Raten', () => {
    expect(parseProfileView({ username: 'mara', web_indexable: 'true', web_badges: ['first_bloodwork'], card: 'x' }))
      .toMatchObject({ webIndexable: null, webBadges: null, card: null })
    expect(parseProfileView({ username: 'mara' })).toMatchObject({ webIndexable: null, webBadges: null, card: null })
  })
})

describe('localProfileView', () => {
  it('nimmt Bio, Ziele, Land, Geschlecht, Mitglied seit aus der Zeile und den Rest aus dem Schnappschuss', () => {
    const v = localProfileView({
      username: 'mara', display_name: '', public_bio: 'Recomp', goals: ['recomp'], country: 'DE', profile_gender: 'female',
      created_at: '2026-03-04T10:00:00Z', cover_path: 'u/c.jpg', avatar_path: null, field_visibility: { age: 'friends' },
      profile_private: true, web_link_enabled: false,
    }, { age: { v: 29 } })
    expect(v.fields).toEqual({ bio: 'Recomp', goals: ['recomp'], country: 'DE', gender: 'female', member_since: '2026-03', cover: 'u/c.jpg', age: { v: 29 } })
    expect(v).toMatchObject({ own: true, displayName: null, visibility: { age: 'friends' }, profilePrivate: true, webLinkEnabled: false })
    // vor der Migration 2c: Spalten fehlen
    expect(v).toMatchObject({ webIndexable: null, webBadges: null, card: null })
  })

  it('liest web_badges und web_indexable aus der Zeile (2c)', () => {
    const v = localProfileView({ username: 'mara', web_indexable: true, web_badges: { first_bloodwork: true } }, null)
    expect(v).toMatchObject({ webIndexable: true, webBadges: { first_bloodwork: true } })
  })
})

describe('shownFields', () => {
  it('eigene Sicht zeigt HRV und VO2max mit Strich, fremde nicht', () => {
    expect(shownFields('gesundheit', { steps: { v: 1, unit: 'steps' } }, true)).toEqual(['steps', 'hrv', 'vo2max'])
    expect(shownFields('gesundheit', { steps: { v: 1, unit: 'steps' } }, false)).toEqual(['steps'])
    expect(shownFields('ueber', {}, true)).toEqual([])
  })
})

describe('profileUrl', () => {
  it('klein geschrieben, ohne doppelten Schrägstrich', () => {
    expect(profileUrl('Mara.Lifts', 'https://hoku.app/')).toBe('https://hoku.app/u/mara.lifts')
  })
})

describe('Titel (Profil-Zusatz)', () => {
  it('parseProfileTitle: Rang nur mit Rang-ID, Abzeichen nur tragbar, sonst nichts', () => {
    expect(parseProfileTitle({ kind: 'rank', id: 'rank_4' })).toEqual({ kind: 'rank', id: 'rank_4' })
    expect(parseProfileTitle({ kind: 'badge', id: 'run_50' })).toEqual({ kind: 'badge', id: 'run_50' })
    expect(parseProfileTitle({ kind: 'badge', id: 'rank_4' })).toBeUndefined()
    expect(parseProfileTitle({ kind: 'rank', id: 'run_50' })).toBeUndefined()
    // verdient, aber nicht tragbar
    expect(parseProfileTitle({ kind: 'badge', id: 'streak_7' })).toBeUndefined()
    expect(parseProfileTitle({ kind: 'badge', id: '<b>' })).toBeUndefined()
    expect(parseProfileTitle('Legende')).toBeUndefined()
  })

  it('parseFields übernimmt nur einen gültigen Titel', () => {
    expect(parseFields({ title: { kind: 'rank', id: 'rank_2' } }).title).toEqual({ kind: 'rank', id: 'rank_2' })
    expect(parseFields({ title: { kind: 'badge', id: 'hack' } }).title).toBeUndefined()
  })

  it('parseTitleSettings: Wahl nur tragbar, Bestätigungen nur persönlich mit Tag; fehlende Spalten = Standard', () => {
    expect(parseTitleSettings({})).toEqual({ choice: null, personalAllowed: false, consents: {} })
    expect(parseTitleSettings({
      title_choice: 'body_fat_5', personal_titles: true,
      title_consents: { body_fat_5: '2026-11-06', run_10: '2026-11-06', weight_5: 'gestern' },
    })).toEqual({ choice: 'body_fat_5', personalAllowed: true, consents: { body_fat_5: '2026-11-06' } })
    expect(parseTitleSettings({ title_choice: 'rank_1' }).choice).toBeNull()
  })

  it('parseProfileView: Titel-Einstellungen nur, wenn der Server sie schickt (eigene Sicht)', () => {
    expect(parseProfileView({ username: 'mara', fields: {} })!.titleSettings).toBeNull()
    expect(parseProfileView({ username: 'mara', fields: {}, personal_titles: false, title_consents: {} })!.titleSettings)
      .toEqual({ choice: null, personalAllowed: false, consents: {} })
    expect(localProfileView({ username: 'mara' }, null).titleSettings).toEqual({ choice: null, personalAllowed: false, consents: {} })
  })
})

