// api/u.js — /u/<name> (vercel.json leitet hierher um): das gebaute App-HTML mit
// Titel, og:*- und twitter:-Tags der Link-Karte. Messenger führen kein JavaScript
// aus und lesen nur diese Tags; der Browser startet danach die SPA wie sonst.
// Spec 2c, Abschnitte 3.1–3.5 und 7.
//
// - Daten nur aus `profile_view(name, null)` mit dem anon-Schlüssel
//   (`api/_lib/profileViewWeb.js`), nie mit der Dienstrolle.
// - Web-Link aus, privat, unbekannt, ausgeblendet und ungültiger Name ergeben
//   dieselbe Antwort: 404, dasselbe HTML ohne Namen, dieselben Kopfzeilen.
// - `noindex` immer, außer bei Treffer mit `web_indexable` (Spec 7.2).

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { CARD_HEIGHT, CARD_WIDTH, SITE_NAME, cardMeta, cardVersion, chooseCard, escapeXml, isValidNickname } from './_lib/profileCard.js'
import { fetchProfileView, isIndexable, patternFeatureOn, pickLang, siteOrigin, toCardInput } from './_lib/profileViewWeb.js'

export const PAGE_CACHE = 'public, max-age=0, s-maxage=60, stale-while-revalidate=60'

const TEMPLATE_PATH = fileURLToPath(new URL('../dist/index.html', import.meta.url))
let templateCache = null
function loadTemplate() {
  if (templateCache === null) templateCache = readFileSync(TEMPLATE_PATH, 'utf8')
  return templateCache
}

/** Name aus `?name=` (Umleitung in vercel.json) oder, falls nicht umgeschrieben, aus `/u/<name>`. */
export function requestedName(req) {
  const q = req.query?.name
  if (typeof q === 'string') return q
  if (Array.isArray(q)) return null
  try {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const all = url.searchParams.getAll('name')
    if (all.length === 1) return all[0]
    if (all.length > 1) return null
    const m = url.pathname.match(/^\/u\/([^/]+)\/?$/)
    return m ? decodeURIComponent(m[1]) : null
  } catch {
    return null
  }
}

function headerValue(req, key) {
  const v = req.headers?.[key]
  return Array.isArray(v) ? v.join(',') : v
}

/**
 * Setzt die Tags in das gebaute `index.html` (wie `scripts/prerender-peptipedia.ts`).
 * Ersetzt wird nur über Funktionen, damit `$&` o. Ä. in einem Namen nichts auslöst.
 */
export function renderPage(template, { lang, meta, image, url, indexable, found }) {
  if (!template.includes('</head>') || !/<html\b/.test(template) || !/<title>[\s\S]*?<\/title>/.test(template)) {
    throw new Error('index.html ohne head/title')
  }
  const tag = (attr, key, value) => `<meta data-hoku-card ${attr}="${key}" content="${escapeXml(value)}">`
  const head = [
    tag('name', 'description', meta.description),
    ...(indexable ? [] : [tag('name', 'robots', 'noindex, nofollow')]),
    ...(url ? [`<link data-hoku-card rel="canonical" href="${escapeXml(url)}">`] : []),
    tag('property', 'og:type', found ? 'profile' : 'website'),
    tag('property', 'og:site_name', SITE_NAME),
    tag('property', 'og:locale', lang === 'de' ? 'de_DE' : 'en_US'),
    tag('property', 'og:title', meta.title),
    tag('property', 'og:description', meta.description),
    ...(url ? [tag('property', 'og:url', url)] : []),
    tag('property', 'og:image', image),
    tag('property', 'og:image:type', 'image/png'),
    tag('property', 'og:image:width', String(CARD_WIDTH)),
    tag('property', 'og:image:height', String(CARD_HEIGHT)),
    tag('property', 'og:image:alt', meta.alt),
    tag('name', 'twitter:card', 'summary_large_image'),
    tag('name', 'twitter:title', meta.title),
    tag('name', 'twitter:description', meta.description),
    tag('name', 'twitter:image', image),
    tag('name', 'twitter:image:alt', meta.alt),
  ].join('\n    ')
  return template
    .replace(/<html\b[^>]*>/, open => (/\slang=/.test(open)
      ? open.replace(/\slang=("[^"]*"|'[^']*'|[^\s>]*)/, () => ` lang="${lang}"`)
      : open.replace(/^<html\b/, () => `<html lang="${lang}"`)))
    .replace(/<title>[\s\S]*?<\/title>/, () => `<title>${escapeXml(meta.title)}</title>`)
    // Vorhandene Beschreibung/robots/og/twitter der Vorlage weichen den eigenen.
    .replace(/<meta\b[^>]*(?:name=["'](?:description|robots|twitter:[^"']*)["']|property=["']og:[^"']*["'])[^>]*>\s*/gi, () => '')
    .replace('</head>', () => `    ${head}\n  </head>`)
}

/** Seite für Treffer oder neutrale Seite (dann ohne Namen, für alle Fälle gleich). */
export function buildPage(template, { view, lang, patternFeature, origin }) {
  const input = toCardInput(view, { lang, patternFeature })
  const found = chooseCard(input) !== 'neutral'
  const meta = cardMeta(input)
  const v = cardVersion(input)
  if (!found) {
    return {
      found,
      indexable: false,
      html: renderPage(template, { lang, meta, image: `${origin}/api/og?lang=${lang}&v=${v}`, url: null, indexable: false, found }),
    }
  }
  const name = encodeURIComponent(input.nickname)
  const indexable = isIndexable(view)
  return {
    found,
    indexable,
    html: renderPage(template, {
      lang, meta, indexable, found,
      image: `${origin}/api/og?name=${name}&lang=${lang}&v=${v}`,
      url: `${origin}/u/${name}`,
    }),
  }
}

function send(req, res, status, headers, body) {
  res.statusCode = status
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v)
  res.setHeader('Content-Length', Buffer.byteLength(body))
  res.end(req.method === 'HEAD' ? undefined : body)
}

export function createHandler({ fetch = globalThis.fetch, env = process.env, template = loadTemplate } = {}) {
  return async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.statusCode = 405
      res.setHeader('Allow', 'GET, HEAD')
      res.setHeader('Cache-Control', 'no-store')
      return res.end()
    }
    let tpl
    try {
      tpl = typeof template === 'function' ? template() : template
    } catch {
      res.statusCode = 500
      res.setHeader('Cache-Control', 'no-store')
      return res.end()
    }
    const lang = pickLang(headerValue(req, 'accept-language'))
    const ctx = { lang, patternFeature: patternFeatureOn(env), origin: siteOrigin(env) }
    const base = {
      'Content-Type': 'text/html; charset=utf-8',
      Vary: 'Accept-Language',
      'X-Content-Type-Options': 'nosniff',
    }

    const name = requestedName(req)
    // Außerhalb des Zeichensatzes: sofort die neutrale 404, ohne Datenbankaufruf.
    const result = isValidNickname(name) ? await fetchProfileView(name, { fetch }) : { ok: true, view: null }
    if (!result.ok) {
      // Supabase nicht erreichbar: neutral, aber nicht zwischenspeichern.
      const page = buildPage(tpl, { ...ctx, view: null })
      return send(req, res, 503, { ...base, 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', 'Retry-After': '30' }, page.html)
    }
    const page = buildPage(tpl, { ...ctx, view: result.view })
    const headers = { ...base, 'Cache-Control': PAGE_CACHE }
    if (!page.indexable) headers['X-Robots-Tag'] = 'noindex'
    return send(req, res, page.found ? 200 : 404, headers, page.html)
  }
}

export default createHandler()
