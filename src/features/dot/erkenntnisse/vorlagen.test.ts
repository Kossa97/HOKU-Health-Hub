import { describe, expect, it } from 'vitest'
import type { Fund, FundId } from '../../../../supabase/functions/_shared/erkenntnisse/typen.ts'
import { pruefeText } from '../../../../supabase/functions/_shared/erkenntnisse/waechter.ts'
import { FUND_IDS } from './erkenntnisseService'
import { TEXTE } from './texte'
import { datumsSpanne, fundText, wochenSpanne } from './vorlagen'

const zeitraum = { von: '2026-09-21', bis: '2026-11-01' }

function vergleich(id: 'H1' | 'E2' | 'W1', werte: Fund['werte']): Fund {
  return { id, schluessel: `${id}:${String(werte.gruppe_a)}`, bezug: null, richtung: 'neutral', datenlage: 'deutlich', staerke: 0.5, zeitraum, werte }
}

const h1VorGrenze = vergleich('H1', { gruppe_a: 'vor_grenze', gruppe_b: 'ab_grenze', mittel_a: 431, mittel_b: 381, n_a: 11, n_b: 9, differenz: 50, einheit: 'min', grenze: 21 })
const h1AbGrenze = vergleich('H1', { gruppe_a: 'ab_grenze', gruppe_b: 'vor_grenze', mittel_a: 440, mittel_b: 415, n_a: 8, n_b: 14, differenz: 25, einheit: 'min', grenze: 21 })
const e2Mehr = vergleich('E2', { gruppe_a: 'trainingstag', gruppe_b: 'ruhetag', mittel_a: 152, mittel_b: 118, n_a: 12, n_b: 16, differenz: 34, einheit: 'g' })
const e2Weniger = vergleich('E2', { gruppe_a: 'trainingstag', gruppe_b: 'ruhetag', mittel_a: 101, mittel_b: 124, n_a: 10, n_b: 18, differenz: -23, einheit: 'g' })
// Umgekehrte Gruppenreihenfolge: Ruhetage als Gruppe a.
const e2Umgekehrt = vergleich('E2', { gruppe_a: 'ruhetag', gruppe_b: 'trainingstag', mittel_a: 130, mittel_b: 110, n_a: 15, n_b: 9, differenz: 20, einheit: 'g' })
const w1Ab = vergleich('W1', { gruppe_a: 'schlaf_ab_grenze', gruppe_b: 'schlaf_unter_grenze', mittel_a: 7.4, mittel_b: 6.2, n_a: 13, n_b: 10, differenz: 1.2, einheit: 'punkte', grenze: 7 })
const w1Unter = vergleich('W1', { gruppe_a: 'schlaf_unter_grenze', gruppe_b: 'schlaf_ab_grenze', mittel_a: 6.9, mittel_b: 5.8, n_a: 9, n_b: 11, differenz: 1.1, einheit: 'punkte', grenze: 7 })
const t7: Fund = { id: 'T7', schluessel: 'T7:tagebuch:14:2026-10-19',bezug: null, richtung: 'positiv', datenlage: 'deutlich', staerke: 0.6, zeitraum, werte: { tage: 14 } }
const r4: Fund = { id: 'R4', schluessel: 'R4:squat_barbell:102.5', bezug: 'squat_barbell', richtung: 'positiv', datenlage: 'deutlich', staerke: 0.7, zeitraum, werte: { kg: 102.5, vorher: 97.5 } }

const BEISPIELFUNDE: Fund[] = [h1VorGrenze, h1AbGrenze, e2Mehr, e2Weniger, e2Umgekehrt, w1Ab, w1Unter, t7, r4]
const namen = { uebung: () => 'Kniebeuge' }

describe('Erkenntnisse: Vorlagen', () => {
  it('Beispielfunde decken jede FundId ab', () => {
    expect([...new Set(BEISPIELFUNDE.map(f => f.id))].sort()).toEqual([...FUND_IDS].sort() as FundId[])
  })

  it('jede Vorlage besteht den Regelwächter, beide Sprachen, beide Reihenfolgen und Vorzeichen', () => {
    for (const f of BEISPIELFUNDE) for (const s of ['de', 'en'] as const) {
      const t = fundText(f, s, namen)
      expect(pruefeText(`${t.satz} ${t.beleg}`, s, f), `${s} ${f.schluessel}`).toEqual({ ok: true, verstoesse: [] })
      expect(pruefeText(`${t.titel} ${t.satz} ${t.beleg}`, s, f), `${s} ${f.schluessel} mit Titel`).toEqual({ ok: true, verstoesse: [] })
      expect(t.titel.trim()).not.toBe('')
      expect(`${t.titel}${t.satz}${t.beleg}`).not.toMatch(/\{\{|undefined|NaN/)
    }
  })

  it('Wortlaut der deutschen Vorlagen', () => {
    expect(fundText(h1VorGrenze, 'de', namen).satz).toBe('Wenn du vor 21 Uhr trainierst, schläfst du in der Nacht danach im Schnitt 50 min länger.')
    expect(fundText(h1AbGrenze, 'de', namen).satz).toBe('Wenn du ab 21 Uhr trainierst, schläfst du in der Nacht danach im Schnitt 25 min länger.')
    expect(fundText(h1VorGrenze, 'de', namen).beleg).toBe('11 gegen 9 Trainingstage, 431 gegen 381 min. Zusammenhang, kein Beweis.')
    expect(fundText(e2Mehr, 'de', namen).satz).toBe('An Trainingstagen isst du im Schnitt 34 g mehr Protein als an Ruhetagen.')
    expect(fundText(e2Weniger, 'de', namen).satz).toContain('weniger Protein')
    expect(fundText(e2Weniger, 'de', namen).satz).toContain(' 23 g ')
    expect(fundText(e2Umgekehrt, 'de', namen).satz).toBe('An Trainingstagen isst du im Schnitt 20 g weniger Protein als an Ruhetagen.')
    expect(fundText(w1Ab, 'de', namen).satz).toBe('Nach Nächten ab 7 h trägst du im Schnitt 1,2 Punkte mehr Energie ein.')
    expect(fundText(w1Unter, 'de', namen).satz).toBe('Nach Nächten unter 7 h trägst du im Schnitt 1,1 Punkte mehr Energie ein.')
    expect(fundText(t7, 'de', namen).satz).toBe('14 Tage am Stück Tagebuch geführt.')
    expect(fundText(r4, 'de', namen).satz).toBe('Neuer Rekord bei Kniebeuge: geschätzt 102,5 kg (vorher 97,5 kg).')
  })

  it('Beleg der Vergleichsfunde endet mit dem Pflichtsatz', () => {
    for (const f of [h1VorGrenze, e2Weniger, w1Unter]) {
      expect(fundText(f, 'de', namen).beleg.endsWith('Zusammenhang, kein Beweis.')).toBe(true)
      expect(fundText(f, 'en', namen).beleg.endsWith('A connection, not proof.')).toBe(true)
    }
  })

  it('R4 holt den Übungsnamen über die Kennung', () => {
    const gesehen: string[] = []
    const t = fundText(r4, 'en', { uebung: id => { gesehen.push(id); return 'Back Squat' } })
    expect(gesehen).toEqual(['squat_barbell'])
    expect(t.satz).toContain('Back Squat')
    expect(t.satz).toContain('102.5 kg')
  })

  it('R4: Name, an dem der Regelwächter hängen bleibt, fällt weg (Ziffern im Katalognamen, Wächterwort im eigenen)', () => {
    const faelle: [string, string][] = [
      ['HYROX Wall Balls (100 reps)', 'en'],
      ['HYROX Wall Balls (100 Wdh.)', 'de'],
      ['Safe Squat', 'en'],
      ['Sicher-Kniebeuge', 'de'],
      ['Kniebeuge sicher', 'de'],
    ]
    for (const [name, s] of faelle as [string, 'de' | 'en'][]) {
      const t = fundText(r4, s, { uebung: () => name })
      expect(t.satz, name).not.toContain(name)
      expect(pruefeText(`${t.satz} ${t.beleg}`, s, r4), name).toEqual({ ok: true, verstoesse: [] })
    }
    expect(fundText(r4, 'de', { uebung: () => 'HYROX Wall Balls (100 Wdh.)' }).satz).toBe('Neuer Rekord: geschätzt 102,5 kg (vorher 97,5 kg).')
    expect(fundText(r4, 'en', { uebung: () => 'Safe Squat' }).satz).toBe('New record: an estimated 102.5 kg (previously 97.5 kg).')
  })

  it('R4: unauffälliger Name bleibt im Satz', () => {
    expect(fundText(r4, 'en', { uebung: () => 'Bench Press' }).satz).toBe('New record in Bench Press: an estimated 102.5 kg (previously 97.5 kg).')
  })

  it('Wochenspanne zeigt die gezählten Tage: Sonntag davor bis Samstag (woche − 7 … woche − 1)', () => {
    // 2026-11-08 ist ein Sonntag; tage_eingeflossen zählt 1.–7. November
    expect(wochenSpanne('2026-11-08', 'de')).toBe(datumsSpanne('2026-11-01', '2026-11-07', 'de', false))
    expect(wochenSpanne('2026-11-08', 'en')).toBe(datumsSpanne('2026-11-01', '2026-11-07', 'en', false))
    expect(wochenSpanne('2026-11-08', 'de')).toMatch(/^1\. Nov\.? – 7\. Nov\.?$/)
  })

  it('Texte: de und en haben dieselben Schlüssel', () => {
    expect(Object.keys(TEXTE.de).sort()).toEqual(Object.keys(TEXTE.en).sort())
  })
})
