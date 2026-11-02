// Regelwächter: prüft jeden Satz, den Hoku zeigt, gegen die rechtlichen Leitplanken
// (EU-MDR, HWG, App-Store): keine Dosiseinheiten, keine Einnahme-Befehle, keine Wirkversprechen,
// keine Diagnose-, Kausal- oder Alarmwörter, und jede Zahl muss aus dem Fund stammen.
// Eine Funktion für App, Server und Tests. Reines TypeScript, keine Importe von außen.

import type { Fund } from './typen.ts'

export type Sprache = 'de' | 'en'

export const PFLICHTSATZ: Record<Sprache, string> = {
  de: 'Zusammenhang, kein Beweis.',
  en: 'A connection, not proof.',
}

// Einheiten, die nicht direkt hinter einer Zahl stehen dürfen.
export const EINHEITEN: string[] = ['mg', 'mcg', 'µg', 'ug', 'ie', 'iu', 'ml', 'einheiten', 'units']

// Ganze Wörter bzw. Wendungen (Leerraum zwischen Wörtern darf beliebig lang sein).
export const BEFEHL: Record<Sprache, string[]> = {
  de: ['nimm', 'nehmen sie', 'absetzen', 'starte'],
  en: ['take', 'stop taking', 'increase', 'reduce', 'combine', 'start taking', 'dose'],
}
// Wortanfänge: passen auf jede Endung („erhöhe“, „reduzierst“).
export const BEFEHL_STAEMME: Record<Sprache, string[]> = {
  de: ['erhöh', 'reduzier', 'kombinier', 'dosier'],
  en: [],
}
export const WIRKUNG: Record<Sprache, string[]> = {
  de: ['wirkt', 'hilft', 'ist gut für', 'sicher', 'unbedenklich'],
  en: ['works', 'helps', 'is good for', 'safe'],
}
export const DIAGNOSE: Record<Sprache, string[]> = {
  de: ['mangel', 'erkrankung', 'störung', 'krankheit'],
  en: ['deficiency', 'disease', 'disorder'],
}
export const KAUSAL: Record<Sprache, string[]> = {
  de: ['weil', 'deshalb', 'daher', 'verursacht', 'führt zu', 'wegen'],
  en: ['because', 'therefore', 'causes', 'leads to', 'due to'],
}
export const ALARM: Record<Sprache, string[]> = {
  de: ['achtung', 'warnung', 'gefährlich', 'gefahr'],
  en: ['warning', 'dangerous', 'danger', 'alert'],
}

// \b versagt neben ä/ö/ü/ß, deshalb eigene Grenzen über Unicode-Buchstaben und -Ziffern.
// Kein Lookbehind (iOS 15 bis 16.3 kennt es nicht): die Grenze davor ist Textanfang oder ein Nicht-Buchstabe.
const VOR = '(?:^|[^\\p{L}\\p{N}])'
const NACH = '(?![\\p{L}\\p{N}])'

function maskiere(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
}

function wortRegex(woerter: string[], staemme: string[] = []): RegExp | null {
  const teile = [
    ...woerter.map((w) => `${maskiere(w)}${NACH}`),
    ...staemme.map((w) => `${maskiere(w)}\\p{L}*`),
  ]
  return teile.length ? new RegExp(`${VOR}(?:${teile.join('|')})`, 'iu') : null
}

const EINHEIT_RE = new RegExp(`\\d+(?:[.,]\\d+)?\\s*(?:${EINHEITEN.map(maskiere).join('|')})${NACH}`, 'iu')
// „setz … ab“ (abgetrennte Vorsilbe) im selben Satz.
const SETZ_AB_RE = new RegExp(`${VOR}setz\\p{L}*[^.!?]*?${VOR}ab${NACH}`, 'iu')
const ZAHL_RE = /\d+(?:[.,]\d+)?/g

function treffer(re: RegExp | null, text: string): boolean {
  return re !== null && re.test(text)
}

function zahlImFund(z: number, fund: Fund | null): boolean {
  if (!fund) return false
  return Object.values(fund.werte).some(
    (w) => typeof w === 'number' && (Math.abs(w - z) < 1e-9 || Math.abs(Math.abs(w) - z) < 1e-9),
  )
}

export function pruefeText(text: string, sprache: Sprache, fund: Fund | null): { ok: boolean; verstoesse: string[] } {
  const verstoesse: string[] = []

  if (EINHEIT_RE.test(text)) verstoesse.push('einheit')

  const befehl = wortRegex(BEFEHL[sprache], BEFEHL_STAEMME[sprache])
  if (treffer(befehl, text) || (sprache === 'de' && SETZ_AB_RE.test(text))) verstoesse.push('befehl')

  if (treffer(wortRegex(WIRKUNG[sprache]), text)) verstoesse.push('wirkung')
  if (treffer(wortRegex(DIAGNOSE[sprache]), text)) verstoesse.push('diagnose')
  if (treffer(wortRegex(KAUSAL[sprache]), text)) verstoesse.push('kausal')
  if (treffer(wortRegex(ALARM[sprache]), text)) verstoesse.push('alarm')

  const gesehen = new Set<string>()
  for (const m of text.matchAll(ZAHL_RE)) {
    const z = m[0].replace(',', '.')
    if (gesehen.has(z)) continue
    gesehen.add(z)
    if (!zahlImFund(Number(z), fund)) verstoesse.push(`zahl:${z}`)
  }

  if (fund?.richtung === 'neutral' && !text.includes(PFLICHTSATZ[sprache])) verstoesse.push('pflichtsatz')

  return { ok: verstoesse.length === 0, verstoesse }
}
