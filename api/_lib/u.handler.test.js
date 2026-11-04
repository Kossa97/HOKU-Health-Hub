// api/u.js mit gemocktem Supabase. Liegt unter `_lib`, weil Vercel jede Datei
// direkt in `api/` als eigene Funktion ausliefern würde.

import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { PAGE_CACHE, buildPage, createHandler, renderPage, requestedName } from '../u.js'
import { cardMeta, cardVersion } from './profileCard.js'
import { FRIEDA, MARA } from './profileViewWeb.fixtures.js'
import { SUPABASE_ANON_KEY, toCardInput } from './profileViewWeb.js'

// Die Vite-Vorlage hat dieselbe Form wie das gebaute dist/index.html (head, title, root).
const TEMPLATE = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
const ENV = { VITE_PUBLIC_SITE_URL: 'https://hokuhealth.app' }

function mockFetch(byName) {
  return vi.fn(async (_url, init) => {
    const { p_username } = JSON.parse(init.body)
    const view = Object.hasOwn(byName, p_username) ? byName[p_username] : null
    if (view instanceof Error) throw view
    return new Response(JSON.stringify(view), { status: 200, headers: { 'Content-Type': 'application/json' } })
  })
}

async function call({ name, url, lang = 'de-DE,de;q=0.9', method = 'GET', views = {}, env = ENV, fetch } = {}) {
  const f = fetch ?? mockFetch(views)
  const handler = createHandler({ fetch: f, env, template: TEMPLATE })
  const req = {
    method,
    url: url ?? `/api/u?name=${encodeURIComponent(name)}`,
    query: url ? undefined : { name },
    headers: lang ? { 'accept-language': lang } : {},
  }
  const res = { statusCode: 200, headers: {}, body: undefined, setHeader(k, v) { this.headers[k.toLowerCase()] = String(v) }, end(b) { this.body = b } }
  await handler(req, res)
  return { status: res.statusCode, headers: res.headers, body: res.body, fetch: f }
}

const metaContent = (html, key) => html.match(new RegExp(`<meta data-hoku-card (?:name|property)="${key}" content="([^"]*)">`))?.[1]

describe('api/u.js: Treffer', () => {
  it('mara (de): 200, Tags der Fortschrittskarte, Kopfzeilen', async () => {
    const { status, headers, body, fetch } = await call({ name: 'mara', views: { mara: MARA } })
    expect(status).toBe(200)
    expect(headers['content-type']).toBe('text/html; charset=utf-8')
    expect(headers['cache-control']).toBe(PAGE_CACHE)
    expect(PAGE_CACHE).toContain('s-maxage=60')
    expect(headers.vary).toBe('Accept-Language')
    expect(headers['x-robots-tag']).toBe('noindex')
    expect(fetch.mock.calls[0][1].headers.apikey).toBe(SUPABASE_ANON_KEY)

    const input = toCardInput(MARA, { lang: 'de' })
    const meta = cardMeta(input)
    expect(body).toContain(`<title>${meta.title.replace('&', '&amp;')}</title>`)
    expect(meta.title).toBe('Mara K. auf Hoku: über 20 % positive Veränderung seit Start')
    expect(metaContent(body, 'og:title')).toBe(meta.title)
    expect(metaContent(body, 'og:description')).toBe(meta.description)
    expect(metaContent(body, 'description')).toBe(meta.description)
    expect(metaContent(body, 'og:image')).toBe(`https://hokuhealth.app/api/og?name=mara&amp;lang=de&amp;v=${cardVersion(input)}`)
    expect(metaContent(body, 'og:image:width')).toBe('1200')
    expect(metaContent(body, 'og:image:height')).toBe('630')
    expect(metaContent(body, 'og:image:alt')).toBe(meta.alt)
    expect(metaContent(body, 'og:url')).toBe('https://hokuhealth.app/u/mara')
    expect(metaContent(body, 'og:type')).toBe('profile')
    expect(metaContent(body, 'og:site_name')).toBe('Hoku Health Hub')
    expect(metaContent(body, 'twitter:card')).toBe('summary_large_image')
    expect(metaContent(body, 'robots')).toBe('noindex, nofollow')
    expect(body).toMatch(/<html lang="de" data-theme="dark">/)
    // Die SPA startet weiter wie sonst
    expect(body).toContain('<div id="root"></div>')
    expect(body).toContain('<script type="module" src="/src/main.tsx"></script>')
    expect(body.match(/<\/head>/g)).toHaveLength(1)
    expect(body.match(/<title>/g)).toHaveLength(1)
  })

  it('Meta-Texte enthalten nichts außer der Karte (keine Ziele, Bio, Abzeichen, Land)', async () => {
    const { body } = await call({ name: 'mara', views: { mara: MARA } })
    const head = body.split('\n').filter(l => l.includes('data-hoku-card') || l.includes('<title>')).join('\n')
    for (const leak of ['muskelaufbau', 'ausdauer', 'Laufe gern', 'streak_7', 'workouts_10', 'cover-', 'avatar-', '00000000-', 'content="DE"', 'Bericht', 'review', 'Streak']) {
      expect(head, leak).not.toContain(leak)
    }
  })

  it('alles auf Freunde (frieda): Rückfall, ohne Fortschritt und Einträge', async () => {
    const { status, body } = await call({ name: 'frieda', views: { frieda: FRIEDA } })
    expect(status).toBe(200)
    expect(metaContent(body, 'og:title')).toBe('Frieda auf Hoku · Mehr als nur Tracking.')
    expect(metaContent(body, 'og:description')).toContain('Frieda trackt 9 Werte mit Hoku.')
    const head = body.slice(0, body.indexOf('</head>'))
    expect(head).not.toMatch(/%|Eintr/)
  })

  it('Englisch ohne oder mit englischem Accept-Language', async () => {
    for (const lang of [null, 'en-US,en;q=0.9', 'fr']) {
      const { body, headers } = await call({ name: 'mara', views: { mara: MARA }, lang })
      expect(metaContent(body, 'og:title')).toBe('Mara K. on Hoku: over 20% positive change since start')
      expect(metaContent(body, 'og:image')).toContain('&amp;lang=en&amp;')
      expect(body).toMatch(/<html lang="en"/)
      expect(headers.vary).toBe('Accept-Language')
    }
  })

  it('Smart App Banner im Server-HTML (Safari liest ihn nicht aus JS), nur mit gültiger ID', async () => {
    const mit = await call({ name: 'Mara', views: { Mara: { ...MARA, username: 'Mara' } }, env: { ...ENV, VITE_APP_STORE_ID: '1234567890' } })
    expect(metaContent(mit.body, 'apple-itunes-app')).toBe('app-id=1234567890, app-argument=https://hokuhealth.app/u/mara')
    expect(metaContent(mit.body, 'og:url')).toBe('https://hokuhealth.app/u/mara')
    expect(mit.body).toContain('rel="canonical" href="https://hokuhealth.app/u/mara"')
    for (const id of [undefined, '', 'id123456', '123']) {
      const ohne = await call({ name: 'mara', views: { mara: MARA }, env: { ...ENV, VITE_APP_STORE_ID: id } })
      expect(metaContent(ohne.body, 'apple-itunes-app'), String(id)).toBeUndefined()
    }
    const neutral = await call({ name: 'niemand', views: {}, env: { ...ENV, VITE_APP_STORE_ID: '1234567890' } })
    expect(metaContent(neutral.body, 'apple-itunes-app')).toBeUndefined()
  })

  it('Suchmaschinen an: ohne noindex (Meta und Kopfzeile), mit canonical', async () => {
    const { status, headers, body } = await call({ name: 'mara', views: { mara: { ...MARA, web_indexable: true } } })
    expect(status).toBe(200)
    expect(headers['x-robots-tag']).toBeUndefined()
    expect(metaContent(body, 'robots')).toBeUndefined()
    expect(body).not.toContain('noindex')
    expect(body).toContain('<link data-hoku-card rel="canonical" href="https://hokuhealth.app/u/mara">')
  })

  it('Musterfunktion per Umgebung: Rückfall-Text „kann Muster finden“', async () => {
    const aus = await call({ name: 'frieda', views: { frieda: FRIEDA } })
    const an = await call({ name: 'frieda', views: { frieda: FRIEDA }, env: { ...ENV, HOKU_PATTERN_FEATURE: '1' } })
    expect(metaContent(aus.body, 'og:description')).toContain('was sich seit deinem Start verändert hat')
    expect(metaContent(an.body, 'og:description')).toContain('kann Muster finden')
    expect(metaContent(aus.body, 'og:image')).not.toBe(metaContent(an.body, 'og:image'))
  })

  it('Name aus dem Pfad, wenn nicht umgeschrieben', () => {
    expect(requestedName({ url: '/u/mara' })).toBe('mara')
    expect(requestedName({ url: '/u/mara/' })).toBe('mara')
    expect(requestedName({ url: '/api/u?name=mara' })).toBe('mara')
    expect(requestedName({ url: '/api/u?name=a&name=b' })).toBeNull()
    expect(requestedName({ query: { name: ['a', 'b'] }, url: '/api/u?name=a&name=b' })).toBeNull()
    expect(requestedName({ url: '/u/%E0%A4%A' })).toBeNull()
  })
})

describe('api/u.js: gleiche 404', () => {
  const views = {
    otto: null, // Web-Link aus
    ben: null, // privat
    hanna: null, // ausgeblendet
    lisa: { ...MARA, username: 'lisa', private: true }, // privat, falls je ein Objekt käme
    karl: { username: 'karl', blocked: true, own: false },
  }
  const cases = [
    ['Web-Link aus', 'otto'],
    ['privat', 'ben'],
    ['ausgeblendet', 'hanna'],
    ['unbekannt', 'niemand'],
    ['privat als Objekt', 'lisa'],
    ['blockiert', 'karl'],
    ['Zeichen außerhalb', '<script>'],
    ['zu kurz', 'ab'],
    ['zu lang', 'a'.repeat(21)],
    ['leer', ''],
  ]

  it('Status, Kopfzeilen und HTML byte-gleich, ohne Namen', async () => {
    const results = []
    for (const [label, name] of cases) results.push([label, name, await call({ name, views })])
    const [, , first] = results[0]
    expect(first.status).toBe(404)
    expect(first.headers['cache-control']).toBe(PAGE_CACHE)
    expect(first.headers['x-robots-tag']).toBe('noindex')
    expect(first.headers.vary).toBe('Accept-Language')
    expect(metaContent(first.body, 'robots')).toBe('noindex, nofollow')
    expect(metaContent(first.body, 'og:title')).toBe('Hoku Health Hub')
    expect(metaContent(first.body, 'og:type')).toBe('website')
    expect(metaContent(first.body, 'og:url')).toBeUndefined()
    expect(metaContent(first.body, 'og:image')).toBe(`https://hokuhealth.app/api/og?lang=de&amp;v=${cardVersion(toCardInput(null, { lang: 'de' }))}`)
    for (const [label, name, r] of results) {
      expect(r.status, label).toBe(first.status)
      expect(r.headers, label).toEqual(first.headers)
      expect(r.body, label).toBe(first.body)
      if (name.length >= 3 && name !== '<script>') expect(r.body, label).not.toContain(name)
    }
  })

  it('ungültiger Name: kein Datenbankaufruf', async () => {
    for (const name of ['<script>', 'ab', 'mara%00', 'mara/x', 'mära']) {
      const { status, fetch } = await call({ name, views })
      expect(status).toBe(404)
      expect(fetch).not.toHaveBeenCalled()
    }
  })
})

describe('api/u.js: Escape', () => {
  it('Anzeigename in Titel und Attributen maskiert, `$`-Muster ohne Wirkung', async () => {
    const evil = `"><script>alert('x')</script> $& $' $\` & </head>`
    const { status, body } = await call({ name: 'mara', views: { mara: { ...MARA, display_name: evil } } })
    expect(status).toBe(200)
    expect(body).not.toContain('<script>alert')
    expect(body).toContain('&quot;&gt;&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt; $&amp; $&#39; $` &amp; &lt;/head&gt;')
    expect(body.match(/<\/head>/g)).toHaveLength(1)
    expect(body.match(/<title>/g)).toHaveLength(1)
    // `$'` hätte sonst den Rest der Vorlage eingefügt
    expect(body.match(/<div id="root"><\/div>/g)).toHaveLength(1)
  })

  it('renderPage ersetzt vorhandene Beschreibung und og-Tags der Vorlage', () => {
    const tpl = '<!doctype html><html><head><title>Alt</title><meta name="description" content="alt"><meta property="og:title" content="alt"></head><body></body></html>'
    const html = renderPage(tpl, { lang: 'en', meta: { title: 'T', description: 'D', alt: 'A' }, image: 'https://x/i.png', url: null, indexable: false, found: false })
    expect(html).toMatch(/^<!doctype html><html lang="en"><head><title>T<\/title>/)
    expect(html).not.toContain('content="alt"')
    expect(html.match(/name="description"/g)).toHaveLength(1)
  })

  it('Vorlage ohne head/title → Fehler statt halber Seite', () => {
    expect(() => buildPage('<html><body></body></html>', { view: MARA, lang: 'de', patternFeature: false, origin: 'https://x' })).toThrow()
  })
})

describe('api/u.js: Sonderfälle', () => {
  it('Supabase nicht erreichbar: 503, neutral, nicht zwischenspeichern', async () => {
    const { status, headers, body } = await call({ name: 'mara', views: { mara: new Error('netz') } })
    expect(status).toBe(503)
    expect(headers['cache-control']).toBe('no-store')
    expect(headers['x-robots-tag']).toBe('noindex')
    expect(metaContent(body, 'og:title')).toBe('Hoku Health Hub')
  })

  it('HEAD: Kopfzeilen ohne Inhalt; POST: 405', async () => {
    const head = await call({ name: 'mara', views: { mara: MARA }, method: 'HEAD' })
    expect(head.status).toBe(200)
    expect(head.body).toBeUndefined()
    expect(Number(head.headers['content-length'])).toBeGreaterThan(0)
    const post = await call({ name: 'mara', views: { mara: MARA }, method: 'POST' })
    expect(post.status).toBe(405)
    expect(post.headers.allow).toBe('GET, HEAD')
    expect(post.fetch).not.toHaveBeenCalled()
  })

  it('Vorlage ohne <title>: 500 ohne Cache statt Absturz', async () => {
    const handler = createHandler({ fetch: mockFetch({ mara: MARA }), env: ENV, template: '<html><head></head><body></body></html>' })
    const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k.toLowerCase()] = v }, end() {} }
    await handler({ method: 'GET', url: '/api/u?name=mara', headers: {} }, res)
    expect(res.statusCode).toBe(500)
    expect(res.headers['cache-control']).toBe('no-store')
  })

  it('fehlendes dist/index.html: 500 ohne Cache', async () => {
    const handler = createHandler({ fetch: vi.fn(), env: ENV, template: () => { throw new Error('ENOENT') } })
    const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k.toLowerCase()] = v }, end() {} }
    await handler({ method: 'GET', url: '/api/u?name=mara', headers: {} }, res)
    expect(res.statusCode).toBe(500)
    expect(res.headers['cache-control']).toBe('no-store')
  })
})
