// Link-Karte für /u/<name>: Kartenwahl, Meta-Texte (de/en), Fassung und das
// 1200 x 630-SVG der drei freigegebenen Karten.
//
// Maßgeblich: Mockup `docs/profil/mockups/profil-2c-karten-auswahl.html`
// (`ogA1`, `ogC`, `ogN`; alle Maße in cqw, 1cqw = 12 px) und Spec
// `docs/superpowers/specs/2026-11-02-profil-p2c-web-design.md` 3.3–3.5.
// Die Kommentare nennen die CSS-Regel des Mockups, aus der eine Zahl kommt.
//
// Rein: keine Netzaufrufe. Gelesen werden nur die Dateien in
// `api/_assets/profile-card/` (Logos, Schriften), einmal und dann zwischengespeichert.
// Das SVG verweist auf die Schriften über den Familiennamen; wer es rastert
// (`api/og.js`, Tests), lädt `cardFontFiles()` in resvg.
//
// Eingabe (`CardInput`, von `api/og.js` / `api/u.js` aus `profile_view` gebildet):
//   lang 'de'|'en', name string|null, nickname string,
//   avatar { png?: Buffer, id?: string } | null   (geprüftes Bild als PNG/JPEG, sonst Initiale;
//     `id` = Storage-Objekt für die Fassung, damit HTML und Bild denselben Hash bilden),
//   tier 10|20|30|50|75|100|null, member { unit: 'days'|'months'|'years', n } | null,
//   entryCount number|null, webValueCount number|null, areas string[] (koerper/training/erholung),
//   title string|null (fertig übersetzt, `titleNames.js`; nur Fortschritt und Rückfall,
//     nie im Meta-Text), patternFeature boolean,
//   webLinkOn boolean, private boolean, found boolean

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseFont } from './fontMetrics.js'

export const CARD_WIDTH = 1200
export const CARD_HEIGHT = 630
/** Fließt in die Fassung ein: hochzählen, wenn sich das Bild bei gleichen Daten ändert. */
const LAYOUT_REVISION = 1

const ASSET_DIR = fileURLToPath(new URL('../_assets/profile-card/', import.meta.url))

const FONT_FILES = {
  disp: 'SpaceGrotesk-SemiBold.ttf',
  ui: 'Inter-Medium.ttf',
  uiBold: 'Inter-SemiBold.ttf',
  uiItalic: 'Inter-MediumItalic.ttf',
  mono: 'IBMPlexMono-Medium.ttf',
}
const FONT_ATTRS = {
  disp: 'font-family="Space Grotesk" font-weight="600"',
  ui: 'font-family="Inter" font-weight="500"',
  uiBold: 'font-family="Inter" font-weight="600"',
  uiItalic: 'font-family="Inter" font-weight="500" font-style="italic"',
  mono: 'font-family="IBM Plex Mono" font-weight="500"',
}

/** Absolute Pfade der Schriften für resvg (`font.fontFiles`). */
export function cardFontFiles() {
  return Object.values(FONT_FILES).map(f => ASSET_DIR + f)
}

let fontCache = null
function fonts() {
  if (!fontCache) {
    fontCache = Object.fromEntries(Object.entries(FONT_FILES).map(([k, f]) => [k, parseFont(readFileSync(ASSET_DIR + f))]))
  }
  return fontCache
}

const imageCache = new Map()
function asset(file) {
  if (!imageCache.has(file)) imageCache.set(file, `data:image/png;base64,${readFileSync(ASSET_DIR + file).toString('base64')}`)
  return imageCache.get(file)
}

// ───── Farben (Mockup :root) ─────
const C = {
  bg: '#0f1116',
  t1: '#f2f2f4',
  t2: 'rgba(255,255,255,.86)',
  t3: 'rgba(255,255,255,.62)',
  hair: 'rgba(255,255,255,.16)',
  acc: '#00ccf5',
  engine: 'rgba(255,255,255,.76)',
}

// ───── Texte ─────

const AREA_ORDER = ['koerper', 'training', 'erholung']
// Wie `pf_area_*` in src/i18n/locales/{de,en}.json
const AREA_LABEL = {
  de: { koerper: 'Körper', training: 'Training', erholung: 'Erholung & Fitness' },
  en: { koerper: 'Body', training: 'Training', erholung: 'Recovery & fitness' },
}
const TIERS = new Set([10, 20, 30, 50, 75, 100])

const T = {
  de: {
    over: 'über',
    change: 'positive Veränderung seit Start',
    about: 'Über Hoku',
    headline: 'Mehr als nur Tracking.',
    lead1: 'Du trackst.',
    lead2: 'Hoku verbindet.',
    enginePattern: 'Hokus intelligente Engine legt deine Werte übereinander und kann Muster finden, die du allein nicht gesehen hättest.',
    engineStart: 'Hokus intelligente Engine legt deine Werte übereinander und zeigt dir, was sich seit deinem Start verändert hat.',
    button: 'Profil ansehen',
    slogan: 'Sieh, wer du wirst.',
    onHoku: 'auf Hoku',
    and: 'und',
  },
  en: {
    over: 'over',
    change: 'positive change since start',
    about: 'About Hoku',
    headline: 'More than just tracking.',
    lead1: 'You track.',
    lead2: 'Hoku connects.',
    enginePattern: 'Hoku’s smart engine layers your data and can find patterns you’d never have spotted on your own.',
    engineStart: 'Hoku’s smart engine layers your data and shows you what has changed since your start.',
    button: 'View profile',
    slogan: 'See who you’re becoming.',
    onHoku: 'on Hoku',
    and: 'and',
  },
}
export const SITE_NAME = 'Hoku Health Hub'
const ADDRESS = 'hokuhealth.app'

function groupDigits(n, sep) {
  return String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, sep)
}

/** „Seit 7 Monaten dabei“ / „Member for 7 months“; Dauer kommt fertig aus `profile_view`. */
export function memberText(lang, member) {
  if (!member || !Number.isInteger(member.n) || member.n < 0) return null
  const { unit, n } = member
  if (lang === 'de') {
    if (unit === 'days') return n === 0 ? 'Seit heute dabei' : `Seit ${n} ${n === 1 ? 'Tag' : 'Tagen'} dabei`
    if (unit === 'months') return `Seit ${n} ${n === 1 ? 'Monat' : 'Monaten'} dabei`
    if (unit === 'years') return `Seit ${n} ${n === 1 ? 'Jahr' : 'Jahren'} dabei`
    return null
  }
  if (unit === 'days') return n === 0 ? 'Joined today' : `Member for ${n} ${n === 1 ? 'day' : 'days'}`
  if (unit === 'months') return `Member for ${n} ${n === 1 ? 'month' : 'months'}`
  if (unit === 'years') return `Member for ${n} ${n === 1 ? 'year' : 'years'}`
  return null
}

/** „1.240 Einträge“ / „1,240 entries“. */
export function entriesText(lang, count) {
  if (!Number.isInteger(count) || count < 1) return null
  return lang === 'de'
    ? `${groupDigits(count, '.')} ${count === 1 ? 'Eintrag' : 'Einträge'}`
    : `${groupDigits(count, ',')} ${count === 1 ? 'entry' : 'entries'}`
}

/** Teile von „trackt 9 Werte“: `[vor, Zahl, nach]`. */
function trackParts(lang, count) {
  const n = lang === 'de' ? groupDigits(count, '.') : groupDigits(count, ',')
  return lang === 'de' ? ['trackt', n, count === 1 ? 'Wert' : 'Werte'] : ['tracks', n, count === 1 ? 'value' : 'values']
}

function tierText(lang, tier) {
  return lang === 'de' ? `${tier} %` : `${tier}%`
}

function joinList(lang, items) {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} ${T[lang].and} ${items.at(-1)}`
}

function cleanText(s) {
  return typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : ''
}

// ───── Prüfen ─────

/** Wie `BENUTZERNAME` in src/features/auth/lib/pruefung.ts. */
const NICKNAME = /^[A-Za-z0-9._]{3,20}$/
export function isValidNickname(name) {
  return typeof name === 'string' && NICKNAME.test(name)
}

// XML 1.0 erlaubt keine Steuerzeichen außer Tab/LF/CR, kein U+FFFE/U+FFFF und keine
// einzelnen Surrogate; resvg bricht sonst das ganze Bild ab.
function xmlAllowed(ch) {
  const cp = ch.codePointAt(0)
  if (cp < 0x20) return cp === 0x09 || cp === 0x0a || cp === 0x0d
  if (cp >= 0xd800 && cp <= 0xdfff) return false // einzeln, sonst wäre ch ein Paar
  return cp !== 0xfffe && cp !== 0xffff
}

/** Für Text und Attribute im SVG (und HTML): `& < > " '` maskiert, unzulässige Zeichen entfernt. */
export function escapeXml(value) {
  return Array.from(String(value ?? '')).filter(xmlAllowed).join('')
    .replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

// ───── Kartenwahl und Modell ─────

/** 'neutral' | 'progress' (Fortschritt) | 'fallback' (Rückfall), Spec 3.3. */
export function chooseCard(input) {
  if (!input || !input.found || !input.webLinkOn || input.private) return 'neutral'
  return TIERS.has(input.tier) ? 'progress' : 'fallback'
}

function langOf(input) {
  return input?.lang === 'de' ? 'de' : 'en'
}

function avatarMime(png) {
  if (!Buffer.isBuffer(png) || png.length < 12) return null
  if (png[0] === 0x89 && png.toString('latin1', 1, 4) === 'PNG') return 'image/png'
  if (png[0] === 0xff && png[1] === 0xd8 && png[2] === 0xff) return 'image/jpeg'
  return null
}

/**
 * Was die Karte zeigt, schon gefiltert und übersetzt. Grundlage für Bild,
 * Meta-Texte und Fassung — was hier fehlt, erscheint nirgends.
 */
export function cardModel(input) {
  const kind = chooseCard(input)
  const lang = langOf(input)
  const engine = input?.patternFeature ? T[lang].enginePattern : T[lang].engineStart
  if (kind === 'neutral') return { kind, lang }
  const nickname = cleanText(input.nickname)
  const displayName = cleanText(input.name) || nickname
  const values = Number.isInteger(input.webValueCount) && input.webValueCount > 0 ? input.webValueCount : null
  const mime = input.avatar ? avatarMime(input.avatar.png) : null
  const model = {
    kind,
    lang,
    displayName,
    firstName: displayName.split(' ')[0] || nickname,
    avatar: mime ? { mime, png: input.avatar.png } : null,
    // Für die Fassung: `api/u.js` kennt nur die Objekt-ID des Bildes, `api/og.js` auch die Bytes.
    // Beide geben dieselbe `id` mit; ohne `id` zählen die Bytes.
    avatarKey: input.avatar?.id ? `id:${input.avatar.id}` : mime ? `sha:${createHash('sha256').update(input.avatar.png).digest('hex')}` : null,
    title: cleanText(input.title) || null,
    member: memberText(lang, input.member),
    values,
  }
  if (kind === 'progress') {
    const areas = new Set(Array.isArray(input.areas) ? input.areas : [])
    model.tier = input.tier
    model.entries = entriesText(lang, input.entryCount)
    model.areas = AREA_ORDER.filter(a => areas.has(a)).map(a => AREA_LABEL[lang][a])
  } else {
    model.engine = engine
  }
  return model
}

/** Kurzer Hash über alles, was das Bild zeigt (Spec 3.5, Parameter `v`). */
export function cardVersion(input) {
  const m = cardModel(input)
  const shown = { ...m, avatar: undefined, firstName: undefined, r: LAYOUT_REVISION }
  return createHash('sha256').update(JSON.stringify(shown)).digest('base64url').slice(0, 10)
}

function genitive(lang, name) {
  if (lang === 'en') return /s$/i.test(name) ? `${name}’` : `${name}’s`
  return /(s|ß|x|z)$/i.test(name) ? `${name}’` : `${name}s`
}

/** `{ title, description, alt }` für `og:title`, `og:description`, `og:image:alt` — unmaskiert. */
export function cardMeta(input) {
  const m = cardModel(input)
  const t = T[m.lang]
  const engineFull = `${t.lead1} ${t.lead2} ${input?.patternFeature ? t.enginePattern : t.engineStart}`
  if (m.kind === 'neutral') {
    return { title: SITE_NAME, description: `${t.slogan} ${engineFull}`, alt: `${SITE_NAME}: ${t.slogan}` }
  }
  const tracks = m.values ? trackParts(m.lang, m.values).join(' ') : null
  if (m.kind === 'progress') {
    const change = `${t.over} ${tierText(m.lang, m.tier)} ${t.change}`
    const parts = []
    if (tracks) {
      const verb = m.lang === 'de' ? `${m.firstName} ${tracks} mit Hoku` : `${m.firstName} ${tracks} with Hoku`
      parts.push(m.areas.length ? `${verb}: ${joinList(m.lang, m.areas)}.` : `${verb}.`)
    }
    const facts = [m.member, m.entries].filter(Boolean)
    if (facts.length) parts.push(`${facts.join(', ')}.`)
    parts.push(m.lang === 'de' ? `Sieh dir ${genitive('de', m.firstName)} Profil an.` : `See ${genitive('en', m.firstName)} profile.`)
    return {
      title: `${m.displayName} ${t.onHoku}: ${change}`,
      description: parts.join(' '),
      alt: `${m.displayName} ${t.onHoku}: ${tracks ? `${tracks}, ` : ''}${change}`,
    }
  }
  const lead = tracks ? (m.lang === 'de' ? `${m.firstName} ${tracks} mit Hoku. ` : `${m.firstName} ${tracks} with Hoku. `) : ''
  return {
    title: `${m.displayName} ${t.onHoku} · ${t.headline}`,
    description: `${lead}${engineFull}`,
    alt: `${m.displayName} ${t.onHoku}: ${t.headline} ${t.lead1} ${t.lead2}`,
  }
}

// ───── Messen und Setzen ─────

const FALLBACK_ORDER = ['ui', 'disp', 'mono']

/** Breite in px. Fehlt ein Zeichen in der Schrift, die Breite aus der nächsten (wie resvg ausweicht). */
export function textWidth(font, size, text, letterSpacing = 0) {
  const all = fonts()
  let w = 0
  for (const ch of text) {
    const cp = ch.codePointAt(0)
    let adv = all[font].advance(cp)
    for (const k of FALLBACK_ORDER) if (adv === null) adv = all[k].advance(cp)
    w += (adv ?? 0.6) * size + letterSpacing
  }
  return w
}

/** Grundlinie für eine CSS-Zeilenbox der Höhe `lineHeight` ab `top` (hhea wie Chrome). */
function baseline(font, size, lineHeight, top) {
  const f = fonts()[font]
  return top + (lineHeight - (f.ascent + f.descent) * size) / 2 + f.ascent * size
}

const r = n => Math.round(n * 100) / 100

function textEl({ font, size, x, y, fill, text, anchor = 'start', ls = 0 }) {
  return `<text x="${r(x)}" y="${r(y)}" ${FONT_ATTRS[font]} font-size="${r(size)}"${ls ? ` letter-spacing="${r(ls)}"` : ''} fill="${fill}"${anchor !== 'start' ? ` text-anchor="${anchor}"` : ''}>${escapeXml(text)}</text>`
}

/** Kürzt mit „…“, bis der Text in `maxW` passt. */
export function ellipsize(font, size, text, maxW, ls = 0) {
  if (textWidth(font, size, text, ls) <= maxW) return text
  const chars = Array.from(text)
  while (chars.length > 1 && textWidth(font, size, `${chars.join('').trimEnd()}…`, ls) > maxW) chars.pop()
  return `${chars.join('').trimEnd()}…`
}

/**
 * Name in einer Zeile (Mockup `.nm`: nowrap). Regel für lange Namen: erst bis auf
 * 70 % der Größe verkleinern (Vor- und Nachname wie „Christina Wagner“ passen so
 * noch ganz), dann mit „…“ kürzen — nie breiter als die Spalte.
 */
const NAME_MIN_SCALE = 0.7
export function fitName(text, size, maxW, ls) {
  const w = textWidth('disp', size, text, ls * size)
  if (w <= maxW) return { text, size }
  const smaller = Math.max(size * NAME_MIN_SCALE, size * maxW / w)
  return { text: ellipsize('disp', smaller, text, maxW, ls * smaller), size: smaller }
}

/** Zeilenumbruch nach Wörtern; ein einzelnes letztes Wort holt eines dazu (CSS `text-wrap: pretty`). */
export function wrapWords(font, size, text, maxW, ls = 0) {
  const words = text.split(' ')
  const lines = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (line && textWidth(font, size, next, ls) > maxW) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  if (lines.length > 1 && !lines.at(-1).includes(' ')) {
    const prev = lines.at(-2).split(' ')
    if (prev.length > 2) {
      const moved = `${prev.pop()} ${lines.at(-1)}`
      if (textWidth(font, size, moved, ls) <= maxW) {
        lines[lines.length - 2] = prev.join(' ')
        lines[lines.length - 1] = moved
      }
    }
  }
  return lines
}

/** Höchstens zwei möglichst gleich lange Zeilen (CSS `text-wrap: balance`), getrennt an `sep`. */
function balance(font, size, text, maxW, ls = 0, sep = ' ') {
  if (textWidth(font, size, text, ls) <= maxW) return [text]
  const parts = text.split(sep)
  let best = null
  for (let i = 1; i < parts.length; i++) {
    const a = parts.slice(0, i).join(sep).trimEnd()
    const b = parts.slice(i).join(sep).trimStart()
    const w = Math.max(textWidth(font, size, a, ls), textWidth(font, size, b, ls))
    if (!best || w < best.w) best = { w, lines: [a, b] }
  }
  return best ? best.lines.map(l => ellipsize(font, size, l, maxW, ls)) : [ellipsize(font, size, text, maxW, ls)]
}

// Ein Baustein: Höhe `h` und `draw(top)` → SVG. `mt` = margin-top (darf negativ sein).
function stack(items, gap) {
  const list = items.filter(Boolean)
  const h = list.reduce((s, it, i) => s + it.h + (it.mt ?? 0) + (it.mb ?? 0) + (i ? gap : 0), 0)
  return {
    h,
    draw(top) {
      let y = top
      return list.map((it, i) => {
        y += (i ? gap : 0) + (it.mt ?? 0)
        const out = it.draw(y)
        y += it.h + (it.mb ?? 0)
        return out
      }).join('')
    },
  }
}

// ───── Symbole (Mockup `P`, viewBox 24) ─────
const ICON = {
  pulse: 'M3 12h4l2.2-5 4 10 2.3-5H21',
  trend: 'M4 16.5l5-5 4 3.5 7-7.5M15 7.5h5v5',
  cal: 'M5 6.5h14v12.5H5zM5 10.5h14M9 4.5v3.5M15 4.5v3.5',
  pen: 'M5 19h4l9.5-9.5a2.1 2.1 0 0 0-4-4L5 15z',
}
function icon(key, x, y, size, color, sw = 1.8) {
  return `<path d="${ICON[key]}" transform="translate(${r(x)} ${r(y)}) scale(${r(size / 24)})" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`
}

// ───── Bausteine der Person (Mockup `.who`) ─────

let clipId = 0

function avatarBlock(m, d, cx) {
  // `.ava`: Kreis d, Verlauf 160°, innerer Ring .14cqw; margin-bottom .6cqw
  return {
    h: d,
    mb: 7.2,
    draw(top) {
      const rad = d / 2
      const cy = top + rad
      const id = `a${++clipId}`
      // linear-gradient(160deg): Linie durch die Mitte, Länge d·(sin160°+|cos160°|)
      const half = d * (Math.sin(Math.PI * 160 / 180) + Math.abs(Math.cos(Math.PI * 160 / 180))) / 2
      const dx = Math.sin(Math.PI * 160 / 180) * half
      const dy = -Math.cos(Math.PI * 160 / 180) * half
      let s = `<defs><linearGradient id="${id}g" gradientUnits="userSpaceOnUse" x1="${r(cx - dx)}" y1="${r(cy - dy)}" x2="${r(cx + dx)}" y2="${r(cy + dy)}"><stop offset="0" stop-color="#4a4f58"/><stop offset="1" stop-color="#252830"/></linearGradient>`
      s += `<clipPath id="${id}c"><circle cx="${r(cx)}" cy="${r(cy)}" r="${r(rad)}"/></clipPath></defs>`
      s += `<circle cx="${r(cx)}" cy="${r(cy)}" r="${r(rad)}" fill="url(#${id}g)"/>`
      if (m.avatar) {
        s += `<image x="${r(cx - rad)}" y="${r(top)}" width="${d}" height="${d}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id}c)" href="data:${m.avatar.mime};base64,${m.avatar.png.toString('base64')}"/>`
      } else {
        // Initiale: Space Grotesk 600, .41 · d, mittig (Zeilenhöhe 1 in einer d hohen Box)
        const size = d * 0.41
        // Erster Buchstabe oder erste Ziffer, Satzzeichen davor zählen nicht
        const initial = (m.displayName.match(/[\p{L}\p{N}]/u)?.[0] ?? '?').toLocaleUpperCase(m.lang)
        s += textEl({ font: 'disp', size, x: cx, y: baseline('disp', size, size, cy - size / 2), fill: C.t1, text: initial, anchor: 'middle' })
      }
      const ring = 0.14 * 12
      s += `<circle cx="${r(cx)}" cy="${r(cy)}" r="${r(rad - ring / 2)}" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="${r(ring)}"/>`
      return s
    },
  }
}

function nameBlock(m, size, maxW, cx) {
  // `.nm`: Space Grotesk 600, Zeilenhöhe 1.05, -.01em, nowrap
  const fit = fitName(m.displayName, size, maxW, -0.01)
  const lh = size * 1.05
  return {
    h: lh,
    draw: top => textEl({ font: 'disp', size: fit.size, x: cx, y: baseline('disp', fit.size, lh, top) , fill: C.t1, text: fit.text, anchor: 'middle', ls: -0.01 * fit.size }),
  }
}

/**
 * Titel-Chip in einer Zeile (`.ttl`: nowrap). Alle Titelnamen aus `titleNames.js`
 * passen in der Grundgröße (längster: „GELEGENHEITSRADLER“ / „YEAR-ROUND ATHLETE“);
 * für alles Längere erst bis auf 80 % verkleinern, dann mit „…“ kürzen.
 */
const TITLE_MIN_SCALE = 0.8
export function fitTitle(text, o, maxW) {
  const avail = maxW - 2 * o.padX
  const w = textWidth('mono', o.size, text, o.size * o.ls)
  if (w <= avail) return { text, size: o.size }
  const size = Math.max(o.size * TITLE_MIN_SCALE, o.size * avail / w)
  // + 1e-6: verkleinert passt der Text genau, Rundung darf ihn nicht kürzen
  return { text: ellipsize('mono', size, text, avail + 1e-6, size * o.ls), size }
}

function titleBlock(m, o, maxW, cx) {
  // `.ttl`: IBM Plex Mono 500, Großbuchstaben, Ring .1cqw, Pille; margin-top -.4cqw
  if (!m.title) return null
  const fit = fitTitle(m.title.toLocaleUpperCase(m.lang), o, maxW)
  const ls = fit.size * o.ls
  const w = textWidth('mono', fit.size, fit.text, ls) + 2 * o.padX
  const h = o.size + 2 * o.padY
  return {
    h,
    mt: -4.8,
    draw(top) {
      const ring = 1.2
      return `<rect x="${r(cx - w / 2 + ring / 2)}" y="${r(top + ring / 2)}" width="${r(w - ring)}" height="${r(h - ring)}" rx="${r((h - ring) / 2)}" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="${ring}"/>`
        + textEl({ font: 'mono', size: fit.size, x: cx + ls / 2, y: baseline('mono', fit.size, o.size, top + o.padY), fill: C.t2, text: fit.text, anchor: 'middle', ls })
    },
  }
}

/**
 * Eine Zeile unter dem Namen (`.meta .it`): Symbol 1.04em, Abstand .8cqw, Text;
 * mittig. `parts` = [{ text, font, size, fill }]; jedes Stück ist ein Flex-Element,
 * senkrecht zentriert in der Zeile (align-items: center), Abstand .8cqw dazwischen.
 */
function metaLine(iconKey, parts, size, cx) {
  const gap = 9.6
  const iconSize = size * 1.04
  const boxes = parts.map(p => ({ ...p, lh: p.lh ?? p.size * 1.2, w: textWidth(p.font, p.size, p.text, p.ls ?? 0) }))
  const h = Math.max(size * 1.2, ...boxes.map(b => b.lh))
  const w = iconSize + boxes.reduce((s, b) => s + gap + b.w, 0)
  return {
    h,
    draw(top) {
      let x = cx - w / 2
      let s = icon(iconKey, x, top + (h - iconSize) / 2, iconSize, C.t2)
      x += iconSize
      for (const b of boxes) {
        x += gap
        s += textEl({ font: b.font, size: b.size, x, y: baseline(b.font, b.size, b.lh, top + (h - b.lh) / 2), fill: b.fill, text: b.text, ls: b.ls ?? 0 })
        x += b.w
      }
      return s
    },
  }
}

function whoBlock(m, o) {
  const metaSize = o.meta
  const lines = []
  if (m.member) lines.push(metaLine('cal', [{ text: m.member, font: 'ui', size: metaSize, fill: C.t2 }], metaSize, o.cx))
  if (o.entries && m.entries) lines.push(metaLine('pen', [{ text: m.entries, font: 'ui', size: metaSize, fill: C.t2 }], metaSize, o.cx))
  if (o.tracks && m.values) {
    const [a, n, b] = trackParts(m.lang, m.values)
    // `.meta .it b`: Space Grotesk 600 1.3em/1, -.01em, Cyan
    const big = metaSize * 1.3
    lines.push(metaLine('pulse', [
      { text: a, font: 'ui', size: metaSize, fill: C.t2 },
      { text: n, font: 'disp', size: big, lh: big, fill: C.acc, ls: -0.01 * big },
      { text: b, font: 'ui', size: metaSize, fill: C.t2 },
    ], metaSize, o.cx))
  }
  return stack([
    avatarBlock(m, o.ava, o.cx),
    nameBlock(m, o.name, o.colW, o.cx),
    titleBlock(m, o.title, o.colW, o.cx),
    lines.length ? stack(lines, 10.8) : null,
  ], 16.8)
}

// ───── Hintergrund „Hoku-Licht“ ─────

function frame(body) {
  // radial-gradient(70% 60% at 50% 118%, rgba(100,210,255,.16), transparent 70%) über #0f1116
  const rx = CARD_WIDTH * 0.7
  const ry = CARD_HEIGHT * 0.6
  const cx = CARD_WIDTH / 2
  const cy = CARD_HEIGHT * 1.18
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}">`
    + `<defs><radialGradient id="licht" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${r(cy)}" r="${rx}" gradientTransform="translate(0 ${r(cy)}) scale(1 ${r(ry / rx)}) translate(0 ${r(-cy)})">`
    + '<stop offset="0" stop-color="rgb(100,210,255)" stop-opacity=".16"/><stop offset=".7" stop-color="rgb(100,210,255)" stop-opacity="0"/></radialGradient></defs>'
    + `<rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="${C.bg}"/><rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="url(#licht)"/>`
    + body
    + '</svg>'
}

function image(file, x, y, w, h) {
  return `<image x="${x}" y="${y}" width="${w}" height="${h}" href="${asset(file)}"/>`
}

// ───── Fortschritt (Mockup `ogA1`, `.og.t-a1`) ─────

function progressSvg(m) {
  const t = T[m.lang]
  // `.body`: left/right 5cqw, top 5cqw, bottom 12.4cqw; Spalten 30cqw | 4.4cqw | Rest
  const top = 60
  const bodyH = CARD_HEIGHT - 60 - 148.8
  const who = whoBlock(m, {
    cx: 60 + 180, colW: 360, ava: 180, name: 55.2, meta: 27.6, entries: true, tracks: false,
    title: { size: 22.8, ls: 0.1, padX: 16.8, padY: 8.4 },
  })

  // `.main`: Trennlinie .1cqw, padding-left 4.4cqw, Abstand 1.1cqw, min-height 30cqw
  const lineX = 60 + 360 + 52.8
  const x0 = lineX + 1.2 + 52.6
  const maxW = CARD_WIDTH - 60 - x0
  const items = []
  if (m.values) {
    // `.tk`: Inter 500 2.9cqw, Zahl Space Grotesk 600 5cqw Cyan, Abstand 1.2cqw, Grundlinien gleich
    const [a, n, b] = trackParts(m.lang, m.values)
    const small = 34.8
    const big = 60
    const wa = textWidth('ui', small, a)
    const wn = textWidth('disp', big, n, -0.02 * big)
    const bl = baseline('disp', big, big, 0)
    items.push({
      h: big,
      draw: y => textEl({ font: 'ui', size: small, x: x0, y: y + bl, fill: C.t2, text: a })
        + textEl({ font: 'disp', size: big, x: x0 + wa + 14.4, y: y + bl, fill: C.acc, text: n, ls: -0.02 * big })
        + textEl({ font: 'ui', size: small, x: x0 + wa + 28.8 + wn, y: y + bl, fill: C.t2, text: b }),
    })
  }
  if (m.areas.length) {
    // `.ar`: Inter 500 2.6cqw/1.3, leise, text-wrap: balance
    const size = 31.2
    const lh = size * 1.3
    const lines = balance('ui', size, m.areas.join(' · '), maxW, 0, ' · ').map((l, i, all) => (i < all.length - 1 ? `${l} ·` : l))
    items.push({
      h: lh * lines.length,
      draw: y => lines.map((l, i) => textEl({ font: 'ui', size, x: x0, y: baseline('ui', size, lh, y + i * lh), fill: C.t3, text: l })).join(''),
    })
  }
  if (items.length) {
    // `.rule`: margin 1.4cqw 0 1cqw
    items.push({ h: 1.2, mt: 16.8, mb: 12, draw: y => `<rect x="${r(x0)}" y="${r(y)}" width="${r(maxW)}" height="1.2" fill="${C.hair}"/>` })
  }
  {
    // `.huge`: „über“ Inter 500 3.4cqw, „30 %“ Space Grotesk 600 10cqw/.95 -.03em Cyan,
    // Trend-Symbol .42em, 0.1em über der Grundlinie; Abstand 1.4cqw
    const big = 120
    const lh = big * 0.95
    const small = 40.8
    const word = t.over
    const num = tierText(m.lang, m.tier)
    const ww = textWidth('ui', small, word)
    const wn = textWidth('disp', big, num, -0.03 * big)
    const bl = baseline('disp', big, lh, 0)
    const iconSize = big * 0.42
    items.push({
      h: lh,
      draw: y => textEl({ font: 'ui', size: small, x: x0, y: y + bl, fill: C.t2, text: word })
        + textEl({ font: 'disp', size: big, x: x0 + ww + 16.8, y: y + bl, fill: C.acc, text: num, ls: -0.03 * big })
        + icon('trend', x0 + ww + 33.6 + wn, y + bl - 0.1 * big - iconSize, iconSize, C.acc, 2),
    })
    // `.lbl`: Inter 500 2.9cqw/1.25
    const size = 34.8
    const llh = size * 1.25
    const lines = wrapWords('ui', size, t.change, maxW)
    items.push({
      h: llh * lines.length,
      draw: y => lines.map((l, i) => textEl({ font: 'ui', size, x: x0, y: baseline('ui', size, llh, y + i * llh), fill: C.t2, text: l })).join(''),
    })
  }
  const main = stack(items, 13.2)
  const mainH = Math.max(360, main.h)
  const mainTop = top + (bodyH - mainH) / 2

  return frame(
    image('hauptlogo-cyan-360.png', 420, 503, 360, 118)
    + who.draw(top + (bodyH - who.h) / 2)
    + `<rect x="${r(lineX)}" y="${r(mainTop)}" width="1.2" height="${r(mainH)}" fill="${C.hair}"/>`
    + main.draw(mainTop + (mainH - main.h) / 2),
  )
}

// ───── Rückfall (Mockup `ogC`, `.og.t-c`, B1) ─────

function fallbackSvg(m) {
  const t = T[m.lang]
  // `.body`: left 4cqw, right 31cqw, top/bottom 6cqw; Spalten 25cqw | 3.4cqw | Rest
  const top = 72
  const bodyH = CARD_HEIGHT - 144
  const who = whoBlock(m, {
    cx: 48 + 150, colW: 300, ava: 144, name: 46.8, meta: 25.2, entries: false, tracks: true,
    title: { size: 20.4, ls: 0.08, padX: 14.4, padY: 7.2 },
  })

  // `.say`: Trennlinie, padding-left 3.6cqw, Abstand 1.4cqw, min-height 32cqw
  const lineX = 48 + 300 + 40.8
  const x0 = lineX + 1.2 + 43
  const colW = 48 + 780 - x0
  // `.hl` nowrap: eine Zeile, darf über die Spalte; die Spalte wird so breit wie sie (Grid-Spur)
  const hlSize = 42
  const hlLs = -0.015 * hlSize
  const hlW = textWidth('disp', hlSize, t.headline, hlLs)
  const wrapW = Math.max(colW, hlW)
  const qSize = 24
  const ldSize = 34.8
  const ldLh = ldSize * 1.2
  const lnSize = 27.6
  const lnLh = lnSize * 1.36
  const engine = wrapWords('uiItalic', lnSize, m.engine, wrapW)
  const pillSize = 28.8
  const pillW = textWidth('uiBold', pillSize, t.button) + 72
  const pillH = pillSize + 38.4

  const say = stack([
    // `.q`: IBM Plex Mono 500 2cqw, .08em, Großbuchstaben, leise
    { h: qSize, draw: y => textEl({ font: 'mono', size: qSize, x: x0, y: baseline('mono', qSize, qSize, y), fill: C.t3, text: t.about.toLocaleUpperCase(m.lang), ls: 0.08 * qSize }) },
    // `.hl`: Space Grotesk 600 3.5cqw/1.12, -.015em
    { h: hlSize * 1.12, draw: y => textEl({ font: 'disp', size: hlSize, x: x0, y: baseline('disp', hlSize, hlSize * 1.12, y), fill: C.t1, text: t.headline, ls: hlLs }) },
    // `.ld`: Space Grotesk 600 2.9cqw/1.2, margin .4cqw 0 -.4cqw; zweite Zeile Cyan
    {
      h: ldLh * 2, mt: 4.8, mb: -4.8,
      draw: y => textEl({ font: 'disp', size: ldSize, x: x0, y: baseline('disp', ldSize, ldLh, y), fill: C.t1, text: t.lead1, ls: -0.01 * ldSize })
        + textEl({ font: 'disp', size: ldSize, x: x0, y: baseline('disp', ldSize, ldLh, y + ldLh), fill: C.acc, text: t.lead2, ls: -0.01 * ldSize }),
    },
    // `.ln`: Inter 500 kursiv 2.3cqw/1.36, 76 % Weiß
    { h: lnLh * engine.length, draw: y => engine.map((l, i) => textEl({ font: 'uiItalic', size: lnSize, x: x0, y: baseline('uiItalic', lnSize, lnLh, y + i * lnLh), fill: C.engine, text: l })).join('') },
    // `.pill`: Inter 600 2.4cqw, padding 1.6cqw 3cqw, Verlauf #2672cf → #1f62b8, margin-top .6cqw
    {
      h: pillH, mt: 7.2,
      draw: y => `<rect x="${r(x0)}" y="${r(y)}" width="${r(pillW)}" height="${r(pillH)}" rx="${r(pillH / 2)}" fill="url(#knopf)"/>`
        + textEl({ font: 'uiBold', size: pillSize, x: x0 + pillW / 2, y: baseline('uiBold', pillSize, pillSize, y + 19.2), fill: '#ffffff', text: t.button, anchor: 'middle' }),
    },
  ], 16.8)
  const sayH = Math.max(384, say.h)
  const sayTop = top + (bodyH - sayH) / 2

  return frame(
    `<defs><linearGradient id="knopf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2672cf"/><stop offset="1" stop-color="#1f62b8"/></linearGradient></defs>`
    // Bildmarke 42cqw bei 66.5cqw / 23cqw, angeschnitten; Kompaktlogo weiß 20cqw, rechts 3.6cqw, oben 3cqw
    + image('hoku-504.png', 798, 276, 504, 504)
    + image('kompaktlogo-weiss-240.png', 917, 36, 240, 59)
    + who.draw(top + (bodyH - who.h) / 2)
    + `<rect x="${r(lineX)}" y="${r(sayTop)}" width="1.2" height="${r(sayH)}" fill="${C.hair}"/>`
    + say.draw(sayTop + (sayH - say.h) / 2),
  )
}

// ───── Neutral (Mockup `ogN`, `.og.t-n`, B3) ─────

function neutralSvg(lang) {
  const t = T[lang]
  // `.tx`: left 40cqw, right 3cqw, mittig, Abstand 3.4cqw, padding-bottom 4cqw
  const cx = (480 + 1164) / 2
  const size = 56.4
  const lh = size * 1.14
  const ls = -0.015 * size
  const lines = balance('disp', size, t.slogan, 684, ls)
  const content = stack([
    { h: 157, draw: y => image('hauptlogo-weiss-480.png', cx - 240, r(y), 480, 157) },
    { h: lh * lines.length, draw: y => lines.map((l, i) => textEl({ font: 'disp', size, x: cx, y: baseline('disp', size, lh, y + i * lh), fill: C.t1, text: l, anchor: 'middle', ls })).join('') },
  ], 40.8)
  // `.addr`: IBM Plex Mono 500 2.1cqw, .04em, leise, unten 4.4cqw
  const addrSize = 25.2
  return frame(
    // Bildmarke 56cqw bei -19cqw / -1.6cqw
    image('hoku-672.png', -228, -19, 672, 672)
    + content.draw((CARD_HEIGHT - 48 - content.h) / 2)
    + textEl({ font: 'mono', size: addrSize, x: cx, y: baseline('mono', addrSize, addrSize, CARD_HEIGHT - 52.8 - addrSize), fill: C.t3, text: ADDRESS, anchor: 'middle', ls: 0.04 * addrSize }),
  )
}

/** Das Vorschaubild als SVG (1200 x 630), Logos als data-URI, Schriften über den Familiennamen. */
export function cardSvg(input) {
  const m = cardModel(input)
  clipId = 0
  if (m.kind === 'progress') return progressSvg(m)
  if (m.kind === 'fallback') return fallbackSvg(m)
  return neutralSvg(m.lang)
}
