import { describe, expect, it } from 'vitest'
import { HEALTH_SECTION_ID, LEGAL_DOCS, PROFILE_SECTION_ID, hatPlatzhalter, legalLang, teileAbsatz } from './texts'

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

  it('beschreibt Profil und Sichtbarkeit: Stufen, privates Profil, Schnappschuss, Web-Link', () => {
    const abschnitt = (lang: 'de' | 'en') => LEGAL_DOCS.datenschutz[lang].sections.find(s => s.id === PROFILE_SECTION_ID)
    const de = abschnitt('de')
    const en = abschnitt('en')
    expect(de?.heading).toBe('6. Profil und Sichtbarkeit')
    expect(en?.heading).toBe('6. Profile and visibility')
    const deText = de?.paragraphs.join(' ') ?? ''
    const enText = en?.paragraphs.join(' ') ?? ''
    for (const wert of ['„Nur ich“', '„Freunde“', '„Alle“', 'angemeldete Hoku-Nutzer', 'Freunde-Funktion', 'Profilbild', 'privat', 'nie ihre Namen', 'Menstruationszyklus, Blutzucker und Medikamente', 'Profilwerte-Schnappschuss', 'mit deinem Konto gelöscht', 'standardmäßig aus', 'Erfahrungsberichte und alle anderen Werte sind ohne Anmeldung nie zu sehen']) expect(deText).toContain(wert)
    for (const wert of ['“Only me”', '“Friends”', '“Everyone”', 'signed-in Hoku users', 'friends feature', 'profile picture', 'private', 'never their names', 'Menstrual cycle, blood sugar and medications', 'Profile values snapshot', 'deleted with your account', 'off by default', 'Experience reports and all other values are never visible without signing in']) expect(enText).toContain(wert)
  })

  it('beschreibt Gesamtfortschritt und Abzeichen: auf dem Gerät, Baseline aus Health, im Konto, für andere nur Gesamt, Bereiche, Abzeichen', () => {
    const absatz = (lang: 'de' | 'en', anfang: string) =>
      LEGAL_DOCS.datenschutz[lang].sections.find(s => s.id === PROFILE_SECTION_ID)?.paragraphs.find(p => p.startsWith(anfang)) ?? ''
    const de = absatz('de', 'Gesamtfortschritt und Abzeichen:')
    const en = absatz('en', 'Overall progress and badges:')
    for (const wert of ['berechnet dein Gerät', 'bis zu 60 Tage vor dem Start', 'Apple Health / Health Connect', 'siehe Abschnitt 4', 'Baseline', 'Richtungen', 'frühere Starts', 'Wochenverlauf', 'verdienten Abzeichen', 'Lesen kannst das nur du', 'mit deinem Konto gelöscht', 'nie einzelne Werte oder deinen Verlauf']) expect(de).toContain(wert)
    for (const wert of ['your device calculates', 'up to 60 days before the start', 'Apple Health / Health Connect', 'see section 4', 'baseline', 'directions', 'earlier starts', 'weekly history', 'badges you have earned', 'Only you can read this', 'deleted with your account', 'never individual values or your history']) expect(en).toContain(wert)
    // gleich aufgebaut: Abschnitt 6 hat in beiden Sprachen gleich viele Absätze
    const anzahl = (lang: 'de' | 'en') => LEGAL_DOCS.datenschutz[lang].sections.find(s => s.id === PROFILE_SECTION_ID)?.paragraphs.length
    expect(anzahl('de')).toBe(anzahl('en'))
  })

  it('nennt den Bild-Check ueber Anthropic (USA) als Empfaenger', () => {
    const empfaenger = (lang: 'de' | 'en') => LEGAL_DOCS.datenschutz[lang].sections[4].paragraphs
    const de = empfaenger('de').find(p => p.startsWith('Anthropic (Bild-Check')) ?? ''
    const en = empfaenger('en').find(p => p.startsWith('Anthropic (picture check')) ?? ''
    for (const wert of ['Profil- und Titelbild', 'USA', 'Claude', 'bevor andere es sehen', 'abgelehntes Bild löschen wir sofort', 'nur den Zeitpunkt']) expect(de).toContain(wert)
    for (const wert of ['profile and cover picture', 'USA', 'Claude', 'before others see it', 'delete a rejected picture immediately', 'only the time']) expect(en).toContain(wert)
  })

  it('zeigt Deutsch nur fuer Deutsch, sonst Englisch', () => {
    expect(legalLang('de-AT')).toBe('de')
    expect(legalLang('fr')).toBe('en')
    expect(legalLang(undefined)).toBe('en')
  })
})
