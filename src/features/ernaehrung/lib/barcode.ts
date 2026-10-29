/**
 * Barcode prüfen: 8–14 Ziffern (EAN-8, UPC-E, UPC-A, EAN-13, GTIN-14),
 * Leerzeichen und Bindestriche egal, Prüfziffer muss stimmen — fängt
 * Tippfehler bei der Zifferneingabe und Fehllesungen der Kamera ab.
 *
 * UPC-A (12 Stellen) wird zu GTIN-13 mit führender 0 — so führt Open Food
 * Facts das Produkt, und nur so findet ein zweiter Scan die gespeicherte
 * eigene Fassung wieder. Gleiche Regel in supabase/functions/food-lookup/off.ts.
 */
export function normalizeBarcode(raw: string): string | null {
  const digits = raw.replace(/[\s-]/g, '')
  if (!/^\d{8,14}$/.test(digits)) return null
  if (gs1ChecksumOk(digits)) return digits.length === 12 ? `0${digits}` : digits
  // 8 Stellen können auch UPC-E sein: Prüfziffer gilt für die ausgeschriebene UPC-A-Form.
  if (digits.length === 8) {
    const upcA = expandUpcE(digits)
    if (upcA && gs1ChecksumOk(upcA)) return digits
  }
  return null
}

/** GS1-Prüfziffer (EAN-8/13, UPC-A, GTIN-14): von rechts abwechselnd ×3 und ×1. */
export function gs1ChecksumOk(digits: string): boolean {
  const body = digits.slice(0, -1)
  let sum = 0
  for (let i = 0; i < body.length; i++) {
    sum += Number(body[body.length - 1 - i]) * (i % 2 === 0 ? 3 : 1)
  }
  return (10 - (sum % 10)) % 10 === Number(digits.at(-1))
}

/** UPC-E (Nummernsystem 0/1, 6 Ziffern, Prüfziffer) → UPC-A mit 12 Stellen; sonst null. */
export function expandUpcE(code: string): string | null {
  if (!/^[01]\d{7}$/.test(code)) return null
  const ns = code[0]
  const [d1, d2, d3, d4, d5, d6] = code.slice(1, 7)
  const check = code[7]
  let body: string
  if ('012'.includes(d6)) body = `${d1}${d2}${d6}0000${d3}${d4}${d5}`
  else if (d6 === '3') body = `${d1}${d2}${d3}00000${d4}${d5}`
  else if (d6 === '4') body = `${d1}${d2}${d3}${d4}00000${d5}`
  else body = `${d1}${d2}${d3}${d4}${d5}0000${d6}`
  return `${ns}${body}${check}`
}
