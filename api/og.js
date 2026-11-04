// api/og.js — Vorschaubild der Link-Karte, 1200 x 630 PNG.
// Aufruf aus `api/u.js`: /api/og?name=<name>&lang=de|en&v=<fassung>. Spec 2c, 3.2–3.5.
//
// - Daten nur aus `profile_view(name, null)` und das Profilbild nur über Storage,
//   beides mit dem anon-Schlüssel (`api/_lib/profileViewWeb.js`).
// - Unbekannt / aus / privat / ausgeblendet / ungültiger Name / `v` passt nicht
//   zum aktuellen Stand → dieselbe neutrale Karte mit denselben Kopfzeilen.
//   Alte Bild-URLs werden so nach Ablauf des CDN-Caches (10 min) wertlos.
// - `lang` steht in der URL (nicht `Accept-Language`), weil die Fassung die
//   Sprache enthält: HTML und Bild können von verschiedenen Abrufern kommen.

import { Resvg } from '@resvg/resvg-js'
import { cardFontFiles, cardSvg, cardVersion, chooseCard, isValidNickname } from './_lib/profileCard.js'
import { fetchAvatar, fetchProfileView, patternFeatureOn, toCardInput } from './_lib/profileViewWeb.js'

export const IMAGE_CACHE = 'public, max-age=0, s-maxage=600'
/** Profilbild kam nicht durch (Netz) oder `v` ist alt: nur kurz zwischenspeichern. */
const SHORT_CACHE = 'public, max-age=0, s-maxage=60'

let fontOptions = null
function render(svg) {
  fontOptions ??= { fontFiles: cardFontFiles(), loadSystemFonts: false, defaultFontFamily: 'Inter' }
  return new Resvg(svg, { font: fontOptions, fitTo: { mode: 'original' } }).render().asPng()
}

const neutralCache = new Map()
function neutralPng(lang) {
  if (!neutralCache.has(lang)) neutralCache.set(lang, render(cardSvg(toCardInput(null, { lang }))))
  return neutralCache.get(lang)
}

export function requestParams(req) {
  let url
  try {
    url = new URL(req.url ?? '/', 'http://localhost')
  } catch {
    return { name: null, lang: 'en', v: null }
  }
  const one = key => {
    const all = url.searchParams.getAll(key)
    return all.length === 1 ? all[0] : null
  }
  const lang = one('lang')
  return { name: one('name'), lang: lang === 'de' ? 'de' : 'en', v: one('v') }
}

function send(req, res, png, cache) {
  res.statusCode = 200
  res.setHeader('Content-Type', 'image/png')
  res.setHeader('Content-Length', png.length)
  res.setHeader('Cache-Control', cache)
  res.setHeader('X-Robots-Tag', 'noindex')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.end(req.method === 'HEAD' ? undefined : png)
}

export function createHandler({ fetch = globalThis.fetch, env = process.env } = {}) {
  return async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.statusCode = 405
      res.setHeader('Allow', 'GET, HEAD')
      res.setHeader('Cache-Control', 'no-store')
      return res.end()
    }
    const { name, lang, v } = requestParams(req)
    const neutral = (cache = IMAGE_CACHE) => {
      try {
        return send(req, res, neutralPng(lang), cache)
      } catch {
        // Schriften/Logos fehlen im Paket o. Ä.: lieber kein Bild als ein halbes.
        res.statusCode = 500
        res.setHeader('Cache-Control', 'no-store')
        return res.end()
      }
    }
    if (!isValidNickname(name) || !v) return neutral()

    const result = await fetchProfileView(name, { fetch })
    if (!result.ok) return neutral('no-store')
    const input = toCardInput(result.view, { lang, patternFeature: patternFeatureOn(env) })
    if (chooseCard(input) === 'neutral') return neutral()
    // Profil ist da, `v` aber alt: Das HTML mit dem alten `v` kann noch bis zu
    // 2 min im CDN liegen. Die neutrale Karte unter dieser URL deshalb nur kurz
    // halten, sonst bliebe sie 10 min an einem frisch geteilten Link hängen.
    // (Verrät nichts: dass der Web-Link an ist, zeigt /u/<name> ohnehin.)
    if (cardVersion(input) !== v) return neutral(SHORT_CACHE)

    let cache = IMAGE_CACHE
    if (input.avatar) {
      const png = await fetchAvatar(input.avatar.id, { fetch })
      if (png) input.avatar = { ...input.avatar, png }
      else cache = SHORT_CACHE
    }
    let png
    try {
      png = render(cardSvg(input))
    } catch {
      return neutral('no-store')
    }
    return send(req, res, png, cache)
  }
}

export default createHandler()
