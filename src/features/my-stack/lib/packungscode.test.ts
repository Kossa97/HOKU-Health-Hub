import { describe, expect, it } from 'vitest'
import { parsePackungscode, pznGueltig } from './packungscode'

const GS = '\x1d'
const RS = '\x1e'
const EOT = '\x04'

describe('pznGueltig', () => {
  it('prueft die Pruefziffer (Modulo 11)', () => {
    expect(pznGueltig('01234562')).toBe(true)
    expect(pznGueltig('01234563')).toBe(false)
    expect(pznGueltig('1234562')).toBe(false)
  })
})

describe('parsePackungscode', () => {
  it('IFA-Format (securPharm Deutschland): PZN, Charge, Verfall', () => {
    const code = `[)>${RS}06${GS}9N110123456242${GS}1TAB12C${GS}D270600${GS}S1234567890AB${RS}${EOT}`
    expect(parsePackungscode(code)).toEqual({ pzn: '01234562', charge: 'AB12C', verfall: '2027-06-30' })
  })

  it('GS1 mit Trennzeichen: PZN aus der NTIN', () => {
    const code = `${GS}010415001234562517280115${'10'}L-77${GS}21XYZ123`
    expect(parsePackungscode(code)).toEqual({ pzn: '01234562', charge: 'L-77', verfall: '2028-01-15' })
  })

  it('GS1 in Klammerschreibweise, PZN in (710)', () => {
    expect(parsePackungscode('(01)05000000000006(17)261231(10)B42(710)01234562'))
      .toEqual({ pzn: '01234562', charge: 'B42', verfall: '2026-12-31' })
  })

  it('ein fremdes Land: Verfall und Charge, ohne PZN', () => {
    expect(parsePackungscode(']d2010500000000000617261100' + '10Q9'))
      .toEqual({ pzn: null, charge: 'Q9', verfall: '2026-11-30' })
  })

  it('Produkt-Barcodes und Unsinn sind kein Packungscode', () => {
    expect(parsePackungscode('4058172312345')).toBeNull()
    expect(parsePackungscode('https://example.org')).toBeNull()
    expect(parsePackungscode(`[)>${RS}06${GS}1TABC${RS}${EOT}`)).toBeNull()
  })

  it('weitere Kennzeichen fester Laenge verschlucken nichts', () => {
    // (13) Herstelldatum vor dem Verfall, ohne Trennzeichen dahinter.
    expect(parsePackungscode('0105000000000006132610011727123110LOT1'))
      .toEqual({ pzn: null, charge: 'LOT1', verfall: '2027-12-31' })
  })

  it('nur eine GTIN ist ein Produkt, keine Packung', () => {
    expect(parsePackungscode('(01)05000000000006')).toBeNull()
  })

  it('unmoegliche Daten werden nicht geraten', () => {
    expect(parsePackungscode('(01)05000000000006(17)261340(10)A')!.verfall).toBeNull()
  })
})
