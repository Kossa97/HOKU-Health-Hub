import { describe, expect, it } from 'vitest'
import type { BloodworkEntry } from '../types'
import { normalizeMarker } from './markerCatalog'
import {
  AUFFAELLIG,
  auffaelligeWerte,
  buildMarkerSummaries,
  roundConverted,
  computeTrend,
  effectiveRange,
  entryInRange,
  filterByKategorie,
  isInRange,
  sortSummaries,
  toNumber,
  ungepruefteWerte,
} from './bloodwork'

const entry = (over: Partial<BloodworkEntry> = {}): BloodworkEntry => ({
  id: 'e1',
  user_id: 'u1',
  tested_at: '2026-07-01',
  marker: 'Testosteron',
  value: 600,
  unit: 'ng/dL',
  notes: null,
  created_at: null,
  report_id: null,
  ref_min: null,
  ref_max: null,
  ...over,
})

describe('toNumber', () => {
  it('wandelt Strings in Zahlen um', () => {
    expect(toNumber('12.5')).toBe(12.5)
  })

  it('gibt Zahlen unverändert zurück', () => {
    expect(toNumber(7)).toBe(7)
  })
})

describe('effectiveRange', () => {
  it('bevorzugt die Labor-Referenz am Eintrag', () => {
    const def = normalizeMarker('Testosteron')
    const range = effectiveRange(entry({ ref_min: 300, ref_max: 1000 }), def)
    expect(range).toEqual({ min: 300, max: 1000, source: 'lab' })
  })

  it('nutzt den Katalog, wenn keine Labor-Referenz vorliegt', () => {
    const def = normalizeMarker('Testosteron')
    const range = effectiveRange(entry(), def)
    expect(range).toEqual({ min: 400, max: 900, source: 'catalog' })
  })

  it('akzeptiert eine einseitige Labor-Referenz', () => {
    const def = normalizeMarker('Testosteron')
    const range = effectiveRange(entry({ ref_max: 1000 }), def)
    expect(range).toEqual({ min: null, max: 1000, source: 'lab' })
  })

  it('meldet "none" für Custom-Marker ohne Labor-Referenz', () => {
    const range = effectiveRange(entry({ marker: 'Phantasiewert' }), null)
    expect(range).toEqual({ min: null, max: null, source: 'none' })
  })

  it('nutzt die Labor-Referenz auch für Custom-Marker', () => {
    const range = effectiveRange(entry({ marker: 'Phantasiewert', ref_min: 1, ref_max: 9 }), null)
    expect(range).toEqual({ min: 1, max: 9, source: 'lab' })
  })

  it('übernimmt einen einseitigen Katalog-Bereich', () => {
    const range = effectiveRange(entry({ marker: 'CRP' }), normalizeMarker('CRP'))
    expect(range).toEqual({ min: null, max: 5, source: 'catalog' })
  })

  it('meldet "none" ohne Eintrag und ohne Katalog-Definition', () => {
    expect(effectiveRange(null, null)).toEqual({ min: null, max: null, source: 'none' })
  })
})

describe('isInRange', () => {
  it('erkennt einen Wert im Bereich', () => {
    expect(isInRange(500, { min: 400, max: 900, source: 'catalog' })).toBe(true)
  })

  it('erkennt einen zu niedrigen Wert', () => {
    expect(isInRange(300, { min: 400, max: 900, source: 'catalog' })).toBe(false)
  })

  it('erkennt einen zu hohen Wert', () => {
    expect(isInRange(1000, { min: 400, max: 900, source: 'catalog' })).toBe(false)
  })

  it('prüft nur die Obergrenze, wenn keine Untergrenze existiert', () => {
    expect(isInRange(0.5, { min: null, max: 1, source: 'catalog' })).toBe(true)
    expect(isInRange(2, { min: null, max: 1, source: 'catalog' })).toBe(false)
  })

  it('gibt null zurück, wenn kein Referenzbereich existiert', () => {
    expect(isInRange(500, { min: null, max: null, source: 'none' })).toBeNull()
  })
})

describe('computeTrend', () => {
  it('gibt null bei weniger als zwei Werten zurück', () => {
    expect(computeTrend([entry()])).toEqual({ trend: null, diff: 0 })
  })

  it('erkennt einen steigenden Trend (neuester Eintrag zuerst)', () => {
    const result = computeTrend([
      entry({ id: 'neu', tested_at: '2026-07-01', value: 700 }),
      entry({ id: 'alt', tested_at: '2026-01-01', value: 500 }),
    ])
    expect(result).toEqual({ trend: 'up', diff: 200 })
  })

  it('erkennt einen fallenden Trend', () => {
    const result = computeTrend([
      entry({ id: 'neu', value: 400 }),
      entry({ id: 'alt', value: 600 }),
    ])
    expect(result).toEqual({ trend: 'down', diff: -200 })
  })

  it('erkennt einen gleichbleibenden Wert', () => {
    expect(computeTrend([entry({ value: 500 }), entry({ id: 'alt', value: 500 })]).trend).toBe('same')
  })
})

describe('buildMarkerSummaries', () => {
  it('legt für jeden Katalog-Marker eine Zusammenfassung an', () => {
    const summaries = buildMarkerSummaries([])
    expect(summaries.length).toBeGreaterThan(50)
    expect(summaries.every(s => s.latest === null)).toBe(true)
  })

  it('sortiert die Einträge eines Markers absteigend nach Datum', () => {
    const summaries = buildMarkerSummaries([
      entry({ id: 'alt', tested_at: '2026-01-01', value: 500 }),
      entry({ id: 'neu', tested_at: '2026-07-01', value: 700 }),
    ])
    const testo = summaries.find(s => s.name === 'Testosteron')!
    expect(testo.latest?.id).toBe('neu')
    expect(testo.entries.map(e => e.id)).toEqual(['neu', 'alt'])
  })

  it('führt unbekannte Marker als Custom-Marker unter "Sonstige"', () => {
    const summaries = buildMarkerSummaries([entry({ marker: 'Phantasiewert', ref_max: 10 })])
    const custom = summaries.find(s => s.name === 'Phantasiewert')!
    expect(custom.def).toBeNull()
    expect(custom.kategorie).toBe('Sonstige')
    expect(custom.range).toEqual({ min: null, max: 10, source: 'lab' })
  })

  it('bewertet den letzten Wert gegen die effektive Referenz', () => {
    const summaries = buildMarkerSummaries([entry({ value: 1200 })])
    const testo = summaries.find(s => s.name === 'Testosteron')!
    expect(testo.inRange).toBe(false)
  })

  it('ordnet einen Synonym-Eintrag dem kanonischen Marker zu', () => {
    const summaries = buildMarkerSummaries([entry({ marker: 'Gesamttestosteron', value: 700 })])
    const testo = summaries.find(s => s.name === 'Testosteron')!
    expect(testo.latest?.value).toBe(700)
    expect(summaries.find(s => s.name === 'Gesamttestosteron')).toBeUndefined()
  })
})

describe('filterByKategorie', () => {
  it('gibt bei null alle Marker zurück', () => {
    const summaries = buildMarkerSummaries([])
    expect(filterByKategorie(summaries, null)).toHaveLength(summaries.length)
  })

  it('filtert auf eine Kategorie', () => {
    const summaries = filterByKategorie(buildMarkerSummaries([]), 'Schilddrüse')
    expect(summaries.map(s => s.name).sort()).toEqual(['TSH', 'fT3', 'fT4'].sort())
  })

  it('filtert Custom-Marker unter "Sonstige"', () => {
    const summaries = buildMarkerSummaries([entry({ marker: 'Phantasiewert' })])
    expect(filterByKategorie(summaries, 'Sonstige').map(s => s.name)).toEqual(['Phantasiewert'])
  })
})

describe('sortSummaries', () => {
  const summaries = buildMarkerSummaries([
    entry({ id: 'a', marker: 'Testosteron', tested_at: '2026-01-01', value: 1200 }),
    entry({ id: 'b', marker: 'Ferritin', tested_at: '2026-07-01', value: 100, unit: 'ng/mL' }),
  ])

  it('sortiert nach Name', () => {
    const names = sortSummaries(summaries, 'name').map(s => s.name)
    expect(names.indexOf('Albumin')).toBeLessThan(names.indexOf('Zink'))
  })

  it('sortiert nach zuletzt getestet, ungetestete zuletzt', () => {
    const sorted = sortSummaries(summaries, 'zuletzt')
    expect(sorted[0].name).toBe('Ferritin')
    expect(sorted[1].name).toBe('Testosteron')
    expect(sorted[2].latest).toBeNull()
  })

  it('sortiert auffällige Werte nach vorn', () => {
    const sorted = sortSummaries(summaries, 'status')
    expect(sorted[0].name).toBe('Testosteron')
  })

  it('sortiert nach Kategorie in Katalog-Reihenfolge, Sonstige zuletzt', () => {
    const withCustom = buildMarkerSummaries([entry({ marker: 'Phantasiewert' })])
    const sorted = sortSummaries(withCustom, 'kategorie')
    expect(sorted[0].kategorie).toBe('Hormone')
    expect(sorted[sorted.length - 1].kategorie).toBe('Sonstige')
  })

  it('verändert das Eingabe-Array nicht', () => {
    const original = buildMarkerSummaries([])
    const namesBefore = original.map(s => s.name)
    sortSummaries(original, 'name')
    expect(original.map(s => s.name)).toEqual(namesBefore)
  })
})

describe('auffaelligeWerte', () => {
  it('liefert nur Marker, deren letzter Wert außerhalb der Referenz liegt', () => {
    const summaries = buildMarkerSummaries([
      entry({ id: 'hoch', marker: 'Testosteron', value: 1200 }),
      entry({ id: 'ok', marker: 'Ferritin', value: 100, unit: 'ng/mL' }),
    ])
    expect(auffaelligeWerte(summaries).map(s => s.name)).toEqual(['Testosteron'])
  })

  it('ignoriert Marker ohne Referenzbereich', () => {
    const summaries = buildMarkerSummaries([entry({ marker: 'Phantasiewert', value: 999 })])
    expect(auffaelligeWerte(summaries)).toEqual([])
  })

  it('der Filter „Auffällige“ liefert genau die auffaelligen Marker', () => {
    const summaries = buildMarkerSummaries([
      entry({ id: 'hoch', marker: 'Testosteron', value: 1200 }),
      entry({ id: 'ok', marker: 'Ferritin', value: 100, unit: 'ng/mL' }),
    ])
    expect(filterByKategorie(summaries, AUFFAELLIG).map(s => s.name)).toEqual(['Testosteron'])
  })

  it('zaehlt Gemessenes ohne Referenzbereich als ungeprueft — nicht als „im Bereich"', () => {
    const summaries = buildMarkerSummaries([
      entry({ id: 'frei', marker: 'Phantasiewert', value: 999 }),
      entry({ id: 'ok', marker: 'Ferritin', value: 100, unit: 'ng/mL' }),
    ])
    expect(ungepruefteWerte(summaries).map(s => s.name)).toEqual(['Phantasiewert'])
  })

  it('ignoriert ungetestete Marker', () => {
    expect(auffaelligeWerte(buildMarkerSummaries([]))).toEqual([])
  })
})

describe('buildMarkerSummaries – Einheiten-Umrechnung', () => {
  it('rechnet den aktuellen Wert in die Katalog-Einheit um', () => {
    const summaries = buildMarkerSummaries([entry({ value: 13.1, unit: 'µg/l' })])
    const t = summaries.find(s => s.name === 'Testosteron')!
    expect(t.displayUnit).toBe('ng/dL')
    expect(t.displayValue).toBeCloseTo(1310, 3)
  })

  it('bewertet inRange anhand des umgerechneten Werts (1310 ng/dL ist zu hoch, nicht zu niedrig)', () => {
    const summaries = buildMarkerSummaries([entry({ value: 13.1, unit: 'µg/l' })])
    const t = summaries.find(s => s.name === 'Testosteron')!
    expect(t.inRange).toBe(false)
    expect(t.displayValue!).toBeGreaterThan(900)
  })

  it('berechnet den Trend über gemischte Einheiten korrekt', () => {
    const summaries = buildMarkerSummaries([
      entry({ id: 'neu', tested_at: '2026-07-15', value: 13.1, unit: 'µg/l' }),
      entry({ id: 'alt', tested_at: '2026-02-22', value: 738, unit: 'ng/dL' }),
    ])
    const t = summaries.find(s => s.name === 'Testosteron')!
    expect(t.trend).toBe('up')
    expect(t.diff).toBeCloseTo(1310 - 738, 2)
  })

  it('liefert points in Katalog-Einheit, neueste zuerst', () => {
    const summaries = buildMarkerSummaries([
      entry({ id: 'a', tested_at: '2026-07-15', value: 13.1, unit: 'µg/l' }),
      entry({ id: 'b', tested_at: '2026-02-22', value: 738, unit: 'ng/dL' }),
    ])
    const t = summaries.find(s => s.name === 'Testosteron')!
    expect(t.points.map(p => (p.value != null ? Math.round(p.value) : null))).toEqual([1310, 738])
  })

  it('lässt einen Punkt weg, der nicht in die Anzeige-Einheit passt', () => {
    // Prolaktin: neuester Wert in ng/mL; der aeltere in mU/L (biologische IE)
    // ist ohne Stoffwissen nicht umrechenbar und wird als null-Punkt markiert.
    const summaries = buildMarkerSummaries([
      entry({ id: 'a', marker: 'Prolaktin', tested_at: '2026-07-15', value: 12, unit: 'ng/mL' }),
      entry({ id: 'b', marker: 'Prolaktin', tested_at: '2026-02-22', value: 306, unit: 'mU/L' }),
    ])
    const t = summaries.find(s => s.name === 'Prolaktin')!
    expect(t.displayUnit).toBe('ng/mL')
    expect(t.points.find(p => p.entry.id === 'a')!.value).toBeCloseTo(12, 3)
    expect(t.points.find(p => p.entry.id === 'b')!.value).toBeNull()
  })

  it('nutzt für Custom-Marker die Einheit des neuesten Eintrags', () => {
    const summaries = buildMarkerSummaries([entry({ marker: 'Phantasiewert', value: 5, unit: 'xyz/L' })])
    const c = summaries.find(s => s.name === 'Phantasiewert')!
    expect(c.displayUnit).toBe('xyz/L')
    expect(c.displayValue).toBe(5)
  })

  it('konvertiert einen Labor-Referenzbereich in die Anzeige-Einheit', () => {
    // Custom-freier Fall: Katalog-Marker mit Labor-Referenz in abweichender Einheit.
    const summaries = buildMarkerSummaries([
      entry({ value: 6.0, unit: 'µg/l', ref_min: 3, ref_max: 9 }), // Labor-Bereich in µg/l
    ])
    const t = summaries.find(s => s.name === 'Testosteron')!
    // displayUnit = ng/dL; 3 µg/l = 300 ng/dL, 9 µg/l = 900 ng/dL
    expect(t.displayUnit).toBe('ng/dL')
    expect(t.range.min).toBeCloseTo(300, 2)
    expect(t.range.max).toBeCloseTo(900, 2)
    expect(t.range.source).toBe('lab')
  })

  it('zeigt einen nicht umrechenbaren Wert in seiner Einheit, meldet inRange aber als unbekannt', () => {
    // Prolaktin in mU/L: nicht in die ng/mL-Katalog-Einheit umrechenbar, daher
    // wird der Wert in mU/L angezeigt und gegen den ng/mL-Katalogbereich nicht beurteilt.
    const summaries = buildMarkerSummaries([entry({ marker: 'Prolaktin', value: 306, unit: 'mU/L' })])
    const t = summaries.find(s => s.name === 'Prolaktin')!
    expect(t.displayUnit).toBe('mU/L')
    expect(t.displayValue).toBe(306)
    expect(t.inRange).toBeNull()
  })

  it('rechnet Testosteron in nmol/L mit dem veroeffentlichten Faktor in ng/dL um', () => {
    const summaries = buildMarkerSummaries([
      entry({ id: 'a', tested_at: '2026-07-15', value: 738, unit: 'ng/dL' }),
      entry({ id: 'b', tested_at: '2026-02-22', value: 20, unit: 'nmol/L' }),
    ])
    const t = summaries.find(s => s.name === 'Testosteron')!
    expect(t.displayUnit).toBe('ng/dL')
    expect(t.points.find(p => p.entry.id === 'b')!.value).toBe(576)
    expect(t.trend).toBe('up')
  })

  it('prüft einen molaren Wert gegen eine gleich-einheitige Labor-Referenz', () => {
    // Wert und Labor-Referenz in derselben (molaren) Einheit -> Vergleich bleibt gültig.
    const summaries = buildMarkerSummaries([
      entry({ value: 35, unit: 'nmol/L', ref_min: 12, ref_max: 30 }),
    ])
    const t = summaries.find(s => s.name === 'Testosteron')!
    // angezeigt in ng/dL, die Labor-Referenz wird mit demselben Faktor umgerechnet
    expect(t.displayUnit).toBe('ng/dL')
    expect(t.displayValue).toBe(1009)
    expect(t.range.min).toBe(346)
    expect(t.inRange).toBe(false)
  })
})

describe('roundConverted', () => {
  it('rundet laborueblich nach Groessenordnung', () => {
    expect(roundConverted(733.631)).toBe(734)
    expect(roundConverted(45.457)).toBe(45.5)
    expect(roundConverted(1.2345)).toBe(1.23)
    expect(roundConverted(0.012345)).toBe(0.0123)
    expect(roundConverted(-5.554)).toBe(-5.55)
  })
})

describe('buildMarkerSummaries – gewaehlte Einheiten', () => {
  const daten = [
    entry({ id: 'a', tested_at: '2026-07-15', value: 1310, unit: 'ng/dL', ref_min: 349, ref_max: 1110 }),
    entry({ id: 'b', tested_at: '2026-02-22', value: 25, unit: 'nmol/L' }),
  ]

  it('zeigt im SI-System nmol/L, samt Bereich und Veraenderung', () => {
    const t = buildMarkerSummaries(daten, { system: 'si' }).find(s => s.name === 'Testosteron')!
    expect(t.displayUnit).toBe('nmol/L')
    // gerundet wie im Labor: 45,457 → 45,5; 38,517 → 38,5
    expect(t.displayValue).toBe(45.5)
    expect(t.range.max).toBe(38.5)
    expect(t.inRange).toBe(false)
    expect(t.diff).toBeCloseTo(20.5, 9)
  })

  it('eine Wahl je Marker gilt vor dem System', () => {
    const t = buildMarkerSummaries(daten, { system: 'si', marker: { Testosteron: 'ng/mL' } }).find(s => s.name === 'Testosteron')!
    expect(t.displayUnit).toBe('ng/mL')
    expect(t.displayValue).toBeCloseTo(13.1, 6)
  })

  it('faellt auf die Katalog-Einheit zurueck, wenn die Wahl nicht umrechenbar ist', () => {
    const t = buildMarkerSummaries(daten, { marker: { Testosteron: 'mU/L' } }).find(s => s.name === 'Testosteron')!
    expect(t.displayUnit).toBe('ng/dL')
  })

  it('urteilt mit ungerundeten Werten: knapp ueber der Grenze bleibt auffaellig, auch in SI', () => {
    const knapp = [entry({ value: 1110.5, unit: 'ng/dL', ref_min: 349, ref_max: 1110 })]
    const si = buildMarkerSummaries(knapp, { system: 'si' }).find(s => s.name === 'Testosteron')!
    // angezeigt beide als 38,5 — das Urteil bleibt trotzdem „ausserhalb"
    expect(si.displayValue).toBe(38.5)
    expect(si.range.max).toBe(38.5)
    expect(si.inRange).toBe(false)
  })

  it('zeigt Werte ohne Einheit weiterhin an', () => {
    const h = buildMarkerSummaries([entry({ marker: 'HOMA-Index', value: 1.4, unit: '' })]).find(s => s.name === 'HOMA-Index')!
    expect(h.displayValue).toBe(1.4)
  })

  it('Marker ohne SI-Faktor bleiben im SI-System in ihrer Einheit', () => {
    const p = buildMarkerSummaries([entry({ marker: 'Prolaktin', value: 12, unit: 'ng/mL' })], { system: 'si' })
      .find(s => s.name === 'Prolaktin')!
    expect(p.displayUnit).toBe('ng/mL')
  })
})

describe('entryInRange', () => {
  const testo = normalizeMarker('Testosteron')
  it('nimmt den Laborbereich des Eintrags, sonst den Katalog', () => {
    expect(entryInRange(entry({ marker: 'Testosteron', value: 950, unit: 'ng/dL', ref_min: 300, ref_max: 1000 }), testo, 'ng/dL')).toBe(true)
    expect(entryInRange(entry({ marker: 'Testosteron', value: 950, unit: 'ng/dL', ref_min: null, ref_max: null }), testo, 'ng/dL')).toBe(false)
  })
  it('rechnet Wert und Bereich in die Anzeige-Einheit', () => {
    expect(entryInRange(entry({ marker: 'Testosteron', value: 20, unit: 'nmol/L', ref_min: 10, ref_max: 30 }), testo, 'ng/dL')).toBe(true)
  })
  it('ohne Bereich kein Urteil', () => {
    expect(entryInRange(entry({ marker: 'Eigenwert', value: 5, unit: 'x', ref_min: null, ref_max: null }), null, 'x')).toBeNull()
  })
})
