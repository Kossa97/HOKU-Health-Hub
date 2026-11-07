import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BADGE_IDS, isBadgeId, RANK_IDS, type BadgeId } from './badgeIds'
import { BADGE_BY_ID } from './badges'
import { isProfileField } from './profileVisibility'
import {
  highestRank, isPersonalTitle, ladderOf, nextRank, PERSONAL_TITLE_SOURCE, RANKS, TITLE_BADGE_IDS, TITLE_LADDERS,
  TITLE_NAMES, titleName, wornStage, wornTitle, type TitleSettings,
} from './titles'

const SQL = readFileSync(resolve(__dirname, '../../../../supabase-profil-titel.sql'), 'utf8')

/** IDs aus `array[...]` einer SQL-Funktion ohne Argumente. */
function sqlListe(funktion: string): string[] {
  const block = SQL.match(new RegExp(`function public\\.${funktion}\\(\\)[\\s\\S]*?array\\[([\\s\\S]*?)\\]::text\\[\\]`))
  expect(block).not.toBeNull()
  return [...block![1].matchAll(/'([a-z_0-9]+)'/g)].map(m => m[1])
}

/** Rumpf einer SQL-Funktion mit einem Argument (bis `$$;`). */
function sqlRumpf(funktion: string): string {
  const block = SQL.match(new RegExp(`function public\\.${funktion}\\(p_id text\\)[\\s\\S]*?as \\$\\$([\\s\\S]*?)\\$\\$;`))
  expect(block).not.toBeNull()
  return block![1]
}

const settings = (x: Partial<TitleSettings> = {}): TitleSettings => ({ choice: null, personalAllowed: false, consents: {}, ...x })
const set = (...ids: BadgeId[]) => new Set<BadgeId>(ids)

describe('Titel-Listen', () => {
  it('Ränge: sechs Stufen 1 · 10 · 50 · 100 · 200 · 365, wie profile_rank_ids()', () => {
    expect(RANKS.map(r => r.id)).toEqual([...RANK_IDS])
    expect(RANKS.map(r => r.days)).toEqual([1, 10, 50, 100, 200, 365])
    expect(sqlListe('profile_rank_ids')).toEqual([...RANK_IDS])
    expect(titleName('rank_4', 'de')).toBe('Routinier')
    expect(titleName('rank_4', 'en')).toBe('Steady')
  })

  it('tragbare Abzeichen = profile_title_badge_ids() (gleiche Reihenfolge), bekannt, keine Ränge', () => {
    expect(sqlListe('profile_title_badge_ids')).toEqual([...TITLE_BADGE_IDS])
    expect(TITLE_BADGE_IDS).toHaveLength(56)
    for (const id of TITLE_BADGE_IDS) {
      expect(isBadgeId(id), id).toBe(true)
      expect(RANK_IDS.includes(id), id).toBe(false)
      expect(TITLE_NAMES[id].de.trim(), id).not.toBe('')
      expect(TITLE_NAMES[id].en.trim(), id).not.toBe('')
    }
  })

  it('Leitern: drei Stufen aufsteigend, jede tragbar, wie profile_title_ladder()', () => {
    const rumpf = sqlRumpf('profile_title_ladder')
    for (const [name, stufen] of Object.entries(TITLE_LADDERS)) {
      expect(stufen, name).toHaveLength(3)
      for (const s of stufen) expect(TITLE_BADGE_IDS.includes(s), s).toBe(true)
      const liste = stufen.map(s => `'${s}'`).join(',')
      expect(rumpf, name).toContain(`when p_id = any (array[${liste}]) then array[${liste}]`)
      // gleiche Sache, steigende Schwelle: Reihenfolge der Abzeichen-Liste
      expect([...stufen].sort((a, b) => BADGE_IDS.indexOf(a) - BADGE_IDS.indexOf(b))).toEqual([...stufen])
    }
    expect((rumpf.match(/when p_id/g) ?? []).length).toBe(Object.keys(TITLE_LADDERS).length)
  })

  it('persönliche Titel: tragbar, mit Quellfeld aus den Profilfeldern, wie profile_title_source()', () => {
    const rumpf = sqlRumpf('profile_title_source')
    for (const [id, feld] of Object.entries(PERSONAL_TITLE_SOURCE)) {
      expect(TITLE_BADGE_IDS.includes(id as never), id).toBe(true)
      expect(isProfileField(feld), feld).toBe(true)
      expect(rumpf).toContain(`when '${id}' then '${feld}'`)
    }
    expect((rumpf.match(/when '/g) ?? []).length).toBe(Object.keys(PERSONAL_TITLE_SOURCE).length)
  })

  it('alles aus Körper, Gewicht, Blut, Ruhepuls, Einnahmen, Zyklen, Berichten, Fortschritt und Schlafqualität ist persönlich', () => {
    for (const id of ['body_fat_5', 'body_fat_10', 'body_fat_20', 'weight_5', 'first_bloodwork', 'all_markers_in_range',
      'resting_hr_5', 'intake_all_30', 'first_cycle_done', 'first_review', 'progress_10', 'progress_25', 'progress_50',
      'sleep_rested_30', 'sleep_rested_100'] as BadgeId[]) {
      expect(isPersonalTitle(id), id).toBe(true)
    }
    // Schlaf überhaupt getrackt ist kein Gesundheitsdatum (Nutzer 04.11.)
    expect(isPersonalTitle('sleep_tracked_30')).toBe(false)
    expect(isPersonalTitle('run_50')).toBe(false)
  })

  it('neutrale Namen: kein „-süchtig“, keine Substanzen', () => {
    const alle = Object.values(TITLE_NAMES).flatMap(n => [n.de, n.en]).join(' ').toLowerCase()
    for (const wort of ['süchtig', 'addict', 'peptid', 'steroid', 'dose', 'dosis']) expect(alle).not.toContain(wort)
  })

  it('jeder Titel gehört zu einem Abzeichen mit Bedingung', () => {
    for (const id of TITLE_BADGE_IDS) expect(BADGE_BY_ID[id].check, id).toBeTypeOf('function')
  })
})

describe('getragener Titel (eigene Sicht, wie profile_view)', () => {
  it('ohne Wahl: höchster verdienter Rang; ohne Rang: nichts', () => {
    expect(wornTitle(settings(), set('rank_1', 'rank_3', 'run_10'))).toEqual({ kind: 'rank', id: 'rank_3' })
    expect(wornTitle(settings(), set())).toBeNull()
    expect(highestRank(set('rank_2', 'rank_1'))).toBe('rank_2')
  })

  it('gewählt und verdient: das Abzeichen; nicht verdient: der Rang', () => {
    expect(wornTitle(settings({ choice: 'streak_100' }), set('rank_2', 'streak_100'))).toEqual({ kind: 'badge', id: 'streak_100' })
    expect(wornTitle(settings({ choice: 'streak_365' }), set('rank_2', 'streak_100'))).toEqual({ kind: 'rank', id: 'rank_2' })
  })

  it('Leiter: die höchste verdiente Stufe steigt von selbst mit', () => {
    expect(wornTitle(settings({ choice: 'run_10' }), set('rank_1', 'run_10', 'run_50'))).toEqual({ kind: 'badge', id: 'run_50' })
    expect(wornStage('run_150', set('run_10'))).toBe('run_10')
    expect(wornStage('run_10', set())).toBeNull()
    expect(ladderOf('hyrox_20')).toBe('hyrox')
    expect(ladderOf('streak_100')).toBeNull()
  })

  it('persönlich: nur mit Schalter und Bestätigung, sonst der Rang', () => {
    const earned = set('rank_2', 'body_fat_5')
    expect(wornTitle(settings({ choice: 'body_fat_5' }), earned)).toEqual({ kind: 'rank', id: 'rank_2' })
    expect(wornTitle(settings({ choice: 'body_fat_5', personalAllowed: true }), earned)).toEqual({ kind: 'rank', id: 'rank_2' })
    expect(wornTitle(settings({ choice: 'body_fat_5', consents: { body_fat_5: '2026-11-01' } }), earned)).toEqual({ kind: 'rank', id: 'rank_2' })
    expect(wornTitle(settings({ choice: 'body_fat_5', personalAllowed: true, consents: { body_fat_5: '2026-11-01' } }), earned))
      .toEqual({ kind: 'badge', id: 'body_fat_5' })
    // Bestätigung gilt je Titel
    expect(wornTitle(settings({ choice: 'body_fat_5', personalAllowed: true, consents: { weight_5: '2026-11-01' } }), earned))
      .toEqual({ kind: 'rank', id: 'rank_2' })
  })

  it('nächster Rang: Stufe und fehlende Tage', () => {
    expect(nextRank(0)).toEqual({ id: 'rank_1', missing: 1 })
    expect(nextRank(150)).toEqual({ id: 'rank_5', missing: 50 })
    expect(nextRank(365)).toBeNull()
  })
})

describe('profile_view (Titel-Block in der Migration)', () => {
  const view = SQL.slice(SQL.indexOf('create or replace function public.profile_view'))

  it('nimmt den Titel nie aus dem Schnappschuss', () => {
    expect(view).toContain("e.key not in ('bio', 'goals', 'country', 'gender', 'member_since', 'cover', 'title')")
  })

  it('persönlich nur mit Schalter, Einwilligung und sichtbarem Quellfeld; sonst Rang', () => {
    expect(view).toContain('p.personal_titles')
    expect(view).toContain('p.title_consents ? wahl')
    expect(view).toContain("stufe = 'owner' or quelle = any(erlaubt)")
    expect(view).toContain('public.profile_rank_ids()')
  })

  it('Web: title ist Web-Feld; persönliche nur, wenn ihr Quellfeld auf „Alle“ steht (Nutzer 07.11.)', () => {
    expect(sqlListe('profile_web_fields')).toContain('title')
    expect(view).toContain("or (stufe = 'web' and coalesce(p.field_visibility ->> quelle = 'all', false))")
    expect(view).not.toContain("and stufe <> 'web'")
  })

  it('Web: ein Abzeichen-Titel nur mit Web-Freigabe des Abzeichens (Grenzfälle wie Schlafbeobachter ab Werk nicht)', () => {
    expect(view).toContain("if wahl is not null and stufe = 'web' and not public.profile_web_badge_on(wahl, p.web_badges) then")
  })
})
