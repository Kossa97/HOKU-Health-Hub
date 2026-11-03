// Die Datenseite des Blutspiegels — gemeinsam fuer Home und die
// Simulationsseite. Vorher lud jede Ansicht ihre Zyklen selbst, mit eigenen
// Abfragen und leicht verschiedenen Regeln (die Seite kannte z. B. keine
// ml-Umrechnung bei der Bereitschaftspruefung). Jetzt gibt es eine Regel.

import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { FEATURES } from '../../config/features'
import { loadNormalizedPkCycles } from '../../services/liveBlutspiegelChart'
import {
  calculateHistoryBlutspiegelCurve,
  findNextPkDose,
  loadDoseHistory,
  nachRouteSchneiden,
  type DoseEvent,
  type DoseUmrechnung,
} from '../../services/blutspiegelHistory'
import {
  evaluatePkReadiness,
  mgPerMlFromStrength,
  resolvePkScheduleForDay,
  staerkeJeEinheit,
  type StaerkeJe,
  type PkRequirement,
  type PkScheduleCycle,
} from '../my-stack/lib/pkReadiness'
import type { TrackingLevel } from '../my-stack/types'
import type { EscalationRow } from '../../lib/intakeSchedule'

// ── Typen ─────────────────────────────────────────────────────────────────

export type PkCategory = 'peptide' | 'glp1' | 'hormone' | 'sarm' | 'other'

export interface PkProfileEmbed {
  name: string
  half_life_hours: number
  tmax_hours: number
  bioavailability_sc: number
  /** IU je Milligramm; null, wenn die Substanz nicht in IU dosiert wird. */
  iu_per_mg: number | null
  vd_l_kg?: number | null
  category: string
  /** Routen, fuer die die Zahlen gelten; leer = unklar (Nutzer bestaetigt). */
  routes?: string[] | null
}

interface CycleWithPk extends PkScheduleCycle {
  active: boolean
  stack_items: {
    id: string
    display_name: string
    tracking_level: TrackingLevel
    pk_profile_method: string | null
    ingredients: Array<{
      position: number
      custom_name: string | null
      // Die Staerke der Zutat — ohne sie laesst sich ein in Millilitern
      // geplantes Vial nicht in Milligramm umrechnen.
      amount_value: number | string | null
      amount_unit: string | null
      basis_value: number | string | null
      basis_unit: string | null
      substance_catalog: {
        canonical_name: string | null
        pk_profile_id: string | null
        pk_profiles: PkProfileEmbed | null
      } | null
    }>
  } | null
}

export interface ReadyEntry {
  kind: 'ready'
  /** Zyklus + Profil: ein Kombi-Vial ergibt mehrere Eintraege. */
  key: string
  cycleId: string
  stackItemId: string
  name: string
  /** Name des Produkts (wie in My Stack). */
  produkt: string
  /** Name des Wirkstoffs, fuer den diese Kurve gilt. */
  wirkstoff: string
  profileId: string
  profile: PkProfileEmbed
  accent: string
  umrechnung: DoseUmrechnung
  /** Vom Nutzer bestaetigte Route (fuer Profile ohne Routenangabe). */
  pkProfileMethod: string | null
  /** Naechste geplante Einnahme (Unix ms); null ohne Plan. */
  nextDoseAt: number | null
}

export interface MissingEntry {
  kind: 'missing'
  key: string
  cycleId: string
  stackItemId: string
  name: string
  missing: PkRequirement[]
}

/** Kein Profil oder keine sichere Umrechnung: es gibt keine Kurve, und das wird gesagt. */
export interface UnsupportedEntry {
  kind: 'unsupported'
  key: string
  cycleId: string
  stackItemId: string
  name: string
  reason: 'unit_conversion' | 'profile' | 'route'
  /** Bei 'route': die Route im Plan, fuer die es kein Profil gibt. */
  method?: string | null
}

export type BlutspiegelEntry = ReadyEntry | MissingEntry | UnsupportedEntry

/**
 * Ohne Kurve, aber behebbar: es fehlt eine Angabe, die Route passt nicht
 * oder die Einheit laesst sich nicht umrechnen. Ohne PK-Profil gibt es nichts
 * zu tun — solche Eintraege (Vitamine, Insulin) zeigt der Blutspiegel nicht.
 */
export function behebbar(entry: BlutspiegelEntry): entry is MissingEntry | UnsupportedEntry {
  return entry.kind === 'missing' || (entry.kind === 'unsupported' && entry.reason !== 'profile')
}

export const CATEGORY_ACCENT: Record<PkCategory, string> = {
  peptide: '#00ccf5',
  glp1: '#10b981',
  hormone: '#f59e0b',
  sarm: '#a855f7',
  other: '#94a3b8',
}

/**
 * Linienfarben in einem Kombipraeparat, in fester Reihenfolge je Zutat.
 * Die Akzente der App, so geordnet, dass Nachbarn auch bei Farbfehlsichtigkeit
 * getrennt bleiben (geprueft mit dem Paletten-Pruefer des dataviz-Skills).
 * Die Kategoriefarbe allein reicht hier nicht: zwei Peptide waeren gleich blau.
 */
export const KOMBI_FARBEN = ['#00ccf5', '#f59e0b', '#a855f7', '#10b981'] as const

/** Alle Kurven eines Produkts — ein Graph, eine Linie je Wirkstoff. */
export interface ProduktGruppe {
  /** Die Zyklus-id: Adresse der Detailseite. */
  key: string
  cycleId: string
  stackItemId: string
  name: string
  /** In Reihenfolge der Zutaten; mindestens einer. */
  wirkstoffe: ReadyEntry[]
}

/** Fasst die Kurven je Produkt zusammen, in der Reihenfolge, in der sie kamen. */
export function nachProdukt(ready: readonly ReadyEntry[]): ProduktGruppe[] {
  const gruppen = new Map<string, ProduktGruppe>()
  for (const entry of ready) {
    const gruppe = gruppen.get(entry.cycleId)
    if (gruppe) gruppe.wirkstoffe.push(entry)
    else gruppen.set(entry.cycleId, { key: entry.cycleId, cycleId: entry.cycleId, stackItemId: entry.stackItemId, name: entry.produkt, wirkstoffe: [entry] })
  }
  return [...gruppen.values()]
}

/**
 * Welche Gruppe und welcher Wirkstoff zu einer Adresse gehoeren. Frueher
 * hatte jeder Wirkstoff seine eigene Detailseite (`zyklus:profil`) — solche
 * Links fuehren jetzt zum Produkt, mit genau diesem Wirkstoff vorn.
 */
export function gruppeZu(gruppen: readonly ProduktGruppe[], key: string | null | undefined): { gruppe: ProduktGruppe; wirkstoff: ReadyEntry } | null {
  if (!key) return null
  for (const gruppe of gruppen) {
    if (gruppe.key === key) return { gruppe, wirkstoff: gruppe.wirkstoffe[0] }
    const wirkstoff = gruppe.wirkstoffe.find(entry => entry.key === key)
    if (wirkstoff) return { gruppe, wirkstoff }
  }
  return null
}

export function normalizeCategory(raw: string | undefined): PkCategory {
  if (raw === 'peptide' || raw === 'glp1' || raw === 'hormone' || raw === 'sarm') return raw
  return 'other'
}

function zahl(wert: number | string | null | undefined): number | null {
  if (wert == null) return null
  const n = typeof wert === 'number' ? wert : Number(wert)
  return Number.isFinite(n) ? n : null
}

interface VerknuepfteZutat {
  id: string
  profile: PkProfileEmbed
  name: string
  mgPerMl: number | null
  mgJe: StaerkeJe | null
}

/**
 * Alle Zutaten des Eintrags, die ein PK-Profil tragen — in ihrer Reihenfolge.
 *
 * Ein Kombi-Vial traegt zwei: „5 mg CJC-1295 ohne DAC UND 5 mg Ipamorelin".
 * Beide stecken in derselben Loesung, und aus demselben aufgezogenen Volumen
 * folgt fuer jede eine eigene Dosis — also ein eigener Spiegel.
 */
function linkedProfiles(cycle: CycleWithPk): VerknuepfteZutat[] {
  const ingredients = cycle.stack_items?.ingredients.slice().sort((a, b) => a.position - b.position) ?? []
  const verknuepft: VerknuepfteZutat[] = []
  for (const ingredient of ingredients) {
    const catalog = ingredient.substance_catalog
    if (!catalog?.pk_profile_id || !catalog.pk_profiles) continue
    verknuepft.push({
      id: catalog.pk_profile_id,
      profile: catalog.pk_profiles,
      name: catalog.canonical_name ?? ingredient.custom_name ?? catalog.pk_profiles.name,
      mgPerMl: mgPerMlFromStrength(
        zahl(ingredient.amount_value), ingredient.amount_unit,
        zahl(ingredient.basis_value), ingredient.basis_unit,
      ),
      // Kapsel, Tablette, Spruehstoss …: jede Zutat ihre eigene Menge je Stueck.
      mgJe: staerkeJeEinheit(
        zahl(ingredient.amount_value), ingredient.amount_unit,
        zahl(ingredient.basis_value), ingredient.basis_unit,
        catalog.pk_profiles.iu_per_mg ?? null,
      ),
    })
  }
  return verknuepft
}

function grund(reason: string): UnsupportedEntry['reason'] {
  return reason === 'unit_conversion' || reason === 'route' ? reason : 'profile'
}

function isLegacyCycleActive(cycle: CycleWithPk, todayKey: string): boolean {
  if (cycle.active) return true
  return Boolean(cycle.end_date && cycle.end_date >= todayKey)
}

const LEGACY_SELECT = `
  id, stack_item_id, start_date, end_date, dose, unit, method, frequency,
  x_days_interval, interval_unit, cycle_on_days, cycle_off_days, slot_doses, slot_days,
  schedule_days, intake_time, intake_time_custom, schedule_history, active,
  stack_items (
    id, display_name, tracking_level, pk_profile_method,
    ingredients:stack_item_ingredients (
      position, custom_name, amount_value, amount_unit, basis_value, basis_unit,
      substance_catalog (
        canonical_name, pk_profile_id,
        pk_profiles ( name, half_life_hours, tmax_hours, bioavailability_sc, iu_per_mg, vd_l_kg, category, routes )
      )
    )
  )`

/** Zyklen + Bereitschaft je Eintrag. Laedt keine Einnahmen. */
export async function loadBlutspiegelEntries(userId: string, now = new Date()): Promise<BlutspiegelEntry[]> {
  const todayKey = format(now, 'yyyy-MM-dd')
  const [{ data, error }, { data: escalationRows }] = FEATURES.planTimelineV2
    ? [{ data: await loadNormalizedPkCycles(userId), error: null }, { data: [] }]
    : await Promise.all([
      supabase.from('cycles').select(LEGACY_SELECT).eq('user_id', userId),
      supabase.from('dose_escalations')
        .select('cycle_id, increase_amount, unit, start_type, start_date, start_after_days')
        .eq('user_id', userId),
    ])
  if (error) throw error
  if (!data) return []

  const entries: BlutspiegelEntry[] = []
  for (const cycle of data as unknown as CycleWithPk[]) {
    if (!FEATURES.planTimelineV2 && !isLegacyCycleActive(cycle, todayKey)) continue
    if (!cycle.stack_items) continue
    const verknuepft = linkedProfiles(cycle)
    const escalations = ((escalationRows ?? []) as EscalationRow[]).filter(row => row.cycle_id === cycle.id)
    const schedule = resolvePkScheduleForDay(cycle, escalations, now)
    const item = cycle.stack_items
    // Je Zutat mit Profil eine eigene Pruefung: im Kombi-Vial kann die eine
    // Zutat umrechenbar sein und die andere nicht (fehlende Staerke).
    const pruefe = (zutat: VerknuepfteZutat | null) => evaluatePkReadiness({
      trackingLevel: item.tracking_level ?? 'intake_only',
      pkProfileId: zutat?.id ?? null,
      pkProfileMethod: item.pk_profile_method ?? null,
      pkProfileRoutes: zutat?.profile.routes ?? null,
      method: schedule?.method ?? null,
      dose: schedule?.dose ?? null,
      unit: schedule?.unit ?? null,
      scheduledAt: schedule?.scheduledAt ?? null,
      // Ohne Faktor bzw. Konzentration fiele eine in IU oder ml geplante
      // Einnahme hier durch und der Eintrag verschwaende wortlos.
      iuPerMg: zutat?.profile.iu_per_mg ?? null,
      mgPerMl: zutat?.mgPerMl ?? null,
      mgJe: zutat?.mgJe ?? null,
    })
    const base = { cycleId: cycle.id, stackItemId: item.id }

    const first = pruefe(verknuepft[0] ?? null)
    if (first.status === 'missing') {
      entries.push({ kind: 'missing', key: cycle.id, ...base, name: item.display_name, missing: first.missing })
      continue
    }
    // Bei einem Kombipraeparat entscheidet jede Zutat fuer sich (Schleife
    // unten): fehlt der ersten die Staerke oder passt ihre Route nicht, hat
    // die zweite trotzdem ihre Kurve. Fehlende Angaben oben gelten dagegen
    // dem ganzen Produkt — Plan, Dosis und Uhrzeit sind fuer alle dieselben.
    const ganzesProdukt = !verknuepft.length || verknuepft.length === 1 || !schedule
    if (first.status === 'unsupported' && ganzesProdukt) {
      entries.push({
        kind: 'unsupported', key: cycle.id, ...base, name: item.display_name,
        reason: grund(first.reason),
        method: schedule?.method ?? null,
      })
      continue
    }
    if (!schedule) continue

    let nextDoseAt: number | null
    try {
      nextDoseAt = findNextPkDose(cycle, escalations, now)?.timestamp.getTime() ?? null
    } catch {
      nextDoseAt = null
    }
    const kombi = verknuepft.length > 1
    for (const [index, zutat] of verknuepft.entries()) {
      const key = `${cycle.id}:${zutat.id}`
      const name = kombi ? `${item.display_name} · ${zutat.name}` : item.display_name
      const readiness = zutat === verknuepft[0] ? first : pruefe(zutat)
      if (readiness.status === 'missing') {
        entries.push({ kind: 'missing', key, ...base, name, missing: readiness.missing })
        continue
      }
      if (readiness.status === 'unsupported') {
        entries.push({ kind: 'unsupported', key, ...base, name, reason: grund(readiness.reason), method: schedule?.method ?? null })
        continue
      }
      entries.push({
        kind: 'ready', key, ...base, name,
        produkt: item.display_name,
        wirkstoff: zutat.name,
        profileId: zutat.id,
        profile: zutat.profile,
        accent: kombi ? KOMBI_FARBEN[index % KOMBI_FARBEN.length] : CATEGORY_ACCENT[normalizeCategory(zutat.profile.category)],
        umrechnung: { iuPerMg: zutat.profile.iu_per_mg ?? null, mgPerMl: zutat.mgPerMl, mgJe: zutat.mgJe },
        pkProfileMethod: item.pk_profile_method ?? null,
        nextDoseAt,
      })
    }
  }
  return entries
}

// ── Verlauf ───────────────────────────────────────────────────────────────

export interface EntryHistory {
  events: DoseEvent[]
  interruptedAt: number | null
}

/** Einnahmen je Zyklus — ein Aufruf je Zyklus, gebuendelt im Service. */
export async function loadEntryHistories(entries: BlutspiegelEntry[]): Promise<Map<string, EntryHistory>> {
  const cycleIds = [...new Set(entries.filter(e => e.kind === 'ready').map(e => e.cycleId))]
  const histories = await Promise.all(cycleIds.map(async id => {
    const history = await loadDoseHistory(id)
    return [id, {
      events: history.events,
      interruptedAt: history.interruptedAt ? new Date(history.interruptedAt).getTime() : null,
    }] as const
  }))
  return new Map(histories)
}

export interface LevelPoint { ts: number; level: number }

export interface EntryCurve {
  points: LevelPoint[]
  /** Einnahmezeitpunkte (Unix ms) */
  intakes: number[]
  /** Bestaetigte Einnahmen mit Dosis, alt → neu (fuer „Letzte Einnahmen“). */
  doses: Array<{ ts: number; dose: number; unit: string }>
  current: number | null
  /** Hoechster Spiegel nach der letzten Einnahme */
  lastPeak: LevelPoint | null
  interruptedAt: number | null
}

const CURVE_RESOLUTION_MINUTES = 15

/** Der Verlauf des Zyklus aus Sicht dieses Wirkstoffs: endet, wo seine Route nicht mehr passt. */
function verlaufFuer(entry: ReadyEntry, history: EntryHistory): EntryHistory {
  const geschnitten = nachRouteSchneiden(
    { events: history.events, interruptedAt: null },
    entry.pkProfileMethod,
    entry.profile.routes ?? null,
  )
  if (!geschnitten.interruptedAt) return history
  const eigene = new Date(geschnitten.interruptedAt).getTime()
  return {
    events: geschnitten.events,
    interruptedAt: history.interruptedAt != null ? Math.min(history.interruptedAt, eigene) : eigene,
  }
}

export function buildEntryCurve(entry: ReadyEntry, gesamt: EntryHistory | undefined): EntryCurve {
  const history = gesamt ? verlaufFuer(entry, gesamt) : undefined
  const empty: EntryCurve = { points: [], intakes: [], doses: [], current: null, lastPeak: null, interruptedAt: history?.interruptedAt ?? null }
  if (!history) return empty
  const taken = history.events.filter(e => e.status === 'taken')
  if (!taken.length) return empty
  const raw = calculateHistoryBlutspiegelCurve(
    history.events,
    entry.profile.half_life_hours,
    entry.profile.tmax_hours,
    entry.profile.bioavailability_sc,
    CURVE_RESOLUTION_MINUTES,
    history.interruptedAt != null ? new Date(history.interruptedAt) : null,
    entry.umrechnung,
  )
  const points = raw.map(p => ({ ts: p.time.getTime(), level: p.level }))
  const intakes = taken.map(e => e.timestamp.getTime())
  const lastIntake = intakes[intakes.length - 1]
  let lastPeak: LevelPoint | null = null
  for (const p of points) {
    if (p.ts < lastIntake) continue
    if (!lastPeak || p.level >= lastPeak.level) lastPeak = p
  }
  return {
    points,
    intakes,
    doses: taken.map(e => ({ ts: e.timestamp.getTime(), dose: e.dose, unit: e.unit })),
    current: points.length ? points[points.length - 1].level : null,
    lastPeak,
    interruptedAt: history.interruptedAt,
  }
}
