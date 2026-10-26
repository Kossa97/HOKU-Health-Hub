/**
 * Dot legt eine Substanz an: „leg BPC-157 an, 250 mcg morgens". Claude
 * bereitet die Angaben vor (Werkzeug `substanz_anlegen` in der Edge Function
 * `coach`), der Assistent öffnet sich damit vorbefüllt, der Nutzer prüft und
 * speichert. Übernommen wird nur, was der Nutzer gesagt hat — keine Menge,
 * keine Zeit, die er nicht genannt hat.
 */
import type { DosageFormKey, IntakeRhythm, IntakeSlotDraft, RoutineGroup, SubstanceCatalogEntry } from '../types'
import type { WizardAction } from './wizardState'
import { findeKatalogeintrag, scanAktionen } from './substanzScan'

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

/** Die Tageszeit einer Uhrzeit, wie der Plan sie gruppiert. */
export function tageszeitVon(uhrzeit: string): RoutineGroup {
  const stunde = Number(uhrzeit.slice(0, 2))
  return stunde < 11 ? 'morning' : stunde < 16 ? 'midday' : 'evening'
}

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
 * Die Schritte für den Assistenten: erst die Substanz (wie nach einem Scan:
 * Katalogeintrag, wenn einer passt, sonst eine eigene), dann Einheit,
 * Zeitpunkte und zuletzt der Rhythmus — der verteilt die Zeitpunkte auf die
 * Wochentage, wenn welche genannt sind.
 */
export function anlageAktionen(anlage: DotAnlage, entries: readonly SubstanceCatalogEntry[], farbe = ''): WizardAction[] {
  const entry = findeKatalogeintrag(anlage.name, entries)
  const aktionen = scanAktionen({ quelle: 'foto', entry, name: anlage.name, brand: null, dosageForm: anlage.form, staerken: [] }, entries, farbe)
  if (anlage.einheit) aktionen.push({ type: 'plan_changed', changes: { unit: anlage.einheit } })
  const slots: IntakeSlotDraft[] = anlage.zeiten.map(zeit => ({
    routineGroup: zeit.tageszeit ?? tageszeitVon(zeit.uhrzeit),
    time: zeit.uhrzeit,
    dose: anlage.menge,
    weekdays: [],
  }))
  if (slots.length === 0 && anlage.menge !== null) slots.push({ routineGroup: 'morning', time: null, dose: anlage.menge, weekdays: [] })
  if (slots.length > 0) aktionen.push({ type: 'plan_changed', changes: { slots } })
  const rhythmus = rhythmusVon(anlage)
  if (rhythmus) aktionen.push({ type: 'plan_changed', changes: { rhythm: rhythmus } })
  return aktionen
}

/** Nimmt vom Server nur, was die Form hat; geprüft hat er schon. */
export function liesAnlagen(roh: unknown): DotAnlage[] {
  if (!Array.isArray(roh)) return []
  return roh.flatMap(a => {
    if (!a || typeof a !== 'object') return []
    const x = a as Record<string, unknown>
    if (typeof x.name !== 'string' || !x.name.trim()) return []
    return [{
      name: x.name,
      form: typeof x.form === 'string' ? x.form as DosageFormKey : null,
      menge: typeof x.menge === 'number' ? x.menge : null,
      einheit: typeof x.einheit === 'string' ? x.einheit : null,
      zeiten: Array.isArray(x.zeiten) ? x.zeiten.filter((z): z is DotAnlage['zeiten'][number] => !!z && typeof z === 'object'
        && (((z as Record<string, unknown>).tageszeit === 'morning' || (z as Record<string, unknown>).tageszeit === 'midday' || (z as Record<string, unknown>).tageszeit === 'evening')
          || typeof (z as Record<string, unknown>).uhrzeit === 'string')) : [],
      rhythmus: ['taeglich', 'wochentage', 'alle_n_tage', 'bei_bedarf'].includes(x.rhythmus as string) ? x.rhythmus as DotAnlage['rhythmus'] : null,
      wochentage: Array.isArray(x.wochentage) ? x.wochentage.filter((t): t is string => typeof t === 'string') : [],
      alleNTage: typeof x.alleNTage === 'number' ? x.alleNTage : null,
    }]
  })
}
