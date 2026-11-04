import { describe, expect, it } from 'vitest'
import { BENUTZERNAME } from '../../src/features/auth/lib/pruefung'
import {
  cardMeta, cardModel, cardSvg, cardVersion, chooseCard, ellipsize, entriesText, escapeXml,
  fitName, isValidNickname, memberText, textWidth, wrapWords,
} from './profileCard.js'

const MARA = {
  lang: 'de', name: 'Mara K.', nickname: 'mara', avatar: null, tier: 30,
  member: { unit: 'months', n: 7 }, entryCount: 1240, webValueCount: 9, areas: ['koerper', 'training', 'erholung'],
  title: null, patternFeature: true, webLinkOn: true, private: false, found: true,
}
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex')

describe('chooseCard', () => {
  it.each([
    ['unbekannt', { found: false }, 'neutral'],
    ['Web-Link aus', { webLinkOn: false }, 'neutral'],
    ['privat', { private: true }, 'neutral'],
    ['privat ohne Stufe', { private: true, tier: null }, 'neutral'],
    ['Stufe da', {}, 'progress'],
    ['Stufe 100', { tier: 100 }, 'progress'],
    ['keine Stufe', { tier: null }, 'fallback'],
    ['Stufe außerhalb der Liste', { tier: 40 }, 'fallback'],
    ['Stufe als Text', { tier: '30' }, 'fallback'],
    ['ohne Bild, ohne Werte', { avatar: null, webValueCount: 0, tier: null }, 'fallback'],
  ])('%s → %s', (_, over, kind) => {
    expect(chooseCard({ ...MARA, ...over })).toBe(kind)
  })

  it('ohne Eingabe neutral', () => {
    expect(chooseCard(null)).toBe('neutral')
  })
})

describe('Texte', () => {
  it.each([
    [{ unit: 'days', n: 0 }, 'Seit heute dabei', 'Joined today'],
    [{ unit: 'days', n: 1 }, 'Seit 1 Tag dabei', 'Member for 1 day'],
    [{ unit: 'days', n: 30 }, 'Seit 30 Tagen dabei', 'Member for 30 days'],
    [{ unit: 'months', n: 1 }, 'Seit 1 Monat dabei', 'Member for 1 month'],
    [{ unit: 'months', n: 7 }, 'Seit 7 Monaten dabei', 'Member for 7 months'],
    [{ unit: 'years', n: 1 }, 'Seit 1 Jahr dabei', 'Member for 1 year'],
    [{ unit: 'years', n: 3 }, 'Seit 3 Jahren dabei', 'Member for 3 years'],
  ])('Mitgliedschaft %o', (member, de, en) => {
    expect(memberText('de', member)).toBe(de)
    expect(memberText('en', member)).toBe(en)
  })

  it('Mitgliedschaft ohne Daten oder Unsinn → keine Zeile', () => {
    for (const m of [null, { unit: 'weeks', n: 2 }, { unit: 'days', n: -1 }, { unit: 'days', n: 1.5 }]) {
      expect(memberText('de', m)).toBeNull()
    }
  })

  it.each([
    [1, '1 Eintrag', '1 entry'],
    [999, '999 Einträge', '999 entries'],
    [1240, '1.240 Einträge', '1,240 entries'],
    [1234567, '1.234.567 Einträge', '1,234,567 entries'],
  ])('Einträge %i', (n, de, en) => {
    expect(entriesText('de', n)).toBe(de)
    expect(entriesText('en', n)).toBe(en)
  })

  it('Einträge 0 oder null → keine Zeile', () => {
    expect(entriesText('de', 0)).toBeNull()
    expect(entriesText('de', null)).toBeNull()
  })
})

describe('cardMeta (Spec 3.3)', () => {
  it('Fortschritt de wie in der Spec', () => {
    expect(cardMeta(MARA)).toEqual({
      title: 'Mara K. auf Hoku: über 30 % positive Veränderung seit Start',
      description: 'Mara trackt 9 Werte mit Hoku: Körper, Training und Erholung & Fitness. Seit 7 Monaten dabei, 1.240 Einträge. Sieh dir Maras Profil an.',
      alt: 'Mara K. auf Hoku: trackt 9 Werte, über 30 % positive Veränderung seit Start',
    })
  })

  it('Fortschritt en', () => {
    expect(cardMeta({ ...MARA, lang: 'en' })).toEqual({
      title: 'Mara K. on Hoku: over 30% positive change since start',
      description: 'Mara tracks 9 values with Hoku: Body, Training and Recovery & fitness. Member for 7 months, 1,240 entries. See Mara’s profile.',
      alt: 'Mara K. on Hoku: tracks 9 values, over 30% positive change since start',
    })
  })

  it('Fortschritt mit Einzahl und einem Bereich', () => {
    const m = cardMeta({ ...MARA, webValueCount: 1, entryCount: 1, member: { unit: 'days', n: 1 }, areas: ['training'] })
    expect(m.description).toBe('Mara trackt 1 Wert mit Hoku: Training. Seit 1 Tag dabei, 1 Eintrag. Sieh dir Maras Profil an.')
    const en = cardMeta({ ...MARA, lang: 'en', webValueCount: 1, entryCount: 1, member: { unit: 'years', n: 1 }, areas: [] })
    expect(en.description).toBe('Mara tracks 1 value with Hoku. Member for 1 year, 1 entry. See Mara’s profile.')
  })

  it('Fortschritt ohne Zahlen: Sätze fallen weg, kein „null“', () => {
    const m = cardMeta({ ...MARA, webValueCount: null, entryCount: null, member: null, areas: [] })
    expect(m.description).toBe('Sieh dir Maras Profil an.')
    expect(m.alt).toBe('Mara K. auf Hoku: über 30 % positive Veränderung seit Start')
    expect(JSON.stringify(m)).not.toMatch(/null|undefined|NaN/)
  })

  it('Genitiv nach s, x, z', () => {
    expect(cardMeta({ ...MARA, name: 'Jonas' }).description).toMatch(/Sieh dir Jonas’ Profil an\.$/)
    expect(cardMeta({ ...MARA, name: 'Max B.' }).description).toMatch(/Sieh dir Max’ Profil an\.$/)
    expect(cardMeta({ ...MARA, name: 'Jonas', lang: 'en' }).description).toMatch(/See Jonas’ profile\.$/)
  })

  it('Rückfall de mit Musterfunktion', () => {
    expect(cardMeta({ ...MARA, tier: null })).toEqual({
      title: 'Mara K. auf Hoku · Mehr als nur Tracking.',
      description: 'Mara trackt 9 Werte mit Hoku. Du trackst. Hoku verbindet. Hokus intelligente Engine legt deine Werte übereinander und kann Muster finden, die du allein nicht gesehen hättest.',
      alt: 'Mara K. auf Hoku: Mehr als nur Tracking. Du trackst. Hoku verbindet.',
    })
  })

  it('Rückfall: Ersatztext ohne Musterfunktion, de und en', () => {
    expect(cardMeta({ ...MARA, tier: null, patternFeature: false }).description)
      .toBe('Mara trackt 9 Werte mit Hoku. Du trackst. Hoku verbindet. Hokus intelligente Engine legt deine Werte übereinander und zeigt dir, was sich seit deinem Start verändert hat.')
    expect(cardMeta({ ...MARA, tier: null, lang: 'en' })).toEqual({
      title: 'Mara K. on Hoku · More than just tracking.',
      description: 'Mara tracks 9 values with Hoku. You track. Hoku connects. Hoku’s smart engine layers your data and can find patterns you’d never have spotted on your own.',
      alt: 'Mara K. on Hoku: More than just tracking. You track. Hoku connects.',
    })
    expect(cardMeta({ ...MARA, tier: null, lang: 'en', patternFeature: false }).description)
      .toBe('Mara tracks 9 values with Hoku. You track. Hoku connects. Hoku’s smart engine layers your data and shows you what has changed since your start.')
  })

  it('Rückfall ohne Werte und ohne Namen: Nickname, kein Satz über Werte', () => {
    const m = cardMeta({ ...MARA, tier: null, webValueCount: null, name: null, nickname: 'mara.lifts' })
    expect(m.title).toBe('mara.lifts auf Hoku · Mehr als nur Tracking.')
    expect(m.description).toMatch(/^Du trackst\./)
  })

  it('Neutral: nichts über die Person, für alle vier Fälle gleich', () => {
    const cases = [{ found: false }, { webLinkOn: false }, { private: true }, { found: false, name: 'Anderer', nickname: 'x' }]
    const metas = cases.map(c => cardMeta({ ...MARA, ...c }))
    expect(metas[0]).toEqual({
      title: 'Hoku Health Hub',
      description: 'Sieh, wer du wirst. Du trackst. Hoku verbindet. Hokus intelligente Engine legt deine Werte übereinander und kann Muster finden, die du allein nicht gesehen hättest.',
      alt: 'Hoku Health Hub: Sieh, wer du wirst.',
    })
    for (const m of metas) expect(m).toEqual(metas[0])
    expect(JSON.stringify(metas)).not.toMatch(/Mara|mara|Anderer/)
    expect(cardMeta({ ...MARA, found: false, lang: 'en' }).description).toMatch(/^See who you’re becoming\. You track\. Hoku connects\./)
  })

  it('Sprache: alles außer de wird en', () => {
    expect(cardMeta({ ...MARA, lang: 'fr' }).title).toBe('Mara K. on Hoku: over 30% positive change since start')
  })

  it('Meta-Texte nennen nur, was die Karte zeigt: Blut, Einnahmen, Einträge auf Rückfall nie', () => {
    const all = { ...MARA, areas: ['koerper', 'blut', 'einnahmen', 'erholung'] }
    expect(cardMeta(all).description).toBe('Mara trackt 9 Werte mit Hoku: Körper und Erholung & Fitness. Seit 7 Monaten dabei, 1.240 Einträge. Sieh dir Maras Profil an.')
    const fb = cardMeta({ ...all, tier: null })
    expect(fb.description).not.toMatch(/Einträge|1\.240|Körper|Seit/)
  })
})

describe('Escape und Nickname', () => {
  it('maskiert & < > " \' und entfernt Steuerzeichen', () => {
    expect(escapeXml('<b>"Tom" & \'Jerry\'</b>')).toBe('&lt;b&gt;&quot;Tom&quot; &amp; &#39;Jerry&#39;&lt;/b&gt;')
    expect(escapeXml('a\u0000b\u0007c\u001Fd\uFFFEe')).toBe('abcde')
    expect(escapeXml('\uD800x')).toBe('x')
    expect(escapeXml('😀 Ä')).toBe('😀 Ä')
  })

  it('Name mit <&" steht im SVG nur maskiert', () => {
    for (const tier of [30, null]) {
      const svg = cardSvg({ ...MARA, tier, name: '<script>&"x"</script>', title: '<i>&' })
      expect(svg).not.toContain('<script>')
      expect(svg).not.toContain('<i>')
      expect(svg).toContain('&lt;script&gt;&amp;&quot;')
    }
  })

  it('isValidNickname wie BENUTZERNAME der Anmeldung', () => {
    for (const ok of ['mara', 'Mara.Lifts', 'a_b', 'abcdefghijklmnopqrst']) {
      expect(isValidNickname(ok), ok).toBe(true)
      expect(BENUTZERNAME.test(ok)).toBe(true)
    }
    for (const bad of ['ab', 'abcdefghijklmnopqrstu', 'mära', 'ma ra', 'a/b', '../x', 'a%2F', '', null, 42]) {
      expect(isValidNickname(bad), String(bad)).toBe(false)
      if (typeof bad === 'string') expect(BENUTZERNAME.test(bad)).toBe(false)
    }
  })
})

describe('Lange Namen', () => {
  it('Regel: bis 70 % verkleinern, dann „…“, nie breiter als die Spalte', () => {
    const fit = fitName('Maximiliane Wolkenstein-Hohenberg', 55.2, 360, -0.01)
    expect(fit.size).toBeCloseTo(55.2 * 0.7)
    expect(fit.text.endsWith('…')).toBe(true)
    expect(textWidth('disp', fit.size, fit.text, -0.01 * fit.size)).toBeLessThanOrEqual(360)
  })

  it('etwas zu lang: nur verkleinert, nicht gekürzt', () => {
    const w = textWidth('disp', 55.2, 'Christina Wagner', -0.552)
    expect(w).toBeGreaterThan(360)
    const fit = fitName('Christina Wagner', 55.2, 360, -0.01)
    expect(fit.text).toBe('Christina Wagner')
    expect(fit.size).toBeLessThan(55.2)
    expect(textWidth('disp', fit.size, fit.text, -0.01 * fit.size)).toBeLessThanOrEqual(360.01)
  })

  it('passt: unverändert', () => {
    expect(fitName('Mara K.', 55.2, 360, -0.01)).toEqual({ text: 'Mara K.', size: 55.2 })
  })

  it('ellipsize kürzt ohne Leerzeichen vor „…“', () => {
    const t = ellipsize('ui', 30, 'Gelegenheitsradler und Bergläufer', 300)
    expect(t.endsWith('…')).toBe(true)
    expect(t).not.toMatch(/ …$/)
    expect(textWidth('ui', 30, t)).toBeLessThanOrEqual(300)
  })

  it('Name im SVG auf beiden Karten gekürzt, Titel-Chip auch', () => {
    const long = { ...MARA, name: 'W'.repeat(60), title: 'Ü'.repeat(60) }
    for (const tier of [30, null]) {
      const svg = cardSvg({ ...long, tier })
      expect(svg).toContain('…')
      expect(svg).not.toContain('W'.repeat(30))
    }
  })

  it('Engine-Satz bricht wie im Mockup um', () => {
    const svg = cardSvg({ ...MARA, tier: null })
    for (const line of ['Hokus intelligente Engine legt', 'deine Werte übereinander und', 'kann Muster finden, die du allein', 'nicht gesehen hättest.']) {
      expect(svg).toContain(`>${line}</text>`)
    }
  })

  it('wrapWords: einzelnes letztes Wort holt eines dazu', () => {
    const m = cardModel({ ...MARA, tier: null })
    const lines = wrapWords('uiItalic', 27.6, m.engine, 300)
    expect(lines.at(-1)).toContain(' ')
    for (const l of lines) expect(textWidth('uiItalic', 27.6, l)).toBeLessThanOrEqual(300)
  })
})

describe('cardVersion', () => {
  const v = cardVersion(MARA)

  it('kurz und stabil', () => {
    expect(v).toMatch(/^[A-Za-z0-9_-]{10}$/)
    expect(cardVersion({ ...MARA })).toBe(v)
  })

  it.each([
    ['Sprache', { lang: 'en' }],
    ['Name', { name: 'Mara L.' }],
    ['Stufe', { tier: 50 }],
    ['Kartenart', { tier: null }],
    ['Mitgliedschaft', { member: { unit: 'months', n: 8 } }],
    ['Einträge', { entryCount: 1241 }],
    ['Werte', { webValueCount: 10 }],
    ['Bereiche', { areas: ['koerper'] }],
    ['Titel', { title: 'Routinier' }],
    ['Bild', { avatar: { png: PNG, id: 'obj-1' } }],
  ])('ändert sich mit %s', (_, over) => {
    expect(cardVersion({ ...MARA, ...over })).not.toBe(v)
  })

  it('Bild: andere Objekt-ID → andere Fassung; ohne ID zählen die Bytes', () => {
    const a = cardVersion({ ...MARA, avatar: { png: PNG, id: 'obj-1' } })
    expect(cardVersion({ ...MARA, avatar: { id: 'obj-1' } })).toBe(a)
    expect(cardVersion({ ...MARA, avatar: { png: PNG, id: 'obj-2' } })).not.toBe(a)
    const bytes = cardVersion({ ...MARA, avatar: { png: PNG } })
    expect(cardVersion({ ...MARA, avatar: { png: Buffer.concat([PNG, Buffer.from([1])]) } })).not.toBe(bytes)
  })

  it.each([
    ['Nickname bei vorhandenem Namen', { nickname: 'mara2' }],
    ['Leerraum im Namen', { name: '  Mara   K. ' }],
    ['Musterfunktion auf der Fortschrittskarte', { patternFeature: false }],
    ['Einträge auf der Rückfallkarte', { tier: null, entryCount: 5 }, { tier: null }],
    ['Bereiche auf der Rückfallkarte', { tier: null, areas: [] }, { tier: null }],
    ['Blut/Einnahmen in den Bereichen', { areas: ['koerper', 'training', 'erholung', 'blut', 'einnahmen'] }],
    ['Reihenfolge der Bereiche', { areas: ['erholung', 'koerper', 'training'] }],
    ['kein gültiges Bild', { avatar: { png: Buffer.from('nope') } }, { avatar: null }],
  ])('bleibt gleich bei %s', (_, over, base = {}) => {
    expect(cardVersion({ ...MARA, ...over })).toBe(cardVersion({ ...MARA, ...base }))
  })

  it('Rückfall: Musterfunktion steht im Bild, ändert die Fassung', () => {
    expect(cardVersion({ ...MARA, tier: null, patternFeature: false })).not.toBe(cardVersion({ ...MARA, tier: null }))
  })

  it('Neutral: eine Fassung je Sprache, egal wessen Daten', () => {
    const n = cardVersion({ ...MARA, found: false })
    expect(cardVersion({ ...MARA, webLinkOn: false, name: 'X' })).toBe(n)
    expect(cardVersion({ ...MARA, private: true, tier: null })).toBe(n)
    expect(cardVersion({ lang: 'de' })).toBe(n)
    expect(cardVersion({ lang: 'en' })).not.toBe(n)
  })
})

describe('cardSvg', () => {
  it('1200 x 630, Logos eingebettet, Schriften über den Namen', () => {
    for (const input of [MARA, { ...MARA, tier: null }, { ...MARA, found: false }]) {
      const svg = cardSvg(input)
      expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="1200" height="630" viewBox="0 0 1200 630">/)
      expect(svg).toContain('href="data:image/png;base64,')
      expect(svg).not.toMatch(/href="(?!data:)/)
      expect(svg).toContain('font-family="Space Grotesk"')
    }
  })

  it('Profilbild nur als geprüftes PNG/JPEG, sonst Initiale', () => {
    const withImg = cardSvg({ ...MARA, avatar: { png: PNG } })
    expect(withImg).toContain(`href="data:image/png;base64,${PNG.toString('base64')}"`)
    const broken = cardSvg({ ...MARA, avatar: { png: Buffer.from('<svg onload=alert(1)>') } })
    expect(broken).not.toContain('onload')
    expect(broken).toMatch(/text-anchor="middle">M<\/text>/)
  })

  it('Initiale: erster Buchstabe, groß', () => {
    expect(cardSvg({ ...MARA, name: '„élodie“' })).toMatch(/text-anchor="middle">É<\/text>/)
  })

  it('Neutral zeigt nichts von der Person', () => {
    const svg = cardSvg({ ...MARA, private: true, avatar: { png: PNG } })
    expect(svg).not.toMatch(/Mara|trackt|Seit|Einträge/)
    expect(svg).not.toContain(PNG.toString('base64'))
    expect(svg).toContain('Sieh, wer du wirst.')
    expect(svg).toBe(cardSvg({ lang: 'de', found: false }))
  })

  it('Fortschritt: Zeilen ohne Daten fehlen, die Trennlinie auch', () => {
    const svg = cardSvg({ ...MARA, member: null, entryCount: null, webValueCount: null, areas: [] })
    expect(svg).not.toMatch(/Seit|Einträge|trackt|Körper/)
    expect(svg).toContain('positive Veränderung seit Start')
    expect(svg.match(/height="1\.2"/g)).toBeNull()
  })

  it('Rückfall: keine Einträge, keine Bereiche, kein Fortschritt', () => {
    const svg = cardSvg({ ...MARA, tier: null })
    expect(svg).not.toMatch(/Einträge|Körper|%/)
    expect(svg).toContain('Seit 7 Monaten dabei')
    expect(svg).toContain('>Hoku verbindet.<')
    expect(svg).toContain('kann Muster finden')
    expect(cardSvg({ ...MARA, tier: null, patternFeature: false })).toMatch(/zeigt dir,.*verändert hat\.<\/text>/)
  })
})
