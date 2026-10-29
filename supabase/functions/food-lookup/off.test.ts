import { describe, expect, it } from 'vitest'
import {
  RateLimiter, TtlCache, itemUrl, mapItem, parseItemResponse, mapProduct, normalizeBarcode, normalizeQuery, parseProductResponse, parseSearchResponse, productUrl, searchUrl,
} from './off'

const nutella = {
  code: '3017620422003', product_name: 'Nutella', product_name_de: 'Nutella Nuss-Nougat-Creme', brands: 'Ferrero, Nutella',
  serving_size: '15 g', serving_quantity: '15', quantity: '400 g',
  nutriments: { 'energy-kcal_100g': 539, proteins_100g: 6.3, carbohydrates_100g: 57.5, fat_100g: 30.9, sugars_100g: 56.3, 'saturated-fat_100g': 10.6, salt_100g: 0.107 },
}

describe('mapProduct', () => {
  it('nimmt den Namen in der Sprache der Oberfläche, Werte je 100 g, erste Marke', () => {
    const f = mapProduct(nutella, 'de')!
    expect(f).toMatchObject({ barcode: '3017620422003', name: 'Nutella Nuss-Nougat-Creme', brand: 'Ferrero', unit: 'g' })
    expect(f.per100).toEqual({ kcal: 539, protein: 6.3, carbs: 57.5, fat: 30.9, fiber: null, sugar: 56.3, satFat: 10.6, salt: 0.11 })
    expect(f.serving).toEqual({ amount: 15, label: '15 g' })
    expect(mapProduct(nutella, 'en')!.name).toBe('Nutella')
  })
  it('gesättigte Fettsäuren: fehlen → null, mehr als das Fett → verworfen', () => {
    const base = { product_name: 'X', nutriments: { 'energy-kcal_100g': 100, fat_100g: 5 } }
    expect(mapProduct(base, 'de')!.per100.satFat).toBeNull()
    expect(mapProduct({ ...base, nutriments: { ...base.nutriments, 'saturated-fat_100g': 2.04 } }, 'de')!.per100.satFat).toBe(2)
    expect(mapProduct({ ...base, nutriments: { ...base.nutriments, 'saturated-fat_100g': 9 } }, 'de')!.per100.satFat).toBeNull()
    expect(mapProduct({ product_name: 'X', nutriments: { 'energy-kcal_100g': 100, 'saturated-fat_100g': 0.4 } }, 'de')!.per100.satFat).toBe(0.4)
  })
  it('rechnet kJ um, wenn kcal fehlt', () => {
    expect(mapProduct({ product_name: 'X', nutriments: { 'energy-kj_100g': 418.4 } }, 'de')!.per100.kcal).toBe(100)
    expect(mapProduct({ product_name: 'X', nutriments: { energy_100g: 836.8 } }, 'de')!.per100.kcal).toBe(200)
  })
  it('erkennt Getränke an der Mengeneinheit', () => {
    expect(mapProduct({ product_name: 'Milch', quantity: '1 l', nutriments: { 'energy-kcal_100g': 64 } }, 'de')!.unit).toBe('ml')
    expect(mapProduct({ product_name: 'Cola', product_quantity_unit: 'ml', nutriments: { 'energy-kcal_100g': 42 } }, 'de')!.unit).toBe('ml')
  })
  it('verwirft ohne Namen, ohne Energie und mit unmöglichen Werten', () => {
    expect(mapProduct({ nutriments: { 'energy-kcal_100g': 100 } }, 'de')).toBeNull()
    expect(mapProduct({ product_name: 'X', nutriments: {} }, 'de')).toBeNull()
    expect(mapProduct({ product_name: 'X', nutriments: { 'energy-kcal_100g': 2000 } }, 'de')).toBeNull()
    expect(mapProduct({ product_name: 'X', nutriments: { 'energy-kcal_100g': 100, fat_100g: 120 } }, 'de')).toBeNull()
    expect(mapProduct({ product_name: 'X', nutriments: { 'energy-kcal_100g': 100, fat_100g: 60, carbohydrates_100g: 60 } }, 'de')).toBeNull()
  })
  it('ignoriert negative Werte und unsinnige Portionen', () => {
    const f = mapProduct({ product_name: 'X', serving_quantity: 9999, nutriments: { 'energy-kcal_100g': 100, proteins_100g: -3 } }, 'de')!
    expect(f.per100.protein).toBe(0)
    expect(f.serving).toBeNull()
  })
  it('kommt mit Marken als Liste klar (Search-a-licious)', () => {
    expect(mapProduct({ ...nutella, brands: ['Ferrero'] }, 'de')!.brand).toBe('Ferrero')
  })
})

describe('Antworten', () => {
  it('Produkt v2 und v3', () => {
    expect(parseProductResponse({ status: 1, code: '3017620422003', product: nutella }, 'de')?.name).toBe('Nutella Nuss-Nougat-Creme')
    expect(parseProductResponse({ status: 'success', product: nutella }, 'en')?.name).toBe('Nutella')
    expect(parseProductResponse({ status: 0 }, 'de')).toBeNull()
    expect(parseProductResponse(null, 'de')).toBeNull()
  })
  it('Suche: Dubletten (gleicher Barcode oder gleiche Werte) und Unbrauchbares fliegen raus', () => {
    const results = parseSearchResponse({
      hits: [nutella, { ...nutella }, { ...nutella, code: '1111111111111' }, { product_name: 'leer' }, { ...nutella, code: '2222222222222', product_name_de: 'Andere Creme' }],
    }, 'de')
    expect(results.map(r => r.name)).toEqual(['Nutella Nuss-Nougat-Creme', 'Andere Creme'])
    expect(parseSearchResponse({}, 'de')).toEqual([])
  })
})

describe('Eingaben', () => {
  it('Barcode', () => {
    expect(normalizeBarcode('3017 6204-22003')).toBe('3017620422003')
    expect(normalizeBarcode('1234567')).toBeNull()
    expect(normalizeBarcode('12345678901234567')).toBeNull()
    expect(normalizeBarcode(42)).toBeNull()
  })
  it('UPC-A wird zu GTIN-13 (führende 0), wie OFF es führt', () => {
    expect(normalizeBarcode('036000291452')).toBe('0036000291452')
  })
  it('Suchbegriff', () => {
    expect(normalizeQuery('  Skyr   natur ')).toBe('Skyr natur')
    expect(normalizeQuery('a')).toBeNull()
    expect(normalizeQuery('x'.repeat(81))).toBeNull()
  })
  it('URLs kodieren die Anfrage', () => {
    expect(productUrl('3017620422003')).toContain('/api/v2/product/3017620422003.json?fields=')
    expect(searchUrl('Müsli & Joghurt', 'de')).toContain('q=M%C3%BCsli+%26+Joghurt')
  })
})

describe('RateLimiter', () => {
  it('lässt je Schlüssel nur `limit` Vorgänge im Fenster zu', () => {
    let now = 0
    const r = new RateLimiter(2, 1000, () => now)
    expect([r.take('a'), r.take('a'), r.take('a')]).toEqual([true, true, false])
    expect(r.take('b')).toBe(true)
    now = 1001
    expect(r.take('a')).toBe(true)
  })
})

describe('TtlCache', () => {
  it('läuft ab und begrenzt die Größe', () => {
    let now = 0
    const c = new TtlCache<number>(1000, 2, () => now)
    c.set('a', 1); c.set('b', 2); c.set('c', 3)
    expect(c.get('a')).toBeUndefined()
    expect(c.get('c')).toBe(3)
    now = 2000
    expect(c.get('c')).toBeUndefined()
  })
  it('merkt sich auch „nicht gefunden"', () => {
    const c = new TtlCache<number | null>(1000)
    c.set('x', null)
    expect(c.get('x')).toBeNull()
  })
})

describe('mapItem (Substanz-Scan)', () => {
  it('braucht nur einen Namen — Supplements ohne Nährwerte bleiben', () => {
    const p = { code: '4058172312345', product_name: 'Vitamin D3 1000 I.E.', brands: 'Das gesunde Plus, dm', quantity: '100 Tabletten' }
    expect(mapItem(p, 'de')).toEqual({ barcode: '4058172312345', name: 'Vitamin D3 1000 I.E.', brand: 'Das gesunde Plus', quantity: '100 Tabletten', protein: null })
    expect(mapProduct(p, 'de')).toBeNull()
  })
  it('nimmt notfalls die Gattungsbezeichnung, ohne Namen nichts', () => {
    expect(mapItem({ generic_name: 'Magnesiumcitrat' }, 'de')!.name).toBe('Magnesiumcitrat')
    expect(mapItem({ brands: 'X' }, 'de')).toBeNull()
  })
  it('liest die Produktantwort und fragt nur die nötigen Felder', () => {
    expect(parseItemResponse({ status: 1, code: '4058172312345', product: { product_name: 'Zink 25 mg' } }, 'de')!.name).toBe('Zink 25 mg')
    expect(parseItemResponse({ status: 0 }, 'de')).toBeNull()
    expect(itemUrl('4058172312345')).toContain('fields=code,product_name')
    // Nährwerte nur fürs Eiweiß (Proteinpulver), samt Portionsgröße.
    expect(itemUrl('4058172312345')).toContain('nutriments,serving_quantity')
  })
  it('Eiweiß je Portion, sonst je 100 g — Unmögliches fliegt raus', () => {
    const whey = { product_name: 'Whey Protein Vanille', nutriments: { proteins_serving: 23.7, proteins_100g: 79 }, serving_quantity: 30 }
    expect(mapItem(whey, 'de')!.protein).toEqual({ amount: 23.7, per: 30 })
    expect(mapItem({ ...whey, serving_quantity: undefined }, 'de')!.protein).toEqual({ amount: 79, per: 100 })
    // Portion in ml: kein Grammbezug — dann je 100 g.
    expect(mapItem({ ...whey, serving_quantity_unit: 'ml' }, 'de')!.protein).toEqual({ amount: 79, per: 100 })
    expect(mapItem({ product_name: 'X', nutriments: { proteins_serving: 40 }, serving_quantity: 30 }, 'de')!.protein).toBeNull()
    expect(mapItem({ product_name: 'X', nutriments: { proteins_100g: 120 } }, 'de')!.protein).toBeNull()
  })
})
