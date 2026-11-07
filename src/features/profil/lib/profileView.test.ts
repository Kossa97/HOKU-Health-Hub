import { describe, expect, it } from 'vitest'
import { localProfileView, parseFields, parseProfileView, profileUrl, shownFields } from './profileView'

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
