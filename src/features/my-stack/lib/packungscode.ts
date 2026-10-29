/**
 * Data-Matrix-Code auf Arzneimittelpackungen (securPharm). Er traegt keine
 * Bezeichnung, nur Nummern: PZN, Charge, Verfall und eine Seriennummer. Den
 * Namen liest danach das Etikettfoto — eine PZN-Datenbank (ABDA) ist bewusst
 * nicht angebunden.
 *
 * Zwei Schreibweisen sind im Umlauf:
 * - IFA/ASC (Deutschland): `[)>␞06␝9N11<PZN8><P2>␝1T<Charge>␝D<JJMMTT>␝S<Serie>␞␄`
 * - GS1: `(01)<GTIN-14>(17)<JJMMTT>(10)<Charge>(21)<Serie>` mit ␝ statt Klammern
 *   hinter Feldern ohne feste Laenge. Die PZN steht in `(710)` oder steckt in
 *   der NTIN `04150<PZN8><P>`.
 */

export interface Packungscode {
  pzn: string | null
  charge: string | null
  /** Verfall als `JJJJ-MM-TT`. „00" als Tag heisst: Monatsende. */
  verfall: string | null
}

const GS = '\x1d'
const RS = '\x1e'
const EOT = '\x04'

/** PZN-8 mit Pruefziffer (Modulo 11, Gewichte 1–7). */
export function pznGueltig(pzn: string): boolean {
  if (!/^\d{8}$/.test(pzn)) return false
  const summe = [...pzn.slice(0, 7)].reduce((s, z, i) => s + Number(z) * (i + 1), 0)
  const pruef = summe % 11
  return pruef !== 10 && pruef === Number(pzn[7])
}

function verfallAus(jjmmtt: string | undefined): string | null {
  if (!jjmmtt || !/^\d{6}$/.test(jjmmtt)) return null
  const jahr = 2000 + Number(jjmmtt.slice(0, 2))
  const monat = Number(jjmmtt.slice(2, 4))
  let tag = Number(jjmmtt.slice(4, 6))
  if (monat < 1 || monat > 12) return null
  const letzter = new Date(Date.UTC(jahr, monat, 0)).getUTCDate()
  if (tag === 0) tag = letzter
  if (tag > letzter) return null
  return `${jahr}-${String(monat).padStart(2, '0')}-${String(tag).padStart(2, '0')}`
}

const charge = (s: string | undefined): string | null => {
  const c = s?.trim()
  return c && /^[\x21-\x7e]{1,20}$/.test(c) ? c : null
}

function ausAsc(text: string): Packungscode | null {
  const felder = text.slice(text.indexOf(`06${GS}`) + 3).split(new RegExp(`[${GS}${RS}${EOT}]`)).filter(Boolean)
  let ppn: string | undefined, lot: string | undefined, datum: string | undefined
  for (const feld of felder) {
    if (feld.startsWith('9N')) ppn = feld.slice(2)
    else if (feld.startsWith('1T')) lot = feld.slice(2)
    else if (feld.startsWith('D')) datum = feld.slice(1)
  }
  // PPN der IFA: „11" + PZN-8 + zwei Pruefziffern.
  const pzn = ppn && /^11\d{10}$/.test(ppn) && pznGueltig(ppn.slice(2, 10)) ? ppn.slice(2, 10) : null
  const ergebnis = { pzn, charge: charge(lot), verfall: verfallAus(datum) }
  return ergebnis.pzn || ergebnis.verfall ? ergebnis : null
}

// Feste Laengen nach GS1; alle anderen Werte enden am ␝ (oder am Ende).
const FEST: Record<string, number> = {
  '00': 18, '01': 14, '02': 14, '11': 6, '12': 6, '13': 6, '15': 6, '16': 6, '17': 6, '20': 2,
}

/** Laenge des Anwendungskennzeichens: zwei, drei oder vier Ziffern, nach den ersten beiden. */
function kennzeichenLaenge(anfang: string): number {
  if (/^(23|24|25|40|41|42|71)$/.test(anfang)) return 3
  if (/^(31|32|33|34|35|36|39|70|72|80|81|82)$/.test(anfang)) return 4
  return 2
}
const FEST_LANG = (ai: string): number | undefined =>
  FEST[ai] ?? (/^3[1-6]\d\d$/.test(ai) ? 6 : /^41\d$/.test(ai) ? 13 : ai === '7003' ? 10 : undefined)

function ausGs1(text: string): Packungscode | null {
  const s = text
    .replace(/^\](d2|d1|C1|Q3)/, '')
    .replace(/\((\d{2,4})\)/g, (_, ai: string) => `${GS}${ai}`)
    .replace(new RegExp(`^${GS}+`), '')
  const werte: Record<string, string> = {}
  let i = 0
  while (i < s.length) {
    if (s[i] === GS) { i++; continue }
    // 710–715: nationale Arzneimittelnummer (in Deutschland 710 = PZN).
    const ai = s.slice(i, i + kennzeichenLaenge(s.slice(i, i + 2)))
    if (!/^\d{2,4}$/.test(ai)) return null
    i += ai.length
    const laenge = FEST_LANG(ai)
    if (laenge) {
      werte[ai] = s.slice(i, i + laenge)
      i += laenge
    } else {
      const ende = s.indexOf(GS, i)
      werte[ai] = s.slice(i, ende < 0 ? s.length : ende)
      i = ende < 0 ? s.length : ende + 1
    }
  }
  const gtin = werte['01']
  if (!gtin || !/^\d{14}$/.test(gtin)) return null
  const nhrn = werte['710']
  const pzn = nhrn && pznGueltig(nhrn)
    ? nhrn
    : gtin.startsWith('04150') && pznGueltig(gtin.slice(5, 13)) ? gtin.slice(5, 13) : null
  const ergebnis = { pzn, charge: charge(werte['10']), verfall: verfallAus(werte['17']) }
  // Nur eine GTIN: ein Produkt, keine Arzneimittelpackung.
  return ergebnis.pzn || ergebnis.charge || ergebnis.verfall ? ergebnis : null
}

/** Liest den Code einer Arzneimittelpackung; `null`, wenn es keiner ist. */
export function parsePackungscode(raw: string): Packungscode | null {
  const text = raw.trim()
  if (text.startsWith('[)>')) return ausAsc(text)
  // Ein reiner EAN/UPC ist ein Produkt-Barcode, kein Packungscode.
  if (/^\d{8,14}$/.test(text)) return null
  const ohneKennung = text.replace(/^\](d2|d1|C1|Q3)/, '')
  const ohneTrenner = ohneKennung.startsWith(GS) ? ohneKennung.slice(1) : ohneKennung
  if (/^(\(01\)|01)\d{14}/.test(ohneTrenner)) return ausGs1(text)
  return null
}
