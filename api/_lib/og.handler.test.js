// api/og.js mit gemocktem Supabase (RPC und Storage). Liegt unter `_lib`,
// weil Vercel jede Datei direkt in `api/` als eigene Funktion ausliefern würde.

import { readFileSync } from 'node:fs'
import { Resvg } from '@resvg/resvg-js'
import { describe, expect, it, vi } from 'vitest'
import { IMAGE_CACHE, createHandler, requestParams } from '../og.js'
import { createHandler as createPage } from '../u.js'
import { CARD_HEIGHT, CARD_WIDTH } from './profileCard.js'
import { FRIEDA, FRIEDA_TITEL, GUSTAV, MARA, MARA_AVATAR, MARA_TITEL } from './profileViewWeb.fixtures.js'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './profileViewWeb.js'

const TEMPLATE = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
const ENV = { VITE_PUBLIC_SITE_URL: 'https://hokuhealth.app' }
const AVATAR = new Resvg('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#c98b5f"/></svg>').render().asPng()

function mockFetch(views, { avatar = AVATAR } = {}) {
  return vi.fn(async (url, init) => {
    if (url.startsWith(`${SUPABASE_URL}/storage/`)) {
      if (avatar instanceof Error) throw avatar
      return avatar ? new Response(avatar) : new Response('{"error":"not_found"}', { status: 400 })
    }
    const { p_username } = JSON.parse(init.body)
    const view = Object.hasOwn(views, p_username) ? views[p_username] : null
    if (view instanceof Error) throw view
    return new Response(JSON.stringify(view), { status: 200, headers: { 'Content-Type': 'application/json' } })
  })
}

function mockRes() {
  return { statusCode: 200, headers: {}, body: undefined, setHeader(k, v) { this.headers[k.toLowerCase()] = String(v) }, end(b) { this.body = b } }
}

async function image(url, { views = {}, avatar, method = 'GET', env = ENV } = {}) {
  const fetch = mockFetch(views, { avatar })
  const res = mockRes()
  await createHandler({ fetch, env })({ method, url, headers: {} }, res)
  return { status: res.statusCode, headers: res.headers, body: res.body, fetch }
}

/** Bild-URL, wie `api/u.js` sie für dieselben Daten ins HTML schreibt. */
async function ogUrl(name, views, lang = 'de-DE', env = ENV) {
  const res = mockRes()
  await createPage({ fetch: mockFetch(views), env, template: TEMPLATE })({ method: 'GET', url: `/api/u?name=${name}`, query: { name }, headers: { 'accept-language': lang } }, res)
  const og = new URL(res.body.match(/property="og:image" content="([^"]*)"/)[1].replaceAll('&amp;', '&'))
  return og.pathname + og.search
}

function pngSize(buf) {
  expect(buf.subarray(1, 4).toString('latin1')).toBe('PNG')
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)]
}

describe('api/og.js: Treffer', () => {
  it('mara mit Bild: PNG 1200 x 630, Kopfzeilen, Profilbild über Storage als anon', async () => {
    const url = await ogUrl('mara', { mara: MARA })
    const { status, headers, body, fetch } = await image(url, { views: { mara: MARA } })
    expect(status).toBe(200)
    expect(headers['content-type']).toBe('image/png')
    expect(headers['cache-control']).toBe(IMAGE_CACHE)
    expect(IMAGE_CACHE).toContain('s-maxage=600')
    expect(headers['x-robots-tag']).toBe('noindex')
    expect(Number(headers['content-length'])).toBe(body.length)
    expect(pngSize(body)).toEqual([CARD_WIDTH, CARD_HEIGHT])
    const storage = fetch.mock.calls.find(([u]) => u.includes('/storage/'))
    expect(storage[0]).toBe(`${SUPABASE_URL}/storage/v1/object/profile-media/${MARA_AVATAR}`)
    expect(storage[1].headers.apikey).toBe(SUPABASE_ANON_KEY)
    for (const [, init] of fetch.mock.calls) expect(init.headers.apikey).toBe(SUPABASE_ANON_KEY)
  })

  it('Fassung aus dem HTML passt: Karte ist nicht die neutrale', async () => {
    const neutral = await image('/api/og?lang=de')
    for (const [name, view] of [['mara', MARA], ['frieda', FRIEDA], ['gustav', GUSTAV]]) {
      const url = await ogUrl(name, { [name]: view })
      const { body } = await image(url, { views: { [name]: view } })
      expect(Buffer.compare(body, neutral.body), name).not.toBe(0)
    }
  })

  it('Titel: HTML und Bild bilden dieselbe Fassung, das Bild ist ein anderes als ohne Titel', async () => {
    for (const [name, ohne, mit] of [['mara', MARA, MARA_TITEL], ['frieda', FRIEDA, FRIEDA_TITEL]]) {
      const urlMit = await ogUrl(name, { [name]: mit })
      expect(urlMit).not.toBe(await ogUrl(name, { [name]: ohne }))
      const a = await image(await ogUrl(name, { [name]: ohne }), { views: { [name]: ohne } })
      const b = await image(urlMit, { views: { [name]: mit } })
      expect(b.headers['cache-control'], name).toBe(IMAGE_CACHE)
      expect(Buffer.compare(a.body, b.body), name).not.toBe(0)
    }
  })

  it('Profilbild nicht ladbar: Initiale, kürzer zwischengespeichert; v bleibt gültig', async () => {
    const url = await ogUrl('mara', { mara: MARA })
    const mit = await image(url, { views: { mara: MARA } })
    const ohne = await image(url, { views: { mara: MARA }, avatar: null })
    const netz = await image(url, { views: { mara: MARA }, avatar: new Error('netz') })
    const neutral = await image('/api/og?lang=de')
    expect(ohne.headers['cache-control']).toBe('public, max-age=0, s-maxage=60')
    expect(netz.headers['cache-control']).toBe('public, max-age=0, s-maxage=60')
    expect(Buffer.compare(ohne.body, mit.body)).not.toBe(0)
    expect(Buffer.compare(ohne.body, neutral.body)).not.toBe(0)
    expect(pngSize(ohne.body)).toEqual([CARD_WIDTH, CARD_HEIGHT])
  })

  it('ohne Profilbild im Profil: kein Storage-Abruf', async () => {
    const url = await ogUrl('gustav', { gustav: GUSTAV })
    const { fetch, headers } = await image(url, { views: { gustav: GUSTAV } })
    expect(fetch.mock.calls.some(([u]) => u.includes('/storage/'))).toBe(false)
    expect(headers['cache-control']).toBe(IMAGE_CACHE)
  })

  it('HEAD ohne Inhalt, POST 405', async () => {
    const head = await image('/api/og?lang=de', { method: 'HEAD' })
    expect(head.status).toBe(200)
    expect(head.body).toBeUndefined()
    const post = await image('/api/og?lang=de', { method: 'POST' })
    expect(post.status).toBe(405)
  })
})

describe('api/og.js: neutrale Karte', () => {
  it('aus / privat / unbekannt / ausgeblendet / ungültig / ohne v: gleiches Bild, gleiche Kopfzeilen', async () => {
    const maraUrl = await ogUrl('mara', { mara: MARA })
    const v = new URL(maraUrl, 'http://x').searchParams.get('v')
    const views = { otto: null, ben: null, hanna: null, lisa: { ...MARA, username: 'lisa', private: true }, mara: MARA }
    const cases = [
      ['ohne Parameter', '/api/og?lang=de'],
      ['Web-Link aus', `/api/og?name=otto&lang=de&v=${v}`],
      ['privat', `/api/og?name=ben&lang=de&v=${v}`],
      ['ausgeblendet', `/api/og?name=hanna&lang=de&v=${v}`],
      ['unbekannt', `/api/og?name=niemand&lang=de&v=${v}`],
      ['privat als Objekt', `/api/og?name=lisa&lang=de&v=${v}`],
      ['ungültiger Name', `/api/og?name=%3Cscript%3E&lang=de&v=${v}`],
      ['ohne v', '/api/og?name=mara&lang=de'],
      ['v doppelt', `/api/og?name=mara&lang=de&v=${v}&v=${v}`],
      ['Web-Link inzwischen aus', maraUrl.replace('name=mara', 'name=otto')],
    ]
    const results = []
    for (const [label, url] of cases) results.push([label, await image(url, { views })])
    const [, first] = results[0]
    expect(first.status).toBe(200)
    expect(first.headers['cache-control']).toBe(IMAGE_CACHE)
    expect(first.headers['x-robots-tag']).toBe('noindex')
    expect(pngSize(first.body)).toEqual([CARD_WIDTH, CARD_HEIGHT])
    for (const [label, r] of results) {
      expect(r.status, label).toBe(200)
      expect(r.headers, label).toEqual(first.headers)
      expect(Buffer.compare(r.body, first.body), label).toBe(0)
    }
  })

  it('veraltetes oder fremdes v: die aktuelle Karte (Messenger behalten das Bild), aber nur 60 s im CDN', async () => {
    const neutral = await image('/api/og?lang=de')
    const aktuellUrl = await ogUrl('mara', { mara: MARA })
    const aktuell = await image(aktuellUrl, { views: { mara: MARA } })
    const vEn = new URL(await ogUrl('mara', { mara: MARA }, 'en'), 'http://x').searchParams.get('v')
    expect(vEn).not.toBe(new URL(aktuellUrl, 'http://x').searchParams.get('v'))
    for (const url of ['/api/og?name=mara&lang=de&v=AAAAAAAAAA', `/api/og?name=mara&lang=de&v=${vEn}`]) {
      const r = await image(url, { views: { mara: MARA } })
      expect(Buffer.compare(r.body, neutral.body), url).not.toBe(0)
      expect(Buffer.compare(r.body, aktuell.body), url).toBe(0)
      expect(r.headers, url).toEqual({ ...aktuell.headers, 'cache-control': 'public, max-age=0, s-maxage=60' })
    }
  })

  it('ungültiger Name: gar kein Abruf', async () => {
    const bad = await image('/api/og?name=a%22b&lang=de&v=x')
    expect(bad.fetch).not.toHaveBeenCalled()
  })

  it('Sprache nur de/en aus der URL', async () => {
    const de = await image('/api/og?lang=de')
    const en = await image('/api/og?lang=en')
    const fr = await image('/api/og?lang=fr')
    expect(Buffer.compare(de.body, en.body)).not.toBe(0)
    expect(Buffer.compare(fr.body, en.body)).toBe(0)
    expect(requestParams({ url: '/api/og?name=a&name=b&lang=de' })).toEqual({ name: null, lang: 'de', v: null })
  })

  it('Supabase nicht erreichbar: neutral, nicht zwischenspeichern', async () => {
    const url = await ogUrl('mara', { mara: MARA })
    const { status, headers } = await image(url, { views: { mara: new Error('netz') } })
    expect(status).toBe(200)
    expect(headers['cache-control']).toBe('no-store')
  })
})
