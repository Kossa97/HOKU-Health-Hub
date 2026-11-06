// Brücke zwischen `profile_view` (Stufe web, ohne Anmeldung) und der Link-Karte.
//
// Sicherheitsgrenze (Plan 2c, Global Constraints): `api/u.js` und `api/og.js`
// fragen Supabase NUR mit dem öffentlichen anon-Schlüssel der App, nie mit der
// Dienstrolle. Was sie zeigen, kommt allein aus der Antwort von
// `profile_view(name, null)`; hier wird nur umgeformt, nicht zusätzlich gefiltert
// (die Filter stehen in `supabase-profil-p2c-web.sql`).
//
// URL und Schlüssel stehen fest im Code wie in `src/lib/supabase.ts` (Paritätstest):
// Sie sind öffentlich (stecken in jeder App), und ohne Umgebungsvariable kann
// niemand versehentlich einen Dienstschlüssel eintragen.

import { isValidNickname } from './profileCard.js'
import { webTitleName } from './titleNames.js'

export const SUPABASE_URL = 'https://xcskcojakolphtbuqfbw.supabase.co'
export const SUPABASE_ANON_KEY = 'sb_publishable_yeAVlq8miTc20FLsPqKCwQ_xAGKHLV1'
export const MEDIA_BUCKET = 'profile-media'
/** Wie `file_size_limit` des Buckets (`supabase-profil-p1-datenbasis.sql`), mit Luft. */
const AVATAR_MAX_BYTES = 1_500_000
const TIMEOUT_MS = 4000

const HEADERS = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }

/**
 * Sprache der Karte aus `Accept-Language`: die bevorzugte unter de/en, sonst en
 * (Spec 3.3, Frage 9). Antworten, die davon abhängen, tragen `Vary: Accept-Language`.
 */
export function pickLang(header) {
  if (typeof header !== 'string' || !header) return 'en'
  let best = null
  header.split(',').forEach((part, i) => {
    const [tag, ...params] = part.trim().split(';')
    const primary = tag.trim().toLowerCase().split('-')[0]
    if (primary !== 'de' && primary !== 'en') return
    const qParam = params.map(p => p.trim()).find(p => p.startsWith('q='))
    const q = qParam ? Number(qParam.slice(2)) : 1
    if (!Number.isFinite(q) || q <= 0) return
    if (!best || q > best.q || (q === best.q && i < best.i)) best = { lang: primary, q, i }
  })
  return best?.lang ?? 'en'
}

/** Rückfall-Text „kann Muster finden“ erst mit der Musterfunktion (Spec 3.3). */
export function patternFeatureOn(env = process.env) {
  return env.HOKU_PATTERN_FEATURE === '1'
}

/** Öffentliche Adresse für `og:url` / `og:image`, wie `scripts/prerender-peptipedia.ts`. */
export function siteOrigin(env = process.env) {
  const host = env.VERCEL_PROJECT_PRODUCTION_URL || env.VERCEL_URL
  const raw = env.VITE_PUBLIC_SITE_URL || (host ? `https://${host}` : 'https://hokuhealth.app')
  try {
    const url = new URL(raw)
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.origin
  } catch { /* unten */ }
  return 'https://hokuhealth.app'
}

/** Pfad im Bucket, wie ihn die App schreibt (`<uuid>/avatar-<zeit>.jpg`); sonst kein Bild. */
const AVATAR_PATH = /^[A-Za-z0-9-]{1,64}\/[A-Za-z0-9_-]{1,64}\.(jpe?g|png)$/
export function isAvatarPath(path) {
  return typeof path === 'string' && AVATAR_PATH.test(path)
}

/**
 * `profile_view` als anon. Ergebnis: `{ ok: true, view }` (view = Objekt oder
 * null für aus/privat/unbekannt/ausgeblendet) oder `{ ok: false }` bei Netz-/Serverfehler.
 */
export async function fetchProfileView(name, { fetch = globalThis.fetch } = {}) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/profile_view`, {
      method: 'POST',
      headers: { ...HEADERS, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ p_username: name, p_as: null }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) return { ok: false }
    const view = await res.json()
    return { ok: true, view: view && typeof view === 'object' && !Array.isArray(view) ? view : null }
  } catch {
    return { ok: false }
  }
}

/**
 * Profilbild über Storage als anon. Die Bild-Policy (`profile_media_visible`) lässt
 * nur das geprüfte Bild bei Web-Link an durch; alles andere → null (Initiale).
 */
export async function fetchAvatar(path, { fetch = globalThis.fetch } = {}) {
  if (!isAvatarPath(path)) return null
  try {
    const url = `${SUPABASE_URL}/storage/v1/object/${MEDIA_BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (!res.ok) return null
    const length = Number(res.headers.get('content-length'))
    if (Number.isFinite(length) && length > AVATAR_MAX_BYTES) return null
    const buf = Buffer.from(await res.arrayBuffer())
    return buf.length > 0 && buf.length <= AVATAR_MAX_BYTES ? buf : null
  } catch {
    return null
  }
}

function intOrNull(v) {
  return Number.isInteger(v) && v >= 0 ? v : null
}

function memberOrNull(m) {
  return m && typeof m === 'object' && ['days', 'months', 'years'].includes(m.unit) && Number.isInteger(m.n) && m.n >= 0
    ? { unit: m.unit, n: m.n }
    : null
}

/**
 * anon-Antwort von `profile_view` → `CardInput` (`api/_lib/profileCard.js`).
 * `view` null/kaputt → `found: false` (neutrale Karte). Bereiche liefert die
 * Web-Stufe nicht (Entscheidung 04.11.), also `areas: []`. Den Titel liefert sie
 * als `{kind, id}`: nur eine bekannte Rang- oder tragbare ID wird zum Namen in
 * `lang` (`titleNames.js`), alles andere zu `null` (kein Chip).
 * `avatar.id` = Pfad im Bucket: dieselbe Kennung in `api/u.js` und `api/og.js`,
 * damit beide dieselbe Fassung `v` bilden.
 */
export function toCardInput(view, { lang = 'en', patternFeature = false } = {}) {
  const base = { lang, patternFeature, areas: [], title: null }
  if (!view || typeof view !== 'object' || view.blocked === true || view.private === true || !isValidNickname(view.username)) {
    return { ...base, found: false, webLinkOn: false, private: false, name: null, nickname: '', avatar: null, tier: null, member: null, entryCount: null, webValueCount: null }
  }
  const fields = view.fields && typeof view.fields === 'object' ? view.fields : {}
  const card = view.card && typeof view.card === 'object' ? view.card : {}
  const tier = fields.progress && typeof fields.progress === 'object' ? fields.progress.tier : null
  return {
    ...base,
    found: true,
    // Nicht null heißt in der Stufe web: Web-Link an und nicht privat.
    webLinkOn: true,
    private: false,
    name: typeof view.display_name === 'string' ? view.display_name : null,
    nickname: view.username,
    avatar: isAvatarPath(view.avatar) ? { id: view.avatar } : null,
    tier: Number.isInteger(tier) ? tier : null,
    member: memberOrNull(card.member_since),
    entryCount: intOrNull(card.entry_count),
    webValueCount: intOrNull(card.web_value_count),
    title: webTitleName(fields.title, lang),
  }
}

/** Suchmaschinen-Schalter (Spec 7.2): nur ein echtes `true` aus der Web-Stufe. */
export function isIndexable(view) {
  return Boolean(view && typeof view === 'object' && view.web_indexable === true)
}
