import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BADGE_IDS, BADGE_IDS_BY_GROUP, BADGES_NEED_FRIENDS, isBadgeId } from './badgeIds'

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
    const sql = readFileSync(resolve(__dirname, '../../../../supabase-profil-p2b-fortschritt.sql'), 'utf8')
    const block = sql.match(/function public\.profile_badge_ids\(\)[\s\S]*?array\[([\s\S]*?)\]::text\[\]/)
    expect(block).not.toBeNull()
    const ausSql = [...block![1].replace(/--[^\n]*/g, '').matchAll(/'([a-z_0-9]+)'/g)].map(m => m[1])
    expect(ausSql).toEqual([...BADGE_IDS])
  })

  it('isBadgeId kennt nur die Liste', () => {
    expect(isBadgeId('streak_7')).toBe(true)
    expect(isBadgeId('hack_badge')).toBe(false)
    expect(isBadgeId(7)).toBe(false)
  })
})
