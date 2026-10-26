import { describe, expect, it } from 'vitest'
import { expandUpcE, gs1ChecksumOk, normalizeBarcode } from './barcode'

describe('normalizeBarcode', () => {
  it('nimmt gültige EAN-13, EAN-8, UPC-A an (Leerzeichen/Bindestriche egal)', () => {
    expect(normalizeBarcode('3017620422003')).toBe('3017620422003') // Nutella
    expect(normalizeBarcode('4 006381 333931')).toBe('4006381333931')
    expect(normalizeBarcode('9638-5074')).toBe('96385074') // EAN-8
    expect(normalizeBarcode('036000291452')).toBe('0036000291452') // UPC-A → GTIN-13, wie OFF es führt
  })
  it('nimmt gültige UPC-E an', () => {
    expect(normalizeBarcode('04252614')).toBe('04252614')
  })
  it('weist Tippfehler (falsche Prüfziffer), falsche Länge und Buchstaben ab', () => {
    expect(normalizeBarcode('3017620422004')).toBeNull()
    expect(normalizeBarcode('1234567')).toBeNull()
    expect(normalizeBarcode('123456789012345')).toBeNull()
    expect(normalizeBarcode('30176204220O3')).toBeNull()
    expect(normalizeBarcode('')).toBeNull()
  })
})

describe('Prüfziffern', () => {
  it('GS1', () => {
    expect(gs1ChecksumOk('4006381333931')).toBe(true)
    expect(gs1ChecksumOk('4006381333932')).toBe(false)
  })
  it('UPC-E-Expansion nach allen vier Regeln', () => {
    expect(expandUpcE('04252614')).toBe('042100005264') // Beispiel aus der GS1-/Wikipedia-Beschreibung
    expect(expandUpcE('01234505')).toBe('012000003455')
    expect(expandUpcE('01234535')).toBe('012300000455')
    expect(expandUpcE('01234545')).toBe('012340000055')
    expect(expandUpcE('21234565')).toBeNull() // Nummernsystem nur 0/1
  })
})
