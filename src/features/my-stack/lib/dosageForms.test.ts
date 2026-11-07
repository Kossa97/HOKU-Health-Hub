import { describe, expect, it } from 'vitest'
import { DOSAGE_FORMS, getDosageForm, getIntakePlanUnitSuggestions, intakeUnitLabelKey, isStageRenderable, showsColor, strengthBasisDefault, strengthHintKey, strengthShapeFor } from './dosageForms'
import type { DosageFormKey } from '../types'

describe('DOSAGE_FORMS', () => {
  it('enthält alle freigegebenen stabilen Schlüssel genau einmal', () => {
    expect(DOSAGE_FORMS.map(form => form.key)).toEqual([
      'vial', 'ampoule', 'pen', 'tablet', 'capsule', 'drops',
      'powder', 'nasal_spray', 'spray', 'gel', 'patch', 'tube', 'other',
    ])
  })

  it('modelliert Tabletten als teilbar und Vials als rekonstituierbar', () => {
    expect(getDosageForm('tablet').capabilities).toContain('divisible')
    expect(getDosageForm('vial').capabilities).toEqual(expect.arrayContaining([
      'injectable', 'reconstitutable', 'concentration_based', 'inventory_capable',
    ]))
  })

  it('aktiviert genau die Formen mit fertiger Bühnengrafik', () => {
    expect(DOSAGE_FORMS.filter(form => form.stageRenderer).map(form => form.key)).toEqual(['vial', 'ampoule', 'pen', 'tablet', 'capsule', 'drops', 'powder', 'nasal_spray', 'spray', 'gel', 'patch', 'tube'])
  })

  it('bewahrt eine komprimierte, aber reale Groessenhierarchie auf der Buehne', () => {
    const ratio = (key: DosageFormKey) => getDosageForm(key).stageHeightRatio

    for (const form of DOSAGE_FORMS.filter(candidate => candidate.stageRenderer)) {
      expect(form.stageHeightRatio, form.key).toBeGreaterThan(0)
      expect(form.stageHeightRatio, form.key).toBeLessThanOrEqual(1)
    }

    expect(ratio('pen')).toBeGreaterThan(ratio('ampoule')!)
    expect(ratio('pen')).toBeLessThanOrEqual(0.94)
    expect(ratio('ampoule')).toBeGreaterThan(ratio('vial')!)
    expect(ratio('vial')).toBeGreaterThan(ratio('capsule')!)
    expect(ratio('capsule')).toBeGreaterThan(ratio('tablet')!)
    expect(getDosageForm('other').stageHeightRatio).toBeUndefined()
  })

  it('gibt jeder freigeschalteten Form ihre Bühnenbeschreibung mit', () => {
    for (const form of DOSAGE_FORMS.filter(f => f.stageRenderer)) {
      expect(form.stageForm, form.key).toBeDefined()
    }
    for (const form of DOSAGE_FORMS.filter(f => !f.stageRenderer)) {
      expect(form.stageForm, form.key).toBeUndefined()
    }
  })

  it('trennt Etikett und Füllstand: beide Glasformen tragen eines, nur das Vial hat einen Pegel', () => {
    expect(getDosageForm('vial').stageForm?.chamber).not.toBeNull()
    expect(getDosageForm('ampoule').stageForm?.chamber).not.toBeNull()
    expect(getDosageForm('vial').stageForm?.hasMeaningfulFill).toBe(true)
    expect(getDosageForm('ampoule').stageForm?.hasMeaningfulFill).toBe(false)
  })

  it('liefert formgerechte Bezugsgrößen', () => {
    expect(getDosageForm('capsule').basisUnits).toContain('capsule')
    expect(getDosageForm('drops').basisUnits).toContain('drop')
    expect(getDosageForm('tube').basisUnits).toContain('ml')
  })

  it('erkennt die zwölf fertigen Formen als darstellbar, den Rest noch nicht', () => {
    expect(isStageRenderable('vial')).toBe(true)
    expect(isStageRenderable('ampoule')).toBe(true)
    expect(isStageRenderable('pen')).toBe(true)
    expect(isStageRenderable('tablet')).toBe(true)
    expect(isStageRenderable('capsule')).toBe(true)
    expect(isStageRenderable('nasal_spray')).toBe(true)
    expect(isStageRenderable('tube')).toBe(true)
    expect(isStageRenderable('patch')).toBe(true)
    expect(isStageRenderable('drops')).toBe(true)
    expect(isStageRenderable('powder')).toBe(true)
    expect(isStageRenderable('gel')).toBe(true)
    expect(isStageRenderable('spray')).toBe(true)
    expect(isStageRenderable('other')).toBe(false)
  })

  it('faellt fuer eine Form, die es nicht mehr gibt, auf other zurueck', () => {
    // 'liquid' stand bis September in der Liste und liegt in Bestandsdaten
    // weiter. Ohne Rueckfall gaebe die Suche undefined zurueck und der
    // naechste Zugriff auf .stageRenderer wuerde die Seite abstuerzen lassen.
    const alt = 'liquid' as never

    expect(getDosageForm(alt).key).toBe('other')
    expect(isStageRenderable(alt)).toBe(false)
  })
})

describe('Einnahmeeinheit je Darreichungsform', () => {
  // Womit EINE Einnahme gezaehlt wird — nicht, was im Schrank steht. Der
  // Beispieleintrag im Tiefenschritt sagte lange „1 Kapsel", dann „1 Ampulle";
  // beides beschrieb die Packung, nicht das, was man tut.
  it('zaehlt Ampulle und Vial in Spritzen, Sprays in Spruehstoessen', () => {
    const einheit = (key: DosageFormKey) => getDosageForm(key).intakeUnit

    // Aufgezogen wird mit der Spritze — bei beiden.
    expect(einheit('ampoule')).toBe('syringe')
    expect(einheit('vial')).toBe('syringe')

    // Beide Sprays geben Spruehstoesse ab.
    expect(einheit('spray')).toBe('spray')
    expect(einheit('nasal_spray')).toBe('spray')

    // Was man zaehlen kann, zaehlt sich selbst.
    expect(einheit('tablet')).toBe('tablet')
    expect(einheit('capsule')).toBe('capsule')
    expect(einheit('drops')).toBe('drop')
    expect(einheit('patch')).toBe('patch')

    // Was aufgetragen oder abgemessen wird, zaehlt in Anwendung oder Portion.
    expect(einheit('gel')).toBe('application')
    expect(einheit('tube')).toBe('application')
    expect(einheit('powder')).toBe('portion')
    expect(einheit('pen')).toBe('dose')
    expect(einheit('other')).toBe('unit')
  })

  it('gibt jeder Form eine Einheit und einen Uebersetzungsschluessel dazu', () => {
    for (const form of DOSAGE_FORMS) {
      expect(form.intakeUnit, form.key).toBeTruthy()
      expect(intakeUnitLabelKey(form.key), form.key)
        .toBe(`my_stack_intake_unit_${form.intakeUnit}`)
    }
  })

  it('stellt die Einnahmeeinheit an die Spitze der Einheitenvorschlaege', () => {
    // Was der Nutzer im Alltag zaehlt, steht vorn — vor den Wirkstoffmengen
    // und den Packungsmassen.
    for (const key of ['ampoule', 'nasal_spray', 'gel'] as const) {
      const vorschlaege = getIntakePlanUnitSuggestions(key)
      expect(vorschlaege, key).toContain(getDosageForm(key).intakeUnit)
    }
  })

  it('gibt jeder Form eine Staerke-Form und einen Hinweis dazu', () => {
    // Je Stueck: Spray, Tablette, Pflaster mit eigenem Beispiel; die
    // Kapsel behaelt den allgemeinen Satz.
    const erwartet: Record<string, string> = {
      vial: 'my_stack_strength_hint_reconstituted',
      ampoule: 'my_stack_strength_hint_per_volume',
      pen: 'my_stack_strength_hint_per_volume',
      tablet: 'my_stack_strength_hint_per_unit_tablet',
      capsule: 'my_stack_strength_hint_per_unit',
      drops: 'my_stack_strength_hint_per_volume',
      powder: 'my_stack_strength_hint_per_mass',
      nasal_spray: 'my_stack_strength_hint_per_unit_spray',
      spray: 'my_stack_strength_hint_per_unit_spray',
      gel: 'my_stack_strength_hint_per_mass',
      patch: 'my_stack_strength_hint_per_unit_patch',
      tube: 'my_stack_strength_hint_per_mass',
      other: 'my_stack_no_dosage_advice',
    }
    expect(DOSAGE_FORMS.map(form => form.key).sort()).toEqual(Object.keys(erwartet).sort())
    for (const form of DOSAGE_FORMS) {
      expect(form.strengthShape, form.key).toBeTruthy()
      expect(strengthHintKey(form.key), form.key).toBe(erwartet[form.key])
    }
  })

  it('nennt beim Nasenspray ein Beispiel in Spruehstoessen, nicht in Kapseln', () => {
    expect(strengthHintKey('nasal_spray')).toBe('my_stack_strength_hint_per_unit_spray')
    expect(strengthHintKey('spray')).toBe('my_stack_strength_hint_per_unit_spray')
    expect(strengthHintKey('capsule')).toBe('my_stack_strength_hint_per_unit')
  })

  it('ordnet jede Form der Staerke zu, die sie tatsaechlich hat', () => {
    const shape = (key: Parameters<typeof getDosageForm>[0]) => getDosageForm(key).strengthShape

    // Stueckware: die Staerke steckt in einem Stueck.
    expect(shape('tablet')).toBe('per_unit')
    expect(shape('capsule')).toBe('per_unit')
    expect(shape('patch')).toBe('per_unit')
    // Ein Spruehstoss ist auch ein Stueck — abgezaehlt, nicht abgemessen.
    expect(shape('nasal_spray')).toBe('per_unit')
    expect(shape('spray')).toBe('per_unit')

    // Fluessiges traegt eine Konzentration.
    expect(shape('ampoule')).toBe('per_volume')
    expect(shape('pen')).toBe('per_volume')
    expect(shape('drops')).toBe('per_volume')

    // Das Pulver-Vial bekommt seine Konzentration erst beim Aufloesen.
    expect(shape('vial')).toBe('reconstituted')

    // Abgewogenes.
    expect(shape('powder')).toBe('per_mass')
    expect(shape('gel')).toBe('per_mass')
    expect(shape('tube')).toBe('per_mass')

    // Unbekannte Form: keine Annahme.
    expect(shape('other')).toBe('free')
  })

  it('belegt die Produktmenge aus der Form vor — und beim Vial gerade nicht', () => {
    // Eine Kapsel traegt ihre Staerke „pro 1 Kapsel", eine Ampulle „pro 1 ml".
    expect(strengthBasisDefault('capsule')).toEqual({ value: 1, unit: 'capsule' })
    expect(strengthBasisDefault('tablet')).toEqual({ value: 1, unit: 'tablet' })
    expect(strengthBasisDefault('nasal_spray')).toEqual({ value: 1, unit: 'spray' })
    expect(strengthBasisDefault('ampoule')).toEqual({ value: 1, unit: 'ml' })
    expect(strengthBasisDefault('pen')).toEqual({ value: 1, unit: 'ml' })
    expect(strengthBasisDefault('gel')).toEqual({ value: 1, unit: 'g' })

    // Wie viel Loesungsmittel ins Vial kommt, steht auf keinem Etikett.
    expect(strengthBasisDefault('vial')).toEqual({ value: null, unit: 'ml' })

    // Ueber eine unbekannte Form wird nichts behauptet.
    expect(strengthBasisDefault('other')).toEqual({ value: null, unit: 'unit' })
  })

  it('schlaegt nur Einheiten vor, die die Form auch kennt', () => {
    for (const form of DOSAGE_FORMS) {
      const vorgabe = strengthBasisDefault(form.key)
      if (vorgabe.unit === null) continue
      expect([...form.basisUnits, 'ml', 'g'], form.key).toContain(vorgabe.unit)
    }
  })

  it('sagt je Form, ob sie die Eintragsfarbe ueberhaupt zeigt', () => {
    // Die Aussage gehoert zur Form, nicht zum Formular: `color_hex` wird
    // ausschliesslich von der Buehnengrafik gezeigt. Wo sie das nicht tut,
    // faellt der Farbschritt weg (siehe wizardSteps).
    expect(showsColor('patch')).toBe(false)   // hautfarben, mit Absicht
    expect(showsColor('tube')).toBe(false)    // Aluminium, mit Absicht
    expect(showsColor('other')).toBe(false)   // gar keine Grafik
    expect(showsColor('vial')).toBe(true)

    // Ohne Grafik kann keine Farbe ankommen — die Umkehrung gilt nicht:
    // Pflaster und Tube HABEN eine Grafik und zeigen sie trotzdem nicht.
    for (const form of DOSAGE_FORMS) {
      if (!isStageRenderable(form.key)) {
        expect(showsColor(form.key), form.key).toBe(false)
      }
    }
  })

  it('laesst die Substanz beim Vial entscheiden, was fuer eine Staerke gefragt wird', () => {
    // Der Fall aus dem Formular: Testosteron Enantat im Vial ist ein Oel und
    // wird nie rekonstituiert; BPC-157 im Vial ist ein Pulver und wird
    // aufgeloest. Dieselbe Form, zwei verschiedene Fragen.
    expect(strengthShapeFor('vial', 'peptide')).toBe('reconstituted')
    expect(strengthShapeFor('vial', 'hormone')).toBe('per_volume')
    expect(strengthShapeFor('vial', 'medication')).toBe('per_volume')
    expect(strengthShapeFor('vial', 'vitamin')).toBe('per_volume')
    expect(strengthShapeFor('vial', 'supplement')).toBe('per_volume')

    // Ohne Kategorie bleibt es bei der Vorgabe der Form: die Kategorie
    // ueberschreibt, sie raet nicht.
    expect(strengthShapeFor('vial', null)).toBe('reconstituted')

    // „Sonstiges" ist keine sechste Aussage ueber den Inhalt, sondern das
    // Gegenteil einer Aussage — es faellt in denselben Fall wie „noch nichts
    // gewaehlt". Aus „nicht Peptid" folgt NICHT „fertig geloest".
    expect(strengthShapeFor('vial', 'other')).toBe('reconstituted')
    expect(strengthBasisDefault('vial', 'other')).toEqual(strengthBasisDefault('vial', null))
    expect(strengthHintKey('vial', 'other')).toBe(strengthHintKey('vial', null))
  })

  it('laesst die Kategorie alle anderen Formen unberuehrt', () => {
    // Eine Kapsel ist eine Kapsel, egal was drin ist. Nur das Vial traegt
    // zwei verschiedene Dinge unter einem Namen.
    for (const form of DOSAGE_FORMS) {
      if (form.key === 'vial') continue
      for (const kategorie of ['peptide', 'hormone', 'medication', 'supplement', 'vitamin', 'other', null] as const) {
        expect(strengthShapeFor(form.key, kategorie), `${form.key}/${kategorie}`)
          .toBe(form.strengthShape)
      }
    }
  })

  it('richtet Vorbelegung und Hinweis des Vials nach der Substanz', () => {
    // Peptid: die Loesungsmittelzeile bleibt leer und der Hinweis erklaert
    // die Rekonstitution.
    expect(strengthBasisDefault('vial', 'peptide')).toEqual({ value: null, unit: 'ml' })
    expect(strengthHintKey('vial', 'peptide')).toBe('my_stack_strength_hint_reconstituted')

    // Hormon: eine fertige Loesung, „pro 1 ml" vom Etikett — und ein eigener
    // Hinweis, der den Ausweg nennt, falls doch ein Pulver drinliegt.
    expect(strengthBasisDefault('vial', 'hormone')).toEqual({ value: 1, unit: 'ml' })
    expect(strengthHintKey('vial', 'hormone')).toBe('my_stack_strength_hint_vial_solution')

    // Der Sonderhinweis gilt nur dem Vial: eine Ampulle bleibt beim
    // allgemeinen Konzentrationssatz.
    expect(strengthHintKey('ampoule', 'hormone')).toBe('my_stack_strength_hint_per_volume')
  })
})


describe('kombiPlanEinheiten', () => {
  it('bietet bei Kombipräparaten nur Stück oder ml an, die Bezugseinheit vorn', async () => {
    const { kombiPlanEinheiten, getIntakePlanUnitSuggestions } = await import('./dosageForms')
    expect(kombiPlanEinheiten('tablet')).toEqual(['tablet'])
    expect(kombiPlanEinheiten('capsule')).toEqual(['capsule'])
    expect(kombiPlanEinheiten('vial', 'peptide')[0]).toBe('ml')
    expect(kombiPlanEinheiten('vial', 'peptide')).not.toContain('mcg')
    expect(kombiPlanEinheiten('drops')[0]).toBe('ml')
    expect(kombiPlanEinheiten('powder')).toEqual(['g', 'portion'])
    expect(getIntakePlanUnitSuggestions('tablet', ['mg'], { category: null })).toEqual(['tablet'])
    expect(getIntakePlanUnitSuggestions('tablet', ['mg'])).toContain('mg')
  })
})
