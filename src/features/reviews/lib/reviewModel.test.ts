import { describe, expect, it } from 'vitest'
import type { CyclePlanVersion, CycleTimeline } from '../../../lib/planTimeline'
import {
  entwurfAus,
  gruppiereBewertungen,
  passtZurSuche,
  entwurfGueltig,
  erfahrungAusSternen,
  istBeendet,
  leererEntwurf,
  vorgeschlagenerZyklus,
  zeileAus,
  zyklusKontext,
  zyklusKurz,
  zyklusZumDatum,
  type Review,
} from './reviewModel'

const timeZone = 'Europe/Berlin'
const now = new Date('2026-10-04T10:00:00.000Z')

// Schluessel und Werte sichtbar, damit die Erwartungen lesbar bleiben.
const t = (key: string, options?: Record<string, unknown>) => {
  if (key === 'review_duration_weeks') return `${options?.n} Wochen`
  if (key === 'review_duration_days') return `${options?.n} Tage`
  if (key === 'review_duration_day') return '1 Tag'
  if (key === 'review_period_since') return `seit ${options?.date}`
  return String(options?.defaultValue ?? key)
}

function version(cycleId: string, from: string, dose: number): CyclePlanVersion {
  return {
    id: `${cycleId}-${from}`, cycle_id: cycleId, effective_kind: 'local_date', effective_at: null, effective_local_date: from,
    change_kind: 'initial', frequency: 'Täglich', x_days_interval: null, interval_unit: null, cycle_on_days: null,
    cycle_off_days: null, schedule_days: [], intake_time: 'morgens', intake_time_custom: '08:00', slot_doses: null,
    slot_days: null, dose, unit: 'mcg', method: 'Subkutan',
  }
}

function zyklus(id: string, stackItemId: string, start: string, ende: string | null, dosen: [string, number][] = [[start, 250]]): CycleTimeline {
  return {
    cycle: {
      id, stack_item_id: stackItemId,
      started_at: `${start}T00:00:00.000Z`, start_local_date: start,
      ended_at: ende ? `${ende}T00:00:00.000Z` : null, end_local_date: ende,
    },
    versions: dosen.map(([from, dose]) => version(id, from, dose)),
    pauses: [],
  }
}

const zyklen = [
  zyklus('alt', 'bpc', '2026-03-01', '2026-04-12'),
  zyklus('neu', 'bpc', '2026-08-12', '2026-09-29', [['2026-08-12', 250], ['2026-09-01', 500]]),
  zyklus('laeuft', 'bpc', '2026-09-30', null),
  zyklus('anders', 'tb', '2026-09-01', null),
]

describe('Vorschlag beim Bewerten', () => {
  it('zuerst der zuletzt beendete Zyklus ohne Bewertung', () => {
    expect(vorgeschlagenerZyklus(zyklen, 'bpc', new Set(), now)).toBe('neu')
    expect(vorgeschlagenerZyklus(zyklen, 'bpc', new Set(['neu']), now)).toBe('alt')
  })

  it('sind alle beendeten bewertet: der laufende; sonst keiner', () => {
    expect(vorgeschlagenerZyklus(zyklen, 'bpc', new Set(['neu', 'alt']), now)).toBe('laeuft')
    expect(vorgeschlagenerZyklus(zyklen, 'bpc', new Set(['neu', 'alt', 'laeuft']), now)).toBeNull()
    expect(vorgeschlagenerZyklus(zyklen, 'unbekannt', new Set(), now)).toBeNull()
  })
})

describe('alte Bewertung ohne Zyklus', () => {
  it('der Zyklus, in dem sie geschrieben wurde', () => {
    expect(zyklusZumDatum(zyklen, 'bpc', '2026-03-20T09:00:00.000Z', timeZone)).toBe('alt')
    expect(zyklusZumDatum(zyklen, 'bpc', '2026-10-02T09:00:00.000Z', timeZone)).toBe('laeuft')
  })

  it('zwischen zwei Zyklen: der, der davor endete', () => {
    expect(zyklusZumDatum(zyklen, 'bpc', '2026-06-01T09:00:00.000Z', timeZone)).toBe('alt')
    expect(zyklusZumDatum(zyklen, 'bpc', '2026-01-01T09:00:00.000Z', timeZone)).toBeNull()
  })
})

describe('was dabei war', () => {
  it('Zeitraum, Dauer in Wochen, Dosis mit Aenderung, Rhythmus', () => {
    const kontext = zyklusKontext(zyklen[1], now, timeZone, 'de', t)
    // Das Ende ist eine Grenze: letzter Einnahmetag ist der 28.09.
    expect(kontext.zeitraum).toBe('12.08.2026 – 28.09.2026')
    expect(kontext.dauer).toBe('7 Wochen')
    expect(kontext.dosis).toBe('250 → 500 mcg')
    expect(kontext.rhythmus).toBeTruthy()
    expect(kontext.laeuft).toBe(false)
  })

  it('ein laufender Zyklus: „seit", Dauer bis heute', () => {
    const kontext = zyklusKontext(zyklen[2], now, timeZone, 'de', t)
    expect(kontext.zeitraum).toBe('seit 30.09.2026')
    expect(kontext.dauer).toBe('5 Tage')
    expect(kontext.dosis).toBe('250 mcg')
    expect(kontext.laeuft).toBe(true)
  })

  it('am Starttag beendet: ein Tag, nicht rueckwaerts', () => {
    const kurz = zyklus('kurz', 'bpc', '2026-09-01', '2026-09-01')
    const kontext = zyklusKontext(kurz, now, timeZone, 'de', t)
    expect(kontext.zeitraum).toBe('01.09.2026 – 01.09.2026')
    expect(kontext.dauer).toBe('1 Tag')
    expect(zyklusKurz(kurz, now, timeZone, 'de', t)).toMatch(/^Sept?\.? 2026$/)
  })

  it('kurz fuer die Auswahl', () => {
    // Abkuerzungen (mit oder ohne Punkt) kommen aus der ICU-Version.
    expect(zyklusKurz(zyklen[1], now, timeZone, 'de', t)).toMatch(/^Aug\.? – Sept?\.? 2026$/)
    expect(zyklusKurz(zyklen[2], now, timeZone, 'de', t)).toMatch(/^seit Sept?\.? 2026$/)
    expect(zyklusKurz(zyklen[0], now, timeZone, 'de', t)).toMatch(/^Mär(z|\.)? – Apr\.? 2026$/)
  })
})

describe('Entwurf und Speichern', () => {
  it('nichts ist vorbelegt; ohne Sterne kein Speichern', () => {
    const entwurf = leererEntwurf('bpc', 'neu')
    expect(entwurf.rating).toBeNull()
    expect(entwurf.is_public).toBe(false)
    expect(entwurfGueltig(entwurf)).toBe(false)
    expect(entwurfGueltig({ ...entwurf, rating: 3 })).toBe(true)
    expect(() => zeileAus(entwurf, 'u1')).toThrow()
  })

  it('die alte Dreiteilung folgt den Sternen', () => {
    expect([1, 2, 3, 4, 5].map(erfahrungAusSternen)).toEqual(['schlecht', 'schlecht', 'mittel', 'gut', 'gut'])
  })

  it('leere Texte werden null, der Titel bleibt leer statt null', () => {
    const zeile = zeileAus({ ...leererEntwurf('bpc', 'neu'), rating: 4, body: '  ', pros: ' schnell ', wirkung: 5 }, 'u1')
    expect(zeile).toMatchObject({
      user_id: 'u1', stack_item_id: 'bpc', cycle_id: 'neu', rating: 4, experience: 'gut',
      wirkung: 5, vertraeglichkeit: null, title: '', body: null, pros: 'schnell', is_public: false,
    })
  })

  it('nur Text geaendert: die alte Dreiteilung bleibt; neue Sterne: sie folgt', () => {
    const entwurf = { ...leererEntwurf('bpc', null), rating: 4 }
    expect(zeileAus(entwurf, 'u1', { rating: 4, experience: 'schlecht' }).experience).toBe('schlecht')
    expect(zeileAus(entwurf, 'u1', { rating: 2, experience: 'schlecht' }).experience).toBe('gut')
    expect(zeileAus(entwurf, 'u1', null).experience).toBe('gut')
  })

  it('eine bestehende Bewertung wird zum Entwurf — und zurueck, ohne Verlust', () => {
    const review: Review = {
      id: 'r1', stack_item_id: 'bpc', cycle_id: 'neu', rating: 5, title: 'Gut', body: 'Text', pros: null, cons: 'teuer',
      experience: 'gut', wirkung: 4, vertraeglichkeit: 5, wieder_nehmen: 'ja', is_public: true,
      created_at: '2026-10-01T10:00:00.000Z', updated_at: null, stack_items: { display_name: 'BPC-157' },
    }
    expect(zeileAus(entwurfAus(review), 'u1')).toMatchObject({
      rating: 5, title: 'Gut', body: 'Text', pros: null, cons: 'teuer', wirkung: 4, vertraeglichkeit: 5, wieder_nehmen: 'ja', is_public: true,
    })
  })
})

describe('Uebersicht', () => {
  const review = (id: string, stackItemId: string, name: string, rating: number, cycleId: string | null, created: string, archived = false): Review => ({
    id, stack_item_id: stackItemId, cycle_id: cycleId, rating, title: null, body: null, pros: null, cons: null,
    experience: null, wirkung: null, vertraeglichkeit: null, wieder_nehmen: null, is_public: false,
    created_at: created, updated_at: null, stack_items: { display_name: name, archived },
  })
  const liste = [
    review('a1', 'bpc', 'BPC-157', 4, 'alt', '2026-04-15T10:00:00.000Z'),
    review('a2', 'bpc', 'BPC-157', 2, null, '2026-01-10T10:00:00.000Z'),
    review('a3', 'bpc', 'BPC-157', 5, 'neu', '2026-09-30T10:00:00.000Z'),
    review('b1', 'tb', 'TB-500', 5, 'anders', '2026-09-02T10:00:00.000Z', true),
  ]

  it('je Substanz, Zyklen neueste zuerst, ohne Zyklus dahinter', () => {
    const gruppen = gruppiereBewertungen(liste, zyklen, 'neueste')
    expect(gruppen.map(g => g.name)).toEqual(['BPC-157', 'TB-500'])
    expect(gruppen[0].bewertungen.map(r => r.id)).toEqual(['a3', 'a1', 'a2'])
    expect(gruppen[0].schnitt).toBe(3.7)
    expect(gruppen[1].archiviert).toBe(true)
  })

  it('nach Schnitt: beste Substanz zuerst', () => {
    expect(gruppiereBewertungen(liste, zyklen, 'beste').map(g => g.name)).toEqual(['TB-500', 'BPC-157'])
  })

  it('Suche in Name und Texten', () => {
    expect(passtZurSuche({ ...liste[0], cons: 'Teuer' }, 'teu')).toBe(true)
    expect(passtZurSuche(liste[0], 'bpc')).toBe(true)
    expect(passtZurSuche(liste[0], 'xyz')).toBe(false)
    expect(passtZurSuche(liste[0], '  ')).toBe(true)
  })
})

describe('noch nicht bewertet', () => {
  it('ein Plan mit festem Ende in der Zukunft laeuft noch — nicht „beendet", nicht vorgeschlagen als beendet', () => {
    const geplant = zyklus('geplant', 'bpc', '2026-09-20', '2026-10-30')
    expect(istBeendet(geplant, now)).toBe(false)
    expect(zyklusKontext(geplant, now, timeZone, 'de', t).laeuft).toBe(true)
    expect(zyklusKontext(geplant, now, timeZone, 'de', t).zeitraum).toBe('seit 20.09.2026')
    expect(vorgeschlagenerZyklus([...zyklen, geplant], 'bpc', new Set(['neu', 'alt', 'laeuft']), now)).toBe('geplant')
  })
})
