import { AMPOULE_SPEC } from '../extensions/ampoule/ampouleShape'
import { CAPSULE_SPEC } from '../extensions/capsule/capsuleShape'
import { NASAL_SPRAY_SPEC } from '../extensions/nasal-spray/nasalSprayShape'
import { GEL_SPEC } from '../extensions/gel/gelShape'
import { PEN_SPEC } from '../extensions/pen/penShape'
import { POWDER_SPEC } from '../extensions/powder/powderShape'
import { SPRAY_SPEC } from '../extensions/spray/sprayShape'
import { TABLET_SPEC } from '../extensions/tablet/tabletShape'
import { DROPS_SPEC } from '../extensions/drops/dropsShape'
import { PATCH_SPEC } from '../extensions/patch/patchShape'
import { TUBE_SPEC } from '../extensions/tube/tubeShape'
import { VIAL_SPEC } from '../extensions/peptide/vialShape'
import { INTAKE_METHODS } from '../../../lib/intakeMethods'
import type { StageFormSpec } from '../stage/types'
import type { DosageFormCapability, DosageFormKey, IntakeUnitKey, StackCategory, StrengthShape } from '../types'

export interface DosageFormDefinition {
  readonly key: DosageFormKey
  readonly labelKey: string
  readonly suggestedUnits: readonly string[]
  readonly basisUnits: readonly string[]
  readonly capabilities: readonly DosageFormCapability[]
  // Womit eine einzelne Einnahme gezaehlt wird. Getrennt von `basisUnits`:
  // die sagen, worin das PRODUKT gemessen wird (eine Ampulle, ein ml), diese
  // sagt, was man TUT — aus der Ampulle wird eine Spritze aufgezogen.
  readonly intakeUnit: IntakeUnitKey
  // Wie die Staerke dieser Form zustande kommt — die VORGABE der Form. Beim
  // Vial hat die Substanz das letzte Wort; siehe `strengthShapeFor`.
  readonly strengthShape: StrengthShape
  // Ob die Grafik dieser Form `color_hex` ueberhaupt zeigt. Pflaster und Tube
  // tun es bewusst nicht (hautfarben, Aluminium), `other` hat gar keine
  // Grafik. Das Formular fragt die Farbe deshalb dort nicht ab — ein
  // Farbfeld, dessen Wahl nirgends ankommt, sieht aus wie ein Fehler.
  readonly showsColor: boolean
  readonly stageRenderer?: 'vial' | 'ampoule' | 'capsule' | 'tablet' | 'nasal_spray' | 'tube' | 'pen' | 'patch' | 'drops' | 'powder' | 'gel' | 'spray'
  // Wahrnehmungsgetreu komprimierter Groessenanteil im gemeinsamen
  // Karussell: reale Hierarchie, ohne kleine Formen unbenutzbar klein zu machen.
  readonly stageHeightRatio?: number
  // What the stage needs to know: where the liquid sits, whether the fill level
  // says anything, and — derived from the chamber — whether it wears our label.
  readonly stageForm?: StageFormSpec
}

export const DOSAGE_FORMS: readonly DosageFormDefinition[] = [
  { key: 'vial', labelKey: 'dosage_form_vial', suggestedUnits: ['mcg', 'mg', 'IU'], basisUnits: ['vial', 'ml'], capabilities: ['injectable', 'reconstitutable', 'concentration_based', 'inventory_capable'], showsColor: true, strengthShape: 'reconstituted', intakeUnit: 'syringe', stageRenderer: 'vial', stageHeightRatio: 0.88, stageForm: VIAL_SPEC },
  { key: 'ampoule', labelKey: 'dosage_form_ampoule', suggestedUnits: ['mg', 'ml', 'IU'], basisUnits: ['ml', 'ampoule'], capabilities: ['injectable', 'liquid', 'concentration_based', 'inventory_capable'], showsColor: true, strengthShape: 'per_volume', intakeUnit: 'syringe', stageRenderer: 'ampoule', stageHeightRatio: 0.91, stageForm: AMPOULE_SPEC },
  { key: 'pen', labelKey: 'dosage_form_pen', suggestedUnits: ['mg', 'mcg', 'IU'], basisUnits: ['dose', 'ml'], capabilities: ['injectable', 'liquid', 'concentration_based', 'inventory_capable'], showsColor: true, strengthShape: 'per_volume', intakeUnit: 'dose', stageRenderer: 'pen', stageHeightRatio: 0.94, stageForm: PEN_SPEC },
  { key: 'tablet', labelKey: 'dosage_form_tablet', suggestedUnits: ['mcg', 'mg', 'g', 'IU'], basisUnits: ['tablet'], capabilities: ['countable', 'divisible', 'inventory_capable'], showsColor: true, strengthShape: 'per_unit', intakeUnit: 'tablet', stageRenderer: 'tablet', stageHeightRatio: 0.48, stageForm: TABLET_SPEC },
  { key: 'capsule', labelKey: 'dosage_form_capsule', suggestedUnits: ['mcg', 'mg', 'g', 'IU'], basisUnits: ['capsule'], capabilities: ['countable', 'inventory_capable'], showsColor: true, strengthShape: 'per_unit', intakeUnit: 'capsule', stageRenderer: 'capsule', stageHeightRatio: 0.52, stageForm: CAPSULE_SPEC },
  { key: 'drops', labelKey: 'dosage_form_drops', suggestedUnits: ['mcg', 'mg', 'IU', 'ml'], basisUnits: ['drop', 'ml'], capabilities: ['liquid', 'concentration_based', 'inventory_capable'], showsColor: true, strengthShape: 'per_volume', intakeUnit: 'drop', stageRenderer: 'drops', stageHeightRatio: 0.86, stageForm: DROPS_SPEC },
  { key: 'powder', labelKey: 'dosage_form_powder', suggestedUnits: ['mg', 'g'], basisUnits: ['g', 'portion'], capabilities: ['inventory_capable'], showsColor: true, strengthShape: 'per_mass', intakeUnit: 'portion', stageRenderer: 'powder', stageHeightRatio: 0.82, stageForm: POWDER_SPEC },
  { key: 'nasal_spray', labelKey: 'dosage_form_nasal_spray', suggestedUnits: ['mcg', 'mg'], basisUnits: ['spray'], capabilities: ['countable', 'liquid', 'inventory_capable'], showsColor: true, strengthShape: 'per_unit', intakeUnit: 'spray', stageRenderer: 'nasal_spray', stageHeightRatio: 0.9, stageForm: NASAL_SPRAY_SPEC },
  { key: 'spray', labelKey: 'dosage_form_spray', suggestedUnits: ['mcg', 'mg', 'ml'], basisUnits: ['spray'], capabilities: ['countable', 'liquid', 'inventory_capable'], showsColor: true, strengthShape: 'per_unit', intakeUnit: 'spray', stageRenderer: 'spray', stageHeightRatio: 0.84, stageForm: SPRAY_SPEC },
  { key: 'gel', labelKey: 'dosage_form_gel', suggestedUnits: ['mg', 'g'], basisUnits: ['g', 'application'], capabilities: ['inventory_capable'], showsColor: true, strengthShape: 'per_mass', intakeUnit: 'application', stageRenderer: 'gel', stageHeightRatio: 0.72, stageForm: GEL_SPEC },
  { key: 'patch', labelKey: 'dosage_form_patch', suggestedUnits: ['mcg', 'mg'], basisUnits: ['patch', 'hour'], capabilities: ['countable', 'inventory_capable'], showsColor: false, strengthShape: 'per_unit', intakeUnit: 'patch', stageRenderer: 'patch', stageHeightRatio: 0.56, stageForm: PATCH_SPEC },
  { key: 'tube', labelKey: 'dosage_form_tube', suggestedUnits: ['mg', 'g', 'ml'], basisUnits: ['g', 'ml', 'application'], capabilities: ['inventory_capable'], showsColor: false, strengthShape: 'per_mass', intakeUnit: 'application', stageRenderer: 'tube', stageHeightRatio: 0.9, stageForm: TUBE_SPEC },
  { key: 'other', labelKey: 'dosage_form_other', suggestedUnits: ['mcg', 'mg', 'g', 'IU', 'ml'], basisUnits: ['unit', 'portion'], capabilities: [], showsColor: false, strengthShape: 'free', intakeUnit: 'unit' },
] as const

// Faellt auf 'other' zurueck, wenn die Form unbekannt ist. Das ist kein
// Sicherheitsnetz gegen Tippfehler — der Typ deckt das ab —, sondern gegen
// Eintraege, die aelter sind als die Liste: 'liquid' stand bis September in
// der Datenbank und liegt in Bestandsdaten weiter. Ohne den Rueckfall gaebe
// die Suche undefined zurueck und der naechste Zugriff auf .stageRenderer
// wuerde die Seite abstuerzen lassen, statt den Eintrag textuell zu zeigen.
export function getDosageForm(key: DosageFormKey): DosageFormDefinition {
  return DOSAGE_FORMS.find(form => form.key === key)
    ?? DOSAGE_FORMS.find(form => form.key === 'other')!
}

// Die Staerke haengt nicht an der Form allein, sondern am PAAR aus Substanz
// und Form. Das Vial ist der Fall, an dem das sichtbar wird:
//
//   BPC-157 im Vial          ein Pulver. Es wird aufgeloest — 10 mg auf 2 ml.
//   Testosteron Enantat      ein Oel. Die Konzentration steht auf dem Etikett
//   im Vial                  — 250 mg pro 1 ml, nie rekonstituiert.
//
// Dieselbe Form, zwei verschiedene Fragen. Getrennt werden sie an der
// Kategorie: lyophilisiert kommt, was als Peptid gefuehrt wird; Hormone,
// Medikamente und Vitamine liegen im Vial fertig geloest vor.
//
// Der Rest der Formen ist eindeutig: eine Kapsel ist eine Kapsel, egal was
// drin ist. Nur das Vial fragt nach, was es traegt.
export function strengthShapeFor(
  key: DosageFormKey,
  category: StackCategory | null,
): StrengthShape {
  const vorgabe = getDosageForm(key).strengthShape
  if (vorgabe !== 'reconstituted') return vorgabe
  // Ohne Kategorie bleibt es bei der Vorgabe der Form. Die Kategorie
  // UEBERSCHREIBT, sie raet nicht: solange niemand gesagt hat, was drinliegt,
  // ist das Vial das, was das Vial immer war.
  //
  // `other` faellt in denselben Fall. Es ist keine sechste Aussage ueber den
  // Inhalt, sondern das Gegenteil einer Aussage — es waere falsch, daraus
  // „fertig geloest" zu schliessen, nur weil es nicht „Peptid" heisst.
  if (category === null || category === 'other') return vorgabe
  return category === 'peptide' ? 'reconstituted' : 'per_volume'
}

export interface StrengthBasisDefault {
  readonly value: number | null
  readonly unit: string | null
}

// Womit der Staerke-Schritt die PRODUKTMENGE vorbelegt. Das ist keine
// Bequemlichkeit, sondern die Aussage der Form:
//   Eine Kapsel ist die Einheit — die Menge ist 1, und wer sie aendert, hat
//   ein anderes Produkt vor sich. Eine Ampulle traegt eine Konzentration, und
//   „pro 1 ml" ist die Zeile, in der Etiketten sie angeben.
//   Beim Pulver-Vial bleibt die Zahl LEER: wie viel Loesungsmittel zugegeben
//   wird, steht auf keinem Etikett — das entscheidet der Nutzer beim
//   Anmischen. Eine Vorbelegung waere dort geraten.
export function strengthBasisDefault(
  key: DosageFormKey,
  category: StackCategory | null = null,
): StrengthBasisDefault {
  const form = getDosageForm(key)
  switch (strengthShapeFor(key, category)) {
    case 'per_unit':
      return { value: 1, unit: form.basisUnits[0] ?? null }
    case 'per_volume':
      return { value: 1, unit: 'ml' }
    case 'reconstituted':
      return { value: null, unit: 'ml' }
    case 'per_mass':
      return { value: 1, unit: 'g' }
    case 'free':
      return { value: null, unit: form.basisUnits[0] ?? null }
  }
}

// Der Uebersetzungsschluessel zum Hinweiskasten im Staerke-Schritt. Eine
// Stelle, damit „was hier einzutragen ist" je Form dasselbe Beispiel nennt.
export function strengthHintKey(
  key: DosageFormKey,
  category: StackCategory | null = null,
): string {
  const shape = strengthShapeFor(key, category)
  // 'free' behaelt den alten Satz: er sagt genau das Richtige fuer eine Form,
  // ueber die wir nichts wissen, und steht schon geprueft in 14 Sprachen.
  if (shape === 'free') return 'my_stack_no_dosage_advice'
  // Ein fertig geloestes Vial bekommt einen eigenen Satz statt des
  // allgemeinen Konzentrationshinweises: Es ist die eine Stelle, an der die
  // Kategorie danebenliegen kann (HCG etwa ist ein Hormon und liegt trotzdem
  // als Pulver vor). Der Satz nennt deshalb den Ausweg, statt ihn dem Nutzer
  // zu ueberlassen.
  if (shape === 'per_volume' && key === 'vial') return 'my_stack_strength_hint_vial_solution'
  // Je Stueck mit einem Beispiel aus der eigenen Form — beim Nasenspray nicht
  // „500 mg pro 1 Kapsel". Die Kapsel behaelt den allgemeinen Satz.
  if (shape === 'per_unit') {
    const stueck = getDosageForm(key).intakeUnit
    if (stueck === 'spray' || stueck === 'tablet' || stueck === 'patch') return `my_stack_strength_hint_per_unit_${stueck}`
  }
  return `my_stack_strength_hint_${shape}`
}

export function getIntakePlanUnitSuggestions(
  key: DosageFormKey,
  catalogSuggestedUnits: readonly string[] = [],
): string[] {
  const form = getDosageForm(key)
  const catalogUnits = catalogSuggestedUnits
    .filter(unit => form.suggestedUnits.includes(unit))

  // Die Einnahmeeinheit steht mit vorn: sie ist das, was der Nutzer im Alltag
  // zaehlt (eine Spritze, ein Spruehstoss), waehrend `suggestedUnits` die
  // Wirkstoffmengen sind und `basisUnits` die Packungsmasse.
  return Array.from(new Set([
    ...catalogUnits,
    form.intakeUnit,
    ...form.suggestedUnits,
    ...form.basisUnits,
  ]))
}

// Der Uebersetzungsschluessel zur Einnahmeeinheit einer Form. Eine Stelle,
// damit „Spritze" ueberall dasselbe Wort ist — im Beispieleintrag, im Plan
// und in der Zusammenfassung.
export function intakeUnitLabelKey(key: DosageFormKey): string {
  return `my_stack_intake_unit_${getDosageForm(key).intakeUnit}`
}

export function isStageRenderable(key: DosageFormKey): boolean {
  return getDosageForm(key).stageRenderer !== undefined
}

// Ob es sich lohnt, nach einer Farbe zu fragen. `color_hex` wird ausschliesslich
// von der Buehnengrafik gezeigt (StackStage) — zeigt die Grafik sie nicht, oder
// gibt es gar keine, bleibt die Wahl folgenlos. Der Farbschritt faellt dann weg.
export function showsColor(key: DosageFormKey): boolean {
  return getDosageForm(key).showsColor
}

// ── Einnahmeroute ────────────────────────────────────────────────────────
// Die Route folgt fast immer aus der Darreichungsform: eine Tablette wird
// geschluckt, ein Pflaster geklebt, ein Nasenspray genommen wie sein Name
// sagt. Sie stand trotzdem als leeres Pflichtfeld ganz oben im Plan — eine
// Pflichtwahl, deren Antwort feststeht, ist eine Frage zu viel.
//
// Nur wo es wirklich mehrere gibt (was man spritzt, kann subkutan,
// intramuskulaer oder intravenoes gehen), bleibt die Wahl stehen.

export { INTAKE_METHODS }

const METHOD_CHOICES: Partial<Record<DosageFormKey, readonly string[]>> = {
  vial: ['Subkutan', 'Intramuskulär', 'Intravenös'],
  ampoule: ['Subkutan', 'Intramuskulär', 'Intravenös'],
  pen: ['Subkutan', 'Intramuskulär'],
  nasal_spray: ['Nasal'],
  patch: ['Transdermal'],
  gel: ['Transdermal'],
  tube: ['Transdermal'],
  tablet: ['Oral'],
  capsule: ['Oral'],
  // Tropfen gehen auch in die Nase (Semax, Selank als Nasentropfen).
  drops: ['Oral', 'Nasal'],
  powder: ['Oral'],
  // Ein Spray kann ein Rachenspray sein oder ein Dosieraerosol. Die Liste
  // kennt keine Inhalation, deshalb bleibt hier die Wahl offen.
  spray: ['Oral', 'Nasal', 'Andere'],
}

/**
 * Die Routen, die zu dieser Form ueberhaupt in Frage kommen.
 *
 * `zusaetzlich`: Wege, die trotzdem dazugehoeren — die Routen aus dem
 * PK-Profil der Substanz (NA-Semax aus dem Vial geht in die Nase).
 */
export function methodChoicesFor(key: DosageFormKey, zusaetzlich: readonly (string | null | undefined)[] = []): readonly string[] {
  const basis = METHOD_CHOICES[key] ?? INTAKE_METHODS
  const extra = zusaetzlich.filter((route): route is string => (
    Boolean(route) && (INTAKE_METHODS as readonly string[]).includes(route!) && !basis.includes(route!)
  ))
  return extra.length > 0 ? [...basis, ...new Set(extra)] : basis
}

/** Die Route, die vorbelegt wird — leer, wo die Form nichts hergibt. */
export function defaultMethodFor(key: DosageFormKey): string {
  const choices = methodChoicesFor(key)
  return choices.length === INTAKE_METHODS.length ? '' : choices[0]
}

/**
 * Die Einheit, die vorbelegt wird. Der erste Vorschlag stimmt fast immer —
 * er kam bisher nur als Vorschlagsliste, und getippt hat trotzdem der Nutzer.
 */
export function defaultIntakeUnitFor(
  key: DosageFormKey,
  catalogSuggestedUnits: readonly string[] = [],
): string | null {
  return getIntakePlanUnitSuggestions(key, catalogSuggestedUnits)[0] ?? null
}
