/**
 * Dot legt eine Substanz an: „leg BPC-157 an, 250 mcg morgens". Claude
 * bereitet die Angaben vor (Werkzeug `substanz_anlegen` in der Edge Function
 * `coach`), der Assistent öffnet sich damit vorbefüllt, der Nutzer prüft und
 * speichert. Übernommen wird nur, was der Nutzer gesagt hat — keine Menge
 * ohne ihre Einheit, keine Zeit, die er nicht genannt hat.
 */
import type { DosageFormKey, IntakeRhythm, IntakeSlotDraft, RoutineGroup, SubstanceCatalogEntry } from '../types'
import { DOSAGE_FORMS } from './dosageForms'
import { wizardReducer, type WizardAction, type WizardState } from './wizardState'
import { findeKatalogeintrag, scanAktionen } from './substanzScan'
import { routineGroupFromMinutes } from '../../routines/intakeGroups'

/** Wie die Edge Function sie liefert (`Anlage` in supabase/functions/coach/prompt.ts). */
export interface DotAnlage {
  name: string
  form: DosageFormKey | null
  menge: number | null
  einheit: string | null
  zeiten: ({ tageszeit: RoutineGroup; uhrzeit: null } | { tageszeit: null; uhrzeit: string })[]
  rhythmus: 'taeglich' | 'wochentage' | 'alle_n_tage' | 'bei_bedarf' | null
  wochentage: string[]
  alleNTage: number | null
}

const UHRZEIT = /^([01]\d|2[0-3]):[0-5]\d$/

/** Die Tageszeit einer Uhrzeit, wie der Rest der App sie gruppiert. */
export const tageszeitVon = (uhrzeit: string): RoutineGroup =>
  routineGroupFromMinutes(Number(uhrzeit.slice(0, 2)) * 60 + Number(uhrzeit.slice(3, 5)))

/** Gesagte Einheiten auf die Schlüssel des Plans („Tabletten" → tablet, „µg" → mcg). Unbekanntes bleibt. */
const EINHEITEN: Record<string, string> = {
  'µg': 'mcg', ug: 'mcg', mcg: 'mcg', mikrogramm: 'mcg', microgram: 'mcg', micrograms: 'mcg',
  mg: 'mg', milligramm: 'mg', milligram: 'mg', milligrams: 'mg',
  g: 'g', gramm: 'g', gram: 'g', grams: 'g',
  iu: 'IU', ie: 'IU', 'i.e.': 'IU', einheiten: 'IU', 'internationale einheiten': 'IU', units: 'IU',
  ml: 'ml', milliliter: 'ml', millilitre: 'ml',
  tablette: 'tablet', tabletten: 'tablet', tablet: 'tablet', tablets: 'tablet', tab: 'tablet', tabs: 'tablet',
  kapsel: 'capsule', kapseln: 'capsule', capsule: 'capsule', capsules: 'capsule',
  tropfen: 'drop', drop: 'drop', drops: 'drop',
  hub: 'spray', 'hübe': 'spray', 'sprühstoß': 'spray', 'sprühstöße': 'spray', spray: 'spray', sprays: 'spray', puff: 'spray', puffs: 'spray',
  spritze: 'syringe', spritzen: 'syringe', syringe: 'syringe',
  pflaster: 'patch', patch: 'patch', patches: 'patch',
  portion: 'portion', portionen: 'portion', 'messlöffel': 'portion', scoop: 'portion', scoops: 'portion',
}
export const einheitVon = (gesagt: string) => EINHEITEN[gesagt.trim().toLowerCase()] ?? gesagt.trim()

function rhythmusVon(anlage: DotAnlage): IntakeRhythm | null {
  const leer: IntakeRhythm = { kind: 'daily', intervalValue: null, intervalUnit: 'day', onDays: null, offDays: null, weekdays: [] }
  switch (anlage.rhythmus) {
    case 'taeglich': return leer
    case 'bei_bedarf': return { ...leer, kind: 'on_demand' }
    case 'wochentage': return anlage.wochentage.length ? { ...leer, kind: 'weekdays', weekdays: anlage.wochentage } : null
    case 'alle_n_tage': return anlage.alleNTage ? { ...leer, kind: 'interval', intervalValue: anlage.alleNTage } : null
    default: return null
  }
}

/**
 * Der Assistent mit Dots Angaben: erst die Substanz (wie nach einem Scan:
 * Katalogeintrag, wenn einer passt, sonst eine eigene), dann Einheit,
 * Zeitpunkte und zuletzt der Rhythmus — der verteilt die Zeitpunkte auf die
 * Wochentage, wenn welche genannt sind. Eine Menge ohne Einheit bleibt weg:
 * sonst stünde sie in der Einheit, die die Form vorbelegt (250 „mg" statt mcg).
 * Ohne genannte Zeit bekommt die vorbelegte Zeit die Menge, es kommt keine dazu.
 */
export function anlageAnwenden(anlage: DotAnlage, entries: readonly SubstanceCatalogEntry[], start: WizardState, farbe = ''): WizardState {
  const entry = findeKatalogeintrag(anlage.name, entries)
  const schritte: WizardAction[] = scanAktionen({ quelle: 'foto', entry, name: anlage.name, brand: null, dosageForm: anlage.form, staerken: [] }, entries, farbe)
  let state = schritte.reduce(wizardReducer, start)
  const menge = anlage.einheit ? anlage.menge : null
  if (anlage.einheit) state = wizardReducer(state, { type: 'plan_changed', changes: { unit: einheitVon(anlage.einheit) } })
  const slots: IntakeSlotDraft[] = anlage.zeiten.length > 0
    ? anlage.zeiten.map(zeit => ({ routineGroup: zeit.tageszeit ?? tageszeitVon(zeit.uhrzeit), time: zeit.uhrzeit, dose: menge, weekdays: [] }))
    : menge !== null ? state.draft.plan.slots.map(slot => ({ ...slot, dose: menge })) : []
  if (slots.length > 0) state = wizardReducer(state, { type: 'plan_changed', changes: { slots } })
  const rhythmus = rhythmusVon(anlage)
  if (rhythmus) state = wizardReducer(state, { type: 'plan_changed', changes: { rhythm: rhythmus } })
  return state
}

const FORMEN = new Set<string>(DOSAGE_FORMS.map(form => form.key))
const RHYTHMEN = ['taeglich', 'wochentage', 'alle_n_tage', 'bei_bedarf']
const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

/** Nimmt vom Server (oder aus dem gesicherten Verlauf) nur, was genau die Form hat. */
export function liesAnlagen(roh: unknown): DotAnlage[] {
  if (!Array.isArray(roh)) return []
  return roh.flatMap(a => {
    if (!a || typeof a !== 'object') return []
    const x = a as Record<string, unknown>
    if (typeof x.name !== 'string' || !x.name.trim()) return []
    const zeiten = (Array.isArray(x.zeiten) ? x.zeiten : []).flatMap((z): DotAnlage['zeiten'] => {
      const t = (z ?? {}) as Record<string, unknown>
      if ((t.tageszeit === 'morning' || t.tageszeit === 'midday' || t.tageszeit === 'evening') && t.uhrzeit == null) return [{ tageszeit: t.tageszeit, uhrzeit: null }]
      if (t.tageszeit == null && typeof t.uhrzeit === 'string' && UHRZEIT.test(t.uhrzeit)) return [{ tageszeit: null, uhrzeit: t.uhrzeit }]
      return []
    })
    const menge = typeof x.menge === 'number' && Number.isFinite(x.menge) && x.menge > 0 ? x.menge : null
    return [{
      name: x.name.trim().slice(0, 80),
      form: typeof x.form === 'string' && FORMEN.has(x.form) ? x.form as DosageFormKey : null,
      menge,
      einheit: typeof x.einheit === 'string' && x.einheit.trim() ? x.einheit.trim().slice(0, 20) : null,
      zeiten,
      rhythmus: RHYTHMEN.includes(x.rhythmus as string) ? x.rhythmus as DotAnlage['rhythmus'] : null,
      wochentage: Array.isArray(x.wochentage) ? WOCHENTAGE.filter(tag => (x.wochentage as unknown[]).includes(tag)) : [],
      alleNTage: typeof x.alleNTage === 'number' && Number.isInteger(x.alleNTage) && x.alleNTage >= 2 ? x.alleNTage : null,
    }]
  })
}
