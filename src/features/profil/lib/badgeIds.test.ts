import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  BADGE_IDS, BADGE_IDS_BY_GROUP, BADGES_NEED_FRIENDS, BADGES_WEB_BORDERLINE, BADGES_WEB_SENSITIVE,
  isBadgeId, parseWebBadges, webBadgeDefault, webBadgeOn, withWebBadge,
} from './badgeIds'

/** IDs aus `array[...]` einer SQL-Funktion ohne Argumente. */
function sqlListe(datei: string, funktion: string): string[] {
  const sql = readFileSync(resolve(__dirname, '../../../../', datei), 'utf8')
  const block = sql.match(new RegExp(`function public\\.${funktion}\\(\\)[\\s\\S]*?array\\[([\\s\\S]*?)\\]::text\\[\\]`))
  expect(block).not.toBeNull()
  return [...block![1].replace(/--[^\n]*/g, '').matchAll(/'([a-z_0-9]+)'/g)].map(m => m[1])
}

describe('Abzeichen-IDs', () => {
  it('39 IDs aus Spec Abschnitt 4, jede einmal, sprechend', () => {
    expect(BADGE_IDS).toHaveLength(39)
    expect(new Set(BADGE_IDS).size).toBe(39)
    for (const id of BADGE_IDS) expect(id).toMatch(/^[a-z][a-z0-9_]*$/)
  })

  it('Gruppen wie in der Spec: 9 / 12 / 12 / 6', () => {
    expect(BADGE_IDS_BY_GROUP.bestaendigkeit).toHaveLength(9)
    expect(BADGE_IDS_BY_GROUP.meilensteine).toHaveLength(12)
    expect(BADGE_IDS_BY_GROUP.fortschritt).toHaveLength(12)
    expect(BADGE_IDS_BY_GROUP.gemeinschaft).toHaveLength(6)
    expect(BADGES_NEED_FRIENDS.every(id => BADGE_IDS_BY_GROUP.gemeinschaft.includes(id as never))).toBe(true)
  })

  it('stimmt mit profile_badge_ids() in der Migration ueberein (gleiche Reihenfolge)', () => {
    expect(sqlListe('supabase-profil-p2b-fortschritt.sql', 'profile_badge_ids')).toEqual([...BADGE_IDS])
  })

  it('isBadgeId kennt nur die Liste', () => {
    expect(isBadgeId('streak_7')).toBe(true)
    expect(isBadgeId('hack_badge')).toBe(false)
    expect(isBadgeId(7)).toBe(false)
  })
})

describe('Abzeichen im Web (2c)', () => {
  it('heikle Liste = profile_badge_web_sensitive(), Grenzfaelle = profile_badge_web_borderline()', () => {
    expect(sqlListe('supabase-profil-p2c-web.sql', 'profile_badge_web_sensitive')).toEqual([...BADGES_WEB_SENSITIVE])
    expect(sqlListe('supabase-profil-p2c-web.sql', 'profile_badge_web_borderline')).toEqual([...BADGES_WEB_BORDERLINE])
  })

  it('10 heikle und 8 Grenzfaelle aus Spec 6.1, bekannt, ohne Ueberschneidung', () => {
    expect(BADGES_WEB_SENSITIVE).toHaveLength(10)
    expect(BADGES_WEB_BORDERLINE).toHaveLength(8)
    const alle = [...BADGES_WEB_SENSITIVE, ...BADGES_WEB_BORDERLINE]
    expect(new Set(alle).size).toBe(18)
    expect(alle.every(isBadgeId)).toBe(true)
  })

  it('Standard: heikle und Grenzfaelle aus, der Rest an', () => {
    expect(webBadgeDefault('first_bloodwork')).toBe(false)
    expect(webBadgeDefault('progress_25')).toBe(false)
    expect(webBadgeDefault('streak_30')).toBe(true)
    expect(BADGE_IDS.filter(webBadgeDefault)).toHaveLength(39 - 18)
  })

  it('webBadgeOn wie profile_web_badge_on: Abweichung, sonst Standard; Nicht-Bool zaehlt nicht', () => {
    expect(webBadgeOn('first_bloodwork', {})).toBe(false)
    expect(webBadgeOn('first_bloodwork', { first_bloodwork: true })).toBe(true)
    expect(webBadgeOn('workouts_10', { workouts_10: false })).toBe(false)
    expect(webBadgeOn('workouts_10', { first_bloodwork: true })).toBe(true)
    expect(webBadgeOn('workouts_10', { workouts_10: 'false' } as never)).toBe(true)
    // geerbte Schluessel sind keine Abweichung
    expect(webBadgeOn('workouts_10', Object.create({ workouts_10: false }))).toBe(true)
  })

  it('withWebBadge haelt nur Abweichungen; zurueck auf Standard loescht den Schluessel', () => {
    const a = withWebBadge({}, 'first_bloodwork', true)
    expect(a).toEqual({ first_bloodwork: true })
    const b = withWebBadge(a, 'workouts_10', false)
    expect(b).toEqual({ first_bloodwork: true, workouts_10: false })
    expect(withWebBadge(b, 'first_bloodwork', false)).toEqual({ workouts_10: false })
    expect(withWebBadge(b, 'workouts_10', true)).toEqual({ first_bloodwork: true })
    expect(withWebBadge({}, 'streak_7', true)).toEqual({})
    expect(a).toEqual({ first_bloodwork: true })
  })

  it('parseWebBadges: nur bekannte IDs mit true/false, nur echte Abweichungen', () => {
    expect(parseWebBadges({ first_bloodwork: true, workouts_10: false, streak_7: true, hack: true, weight_5: 'true', bloodwork_3: 1 }))
      .toEqual({ first_bloodwork: true, workouts_10: false })
    expect(parseWebBadges(null)).toEqual({})
    expect(parseWebBadges(['first_bloodwork'])).toEqual({})
    expect(parseWebBadges('{}')).toEqual({})
  })
})
