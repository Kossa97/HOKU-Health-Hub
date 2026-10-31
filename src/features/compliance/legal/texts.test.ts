import { describe, expect, it } from 'vitest'
import { HEALTH_SECTION_ID, LEGAL_DOCS, hatPlatzhalter, legalLang, teileAbsatz } from './texts'

describe('Rechtstexte', () => {
  it('haben fuer jede Seite Deutsch und Englisch mit gleicher Gliederung', () => {
    for (const docs of Object.values(LEGAL_DOCS)) {
      expect(docs.de.sections.length).toBe(docs.en.sections.length)
      docs.de.sections.forEach((section, i) => {
        expect(section.paragraphs.length).toBe(docs.en.sections[i].paragraphs.length)
      })
    }
  })

  it('nennen in Deutsch und Englisch dieselben Platzhalter-Stellen', () => {
    const zaehle = (doc: (typeof LEGAL_DOCS)['datenschutz']['de']) =>
      doc.sections.flatMap(s => s.paragraphs).join(' ').match(/\[\[/g)?.length ?? 0
    for (const docs of Object.values(LEGAL_DOCS)) expect(zaehle(docs.de)).toBe(zaehle(docs.en))
  })

  it('erkennt offene Platzhalter', () => {
    expect(hatPlatzhalter(LEGAL_DOCS.impressum.de)).toBe(true)
    expect(hatPlatzhalter({ title: 'x', updated: 'y', sections: [{ heading: 'h', paragraphs: ['fertig'] }] })).toBe(false)
  })

  it('zerlegt Absaetze in Text und Platzhalter', () => {
    expect(teileAbsatz('E-Mail: [[Kontakt]] bitte')).toEqual([
      { text: 'E-Mail: ', platzhalter: false },
      { text: 'Kontakt', platzhalter: true },
      { text: ' bitte', platzhalter: false },
    ])
  })

  it('beschreibt die gespeicherten Daten aus Apple Health / Health Connect mit Einwilligung, Widerruf und Loeschen', () => {
    const absatz = (lang: 'de' | 'en') => LEGAL_DOCS.datenschutz[lang].sections[3].paragraphs.find(p => p.startsWith('Data from Apple Health') || p.startsWith('Daten aus Apple Health')) ?? ''
    const de = absatz('de')
    const en = absatz('en')
    for (const wert of ['Schritte', 'Ruhepuls', 'Schlaf', 'aktive Kalorien', 'SpO2', 'Atemfrequenz', 'Blutdruck', 'Art. 9 Abs. 2 lit. a DSGVO', 'widerrufen', 'löschen', 'Werbung']) expect(de).toContain(wert)
    for (const wert of ['steps', 'resting heart rate', 'sleep', 'active calories', 'SpO2', 'respiratory rate', 'blood pressure', 'Art. 9(2)(a) GDPR', 'withdraw', 'delete', 'advertising']) expect(en).toContain(wert)
    // Widerruf loescht nicht von selbst.
    expect(de).toContain('bereits gespeicherte Tageswerte bleiben erhalten, bis du sie im Profil löschst')
    expect(en).toContain('daily values already stored stay until you delete them in your profile')
  })

  it('nennt bei den Kontodaten Profil- und Titelbild, Land, Ziele und Geschlecht im Profil', () => {
    const konto = (lang: 'de' | 'en') => LEGAL_DOCS.datenschutz[lang].sections[1].paragraphs[0]
    expect(konto('de')).toMatch(/^Konto: /)
    expect(konto('en')).toMatch(/^Account: /)
    for (const wert of ['Profil- und Titelbild', 'Land', 'Ziele', 'Geschlecht']) expect(konto('de')).toContain(wert)
    for (const wert of ['profile and cover picture', 'country', 'goals', 'gender']) expect(konto('en')).toContain(wert)
  })

  it('nennt im ersten Absatz zu Apple Health / Health Connect dieselben Werte, die die App liest', () => {
    const [de] = LEGAL_DOCS.datenschutz.de.sections[3].paragraphs
    const [en] = LEGAL_DOCS.datenschutz.en.sections[3].paragraphs
    for (const wert of ['Gewicht', 'Schritte', 'Workouts', 'Schlaf', 'Ruhepuls', 'aktive Kalorien', 'SpO2', 'Atemfrequenz', 'Blutdruck']) expect(de).toContain(wert)
    for (const wert of ['weight', 'steps', 'workouts', 'sleep', 'resting heart rate', 'active calories', 'SpO2', 'respiratory rate', 'blood pressure']) expect(en).toContain(wert)
  })

  it('hat am Abschnitt Apple Health / Health Connect die Sprungmarke, die Android oeffnet', () => {
    expect(HEALTH_SECTION_ID).toBe('gesundheitsdaten')
    expect(LEGAL_DOCS.datenschutz.de.sections[3].id).toBe(HEALTH_SECTION_ID)
    expect(LEGAL_DOCS.datenschutz.en.sections[3].id).toBe(HEALTH_SECTION_ID)
  })

  it('zeigt Deutsch nur fuer Deutsch, sonst Englisch', () => {
    expect(legalLang('de-AT')).toBe('de')
    expect(legalLang('fr')).toBe('en')
    expect(legalLang(undefined)).toBe('en')
  })
})
