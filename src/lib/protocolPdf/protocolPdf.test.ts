import { beforeEach, describe, expect, it } from 'vitest'
import { visibleSections, defaultSelection, resolveSubject } from './sections'
import { applyPreset, matchPreset } from './presets'
import { loadPdfExportPrefs, savePdfExportPrefs } from './persistence'
import { buildProtocolPdf, effectTableBody } from './renderProtocolPdf'
import type { ProtocolData, PdfBuildOptions } from './types'

function makeData(overrides: Partial<ProtocolData> = {}): ProtocolData {
  return {
    profile: { display_name: 'Max Muster', username: 'max', age: 32, gender: 'männlich', height_cm: 182, weight_kg: 84 },
    cycles: [
      { id: 'c1', name: 'Zyklus', stack_item_name: 'BPC-157', dose: 250, unit: 'mcg', method: 'SC', frequency: 'Täglich', start_date: '2026-01-01', end_date: null, active: true },
    ],
    doseLogs: [
      { stack_item_id: 'p1', logged_at: '2026-06-01T08:00:00Z', taken: true },
      { stack_item_id: 'p1', logged_at: '2026-06-02T08:00:00Z', taken: false },
      { stack_item_id: 'p1', logged_at: '2026-06-03T08:00:00Z', taken: true },
    ],
    weightLogs: [
      { logged_at: '2026-06-01T08:00:00Z', weight_kg: 84 },
      { logged_at: '2026-06-15T08:00:00Z', weight_kg: 82.5 },
      { logged_at: '2026-06-29T08:00:00Z', weight_kg: 81.2 },
    ],
    bloodwork: [
      { tested_at: '2026-06-01', marker: 'IGF-1', value: 180, unit: 'ng/ml' },
      { tested_at: '2026-06-28', marker: 'IGF-1', value: 240, unit: 'ng/ml' },
    ],
    effects: [
      { type: 'effect', description: 'Bessere Regeneration', severity: 4, stack_item_name: 'BPC-157', occurred_at: '2026-06-10T08:00:00Z' },
    ],
    reviews: [
      { stack_item_name: 'BPC-157', rating: 5, experience: 'gut', wirkung: 5, vertraeglichkeit: 4, wieder_nehmen: 'ja' },
      // Alt, ohne Kriterien: muss genauso durchlaufen.
      { stack_item_name: 'TB-500', rating: 3, experience: 'mittel' },
    ],
    dailyLogs: [
      { log_date: '2026-06-01', energie: 6, schlaf: 7, wohlbefinden: 6, libido: 5 },
      { log_date: '2026-06-15', energie: 8, schlaf: 8, wohlbefinden: 7, libido: 7 },
    ],
    stackItemNames: new Map([['p1', 'BPC-157']]),
    ...overrides,
  }
}

const ALL_SECTIONS = ['personal', 'summary', 'cycles', 'adherence', 'bloodwork', 'weight', 'wellness', 'effects', 'reviews', 'notes'] as const

describe('resolveSubject', () => {
  it('nutzt den Namen, wenn persönliche Angaben enthalten sind', () => {
    expect(resolveSubject(makeData(), true, 'de')).toBe('Max Muster')
  })
  it('anonymisiert, wenn persönliche Angaben abgewählt sind', () => {
    expect(resolveSubject(makeData(), false, 'de')).toBe('Anonym')
    expect(resolveSubject(makeData(), false, 'en')).toBe('Anonymous')
  })
  it('fällt auf Anonym zurück, wenn kein Name vorhanden', () => {
    const d = makeData({ profile: { display_name: null, username: null, age: null, gender: null, height_cm: null, weight_kg: null } })
    expect(resolveSubject(d, true, 'de')).toBe('Anonym')
  })
})

describe('visibleSections', () => {
  it('filtert leere Sektionen heraus, behält Notizen immer', () => {
    const empty: ProtocolData = {
      profile: null, cycles: [], doseLogs: [], weightLogs: [], bloodwork: [],
      effects: [], reviews: [], dailyLogs: [], stackItemNames: new Map(),
    }
    const vis = visibleSections([...ALL_SECTIONS], empty)
    expect(vis).toEqual(['notes'])
  })
  it('behält die feste PDF-Reihenfolge unabhängig von der Auswahl-Reihenfolge', () => {
    const vis = visibleSections(['reviews', 'personal', 'cycles'], makeData())
    expect(vis).toEqual(['personal', 'cycles', 'reviews'])
  })
  it('ignoriert nicht gewählte Sektionen', () => {
    const vis = visibleSections(['weight'], makeData())
    expect(vis).toEqual(['weight'])
  })
})

describe('defaultSelection', () => {
  it('wählt alle Sektionen mit Daten, aber nicht Notizen (Freitext)', () => {
    const sel = defaultSelection(makeData())
    expect(sel).toContain('bloodwork')
    expect(sel).toContain('weight')
    expect(sel).not.toContain('notes')
  })
})

/** Ein Jahr taeglicher Wohlbefinden-Eintraege, wie auf dem Testaccount. */
function jahrDailyLogs(): ProtocolData['dailyLogs'] {
  const basis = Date.UTC(2026, 0, 1)
  return Array.from({ length: 365 }, (_, i) => ({
    log_date: new Date(basis + i * 86_400_000).toISOString().slice(0, 10),
    energie: 4 + (i % 7),
    schlaf: 3 + (i % 8),
    wohlbefinden: 5 + (i % 6),
    libido: 2 + (i % 9),
  }))
}

describe('Wohlbefinden ueber einen langen Zeitraum', () => {
  const opts: PdfBuildOptions = {
    lang: 'de',
    range: { from: '2026-01-01', to: '2026-12-31' },
    sections: ['wellness'],
    note: '',
  }

  it('rendert ein Jahr ohne Fehler und ohne aus dem Blatt zu laufen', async () => {
    // Vorher wurden 365 Punkte je Metrik roh in einen 42-mm-Kasten gezeichnet.
    // Jetzt fasst der Renderer zu Monaten zusammen — die Datenmenge darf die
    // Seitenzahl nicht mehr treiben.
    const doc = await buildProtocolPdf(makeData({ dailyLogs: jahrDailyLogs() }), opts)
    const kurz = await buildProtocolPdf(makeData(), opts)
    expect(doc.getNumberOfPages()).toBe(kurz.getNumberOfPages())
  })

  it('zeichnet vier getrennte Charts, auch wenn nur eine Metrik gefuellt ist', async () => {
    // Der Schwarzweiss-Grund: eine Linie je Chart, damit die Ueberschrift die
    // Zuordnung traegt und nicht die Farbe. Eine leere Metrik bekommt keinen
    // leeren Kasten.
    const nurSchlaf = jahrDailyLogs().map(l => ({
      ...l, energie: null, wohlbefinden: null, libido: null,
    }))
    const doc = await buildProtocolPdf(makeData({ dailyLogs: nurSchlaf }), opts)
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2)
  })

  it('kommt mit einem einzigen Eintrag zurecht', async () => {
    // Ein Punkt ist kein Verlauf. Er darf trotzdem nicht zum Absturz fuehren.
    const einer = [{ log_date: '2026-06-01', energie: 7, schlaf: null, wohlbefinden: null, libido: null }]
    const doc = await buildProtocolPdf(makeData({ dailyLogs: einer }), opts)
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2)
  })

  it('rendert das Jahr auch auf Englisch', async () => {
    const doc = await buildProtocolPdf(makeData({ dailyLogs: jahrDailyLogs() }), { ...opts, lang: 'en' })
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2)
  })
})

describe('buildProtocolPdf (Runtime-Smoke)', () => {
  const opts: PdfBuildOptions = {
    lang: 'de',
    range: { from: '2026-06-01', to: '2026-06-30' },
    sections: [...ALL_SECTIONS],
    note: 'Frage an den Arzt: IGF-1 weiter beobachten?',
  }

  it('erzeugt ein mehrseitiges PDF ohne Fehler', async () => {
    const doc = await buildProtocolPdf(makeData(), opts)
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2)
    const bytes = doc.output('arraybuffer') as ArrayBuffer
    expect(bytes.byteLength).toBeGreaterThan(3000)
  })

  it('rendert auch bei komplett leeren Daten (nur Deckblatt + Notizen + Disclaimer)', async () => {
    const empty: ProtocolData = {
      profile: null, cycles: [], doseLogs: [], weightLogs: [], bloodwork: [],
      effects: [], reviews: [], dailyLogs: [], stackItemNames: new Map(),
    }
    const doc = await buildProtocolPdf(empty, { ...opts, note: '' })
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2)
  })

  it('funktioniert auf Englisch', async () => {
    const doc = await buildProtocolPdf(makeData(), { ...opts, lang: 'en' })
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2)
  })
})

describe('presets', () => {
  it('Arzt enthält Blutwerte und persönliche Angaben, kein Forum-Stil', () => {
    const sel = applyPreset('arzt', makeData())
    expect(sel).toContain('personal')
    expect(sel).toContain('bloodwork')
    expect(sel).toContain('effects')
    expect(sel).not.toContain('reviews')
    expect(sel).not.toContain('wellness')
  })

  it('Coach lässt Blutwerte weg und behält Wellness/Reviews', () => {
    const sel = applyPreset('coach', makeData())
    expect(sel).toContain('personal')
    expect(sel).toContain('wellness')
    expect(sel).toContain('reviews')
    expect(sel).not.toContain('bloodwork')
  })

  it('Forum anonymisiert (kein personal), ohne Labor und Notizen', () => {
    const sel = applyPreset('forum', makeData())
    expect(sel).not.toContain('personal')
    expect(sel).not.toContain('bloodwork')
    expect(sel).not.toContain('notes')
    expect(sel).toContain('summary')
    expect(sel).toContain('wellness')
  })

  it('filtert Sektionen ohne Daten heraus, behält Notizen im Arzt-Muster', () => {
    const empty: ProtocolData = {
      profile: null, cycles: [], doseLogs: [], weightLogs: [], bloodwork: [],
      effects: [], reviews: [], dailyLogs: [], stackItemNames: new Map(),
    }
    expect(applyPreset('arzt', empty)).toEqual(['notes'])
  })

  it('matchPreset erkennt Muster und Custom', () => {
    const data = makeData()
    const arzt = applyPreset('arzt', data)
    expect(matchPreset(arzt, data)).toBe('arzt')
    const withReviews = [...arzt, 'reviews' as const]
    expect(matchPreset(withReviews, data)).toBe('custom')
    const withoutBloodwork = arzt.filter(id => id !== 'bloodwork')
    expect(matchPreset(withoutBloodwork, data)).toBe('custom')
  })
})

describe('persistence', () => {
  const store = new Map<string, string>()

  beforeEach(() => {
    store.clear()
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => { store.set(k, v) },
        removeItem: (k: string) => { store.delete(k) },
      },
    })
  })

  it('speichert und lädt die letzte Auswahl', () => {
    const prefs = {
      preset: 'coach' as const,
      sections: applyPreset('coach', makeData()),
      lang: 'en' as const,
    }
    savePdfExportPrefs('user-1', prefs)
    expect(loadPdfExportPrefs('user-1')).toEqual(prefs)
  })

  it('verwirft kaputte localStorage-Einträge', () => {
    localStorage.setItem('tyd_pdf_export_prefs_user-2', '{not-json')
    expect(loadPdfExportPrefs('user-2')).toBeNull()
  })
})


describe('Einheitliches Report-Layout', () => {
  it('erzeugt ein PDF mit preset arzt', async () => {
    const doc = await buildProtocolPdf(makeData(), {
      lang: 'de',
      range: { from: '2026-06-01', to: '2026-06-30' },
      sections: ['personal', 'summary', 'cycles', 'adherence', 'bloodwork', 'weight', 'effects', 'notes'],
      note: 'Frage an den Arzt',
      preset: 'arzt',
    })
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2)
    const bytes = doc.output('arraybuffer') as ArrayBuffer
    expect(bytes.byteLength).toBeGreaterThan(3000)
  })
})


describe('Presets mit gleichem Layout', () => {
  it('erzeugt ein Coaching-PDF mit gleichem Layout', async () => {
    const doc = await buildProtocolPdf(makeData(), {
      lang: 'de',
      range: { from: '2026-06-01', to: '2026-06-30' },
      sections: ['personal', 'summary', 'cycles', 'adherence', 'weight', 'wellness', 'effects', 'reviews', 'notes'],
      note: 'Frage an den Coach',
      preset: 'coach',
    })
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2)
    const bytes = doc.output('arraybuffer') as ArrayBuffer
    expect(bytes.byteLength).toBeGreaterThan(3000)
  })

  it('erzeugt ein anonymes Forum-PDF mit gleichem Layout', async () => {
    const doc = await buildProtocolPdf(makeData(), {
      lang: 'de',
      range: { from: '2026-06-01', to: '2026-06-30' },
      sections: ['summary', 'cycles', 'adherence', 'weight', 'wellness', 'effects', 'reviews'],
      note: '',
      preset: 'forum',
    })
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2)
    const bytes = doc.output('arraybuffer') as ArrayBuffer
    expect(bytes.byteLength).toBeGreaterThan(2500)
  })
})

describe('Tagebuch im PDF', () => {
  const base = { stack_item_name: 'BPC-157', occurred_at: '2026-06-10T08:00:00Z' }

  it('eine Zeile je Chip: Name in der PDF-Sprache, Dauer, Titel und Substanz darunter', () => {
    const rows = effectTableBody([
      { ...base, type: 'side_effect', description: 'Morgens', severity: 3, symptom_key: 'nausea', custom_label: null, duration_minutes: 120, ongoing: false },
      { ...base, type: 'effect', description: 'Morgens', severity: 4, symptom_key: 'more_energy', custom_label: null, duration_minutes: null, ongoing: true },
    ], 'de')
    expect(rows).toEqual([
      ['Nebenwirkung', 'Übelkeit · 2 Std.\n(Morgens · BPC-157)', '3/5', expect.any(String)],
      ['Wirkung', 'Mehr Energie · hält an\n(Morgens · BPC-157)', '4/5', expect.any(String)],
    ])
    expect(effectTableBody([{ ...base, type: 'side_effect', description: 'x', severity: 2, symptom_key: 'nausea', duration_minutes: 1440 }], 'en')[0][1])
      .toBe('Nausea · 1 day\n(x · BPC-157)')
  })

  it('aelterer Eintrag ohne Chips: Titel als Name, nicht doppelt', () => {
    const rows = effectTableBody([{ ...base, type: 'effect', description: 'Bessere Regeneration', severity: 4 }], 'de')
    expect(rows[0][1]).toBe('Bessere Regeneration\n(BPC-157)')
    // So liefert ihn loadProtocolData: eigener Name = Titel.
    const loaded = effectTableBody([{ ...base, stack_item_name: null, type: 'effect', description: 'Ruhig', severity: 2, custom_label: 'Ruhig' }], 'de')
    expect(loaded[0][1]).toBe('Ruhig')
  })
})

