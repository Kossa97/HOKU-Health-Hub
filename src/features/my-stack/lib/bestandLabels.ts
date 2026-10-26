import type { Translate } from './planLabels'
import { formatLocalDay } from './localDays'
import { getDosageForm } from './dosageForms'
import { anbruchArt, behaelterArt, behaelterGroesse, vorratTeile, type Reichweite } from './bestand'
import type { DosageFormKey, StackItemIngredient, StackItemInventory } from '../types'

/** Texte zum Bestand — Zahlen mit Einheit, Reichweite. */

const BEKANNTE_EINHEITEN = new Set([
  'vial', 'tablet', 'capsule', 'drop', 'ml', 'spray', 'dose', 'patch',
  'g', 'portion', 'application', 'ampoule', 'unit', 'hour',
])

export function formatAmount(value: number, language: string): string {
  return new Intl.NumberFormat(language, { maximumFractionDigits: 2 }).format(value)
}

/**
 * „3 Vials", „1 Tablette", „30 ml". Einzahl nur bei genau 1; eine unbekannte
 * Einheit (frei eingegeben) steht, wie sie gespeichert ist.
 */
export function stockAmountLabel(t: Translate, value: number, unit: string | null, language: string): string {
  const count = formatAmount(value, language)
  if (!unit) return count
  if (!BEKANNTE_EINHEITEN.has(unit)) return `${count} ${unit}`
  const form = value === 1 ? 'single' : 'multiple'
  return String(t(`my_stack_stock_unit_${unit}_${form}`, { n: count }))
}

/** Nur das Wort der Einheit, in der Mehrzahl: „Vials", „Tabletten". */
export function stockUnitName(t: Translate, unit: string): string {
  if (!BEKANNTE_EINHEITEN.has(unit)) return unit
  return String(t(`my_stack_stock_unit_${unit}_multiple`, { n: '' })).trim()
}

/** Nur das Wort der Einheit, in der Einzahl: „Sprühstoß", „Tropfen" — fuer „125 mcg / Sprühstoß". */
export function stockUnitSingular(t: Translate, unit: string): string {
  // Einheitenzeichen bleiben Zeichen; uebersetzt werden nur Woerter.
  if (!BEKANNTE_EINHEITEN.has(unit) || unit === 'ml' || unit === 'g') return unit
  return String(t(`my_stack_stock_unit_${unit}_single`, { n: '' })).trim()
}

export function daysLabel(t: Translate, days: number): string {
  return String(t(days === 1 ? 'my_stack_stock_days_single' : 'my_stack_stock_days_multiple', { n: days }))
}

export function reichweiteLabel(
  t: Translate,
  range: Reichweite,
  unit: string | null,
  language: string,
): string {
  switch (range.art) {
    case 'tage':
      return String(t(range.tage === 1 ? 'my_stack_stock_range_days_single' : 'my_stack_stock_range_days_multiple', {
        n: range.tage,
        date: formatLocalDay(range.bis, language),
      }))
    case 'laenger':
      return String(t('my_stack_stock_range_longer', { n: range.tage }))
    case 'kein_plan':
      return String(t('my_stack_stock_range_no_plan'))
    case 'unbekannt':
      return String(t('my_stack_stock_range_unknown', { unit: unit ?? '' }))
    case 'leer':
      return String(t('my_stack_stock_empty'))
  }
}

/** Einheiten, in denen ein Bestand zaehlen kann: die Bezuege der Zutaten zuerst. */
export function stockUnitChoices(form: DosageFormKey, ingredients: readonly StackItemIngredient[]): string[] {
  const ausZutaten = ingredients.map(zutat => zutat.basis_unit).filter((unit): unit is string => Boolean(unit))
  return [...new Set([...ausZutaten, ...getDosageForm(form).basisUnits])]
}

/**
 * Der Knopf, der einen neuen Behaelter anbricht — je Form ein eigenes Wort.
 * Ein Vial mit fertiger Loesung wird angebrochen, nicht rekonstituiert.
 */
export function neuAnbrechenLabel(t: Translate, form: DosageFormKey | null | undefined, loesung = false): string {
  if (form === 'vial' && loesung) return String(t('my_stack_stock_open_new_vial'))
  const key = {
    vial: 'my_stack_stock_mix_new',
    pen: 'my_stack_stock_open_new_pen',
    spray: 'my_stack_stock_open_new_spray',
    bottle: 'my_stack_stock_open_new_bottle',
  }[behaelterArt(form) ?? 'bottle']
  return String(t(key))
}

/**
 * Die Zahl oben: was noch da ist. Wo die Form Behaelter anbricht — Vial, Pen,
 * Spray, Tropfflasche — in Behaeltern: „2 Sprays · + 1 geöffnet · 40 %".
 * Gezaehlt wird darunter weiter in der Packungseinheit (Spruehstoesse …);
 * ohne bekannte Behaeltergroesse bleibt es bei ihr.
 */
export function vorratZeilen(
  t: Translate,
  inventory: StackItemInventory,
  form: DosageFormKey | null | undefined,
  language: string,
): { gross: string; klein: string | null; anteil: number } {
  const art = anbruchArt(form)
  const behaelter = behaelterArt(form)
  const teile = vorratTeile(inventory)
  const einheit = inventory.package_unit
  const packung = inventory.package_quantity
  const anteil = packung && packung > 0 ? teile.rest / Math.max(packung, teile.rest) : teile.rest > 0 ? 1 : 0
  if (art === 'vial' && einheit === 'vial') {
    return {
      gross: stockAmountLabel(t, teile.voll, 'vial', language),
      klein: teile.angebrochenAnteil != null
        ? String(t('my_stack_stock_mixed_extra', { percent: Math.round(teile.angebrochenAnteil * 100) }))
        : null,
      anteil,
    }
  }
  const groesse = behaelterGroesse(inventory)
  // Vial mit fertiger Loesung, gezaehlt in ml: die Menge vorn, dahinter die
  // Vials — „18 ml · 1 ungeöffnet + 1 angebrochen · 80 %".
  if (art === 'vial' && einheit && groesse) {
    return {
      gross: stockAmountLabel(t, teile.rest, einheit, language),
      klein: teile.angebrochenAnteil != null
        ? String(t(teile.voll > 0 ? 'my_stack_stock_solution_vial_extra' : 'my_stack_stock_solution_vial_opened', {
          n: teile.voll,
          percent: Math.max(1, Math.round(teile.angebrochenAnteil * 100)),
        }))
        : String(t('my_stack_stock_solution_vial_size', { amount: stockAmountLabel(t, groesse, einheit, language) })),
      anteil,
    }
  }
  if (behaelter && behaelter !== 'vial' && groesse && einheit) {
    const behaelterText = (anzahl: number) => String(t(
      `my_stack_stock_container_${behaelter}_${anzahl === 1 ? 'single' : 'multiple'}`,
      { n: formatAmount(anzahl, language) },
    ))
    const groesseText = String(t('my_stack_stock_container_size', { amount: stockAmountLabel(t, groesse, einheit, language) }))
    // „Geöffnet" nur, wenn wirklich einer geoeffnet ist — dieselbe Teilung,
    // nach der der Knopf „Neues Spray öffnen" sperrt. Ohne Oeffnungsdatum
    // sind es schlicht so viele Behaelter, notfalls mit Komma.
    if (teile.angebrochenAnteil == null) {
      return { gross: behaelterText(Math.round(teile.rest / groesse * 10) / 10), klein: groesseText, anteil }
    }
    return {
      gross: behaelterText(teile.voll),
      klein: String(t(behaelter === 'pen' ? 'my_stack_stock_pen_extra' : 'my_stack_stock_bottle_extra', {
        percent: Math.max(1, Math.round(teile.angebrochenAnteil * 100)),
      })),
      anteil,
    }
  }
  if (art && teile.angebrochen > 0) {
    return {
      gross: stockAmountLabel(t, teile.rest, einheit, language),
      klein: String(t('my_stack_stock_opened_extra', { amount: stockAmountLabel(t, teile.angebrochen, einheit, language) })),
      anteil,
    }
  }
  return {
    gross: stockAmountLabel(t, teile.rest, einheit, language),
    klein: packung ? String(t('my_stack_stock_package_line', { amount: stockAmountLabel(t, packung, einheit, language) })) : null,
    anteil,
  }
}
