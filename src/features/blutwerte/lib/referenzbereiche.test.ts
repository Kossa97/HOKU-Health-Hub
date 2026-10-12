import { describe, expect, it } from 'vitest'
import type { BloodworkEntry } from '../types'
import { MARKER_CATALOG, normalizeMarker } from './markerCatalog'
import { alterAm, profilBereich, REFERENZBEREICHE, WECHSELJAHR_MARKER } from './referenzbereiche'
import { buildMarkerSummaries, effectiveRange, entryInRange, entryRange } from './bloodwork'
import { bereichsHerkunft } from './bereichsHerkunft'
import { geburtsdatumGueltig, parseBioProfile } from './bioProfile'

const entry = (over: Partial<BloodworkEntry> = {}): BloodworkEntry => ({
  id: 'e1', user_id: 'u1', tested_at: '2026-07-01', marker: 'Testosteron', value: 300, unit: 'ng/dL',
  notes: null, created_at: null, report_id: null, ref_min: null, ref_max: null,
  ...over,
} as BloodworkEntry)

const mann = { birthDate: '1980-03-15', sex: 'male' as const }
const frau = { birthDate: '1990-12-31', sex: 'female' as const }

describe('Daten', () => {
  it('jeder Marker steht im Katalog, jede Regel ist plausibel', () => {
    const namen = new Set(MARKER_CATALOG.map(d => d.name))
    for (const [name, set] of Object.entries(REFERENZBEREICHE)) {
      expect(namen.has(name), name).toBe(true)
      expect(set.quellen.length, name).toBeGreaterThan(0)
      for (const q of set.quellen) expect(q).toMatch(/^https:\/\/(www\.gesundheitsinformation\.de|medlineplus\.gov)\//)
      for (const r of set.rules) {
        expect(r.ageMin ?? 18, name).toBeGreaterThanOrEqual(18)
        if (r.keinStandard) continue
        expect(r.min != null || r.max != null, name).toBe(true)
        if (r.min != null && r.max != null) expect(r.min, name).toBeLessThan(r.max)
      }
    }
  })

  it('Altersgruppen eines Geschlechts überlappen nicht und lassen keine Lücke', () => {
    for (const [name, set] of Object.entries(REFERENZBEREICHE)) {
      for (const sex of ['male', 'female', undefined]) {
        // Wechseljahr-Regeln sind Alternativen zur Regel ohne Angabe
        const rules = set.rules.filter(r => r.sex === sex && !r.menopause)
        if (!rules.length) continue
        for (let alter = 18; alter <= 110; alter++) {
          const treffer = rules.filter(r => (r.ageMin ?? 0) <= alter && alter <= (r.ageMax ?? Infinity))
          expect(treffer.length, `${name} ${sex} ${alter}`).toBe(1)
        }
      }
    }
  })
})

describe('alterAm', () => {
  it('zählt volle Jahre am Messtag', () => {
    expect(alterAm('1980-03-15', '2026-03-14')).toBe(45)
    expect(alterAm('1980-03-15', '2026-03-15')).toBe(46)
    expect(alterAm('1980-03-15', '2026-03-15T08:00:00Z')).toBe(46)
    expect(alterAm(null, '2026-03-15')).toBeNull()
    expect(alterAm('2030-01-01', '2026-03-15')).toBeNull()
  })
})

describe('profilBereich', () => {
  it('ohne Angaben: nichts', () => {
    expect(profilBereich('Testosteron', null, '2026-07-01')).toBeNull()
    expect(profilBereich('Testosteron', { birthDate: null, sex: null }, '2026-07-01')).toBeNull()
  })

  it('Geschlecht reicht für Bereiche ab 18', () => {
    expect(profilBereich('Hämoglobin', { birthDate: null, sex: 'female' }, '2026-07-01'))
      .toEqual({ art: 'bereich', min: 11.5, max: 16, gruppe: { sex: 'female', ageMin: 18, ageMax: undefined } })
  })

  it('Altersgruppen brauchen das Geburtsdatum', () => {
    expect(profilBereich('DHEA-S', { birthDate: null, sex: 'male' }, '2026-07-01')).toBeNull()
    expect(profilBereich('DHEA-S', mann, '2026-07-01')).toMatchObject({ min: 45, max: 345, gruppe: { ageMin: 40, ageMax: 49 } })
    // Alter zählt am Messtag, nicht heute.
    expect(profilBereich('DHEA-S', mann, '2000-07-01')).toMatchObject({ min: 110, max: 510 })
  })

  it('TSH nur nach Alter, Geschlecht egal', () => {
    expect(profilBereich('TSH', { birthDate: '1960-01-01', sex: null }, '2026-07-01')).toMatchObject({ min: 0.3, max: 4.5 })
    expect(profilBereich('TSH', { birthDate: null, sex: 'male' }, '2026-07-01')).toBeNull()
  })

  it('unter 18: allgemeiner Bereich', () => {
    expect(profilBereich('Hämoglobin', { birthDate: '2010-01-01', sex: 'male' }, '2026-07-01')).toBeNull()
  })

  it('Östradiol, LH, FSH bei Frauen: Bereich nach Wechseljahren, ohne Angabe keiner', () => {
    expect(profilBereich('Östradiol', frau, '2026-07-01', 'pre')).toMatchObject({ art: 'bereich', min: 30, max: 400, gruppe: { sex: 'female', menopause: 'pre' } })
    expect(profilBereich('Östradiol', frau, '2026-07-01', 'post')).toMatchObject({ art: 'bereich', min: null, max: 30 })
    expect(profilBereich('LH', frau, '2026-07-01', 'post')).toMatchObject({ min: 7.7, max: 58.5 })
    expect(profilBereich('FSH', frau, '2026-07-01', 'pre')).toMatchObject({ min: 4.7, max: 21.5 })
    expect(profilBereich('FSH', frau, '2026-07-01', null)).toMatchObject({ art: 'keinStandard' })
    // Bei Männern zählt die Angabe nicht
    expect(profilBereich('FSH', mann, '2026-07-01', 'post')).toMatchObject({ min: 1.5, max: 12.4 })
    expect([...WECHSELJAHR_MARKER].sort()).toEqual(['FSH', 'LH', 'Östradiol'])
  })

  it('Östradiol bei Frauen: kein Standardbereich', () => {
    expect(profilBereich('Östradiol', frau, '2026-07-01')).toEqual({ art: 'keinStandard', gruppe: { sex: 'female', ageMin: 18, ageMax: undefined } })
  })
})

describe('effectiveRange mit Profil', () => {
  const def = normalizeMarker('Testosteron')

  it('Labor schlägt Gruppe', () => {
    expect(effectiveRange(entry({ ref_min: 250, ref_max: 800 }), def, mann)).toEqual({ min: 250, max: 800, source: 'lab' })
  })

  it('Gruppe schlägt allgemein', () => {
    expect(effectiveRange(entry(), def, mann)).toEqual({ min: 271, max: 1070, source: 'catalog', gruppe: { sex: 'male', ageMin: 18, ageMax: undefined } })
    expect(effectiveRange(entry(), def)).toEqual({ min: 400, max: 900, source: 'catalog' })
  })

  it('Urteil folgt der Gruppe', () => {
    expect(entryInRange(entry({ value: 300 }), def, 'ng/dL')).toBe(false)
    expect(entryInRange(entry({ value: 300 }), def, 'ng/dL', mann)).toBe(true)
  })

  it('Wechseljahr-Angabe am Eintrag wählt den Bereich', () => {
    const d = normalizeMarker('Östradiol')
    const e = entry({ marker: 'Östradiol', value: 150, unit: 'pg/mL', menopause: 'post' })
    expect(entryInRange(e, d, 'pg/mL', frau)).toBe(false)
    expect(entryInRange({ ...e, menopause: 'pre' }, d, 'pg/mL', frau)).toBe(true)
  })

  it('kein Standard: kein Urteil statt eines falschen', () => {
    const e2 = normalizeMarker('Östradiol')
    const e = entry({ marker: 'Östradiol', value: 150, unit: 'pg/mL' })
    expect(entryInRange(e, e2, 'pg/mL', frau)).toBeNull()
    expect(effectiveRange(e, e2, frau)).toMatchObject({ source: 'none', keinStandard: { sex: 'female' } })
  })

  it('Gruppenbereich wird in die Anzeige-Einheit umgerechnet und behält die Gruppe', () => {
    const r = entryRange(entry({ value: 10, unit: 'nmol/L' }), def, 'nmol/L', mann)
    expect(r.source).toBe('catalog')
    expect(r.gruppe?.sex).toBe('male')
    expect(r.min).toBeCloseTo(9.4, 1)
    expect(r.max).toBeCloseTo(37.1, 1)
  })

  it('Zusammenfassung nutzt das Profil', () => {
    const [s] = buildMarkerSummaries([entry({ value: 300 })], {}, mann).filter(x => x.name === 'Testosteron')
    expect(s.range).toMatchObject({ min: 271, max: 1070 })
    expect(s.inRange).toBe(true)
  })
})

describe('bereichsHerkunft', () => {
  const t = (k: string, o?: Record<string, unknown>) => (o ? `${k}:${JSON.stringify(o)}` : k)
  it('benennt Labor, Gruppe und allgemein', () => {
    expect(bereichsHerkunft({ min: 1, max: 2, source: 'lab' }, t)).toBe('bw_lab_source')
    expect(bereichsHerkunft({ min: 1, max: 2, source: 'catalog' }, t)).toBe('bw_range_general')
    expect(bereichsHerkunft({ min: 1, max: 2, source: 'catalog', gruppe: { sex: 'male', ageMin: 18 } }, t)).toBe('bw_range_men')
    expect(bereichsHerkunft({ min: 1, max: 2, source: 'catalog', gruppe: { sex: 'female', ageMin: 40, ageMax: 49 } }, t))
      .toBe('bw_range_women, bw_range_age:{"min":40,"max":49}')
    expect(bereichsHerkunft({ min: 1, max: 2, source: 'catalog', gruppe: { ageMin: 50 } }, t)).toBe('bw_range_age_from:{"min":50}')
    expect(bereichsHerkunft({ min: null, max: null, source: 'none' }, t)).toBeNull()
    expect(bereichsHerkunft({ min: 1, max: 2, source: 'catalog', gruppe: { sex: 'female', ageMin: 18, menopause: 'post' } }, t)).toBe('bw_range_women, bw_range_postmeno')
  })
})

describe('bioProfile', () => {
  it('liest nur Gültiges', () => {
    expect(parseBioProfile({ birth_date: '1980-03-15', bio_sex: 'male' })).toEqual({ birthDate: '1980-03-15', sex: 'male' })
    expect(parseBioProfile({ birth_date: 'x', bio_sex: 'other' })).toEqual({ birthDate: null, sex: null })
    expect(parseBioProfile(null)).toEqual({ birthDate: null, sex: null })
  })
  it('prüft das Geburtsdatum', () => {
    expect(geburtsdatumGueltig('1981-02-29', '2026-10-09')).toBe(false)
    expect(geburtsdatumGueltig('1980-02-28', '2026-10-09')).toBe(true)
    expect(geburtsdatumGueltig('1899-12-31', '2026-10-09')).toBe(false)
    expect(geburtsdatumGueltig('2026-10-10', '2026-10-09')).toBe(false)
  })
})

describe('geschlechtAusAltangabe', () => {
  it('übersetzt nur männlich/weiblich', async () => {
    const { geschlechtAusAltangabe } = await import('./bioProfile')
    expect(geschlechtAusAltangabe('männlich')).toBe('male')
    expect(geschlechtAusAltangabe(' Weiblich ')).toBe('female')
    expect(geschlechtAusAltangabe('divers')).toBeNull()
    expect(geschlechtAusAltangabe(null)).toBeNull()
  })
})
