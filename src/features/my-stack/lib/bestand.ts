import { addDays, format, parseISO } from 'date-fns'
import { resolveTimelineIntakesForDay } from '../../../lib/intakeSchedule'
import type { CycleTimeline } from '../../../lib/planTimeline'
import { localDateTimeKey } from '../../../lib/planTimeline'
import type { DosageFormKey, StackItemIngredient, StackItemInventory } from '../types'

/**
 * Rechnungen zum Bestand einer Substanz — fuer jede Darreichungsform dieselben.
 *
 * Gezaehlt wird in der Einheit der Packung (`package_unit`): Vials, Tabletten,
 * Tropfen, ml. Wie eine Einnahme in diese Einheit umgerechnet wird, steht in
 * `dosisInPackungseinheit` und folgt Zeile fuer Zeile der Datenbank
 * (`apply_inventory_confirmation`): was die App als Reichweite verspricht,
 * muss die Datenbank beim Abbuchen genauso rechnen.
 */

/**
 * Was bei dieser Form „angebrochen" heisst. Ein Vial wird angemischt, eine
 * Flasche oder ein Pen geoeffnet — und ist danach nur begrenzt haltbar.
 * Tabletten, Kapseln, Pflaster, Ampullen (einmal auf, sofort leer) kennen das
 * nicht; dort gibt es keinen solchen Block.
 */
export type AnbruchArt = 'vial' | 'pen' | 'flasche'

export function anbruchArt(form: DosageFormKey | null | undefined): AnbruchArt | null {
  switch (form) {
    case 'vial': return 'vial'
    case 'pen': return 'pen'
    case 'drops':
    case 'spray':
    case 'nasal_spray':
      return 'flasche'
    default:
      return null
  }
}

/**
 * Worin der Vorrat kommt — fuer die Texte. Gezaehlt wird weiter in der
 * Einheit der Packung (Spruehstoesse, Tropfen, Dosen); angezeigt werden die
 * Behaelter: „2 Sprays · + 1 geöffnet · 40 %" statt „240 Sprühstöße".
 */
export type Behaelter = 'vial' | 'pen' | 'spray' | 'bottle'

export function behaelterArt(form: DosageFormKey | null | undefined): Behaelter | null {
  switch (form) {
    case 'vial': return 'vial'
    case 'pen': return 'pen'
    case 'spray':
    case 'nasal_spray':
      return 'spray'
    case 'drops': return 'bottle'
    default: return null
  }
}

/**
 * Bucht dieses Vial ueber den Bestand? Dieselbe Regel wie
 * `vial_uses_inventory` in der Datenbank: Bestand in Vials und genau ein
 * Wirkstoff pro Vial. Sonst bleibt der alte Weg zustaendig, und der Bestand
 * hier wird nicht abgebucht.
 */
export function vialBuchtUeberBestand(
  inventory: StackItemInventory | null | undefined,
  ingredients: readonly StackItemIngredient[],
): boolean {
  if (inventory?.package_unit !== 'vial' || ingredients.length !== 1) return false
  const [zutat] = ingredients
  return zutat.basis_unit === 'vial' && (zutat.amount_value ?? 0) > 0 && (zutat.basis_value ?? 0) > 0
}

/**
 * Ein Vial mit fertiger Loesung (Testosteron, 250 mg/ml): es wird angebrochen,
 * nicht angemischt. Pulver-Vials gibt es nur bei Peptiden (wie
 * `istPulverVial` im Formular).
 */
export function istLoesungsVial(form: DosageFormKey | null | undefined, category: string | null | undefined): boolean {
  return form === 'vial' && category != null && category !== 'peptide'
}

/**
 * Wie die Haltbarkeit nach dem ersten Oeffnen heisst — oder `null`, wenn nur
 * das Ablaufdatum der Packung zaehlt. Ein Pulver-Vial wird angemischt, eine
 * fertige Loesung angebrochen, ein Pen ist ab der ersten Benutzung in Gebrauch,
 * Flaschen, Tuben und Dosen werden geoeffnet. Ampulle, Kapsel, Tablette und
 * Pflaster nicht: eine Ampulle wird einmal geoeffnet und ganz verwendet, der
 * Rest ist einzeln verpackt.
 */
export type HaltbarkeitArt = 'angemischt' | 'angebrochen' | 'benutzung' | 'geoeffnet'

export function haltbarkeitArt(form: DosageFormKey | null | undefined, category: string | null | undefined): HaltbarkeitArt | null {
  switch (form) {
    case 'vial': return istLoesungsVial(form, category) ? 'angebrochen' : 'angemischt'
    case 'pen': return 'benutzung'
    case 'drops':
    case 'spray':
    case 'nasal_spray':
    case 'gel':
    case 'tube':
    case 'powder':
      return 'geoeffnet'
    default:
      return null
  }
}

/** Bis wann aufbrauchen: Oeffnen plus Haltbarkeit, hoechstens bis zum Ablaufdatum. */
export function aufbrauchenBis(openedAt: string | null | undefined, useWithinDays: number | null | undefined, expiresAt?: string | null): string | null {
  if (!openedAt || useWithinDays == null || !gueltigeHaltbarkeit(useWithinDays)) return null
  const ende = format(addDays(parseISO(openedAt), useWithinDays), 'yyyy-MM-dd')
  return expiresAt && expiresAt < ende ? expiresAt : ende
}

/**
 * Bucht die Datenbank bestaetigte Einnahmen von diesem Bestand ab? Dieselbe
 * Regel wie `apply_inventory_confirmation`: ein in Vials gefuehrtes Vial ueber
 * `vialBuchtUeberBestand`, ein in ml (o. ae.) gefuehrtes wie jede andere Form
 * nur mit erfasster Staerke. Ein in Vials gefuehrtes ohne eindeutige
 * Umrechnung bleibt beim alten Weg — der Bestand hier aendert sich dann nicht.
 */
export function buchtEinnahmenAb(item: {
  dosage_form: DosageFormKey
  tracking_level: string
  inventory?: StackItemInventory | null
  ingredients: readonly StackItemIngredient[]
}): boolean {
  if (item.dosage_form === 'vial') {
    const einheit = item.inventory?.package_unit
    if (einheit === 'vial') return vialBuchtUeberBestand(item.inventory, item.ingredients)
    // Ohne Packungseinheit nimmt die Datenbank den alten Weg.
    if (!einheit || !item.inventory?.enabled) return false
  }
  return item.tracking_level === 'complete'
}

/**
 * Wie viel ein einzelner Behaelter fasst, in Packungseinheiten. Beim Vial ist
 * die Packungseinheit das Vial selbst; sonst beschreibt die Packungsgroesse
 * einen Behaelter („eine Flasche mit 30 ml").
 */
export function behaelterGroesse(inventory: StackItemInventory): number | null {
  if (inventory.package_unit === 'vial') return 1
  const groesse = inventory.package_quantity
  return groesse != null && groesse > 0 ? groesse : null
}

function rund(wert: number, stellen = 4): number {
  const faktor = 10 ** stellen
  return Math.round(wert * faktor) / faktor
}

export interface VorratTeile {
  rest: number
  /** Ungeoeffnete Behaelter. */
  voll: number
  /** Was im angebrochenen Behaelter noch ist, in Packungseinheiten; 0 = keiner. */
  angebrochen: number
  /** Derselbe Rest als Anteil des Behaelters (0–1), oder null ohne Behaeltergroesse. */
  angebrochenAnteil: number | null
}

/**
 * Teilt den Vorrat in volle Behaelter und den angebrochenen. Beim Vial ist der
 * Nachkommateil das angemischte Vial: 2,95 Vials sind zwei volle und eines
 * mit 95 %.
 */
export function vorratTeile(inventory: StackItemInventory): VorratTeile {
  const rest = Math.max(0, inventory.remaining_quantity ?? 0)
  const groesse = behaelterGroesse(inventory)
  if (!groesse || !teiltInBehaelter(inventory)) {
    return { rest, voll: rest, angebrochen: 0, angebrochenAnteil: null }
  }
  const angebrochen = rund(rest % groesse)
  const voll = Math.round((rest - angebrochen) / groesse)
  return {
    rest,
    voll,
    angebrochen,
    angebrochenAnteil: angebrochen > 0 ? rund(angebrochen / groesse, 4) : null,
  }
}

// Nur wo ein Behaelter angebrochen wird, ergibt die Teilung Sinn. Tabletten
// „in einer Packung zu 60" sind 42 Tabletten, nicht 0 volle Packungen und
// eine zu 70 %.
function teiltInBehaelter(inventory: StackItemInventory): boolean {
  return inventory.package_unit === 'vial' || inventory.opened_at != null
}

export interface BestandAufteilung {
  /** Wie viel ein Behaelter fasst, in Packungseinheiten. */
  groesse: number
  /** Ungeoeffnete Behaelter. */
  voll: number
  /** Was im angebrochenen noch ist, in Prozent (0 = keiner). */
  prozent: number
}

/**
 * Fuer „Bestand aendern": ungeoeffnete Behaelter und der angebrochene in
 * Prozent. Anders als `vorratTeile` auch ohne Oeffnungsdatum — man soll dort
 * eintragen koennen, dass ein Pen angebrochen ist. Null, wo die Form nichts
 * anbricht oder die Behaeltergroesse fehlt: dann gibt es nur die eine Menge.
 */
export function bestandAufteilen(inventory: StackItemInventory, art: AnbruchArt | null): BestandAufteilung | null {
  if (!art) return null
  const groesse = behaelterGroesse(inventory)
  if (!groesse) return null
  const rest = Math.max(0, inventory.remaining_quantity ?? 0)
  const voll = Math.floor(rest / groesse + 1e-9)
  return { groesse, voll, prozent: Math.round((rest - voll * groesse) / groesse * 100) }
}

// Einheiten, die man zaehlt: dort gibt es keinen halben Spruehstoss.
const ZAEHLBAR_TEILBAR = new Set(['vial', 'ml', 'g'])

/**
 * Der Vorrat aus ungeoeffneten Behaeltern und dem angebrochenen in Prozent.
 *
 * Die Prozentzahl ist gerundet. Bleibt sie, wie sie angezeigt wurde, gilt der
 * genaue Rest von vorher — sonst aendert schon „Speichern ohne Aenderung" den
 * Bestand (181 Stoesse wuerden zu 181,2). Gezaehlte Einheiten bleiben ganz.
 */
export function bestandZusammensetzen(
  vorher: BestandAufteilung,
  voll: number,
  prozent: number,
  inventory: Pick<StackItemInventory, 'remaining_quantity' | 'package_unit'>,
): number {
  const { groesse } = vorher
  const angebrochen = prozent === vorher.prozent
    ? Math.max(0, (inventory.remaining_quantity ?? 0) - vorher.voll * groesse)
    : prozent / 100 * groesse
  const gesamt = rund(voll * groesse + angebrochen)
  return ZAEHLBAR_TEILBAR.has(inventory.package_unit ?? '') ? gesamt : Math.round(gesamt)
}

/** Zugefuegte Fluessigkeit: mehr als 0 und hoechstens 1000 ml (Check in der Datenbank). */
export function gueltigeFluessigkeit(ml: number | null | undefined): boolean {
  return ml == null || (ml > 0 && ml <= 1000)
}

/** Haltbarkeit danach: ganze Tage von 1 bis 3650 (Check in der Datenbank). */
export function gueltigeHaltbarkeit(tage: number | null | undefined): boolean {
  return tage == null || (Number.isInteger(tage) && tage >= 1 && tage <= 3650)
}

/**
 * Bis wann der angebrochene Behaelter haelt (`YYYY-MM-DD`), oder null — ohne
 * das Ablaufdatum: `haltbarkeitFuer` unterscheidet „Anbruch vorbei" von
 * „Packung abgelaufen" und nimmt selbst die fruehere Frist.
 */
export function haltbarBis(inventory: StackItemInventory): string | null {
  return aufbrauchenBis(inventory.opened_at, inventory.use_within_days)
}

/**
 * Eine Einnahme in Packungseinheiten — dieselbe Regel wie
 * `apply_inventory_confirmation`: jede Zutat mit der Packungseinheit als Bezug
 * muss dieselbe Menge ergeben, sonst ist die Umrechnung mehrdeutig (null).
 */
export function dosisInPackungseinheit(
  dose: number | null,
  unit: string | null,
  ingredients: readonly StackItemIngredient[],
  inventory: StackItemInventory,
): number | null {
  if (dose == null || !unit || dose <= 0 || ingredients.length === 0) return null
  const packung = inventory.package_unit
  const deltas = ingredients.map(zutat => {
    if (zutat.basis_unit !== packung) return null
    const menge = zutat.amount_value
    const bezug = zutat.basis_value
    if (unit === zutat.basis_unit) return dose
    if (menge != null && menge > 0 && bezug != null) {
      if (unit === zutat.amount_unit) return dose / menge * bezug
      if (unit === 'mg' && zutat.amount_unit === 'mcg') return dose * 1000 / menge * bezug
      if (unit === 'mcg' && zutat.amount_unit === 'mg') return dose / 1000 / menge * bezug
    }
    if (packung === 'vial' && unit.toLowerCase() === 'ml' && (inventory.reconstitution_ml ?? 0) > 0) {
      return dose / inventory.reconstitution_ml!
    }
    return null
  })
  if (deltas.some(delta => delta == null || !(delta > 0))) return null
  // Gerundet verglichen: die Datenbank rechnet exakt (numeric), JavaScript in
  // Gleitkomma — 0,2/0,3·3 und 0,2/0,1·1 sollen auch hier gleich sein.
  const erste = rund(deltas[0]!, 9)
  if (deltas.some(delta => rund(delta!, 9) !== erste)) return null
  return packung === 'vial' ? rund(erste) : erste
}

export type Reichweite =
  | { art: 'tage'; tage: number; bis: string }
  | { art: 'laenger'; tage: number }
  | { art: 'unbekannt' }
  | { art: 'kein_plan' }
  | { art: 'leer' }

export const REICHWEITE_HORIZONT_TAGE = 180

/**
 * Wie lange der Vorrat nach dem Plan noch reicht — mit allen geplanten Stufen,
 * denn eine Titration verbraucht in drei Wochen mehr als heute.
 *
 * Gezaehlt werden die Einnahmen ab jetzt; heute nur die, die noch kommen.
 * `tage` ist die Zahl der Tage, deren Einnahmen der Vorrat noch ganz deckt,
 * `bis` der letzte davon.
 */
export function reichweite(input: {
  inventory: StackItemInventory
  ingredients: readonly StackItemIngredient[]
  timelines: readonly CycleTimeline[]
  now: Date
  timeZone: string
  horizonDays?: number
}): Reichweite {
  const { inventory, ingredients, timelines, now, timeZone } = input
  const horizont = input.horizonDays ?? REICHWEITE_HORIZONT_TAGE
  let rest = Math.max(0, inventory.remaining_quantity ?? 0)
  if (rest <= 0) return { art: 'leer' }
  if (timelines.length === 0) return { art: 'kein_plan' }

  const heute = localDateTimeKey(now, timeZone).slice(0, 10)
  let gedeckt = 0
  let letzterTag = heute
  let sahEinnahme = false
  for (let tag = 0; tag < horizont; tag += 1) {
    const datum = format(addDays(parseISO(heute), tag), 'yyyy-MM-dd')
    let bedarf = 0
    for (const timeline of timelines) {
      for (const einnahme of resolveTimelineIntakesForDay(timeline, datum, timeZone)) {
        if (tag === 0 && new Date(einnahme.scheduledAt) <= now) continue
        const delta = dosisInPackungseinheit(einnahme.dose, einnahme.unit, ingredients, inventory)
        if (delta == null) return { art: 'unbekannt' }
        bedarf += delta
        sahEinnahme = true
      }
    }
    if (bedarf > rest + 1e-9) {
      return sahEinnahme ? { art: 'tage', tage: gedeckt, bis: letzterTag } : { art: 'kein_plan' }
    }
    rest -= bedarf
    gedeckt = tag + 1
    letzterTag = datum
  }
  return sahEinnahme ? { art: 'laenger', tage: horizont } : { art: 'kein_plan' }
}

/** Einheiten pro ml auf der Spritze. U-100 ist der Normalfall. */
export function spritzenEinheitenProMl(syringeType: string | null | undefined): number {
  const text = (syringeType ?? '').replace(',', '.')
  // Das fruehere Formular speicherte „ml:Einheiten", die Datenbank-Vorgabe
  // lautet „1 mL (100 Einheiten)".
  const paar = /^\s*(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)\s*$/.exec(text)
    ?? /(\d+(?:\.\d+)?)\s*ml\D*?(\d+(?:\.\d+)?)/i.exec(text)
  if (paar) {
    const ml = Number(paar[1])
    const einheiten = Number(paar[2])
    if (ml > 0 && einheiten > 0) return einheiten / ml
  }
  return 100
}

export interface SpritzenRechnung {
  /** Wirkstoff je ml der angemischten Loesung, in `einheit`. */
  proMl: number
  einheit: string
  /** Wirkstoff im Vial und die zugefuegte Fluessigkeit — fuer den Hinweis. */
  imVial: number
  ml: number
  einheitenProMl: number
}

/**
 * Konzentration eines angemischten Vials: der eine Wirkstoff pro Vial geteilt
 * durch die zugefuegte Fluessigkeit. Ohne beides (oder bei Mischungen) null.
 */
export function spritzenRechnung(
  ingredients: readonly StackItemIngredient[],
  reconstitutionMl: number | null | undefined,
  syringeType: string | null | undefined,
): SpritzenRechnung | null {
  if (ingredients.length !== 1 || !reconstitutionMl || reconstitutionMl <= 0) return null
  const [zutat] = ingredients
  if (zutat.basis_unit !== 'vial' || !zutat.amount_value || !zutat.amount_unit || !zutat.basis_value) return null
  const imVial = zutat.amount_value / zutat.basis_value
  return {
    proMl: imVial / reconstitutionMl,
    einheit: zutat.amount_unit,
    imVial,
    ml: reconstitutionMl,
    einheitenProMl: spritzenEinheitenProMl(syringeType),
  }
}

/** Wie viele Einheiten fuer diese Dosis aufzuziehen sind, auf eine Stelle. */
export function aufzuziehendeEinheiten(
  dose: number | null,
  unit: string | null,
  rechnung: SpritzenRechnung,
): number | null {
  if (dose == null || !unit || dose <= 0) return null
  let ml: number | null = null
  if (unit.toLowerCase() === 'ml') ml = dose
  else if (unit === rechnung.einheit) ml = dose / rechnung.proMl
  else if (unit === 'mcg' && rechnung.einheit === 'mg') ml = dose / 1000 / rechnung.proMl
  else if (unit === 'mg' && rechnung.einheit === 'mcg') ml = dose * 1000 / rechnung.proMl
  if (ml == null || !Number.isFinite(ml)) return null
  return Math.round(ml * rechnung.einheitenProMl * 10) / 10
}

/** Einheiten, in denen man eine Einnahme zaehlt: ein Spruehstoss, eine Tablette, ein Tropfen … */
const STUECK_EINHEITEN = new Set(['spray', 'tablet', 'capsule', 'drop', 'dose', 'patch'])

/** Gewichtseinheiten untereinander, in mg. */
const IN_MG: Record<string, number> = { mcg: 0.001, mg: 1, g: 1000 }

export interface StueckRechnung {
  /** Wirkstoff je Stueck, in `einheit` — etwa 300 (mcg) je Spruehstoss. */
  proStueck: number
  einheit: string
  /** Die Zaehleinheit: `spray`, `tablet`, `capsule`, `drop`, `dose`, `patch`. */
  stueck: string
}

/**
 * Woraus sich die Stueckzahl einer Einnahme rechnet — das Gegenstueck zur
 * Spritzenrechnung beim Vial. Nur bei genau einem Wirkstoff, dessen Staerke
 * je Stueck angegeben ist („300 mcg / 1 Sprühstoß"); sonst null.
 */
export function stueckRechnung(ingredients: readonly StackItemIngredient[]): StueckRechnung | null {
  if (ingredients.length !== 1) return null
  const [zutat] = ingredients
  if (!zutat.basis_unit || !STUECK_EINHEITEN.has(zutat.basis_unit)) return null
  if (!zutat.amount_value || zutat.amount_value <= 0 || !zutat.amount_unit || !zutat.basis_value || zutat.basis_value <= 0) return null
  return { proStueck: zutat.amount_value / zutat.basis_value, einheit: zutat.amount_unit, stueck: zutat.basis_unit }
}

/**
 * Wie viele Stueck eine Einnahme sind: 600 mcg bei 300 mcg je Spruehstoss
 * sind 2 Spruehstoesse. Auf eine Nachkommastelle — eine halbe Tablette gibt
 * es. Null, wenn die Menge schon in Stueck angegeben ist oder sich nicht
 * umrechnen laesst.
 */
export function stueckZahl(dose: number | null, unit: string | null, rechnung: StueckRechnung): number | null {
  if (dose == null || !unit || dose <= 0 || unit === rechnung.stueck) return null
  let menge: number | null = null
  if (unit === rechnung.einheit) menge = dose
  else if (IN_MG[unit] != null && IN_MG[rechnung.einheit] != null) menge = dose * IN_MG[unit] / IN_MG[rechnung.einheit]
  if (menge == null || !Number.isFinite(menge)) return null
  return Math.round(menge / rechnung.proStueck * 10) / 10
}
