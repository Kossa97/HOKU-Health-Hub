import { addDays, format, parseISO } from 'date-fns'
import { supabase } from '../../../lib/supabase'
import { resolveTimelineIntakesForDay, type ResolvedTimelineIntake } from '../../../lib/intakeSchedule'
import { localDateBoundaryInstant, localDateTimeKey, type CycleTimeline } from '../../../lib/planTimeline'
import { loadCycleTimelines } from '../../my-stack/services/planLifecycle'
import { formatTrackedQuantity, hasTrackedQuantity } from '../../routines/quantityPresentation'
import type { DotTextKey } from '../texte'

/**
 * Was Dot über den Nutzer weiß — knapp, für Sprechblasen und als Kontext
 * für den Chat. Gelesen mit der Sitzung des Nutzers (RLS), nichts davon
 * wird auf dem Server gespeichert.
 *
 * Bewusst klein: der Plan der letzten 7 Tage und von heute, der Stack mit
 * Bestand, die letzten Blutwerte und die heutige Ernährung. Mehr braucht ein
 * Coach für die Fragen, die er beantworten darf, nicht.
 */

export type EinnahmeStatus = 'genommen' | 'ausgelassen' | 'offen'

export interface DotEinnahme {
  /** Kurzer Verweis für Dots Werkzeug (`e1`, `e2` …), gilt nur für diesen Kontext. */
  ref?: string
  datum: string
  zeit: string
  minuten: number
  substanz: string
  menge: string | null
  status: EinnahmeStatus
}

export interface DotKontext {
  heute: string
  jetzt: string
  zeitzone: string
  stack: { name: string; kategorie: string | null; form: string | null; bestand: string | null }[]
  einnahmen: DotEinnahme[]
  blutwerte: { marker: string; wert: number; einheit: string; ref_min: number | null; ref_max: number | null; datum: string }[]
  ernaehrung: { kcal: number; eiweiss: number; kh: number; fett: number; ziel_kcal: number | null } | null
}

const TAGE = 7

/** Einnahmen der letzten Tage aus den Plänen, mit Status aus den Protokollen. */
export function einnahmenAusPlaenen(
  timelines: CycleTimeline[],
  logs: { routine_slot_key: string | null; taken: boolean | null }[],
  namen: Map<string, string>,
  heute: string,
  zeitzone: string,
  tage = TAGE,
  /** Wird gefüllt: Verweis → geplante Einnahme, für Meldungen per Satz. */
  slots?: Map<string, ResolvedTimelineIntake>,
): DotEinnahme[] {
  const status = new Map<string, EinnahmeStatus>()
  for (const log of logs) {
    if (!log.routine_slot_key) continue
    // „genommen" schlägt „ausgelassen", falls beides protokolliert ist
    if (log.taken) status.set(log.routine_slot_key, 'genommen')
    else if (!status.has(log.routine_slot_key)) status.set(log.routine_slot_key, 'ausgelassen')
  }
  const out: { e: DotEinnahme; intake: ResolvedTimelineIntake }[] = []
  for (let i = tage - 1; i >= 0; i--) {
    const datum = format(addDays(parseISO(heute), -i), 'yyyy-MM-dd')
    for (const timeline of timelines) {
      for (const e of resolveTimelineIntakesForDay(timeline, datum, zeitzone)) {
        const name = namen.get(e.stackItemId)
        if (!name) continue
        out.push({
          intake: e,
          e: {
            datum, zeit: e.time, minuten: e.minutes, substanz: name,
            menge: hasTrackedQuantity({ dose: e.dose, unit: e.unit }) ? formatTrackedQuantity(e.dose, e.unit, '') : null,
            status: status.get(e.routineSlotKey) ?? 'offen',
          },
        })
      }
    }
  }
  out.sort((a, b) => (a.e.datum + a.e.zeit).localeCompare(b.e.datum + b.e.zeit))
  return out.map(({ e, intake }, i) => {
    const ref = `e${i + 1}`
    slots?.set(ref, intake)
    return { ref, ...e }
  })
}

/** Zu jedem geladenen Kontext: welche geplante Einnahme hinter einem Verweis steht. */
const slotsJeKontext = new WeakMap<DotKontext, Map<string, ResolvedTimelineIntake>>()

/** Die geplante Einnahme hinter einem Verweis aus genau diesem Kontext. */
export const einnahmeZuRef = (k: DotKontext, ref: string) => slotsJeKontext.get(k)?.get(ref) ?? null

const zahl = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0)

export async function ladeDotKontext(userId: string): Promise<DotKontext> {
  const zeitzone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  const jetzt = new Date()
  const heute = localDateTimeKey(jetzt, zeitzone).slice(0, 10)
  const ab = format(addDays(parseISO(heute), -(TAGE - 1)), 'yyyy-MM-dd')
  const seit = localDateBoundaryInstant(ab, zeitzone).toISOString()

  const [timelines, logs, items, blut, essen, ziele] = await Promise.all([
    loadCycleTimelines(supabase as never, userId).catch(() => [] as CycleTimeline[]),
    supabase.from('dose_logs').select('routine_slot_key, taken').eq('user_id', userId).gte('logged_at', seit),
    supabase.from('stack_items')
      .select('id, display_name, category, dosage_form, inventory:stack_item_inventory(enabled, package_unit, remaining_quantity)')
      .eq('user_id', userId),
    supabase.from('bloodwork').select('marker, value, unit, ref_min, ref_max, tested_at')
      .eq('user_id', userId).order('tested_at', { ascending: false }).limit(500),
    supabase.from('food_logs').select('kcal, protein_g, carbs_g, fat_g').eq('user_id', userId).eq('log_date', heute),
    supabase.from('nutrition_goals').select('kcal').eq('user_id', userId).maybeSingle(),
  ])

  const zeilen = (items.data ?? []) as Record<string, unknown>[]
  const namen = new Map(zeilen.map(z => [String(z.id), String(z.display_name ?? '')]))
  const stack = zeilen.map(z => {
    const inv = (Array.isArray(z.inventory) ? z.inventory[0] : z.inventory) as Record<string, unknown> | null | undefined
    const bestand = inv?.enabled && inv.remaining_quantity != null ? `${zahl(inv.remaining_quantity)} ${String(inv.package_unit ?? '')}`.trim() : null
    return { name: String(z.display_name ?? ''), kategorie: (z.category as string) ?? null, form: (z.dosage_form as string) ?? null, bestand }
  })
  // Nur der jüngste Wert je Marker
  const gesehen = new Set<string>()
  const blutwerte = ((blut.data ?? []) as Record<string, unknown>[]).filter(z => {
    const m = String(z.marker); if (gesehen.has(m)) return false
    gesehen.add(m); return true
  }).slice(0, 80).map(z => ({
    marker: String(z.marker), wert: zahl(z.value), einheit: String(z.unit ?? ''),
    ref_min: z.ref_min == null ? null : zahl(z.ref_min), ref_max: z.ref_max == null ? null : zahl(z.ref_max),
    datum: String(z.tested_at ?? '').slice(0, 10),
  }))
  const essenZeilen = (essen.data ?? []) as Record<string, unknown>[]
  const ernaehrung = essenZeilen.length || ziele.data
    ? {
      kcal: Math.round(essenZeilen.reduce((s, z) => s + zahl(z.kcal), 0)),
      eiweiss: Math.round(essenZeilen.reduce((s, z) => s + zahl(z.protein_g), 0)),
      kh: Math.round(essenZeilen.reduce((s, z) => s + zahl(z.carbs_g), 0)),
      fett: Math.round(essenZeilen.reduce((s, z) => s + zahl(z.fat_g), 0)),
      ziel_kcal: ziele.data ? zahl((ziele.data as Record<string, unknown>).kcal) : null,
    }
    : null

  const slots = new Map<string, ResolvedTimelineIntake>()
  const kontext: DotKontext = {
    heute, zeitzone,
    jetzt: localDateTimeKey(jetzt, zeitzone).slice(11, 16),
    stack,
    einnahmen: einnahmenAusPlaenen(timelines, (logs.data ?? []) as never, namen, heute, zeitzone, TAGE, slots),
    blutwerte,
    ernaehrung,
  }
  slotsJeKontext.set(kontext, slots)
  return kontext
}

/** Ist der Kontext noch von heute (in seiner Zeitzone)? */
export const kontextVonHeute = (k: DotKontext, jetzt = new Date()) => localDateTimeKey(jetzt, k.zeitzone).slice(0, 10) === k.heute

/**
 * Die nächste offene Einnahme heute ab jetzt, sonst die letzte verpasste.
 * `jetzt` ist die aktuelle Uhrzeit („HH:MM"), nicht die beim Laden.
 */
export function heuteOffen(k: DotKontext, jetzt = k.jetzt) {
  const [h, m] = jetzt.split(':').map(Number)
  const minuten = h * 60 + m
  const heute = k.einnahmen.filter(e => e.datum === k.heute)
  const offen = heute.filter(e => e.status === 'offen')
  return {
    geplant: heute.length,
    offen: offen.length,
    naechste: offen.find(e => e.minuten >= minuten) ?? null,
    verpasst: [...offen].reverse().find(e => e.minuten < minuten) ?? null,
    /** Wie viele schon fällig waren und noch offen sind. */
    faellig: offen.filter(e => e.minuten < minuten).length,
    minuten,
  }
}

/**
 * Was Dot beim Begrüßen über heute sagt. Erst, was schon fällig und noch
 * offen ist (wie bei der Uhr), dann die nächste Einnahme; „alles
 * eingetragen" nur, wenn wirklich nichts mehr offen ist.
 */
export function heuteHinweis(h: ReturnType<typeof heuteOffen>): { schluessel: DotTextKey; werte?: Record<string, string | number> } {
  if (h.verpasst) {
    return h.faellig > 1
      ? { schluessel: 'gruss_offen', werte: { anzahl: h.faellig } }
      : { schluessel: 'gruss_verpasst', werte: { substanz: h.verpasst.substanz, zeit: h.verpasst.zeit } }
  }
  if (h.naechste) {
    return h.naechste.menge
      ? { schluessel: 'naechste_menge', werte: { zeit: h.naechste.zeit, substanz: h.naechste.substanz, menge: h.naechste.menge } }
      : { schluessel: 'naechste', werte: { zeit: h.naechste.zeit, substanz: h.naechste.substanz } }
  }
  return { schluessel: h.geplant ? 'alles_erledigt' : 'nichts_geplant' }
}
