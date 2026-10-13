import { describe, expect, it } from 'vitest'
import { canConvert, convert, normalizeUnitString, systemUnit, unitChoices } from './unitConversion'

describe('normalizeUnitString', () => {
  it('vereinheitlicht Groß-/Kleinschreibung und Leerzeichen', () => {
    expect(normalizeUnitString('  NG/DL ')).toBe('ng/dl')
  })

  it('vereinheitlicht Mikro-Schreibweisen (µ, u, mc)', () => {
    expect(normalizeUnitString('µg/l')).toBe(normalizeUnitString('ug/l'))
    expect(normalizeUnitString('mcg/l')).toBe(normalizeUnitString('µg/l'))
  })
})

describe('convert', () => {
  it('gibt den Wert unverändert zurück, wenn Einheiten gleich sind', () => {
    expect(convert(500, 'ng/dL', 'ng/dL')).toBe(500)
  })

  it('behandelt gleiche Einheiten auch bei unbekannter Einheit als identisch', () => {
    expect(convert(7, 'U/L', 'U/L')).toBe(7)
    expect(convert(7, 'u/l', 'U/L')).toBe(7)
  })

  it('rechnet den realen Testosteron-Fall korrekt um (µg/l -> ng/dL)', () => {
    expect(convert(13.1, 'µg/l', 'ng/dL')).toBeCloseTo(1310, 6)
  })

  it('rechnet zurück (ng/dL -> µg/l)', () => {
    expect(convert(612, 'ng/dL', 'µg/l')).toBeCloseTo(6.12, 6)
  })

  it('rechnet ng/mL und µg/l als gleich (1:1)', () => {
    expect(convert(5, 'ng/mL', 'µg/l')).toBeCloseTo(5, 6)
  })

  it('rechnet pg/mL -> ng/mL', () => {
    expect(convert(1000, 'pg/mL', 'ng/mL')).toBeCloseTo(1, 6)
  })

  it('rechnet µg/dL -> ng/mL', () => {
    expect(convert(1, 'µg/dL', 'ng/mL')).toBeCloseTo(10, 6)
  })

  it('rechnet mg/L -> ng/mL', () => {
    expect(convert(1, 'mg/L', 'ng/mL')).toBeCloseTo(1000, 6)
  })

  it('rechnet mg/dL -> ng/mL', () => {
    expect(convert(1, 'mg/dL', 'ng/mL')).toBeCloseTo(10000, 6)
  })

  it('ist über einen Roundtrip stabil', () => {
    const there = convert(738, 'ng/dL', 'µg/l')!
    expect(convert(there, 'µg/l', 'ng/dL')).toBeCloseTo(738, 6)
  })

  it('gibt null für molare Einheiten zurück (kein Raten ohne Molekulargewicht)', () => {
    expect(convert(21, 'nmol/L', 'ng/dL')).toBeNull()
    expect(convert(500, 'ng/dL', 'nmol/L')).toBeNull()
  })

  it('gibt null für unbekannte oder inkompatible Einheiten zurück', () => {
    expect(convert(5, 'U/L', 'ng/dL')).toBeNull()
    expect(convert(5, '%', 'ng/mL')).toBeNull()
    expect(convert(5, 'ng/dL', '')).toBeNull()
  })

  it('gibt null bei nicht-endlichem Wert zurück', () => {
    expect(convert(Number.NaN, 'ng/dL', 'µg/l')).toBeNull()
  })
})

describe('canConvert', () => {
  it('ist true für gleiche Einheiten', () => {
    expect(canConvert('U/L', 'U/L')).toBe(true)
  })

  it('ist true für kompatible Masse-Einheiten', () => {
    expect(canConvert('ng/dL', 'µg/l')).toBe(true)
  })

  it('ist false für molare oder unbekannte Einheiten', () => {
    expect(canConvert('nmol/L', 'ng/dL')).toBe(false)
    expect(canConvert('U/L', 'ng/dL')).toBe(false)
  })
})

describe('convert mit Marker', () => {
  it('rechnet Masse ↔ Stoffmenge mit dem veroeffentlichten Faktor', () => {
    expect(convert(1000, 'ng/dL', 'nmol/L', 'Testosteron')).toBeCloseTo(34.7, 6)
    expect(convert(34.7, 'nmol/L', 'ng/dL', 'Testosteron')).toBeCloseTo(1000, 6)
    // ueber Praefixe hinweg: µg/l → pmol/l
    expect(convert(10, 'µg/l', 'pmol/L', 'Testosteron')).toBeCloseTo(34700, 3)
    expect(convert(198, 'pmol/l', 'pg/mL', 'Östradiol')).toBeCloseTo(198 / 3.671, 6)
  })

  it('raet ohne Faktor nicht', () => {
    expect(convert(20, 'nmol/L', 'ng/dL')).toBeNull()
    expect(convert(20, 'nmol/L', 'ng/mL', 'SHBG')).toBeNull()
    expect(convert(306, 'mU/L', 'ng/mL', 'Prolaktin')).toBeNull()
  })

  it('rechnet IE-Schreibweisen ineinander um', () => {
    expect(convert(1.5, 'mU/l', 'mIU/L')).toBe(1.5)
    expect(convert(1.5, 'mIU/L', 'µIU/mL')).toBeCloseTo(1.5, 9)
    expect(convert(4, 'mIU/mL', 'U/l', 'LH')).toBeCloseTo(4, 9)
    expect(convert(10, 'uIU/mL', 'mU/L')).toBeCloseTo(10, 9)
  })

  it('U/l bleibt bei Enzymen Enzymaktivitaet', () => {
    expect(convert(30, 'U/L', 'mIU/mL', 'GPT (ALT)')).toBeNull()
    expect(convert(60, 'U/L', 'µkat/L', 'GPT (ALT)')).toBeCloseTo(1, 9)
  })

  it('G/l heisst bei Zellzahlen Giga pro Liter', () => {
    expect(convert(6.2, 'G/l', '/nL', 'Leukozyten')).toBeCloseTo(6.2, 9)
    expect(convert(5.22, 'T/l', 'Mio/µL', 'Erythrozyten')).toBeCloseTo(5.22, 9)
    // ohne Zellzahl-Marker bleibt G/l Gramm pro Liter
    expect(convert(1, 'G/l', '/nL')).toBeNull()
  })
})

describe('systemUnit und unitChoices', () => {
  it('liefert konventionell die Katalog-, im SI-System die Faktor-Einheit', () => {
    expect(systemUnit('Testosteron', 'ng/dL', 'konventionell')).toBe('ng/dL')
    expect(systemUnit('Testosteron', 'ng/dL', 'si')).toBe('nmol/L')
    expect(systemUnit('Prolaktin', 'ng/mL', 'si')).toBe('ng/mL')
  })

  it('bietet Katalog-, SI- und eigene Einheiten an, ohne Dubletten', () => {
    expect(unitChoices('Testosteron', 'ng/dL', ['nmol/l', 'µg/l', 'ng/dL', 'mU/L'])).toEqual(['ng/dL', 'nmol/L', 'µg/l'])
    expect(unitChoices('TSH', 'mIU/L', ['mU/l', 'µIU/mL'])).toEqual(['mIU/L'])
  })
})

describe('Laborschreibweisen', () => {
  it('kennt „E“ als Einheit: µE/ml ist µIU/mL', () => {
    expect(convert(2.6, 'µE/ml', 'µIU/mL', 'Insulin')).toBeCloseTo(2.6)
    expect(convert(2.6, 'uE/ml', 'mIU/L', 'Insulin')).toBeCloseTo(2.6)
  })

  it('rechnet Hämatokrit zwischen l/l und % um, aber keinen relativen Zellanteil in eine Zellzahl', () => {
    expect(convert(0.45, 'l/l', '%', 'Hämatokrit')).toBeCloseTo(45)
    expect(convert(1, '%', 'G/l', 'Basophile')).toBeNull()
  })

  it('liest „mIU/mL“ bei TSH als µIU/mL — der Bereich springt nicht mehr um den Faktor 1000', () => {
    expect(convert(4.2, 'mIU/l', 'mIU/mL', 'TSH')).toBeCloseTo(4.2)
    expect(convert(2, 'mIU/mL', 'mIU/L', 'TSH')).toBeCloseTo(2)
    // Bei LH und FSH ist mIU/mL richtig und bleibt, was es ist
    expect(convert(5, 'mIU/mL', 'IU/L', 'LH')).toBeCloseTo(5)
    expect(convert(5, 'mIU/mL', 'mIU/L', 'LH')).toBeCloseTo(5000)
  })
})
