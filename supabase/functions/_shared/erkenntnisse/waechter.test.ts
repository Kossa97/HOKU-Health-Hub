import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PFLICHTSATZ, pruefeText } from './waechter.ts'
import type { Fund } from './typen.ts'

function fund(teil: Partial<Fund> = {}): Fund {
  return {
    id: 'H1',
    schluessel: 'test',
    bezug: null,
    richtung: 'positiv',
    datenlage: 'hinweis',
    staerke: 0.5,
    zeitraum: { von: '2026-10-01', bis: '2026-10-31' },
    werte: {},
    ...teil,
  }
}

describe('erkenntnisse: Regelwächter (Beispiele aus dem Plan)', () => {
  const f = fund({ richtung: 'neutral', werte: { mittel_a: 470, mittel_b: 420, differenz: 50, grenze: 21 } })

  it('lässt einen sauberen Satz mit Pflichtsatz durch', () => {
    const r = pruefeText('Wenn du vor 21 Uhr trainierst, schläfst du im Schnitt 50 min länger. Zusammenhang, kein Beweis.', 'de', f)
    expect(r).toEqual({ ok: true, verstoesse: [] })
  })

  it('wirkung', () => {
    expect(pruefeText('Training vor 21 Uhr hilft deinem Schlaf. Zusammenhang, kein Beweis.', 'de', f).verstoesse).toContain('wirkung')
  })

  it('kausal', () => {
    expect(pruefeText('Du schläfst 50 min länger, weil du früher trainierst. Zusammenhang, kein Beweis.', 'de', f).verstoesse).toContain('kausal')
  })

  it('zahl, die nicht im Fund steht', () => {
    expect(pruefeText('Du schläfst 55 min länger. Zusammenhang, kein Beweis.', 'de', f).verstoesse).toContain('zahl:55')
  })

  it('pflichtsatz bei neutralem Fund', () => {
    expect(pruefeText('Du schläfst 50 min länger.', 'de', f).verstoesse).toContain('pflichtsatz')
  })

  it('einheit, befehl und zahl ohne Fund', () => {
    expect(pruefeText('Nimm 250 mcg am Abend.', 'de', null).verstoesse).toEqual(expect.arrayContaining(['einheit', 'befehl', 'zahl:250']))
  })

  it('alarm und diagnose', () => {
    expect(pruefeText('Achtung: Mangel möglich.', 'de', null).verstoesse).toEqual(expect.arrayContaining(['alarm', 'diagnose']))
  })

  it('englisch: wirkung und kausal', () => {
    expect(pruefeText('This works because you train early.', 'en', null).verstoesse).toEqual(expect.arrayContaining(['wirkung', 'kausal']))
  })

  it('„Start“ ist kein Befehl', () => {
    expect(pruefeText('Seit dem Start trägst du mehr ein.', 'de', null).ok).toBe(true)
  })

  it('Zahl aus dem Fund ist erlaubt', () => {
    expect(pruefeText('Du bist 14 Tage dabei.', 'de', fund({ richtung: 'positiv', werte: { tage: 14 } })).ok).toBe(true)
  })
})

describe('erkenntnisse: Regelwächter (Entscheidungen)', () => {
  it('PFLICHTSATZ steht in beiden Sprachen fest', () => {
    expect(PFLICHTSATZ).toEqual({ de: 'Zusammenhang, kein Beweis.', en: 'A connection, not proof.' })
  })

  it('zahl: Betrag zählt, damit „20 g weniger“ bei differenz -20 passt', () => {
    const f = fund({ werte: { differenz: -20 } })
    expect(pruefeText('Du isst 20 g weniger.', 'de', f).ok).toBe(true)
    expect(pruefeText('Du isst 21 g weniger.', 'de', f).verstoesse).toEqual(['zahl:21'])
  })

  it('zahl: deutsches Komma gegen Dezimalwert, Kennung mit Punkt', () => {
    const f = fund({ werte: { rate: 0.8 } })
    expect(pruefeText('Das sind 0,8 Einträge pro Tag.', 'de', f).ok).toBe(true)
    expect(pruefeText('Das sind 0,9 Einträge pro Tag.', 'de', f).verstoesse).toEqual(['zahl:0.9'])
  })

  it('zahl: Textwerte im Fund zählen nicht', () => {
    expect(pruefeText('Das sind 14 Tage.', 'de', fund({ werte: { tage: '14' } })).verstoesse).toEqual(['zahl:14'])
  })

  it('zahl: jede Ziffernfolge zählt, auch in „B12“; doppelte nur einmal, in Textreihenfolge', () => {
    expect(pruefeText('Vitamin B12 und 7 und 3 und 7.', 'de', fund()).verstoesse).toEqual(['zahl:12', 'zahl:7', 'zahl:3'])
  })

  it('Umlaut-Wortgrenzen: Störung, gefährlich, führt zu, erhöhe', () => {
    expect(pruefeText('Eine Störung.', 'de', null).verstoesse).toEqual(['diagnose'])
    expect(pruefeText('Das ist gefährlich.', 'de', null).verstoesse).toEqual(['alarm'])
    expect(pruefeText('Das führt zu Schlaf.', 'de', null).verstoesse).toEqual(['kausal'])
    expect(pruefeText('Erhöhe es.', 'de', null).verstoesse).toEqual(['befehl'])
    expect(pruefeText('Du reduzierst es.', 'de', null).verstoesse).toEqual(['befehl'])
  })

  it('Wortgrenzen: Teilwörter lösen nichts aus', () => {
    expect(pruefeText('Das Sicherheitsgefühl und die Mangelware.', 'de', null).ok).toBe(true)
    expect(pruefeText('A tradeoff in the starter plan.', 'en', null).ok).toBe(true)
  })

  it('Groß- und Kleinschreibung ist egal', () => {
    expect(pruefeText('WEIL du trainierst.', 'de', null).verstoesse).toEqual(['kausal'])
  })

  it('befehl: setz … ab, auch „setz es ab“, nur im selben Satz', () => {
    expect(pruefeText('Setz es ab.', 'de', null).verstoesse).toEqual(['befehl'])
    expect(pruefeText('Setz das Ziel. Ab Montag.', 'de', null).ok).toBe(true)
  })

  it('befehl: mehrteilige Wendungen und englische Formen', () => {
    expect(pruefeText('Nehmen Sie es.', 'de', null).verstoesse).toEqual(['befehl'])
    expect(pruefeText('Stop taking it.', 'en', null).verstoesse).toEqual(['befehl'])
    expect(pruefeText('Start taking it.', 'en', null).verstoesse).toEqual(['befehl'])
    expect(pruefeText('Combine them.', 'en', null).verstoesse).toEqual(['befehl'])
    expect(pruefeText('This leads to sleep, due to training.', 'en', null).verstoesse).toEqual(['kausal'])
    expect(pruefeText('It is good for you and safe.', 'en', null).verstoesse).toEqual(['wirkung'])
  })

  it('einheit: nur Zahl plus Einheit, mit oder ohne Leerzeichen', () => {
    expect(pruefeText('5mg', 'en', fund({ werte: { n: 5 } })).verstoesse).toEqual(['einheit'])
    expect(pruefeText('5 IU', 'en', fund({ werte: { n: 5 } })).verstoesse).toEqual(['einheit'])
    expect(pruefeText('2 Einheiten', 'de', fund({ werte: { n: 2 } })).verstoesse).toEqual(['einheit'])
    expect(pruefeText('5 Tage', 'de', fund({ werte: { n: 5 } })).ok).toBe(true)
    expect(pruefeText('5 minutes', 'en', fund({ werte: { n: 5 } })).ok).toBe(true)
  })

  it('Reihenfolge der Kennungen und jede Kategorie höchstens einmal', () => {
    const r = pruefeText('Nimm 5 mg, nimm 6 mg. Achtung! Mangel, weil Gefahr.', 'de', fund({ richtung: 'neutral' }))
    expect(r.ok).toBe(false)
    expect(r.verstoesse).toEqual(['einheit', 'befehl', 'diagnose', 'kausal', 'alarm', 'zahl:5', 'zahl:6', 'pflichtsatz'])
  })

  it('pflichtsatz nur bei neutral und je Sprache', () => {
    expect(pruefeText('Ein Satz.', 'de', fund({ richtung: 'kritisch' })).ok).toBe(true)
    expect(pruefeText('A sentence. A connection, not proof.', 'en', fund({ richtung: 'neutral' })).ok).toBe(true)
    expect(pruefeText('A sentence. Zusammenhang, kein Beweis.', 'en', fund({ richtung: 'neutral' })).verstoesse).toEqual(['pflichtsatz'])
  })
})

describe('erkenntnisse: Regelwächter (iOS-Verträglichkeit)', () => {
  it('der Quelltext enthält kein Lookbehind (iOS 15 bis 16.3 würde beim Laden abstürzen)', () => {
    const quelltext = readFileSync(new URL('./waechter.ts', import.meta.url), 'utf8')
    expect(quelltext).not.toContain('(?<')
  })
})
