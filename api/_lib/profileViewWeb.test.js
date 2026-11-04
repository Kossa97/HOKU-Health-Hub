import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { cardMeta, chooseCard } from './profileCard.js'
import { FRIEDA, GUSTAV, IDA, MARA, MARA_AVATAR } from './profileViewWeb.fixtures.js'
import {
  SUPABASE_ANON_KEY, SUPABASE_URL, fetchAvatar, fetchProfileView, isAvatarPath, isIndexable,
  patternFeatureOn, pickLang, siteOrigin, toCardInput,
} from './profileViewWeb.js'

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8')

describe('Schlüssel', () => {
  it('URL und anon-Schlüssel wie in der App (src/lib/supabase.ts)', () => {
    const app = read('../../src/lib/supabase.ts')
    expect(app).toContain(`const supabaseUrl = '${SUPABASE_URL}'`)
    expect(app).toContain(`const supabaseAnonKey = '${SUPABASE_ANON_KEY}'`)
    expect(SUPABASE_ANON_KEY.startsWith('sb_publishable_')).toBe(true)
  })

  it('die Funktionen kennen keinen Dienstschlüssel und keine Supabase-Umgebungsvariable', () => {
    for (const file of ['../u.js', '../og.js', './profileViewWeb.js']) {
      const src = read(file)
      expect(src, file).not.toMatch(/service_role|SERVICE_KEY|SERVICE_ROLE|sb_secret_/i)
      expect(src, file).not.toMatch(/process\.env\.\w*SUPABASE/)
    }
  })
})

describe('pickLang', () => {
  it.each([
    [undefined, 'en'],
    ['', 'en'],
    ['de-DE,de;q=0.9,en;q=0.8', 'de'],
    ['de', 'de'],
    ['en-US,en;q=0.9,de;q=0.8', 'en'],
    ['fr-FR,fr;q=0.9,de;q=0.8', 'de'],
    ['fr-FR,fr;q=0.9', 'en'],
    ['en;q=0.5, de;q=0.7', 'de'],
    ['de;q=0, en', 'en'],
    ['*', 'en'],
    ['DE-at', 'de'],
  ])('%s → %s', (header, lang) => {
    expect(pickLang(header)).toBe(lang)
  })
})

describe('Schalter und Adresse', () => {
  it('Musterfunktion nur mit HOKU_PATTERN_FEATURE=1', () => {
    expect(patternFeatureOn({})).toBe(false)
    expect(patternFeatureOn({ HOKU_PATTERN_FEATURE: 'true' })).toBe(false)
    expect(patternFeatureOn({ HOKU_PATTERN_FEATURE: '1' })).toBe(true)
  })

  it('Adresse wie der Peptipedia-Prerender, sonst hokuhealth.app', () => {
    expect(siteOrigin({})).toBe('https://hokuhealth.app')
    expect(siteOrigin({ VITE_PUBLIC_SITE_URL: 'https://hokuhealth.app/pfad' })).toBe('https://hokuhealth.app')
    expect(siteOrigin({ VERCEL_PROJECT_PRODUCTION_URL: 'tyd.vercel.app' })).toBe('https://tyd.vercel.app')
    expect(siteOrigin({ VERCEL_URL: 'preview-1.vercel.app' })).toBe('https://preview-1.vercel.app')
    expect(siteOrigin({ VITE_PUBLIC_SITE_URL: 'javascript:alert(1)' })).toBe('https://hokuhealth.app')
    expect(siteOrigin({ VITE_PUBLIC_SITE_URL: 'kaputt' })).toBe('https://hokuhealth.app')
  })

  it('Profilbild-Pfade nur in der Form der App', () => {
    expect(isAvatarPath(MARA_AVATAR)).toBe(true)
    for (const bad of ['../x/avatar.jpg', 'a/b/c.jpg', 'a/avatar.gif', 'a/', '', null, 'a/%2e%2e.jpg', 'a\\b.jpg']) {
      expect(isAvatarPath(bad), String(bad)).toBe(false)
    }
  })
})

describe('toCardInput (Fixtures aus dem Trockenlauf)', () => {
  it('mara: Fortschrittskarte, Stufe 20, 25 Einträge, 9 Werte, keine Bereiche', () => {
    const input = toCardInput(MARA, { lang: 'de' })
    expect(input).toEqual({
      lang: 'de', patternFeature: false, areas: [], title: null,
      found: true, webLinkOn: true, private: false,
      name: 'Mara K.', nickname: 'mara', avatar: { id: MARA_AVATAR },
      tier: 20, member: { unit: 'months', n: 7 }, entryCount: 25, webValueCount: 9,
    })
    expect(chooseCard(input)).toBe('progress')
  })

  it('frieda (alles auf Freunde): Rückfall ohne Fortschritt und Einträge, mit Dauer und Werten', () => {
    const input = toCardInput(FRIEDA, { lang: 'de' })
    expect(chooseCard(input)).toBe('fallback')
    expect(input).toMatchObject({ tier: null, entryCount: null, member: { unit: 'months', n: 6 }, webValueCount: 9 })
    const meta = cardMeta(input)
    expect(meta.description).toContain('Frieda trackt 9 Werte mit Hoku.')
    for (const text of Object.values(meta)) {
      expect(text).not.toMatch(/%|Eintr/)
    }
  })

  it('gustav: Rückfall, 5 Werte, kein Bild', () => {
    const input = toCardInput(GUSTAV, { lang: 'en' })
    expect(chooseCard(input)).toBe('fallback')
    expect(input).toMatchObject({ avatar: null, webValueCount: 5, member: { unit: 'months', n: 5 }, entryCount: null })
  })

  it('ida: Rückfall, nur Dauer, Name = Nutzername', () => {
    const input = toCardInput(IDA, { lang: 'de' })
    expect(chooseCard(input)).toBe('fallback')
    expect(input).toMatchObject({ name: null, nickname: 'ida', webValueCount: null, member: { unit: 'days', n: 15 } })
  })

  it.each([
    ['null (aus / privat / unbekannt / ausgeblendet)', null],
    ['privat (zur Sicherheit)', { ...MARA, private: true }],
    ['blockiert', { ...MARA, blocked: true }],
    ['Nutzername ungültig', { ...MARA, username: '<b>' }],
    ['Nutzername fehlt', { ...MARA, username: undefined }],
    ['kein Objekt', 'mara'],
  ])('%s → neutral', (_, view) => {
    expect(chooseCard(toCardInput(view, { lang: 'de' }))).toBe('neutral')
  })

  it('kaputte Formen werden ignoriert, nichts wird erfunden', () => {
    const input = toCardInput({
      ...MARA,
      avatar: '../geheim.jpg',
      fields: { progress: { tier: '20', total: 28.35 } },
      card: { member_since: { unit: 'weeks', n: 3 }, web_value_count: -1, entry_count: 2.5 },
    })
    expect(input).toMatchObject({ avatar: null, tier: null, member: null, webValueCount: null, entryCount: null })
  })

  it('Schalter Musterfunktion kommt an', () => {
    expect(toCardInput(FRIEDA, { patternFeature: true }).patternFeature).toBe(true)
  })

  it('Suchmaschinen nur bei echtem true', () => {
    expect(isIndexable({ ...MARA, web_indexable: true })).toBe(true)
    expect(isIndexable({ ...MARA, web_indexable: 'true' })).toBe(false)
    expect(isIndexable(MARA)).toBe(false)
    expect(isIndexable(null)).toBe(false)
  })
})

function jsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' }, ...init })
}

describe('fetchProfileView', () => {
  it('ruft profile_view(name, null) mit dem anon-Schlüssel', async () => {
    const fetch = vi.fn(async () => jsonResponse(MARA))
    expect(await fetchProfileView('mara', { fetch })).toEqual({ ok: true, view: MARA })
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe(`${SUPABASE_URL}/rest/v1/rpc/profile_view`)
    expect(init.method).toBe('POST')
    expect(init.headers.apikey).toBe(SUPABASE_ANON_KEY)
    expect(init.headers.Authorization).toBe(`Bearer ${SUPABASE_ANON_KEY}`)
    expect(JSON.parse(init.body)).toEqual({ p_username: 'mara', p_as: null })
  })

  it('null bleibt null, Liste wird null', async () => {
    expect(await fetchProfileView('otto', { fetch: async () => jsonResponse(null) })).toEqual({ ok: true, view: null })
    expect(await fetchProfileView('otto', { fetch: async () => jsonResponse([MARA]) })).toEqual({ ok: true, view: null })
  })

  it('Fehler → ok: false', async () => {
    expect(await fetchProfileView('mara', { fetch: async () => jsonResponse({ message: 'x' }, { status: 500 }) })).toEqual({ ok: false })
    expect(await fetchProfileView('mara', { fetch: async () => { throw new Error('netz') } })).toEqual({ ok: false })
    expect(await fetchProfileView('mara', { fetch: async () => new Response('kein json') })).toEqual({ ok: false })
  })
})

describe('fetchAvatar', () => {
  const JPEG = Buffer.from('ffd8ffe000104a46494600010100000100010000', 'hex')

  it('lädt über Storage mit dem anon-Schlüssel', async () => {
    const fetch = vi.fn(async () => new Response(JPEG))
    expect(await fetchAvatar(MARA_AVATAR, { fetch })).toEqual(JPEG)
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe(`${SUPABASE_URL}/storage/v1/object/profile-media/${MARA_AVATAR}`)
    expect(init.headers.apikey).toBe(SUPABASE_ANON_KEY)
  })

  it('ungültiger Pfad: kein Abruf', async () => {
    const fetch = vi.fn()
    expect(await fetchAvatar('../x.jpg', { fetch })).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('abgelehnt, zu groß oder Netzfehler → null', async () => {
    expect(await fetchAvatar(MARA_AVATAR, { fetch: async () => new Response('{}', { status: 400 }) })).toBeNull()
    expect(await fetchAvatar(MARA_AVATAR, { fetch: async () => new Response(Buffer.alloc(1_600_000)) })).toBeNull()
    expect(await fetchAvatar(MARA_AVATAR, { fetch: async () => new Response(JPEG, { headers: { 'Content-Length': '9999999' } }) })).toBeNull()
    expect(await fetchAvatar(MARA_AVATAR, { fetch: async () => { throw new Error('netz') } })).toBeNull()
  })
})
