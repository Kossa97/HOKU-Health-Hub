// Rastert die Link-Karten mit resvg und den Schriften aus dem Funktionspaket.
// Die PNGs landen in `test-results/profile-card/` (gitignored) zum Ansehen;
// verglichen wurde mit dem Mockup `docs/profil/mockups/profil-2c-karten-auswahl.html`.

import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'
import { describe, expect, it } from 'vitest'
import { CARD_HEIGHT, CARD_WIDTH, cardFontFiles, cardSvg, escapeXml, textWidth } from './profileCard.js'

const OUT = fileURLToPath(new URL('../../test-results/profile-card/', import.meta.url))

const FONT = { fontFiles: cardFontFiles(), loadSystemFonts: false, defaultFontFamily: 'Inter' }

function render(svg) {
  return new Resvg(svg, { font: FONT, fitTo: { mode: 'original' } }).render()
}

// Ein Profilbild ohne Fremddatei: zwei Flächen, von resvg selbst gerastert.
const AVATAR = render(`<svg xmlns="http://www.w3.org/2000/svg" width="360" height="360"><rect width="360" height="360" fill="#c98b5f"/><circle cx="180" cy="150" r="70" fill="#f1d3b8"/><rect x="60" y="240" width="240" height="160" rx="120" fill="#33465c"/></svg>`).asPng()

const MARA = {
  lang: 'de', name: 'Mara K.', nickname: 'mara', avatar: null, tier: 30,
  member: { unit: 'months', n: 7 }, entryCount: 1240, webValueCount: 9, areas: ['koerper', 'training', 'erholung'],
  title: null, patternFeature: true, webLinkOn: true, private: false, found: true,
}

const CASES = {
  'fortschritt-de': MARA,
  'fortschritt-en': { ...MARA, lang: 'en' },
  'fortschritt-titel-bild': { ...MARA, title: 'Routinier', avatar: { png: AVATAR, id: 'a1' } },
  'fortschritt-leer': { ...MARA, member: null, entryCount: null, webValueCount: null, areas: [] },
  'fortschritt-langer-name': { ...MARA, name: 'Maximiliane Wolkenstein-Hohenberg', tier: 100, member: { unit: 'years', n: 1 }, entryCount: 1, webValueCount: 1, areas: ['erholung'] },
  'fortschritt-zwei-namen': { ...MARA, name: 'Christina Wagner', member: { unit: 'days', n: 12 }, entryCount: 18450, webValueCount: 23 },
  'rueckfall-de': { ...MARA, tier: null },
  'rueckfall-zwei-namen-en': { ...MARA, tier: null, lang: 'en', name: 'Christina Wagner', member: { unit: 'months', n: 11 }, webValueCount: 1, title: 'Weekend warrior extraordinaire' },
  'rueckfall-en': { ...MARA, tier: null, lang: 'en' },
  'rueckfall-ersatz': { ...MARA, tier: null, patternFeature: false },
  'rueckfall-titel-bild': { ...MARA, tier: null, title: 'Gelegenheitsradler', avatar: { png: AVATAR } },
  'rueckfall-leer': { ...MARA, tier: null, member: null, webValueCount: null, name: null, nickname: 'x_y' },
  'rueckfall-escape': { ...MARA, tier: null, name: '<b>"Tom & Jerry"</b>\u0007' },
  // Titel-Chip (Spec Titel 4/5, Mockup `profil-titel.html` › Link-Karte): kurz und längster Name
  'titel-fortschritt-de-kurz': { ...MARA, title: 'Läufer' },
  'titel-fortschritt-de-lang': { ...MARA, title: 'Trainingsmaschine', avatar: { png: AVATAR } },
  'titel-fortschritt-en-kurz': { ...MARA, lang: 'en', title: 'Runner' },
  'titel-fortschritt-en-lang': { ...MARA, lang: 'en', title: 'Year-Round Athlete', name: 'Christina Wagner' },
  'titel-rueckfall-de-kurz': { ...MARA, tier: null, title: 'Routinier' },
  'titel-rueckfall-de-lang': { ...MARA, tier: null, title: 'Gelegenheitsradler', name: 'Christina Wagner' },
  'titel-rueckfall-en-kurz': { ...MARA, tier: null, lang: 'en', title: 'Steady' },
  'titel-rueckfall-en-lang': { ...MARA, tier: null, lang: 'en', title: 'Year-Round Athlete', avatar: { png: AVATAR } },
  'neutral-de': { ...MARA, webLinkOn: false },
  'neutral-en': { ...MARA, found: false, lang: 'en' },
}

describe('Link-Karte gerastert', () => {
  mkdirSync(OUT, { recursive: true })

  for (const [name, input] of Object.entries(CASES)) {
    it(`${name}: 1200 x 630`, () => {
      const png = render(cardSvg(input))
      expect([png.width, png.height]).toEqual([CARD_WIDTH, CARD_HEIGHT])
      writeFileSync(`${OUT}${name}.png`, png.asPng())
    })
  }

  it('Breitenmessung liegt nah an dem, was resvg setzt', () => {
    const samples = [
      ['disp', 55.2, 'Mara K.'],
      ['disp', 120, '30 %'],
      ['ui', 31.2, 'Körper · Training · Erholung & Fitness'],
      ['uiItalic', 27.6, 'Hokus intelligente Engine legt'],
      ['mono', 24, 'ÜBER HOKU'],
    ]
    const family = {
      disp: 'font-family="Space Grotesk" font-weight="600"',
      ui: 'font-family="Inter" font-weight="500"',
      uiItalic: 'font-family="Inter" font-weight="500" font-style="italic"',
      mono: 'font-family="IBM Plex Mono" font-weight="500"',
    }
    for (const [font, size, text] of samples) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="200"><text x="0" y="150" ${family[font]} font-size="${size}">${escapeXml(text)}</text></svg>`
      const box = new Resvg(svg, { font: FONT }).getBBox()
      // Leerraum vor/nach den Glyphen fehlt in der Box: grob 6 % Spielraum
      expect(Math.abs(textWidth(font, size, text) - box.width) / box.width, text).toBeLessThan(0.06)
    }
  })
})
