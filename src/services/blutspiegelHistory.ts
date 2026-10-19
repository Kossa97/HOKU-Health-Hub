// Lädt alle bestätigten Einnahmen eines Zyklus aus der Datenbank
// und gibt sie als sortierte Liste von { timestamp, dose, status } zurück.

import { addDays, format } from 'date-fns'
import { supabase } from '../lib/supabase'
import { FEATURES } from '../config/features'
import {
  pkRouteAccepted,
  pkRouteStatus,
  resolvePkScheduleForDay,
  toPkMilligrams,
  type PkScheduleCycle,
  type ResolvedPkSchedule,
} from '../features/my-stack/lib/pkReadiness'
import { cycleAppliesToDay, findNextTimelineIntake, type EscalationRow } from '../lib/intakeSchedule'
import { resolveCycleAt } from '../lib/planTimeline'
import { pkRates, singleDoseLevel } from '../lib/pkModel'

export type BlutspiegelTrend = 'rising' | 'falling' | 'stable'

export interface CurrentBlutspiegelLevel {
  currentLevel: number
  trend: BlutspiegelTrend
  sparkData: number[]
  nextDoseIn: string
  levelAfterNextDose: number | null
  /** Abstand des hoechsten Spiegels zum Berechnungszeitpunkt (ms, negativ = vorbei); null ohne Kurve. Formatiert wird in der Oberflaeche. */
  peakInMs: number | null
  unit: string
  interruptedAt: string | null
}

export interface DoseEvent {
  method?: string
  cycleId?: string | null
  planVersionId?: string | null
  timestamp: Date   // Zeitpunkt der Einnahme
  dose: number
  unit: string
  status: 'taken' | 'skipped' | 'planned'
}

export interface DoseHistory {
  events: DoseEvent[]
  interruptedAt: string | null
}

export interface QuantifiedDoseLog<TTimestamp = string> {
  timestamp: TTimestamp
  dose: number | null
  unit: string | null
  taken: boolean
}

export interface QuantifiedDoseEvent<TTimestamp = string> {
  timestamp: TTimestamp
  dose: number
  unit: string
  status: 'taken'
}

export function splitQuantifiedDoseHistory<TTimestamp>(
  logs: QuantifiedDoseLog<TTimestamp>[],
): { events: QuantifiedDoseEvent<TTimestamp>[]; interruptedAt: TTimestamp | null } {
  const events: QuantifiedDoseEvent<TTimestamp>[] = []

  for (const log of logs) {
    if (!log.taken) continue
    if (log.dose == null || !Number.isFinite(log.dose) || !log.unit?.trim()) {
      return { events, interruptedAt: log.timestamp }
    }
    events.push({
      timestamp: log.timestamp,
      dose: log.dose,
      unit: log.unit,
      status: 'taken',
    })
  }

  return { events, interruptedAt: null }
}

interface CycleRow {
  stack_item_id: string
  start_date: string
  end_date: string | null
}

interface DoseLogRow {
  logged_at: string
  dose: number | null
  unit: string | null
  taken: boolean
}

/**
 * Einnahme-Bestätigungen liegen in `dose_logs` (Spalte `taken`:
 * `true` = eingenommen, `false` = übersprungen, `null` = noch offen).
 * Verknüpfung zum Zyklus über `stack_item_id` + Datumsbereich des Zyklus.
 */
export async function loadDoseHistory(cycleId: string): Promise<DoseHistory> {
  if (FEATURES.planTimelineV2) return sammelDoseHistory(cycleId)
  // 1. Zyklus laden
  const { data: cycle, error: cycleError } = await supabase
    .from('cycles')
    .select('stack_item_id, start_date, end_date')
    .eq('id', cycleId)
    .maybeSingle()

  if (cycleError || !cycle) return { events: [], interruptedAt: null }

  const { stack_item_id, start_date, end_date } = cycle as CycleRow

  // Oberes Datum: end_date, aber höchstens heute wenn end_date fehlt oder in der Zukunft liegt
  const todayIso = format(new Date(), 'yyyy-MM-dd')
  const upperDate =
    !end_date || end_date > todayIso ? todayIso : end_date

  // 2. dose_logs laden
  const { data, error } = await supabase
    .from('dose_logs')
    .select('logged_at, dose, unit, taken')
    .eq('stack_item_id', stack_item_id)
    .gte('logged_at', start_date)
    .lte('logged_at', `${upperDate}T23:59:59.999`)
    .not('taken', 'is', null)
    .order('logged_at', { ascending: true })

  if (error || !data) return { events: [], interruptedAt: null }

  const split = splitQuantifiedDoseHistory((data as DoseLogRow[]).map(log => ({
    timestamp: log.logged_at,
    dose: log.dose == null ? null : Number(log.dose),
    unit: log.unit,
    taken: log.taken,
  })))

  return {
    events: split.events.map(event => ({
      ...event,
      timestamp: new Date(event.timestamp),
    })),
    interruptedAt: split.interruptedAt,
  }
}

/**
 * Der Sammelabruf.
 *
 * Vorher holte diese Datei je Zyklus DREI Abfragen: den Zyklus selbst (den der
 * Aufrufer meist schon hatte) und zweimal `dose_logs` — einmal ueber
 * `cycle_id`, einmal ueber `stack_item_id` fuer die Altzeilen ohne Zyklusbezug.
 * Die Aufrufer fragen aber nie EINEN Zyklus, sondern alle auf einmal
 * (`cycles.map(...)` in `liveBlutspiegelChart` und im Karussell). Bei 153
 * Zyklen waren das ueber 450 Rundreisen je Seitenaufruf, und weil auf
 * `dose_logs.cycle_id` kein Index lag, las jede davon die ganze Tabelle.
 *
 * Gemessen am 2026-09-20: 5159 Anfragen an `/rest/v1/dose_logs` und 2792 an
 * `/rest/v1/cycles` an einem Tag — bei 238 Ladevorgaengen von `stack_items`.
 * Das Verhaeltnis 1,85 zu 1 ist genau dieses Zweier-Paar je Zyklus.
 *
 * `loadDoseHistory(cycleId)` bleibt unveraendert, damit kein Aufrufer sich
 * aendern muss. Was sich aendert: die Aufrufe, die im selben Zug entstehen,
 * werden gesammelt und als DREI Abfragen fuer alle Zyklen gestellt statt als
 * drei je Zyklus. Gesammelt wird ueber einen Microtask — `Promise.all` legt
 * seine Aufrufe synchron an, also liegen sie alle im selben Bund.
 */
interface WartendeAnfrage {
  aufloesen: (history: DoseHistory) => void
  ablehnen: (fehler: unknown) => void
}

const wartendeZyklen = new Map<string, WartendeAnfrage[]>()
let sammlungGeplant = false

function sammelDoseHistory(cycleId: string): Promise<DoseHistory> {
  return new Promise<DoseHistory>((aufloesen, ablehnen) => {
    const vorhanden = wartendeZyklen.get(cycleId)
    if (vorhanden) {
      // Derselbe Zyklus zweimal im selben Bund — eine Abfrage reicht.
      vorhanden.push({ aufloesen, ablehnen })
      return
    }
    wartendeZyklen.set(cycleId, [{ aufloesen, ablehnen }])
    if (sammlungGeplant) return
    sammlungGeplant = true
    queueMicrotask(() => {
      sammlungGeplant = false
      void bundAbarbeiten()
    })
  })
}

async function bundAbarbeiten(): Promise<void> {
  const bund = new Map(wartendeZyklen)
  wartendeZyklen.clear()
  if (bund.size === 0) return
  try {
    const ergebnisse = await ladeDoseHistories([...bund.keys()])
    for (const [cycleId, anfragen] of bund) {
      const ergebnis = ergebnisse.get(cycleId)
      for (const anfrage of anfragen) {
        // Ein Zyklus ohne Startzeitpunkt hat keine Historie — dieselbe
        // Aussage wie vorher, nur nicht mehr je Zyklus erfragt.
        if (ergebnis) anfrage.aufloesen(ergebnis)
        else anfrage.ablehnen(new Error('Cycle history boundary unavailable'))
      }
    }
  } catch (fehler) {
    for (const anfragen of bund.values()) {
      for (const anfrage of anfragen) anfrage.ablehnen(fehler)
    }
  }
}

interface NormalisierteZeile {
  logged_at: string
  dose: number | string | null
  unit: string | null
  method: string | null
  taken: boolean | null
  cycle_id: string | null
  plan_version_id: string | null
  stack_item_id?: string | null
}

/**
 * Aus Zeilen werden Ereignisse — unveraendert die alte Regel: sobald eine
 * Zeile nicht zur Methode des PK-Profils passt oder keine brauchbare Menge
 * traegt, bricht die Historie dort ab.
 */
function zuEreignissen(
  zeilen: NormalisierteZeile[],
  profileMethod: string | undefined,
  profileRoutes: readonly string[] | null = null,
): DoseHistory {
  const events: DoseEvent[] = []
  for (const row of zeilen) {
    const dose = row.dose == null ? null : Number(row.dose)
    // Eine Einnahme ueber eine Route, fuer die das Profil nicht gilt, beendet
    // die Kurve — bestaetigt oder vom Profil abgedeckt muss sie sein.
    if (!pkRouteAccepted(pkRouteStatus(row.method, profileMethod, profileRoutes))) {
      return { events, interruptedAt: row.logged_at }
    }
    if (dose == null || !Number.isFinite(dose) || !row.unit?.trim()) {
      return { events, interruptedAt: row.logged_at }
    }
    events.push({ timestamp: new Date(row.logged_at), dose, unit: row.unit, status: 'taken',
      cycleId: row.cycle_id, planVersionId: row.plan_version_id, method: row.method ?? undefined })
  }
  return { events, interruptedAt: null }
}

interface ZyklusSubstanz {
  pk_profile_method?: string | null
  ingredients?: Array<{ position: number; substance_catalog: { pk_profiles: { routes?: string[] | null } | null } | null }> | null
}

/** Routen des ersten verknuepften Profils — dasselbe Profil, das die Bereitschaft prueft. */
function ersteProfilRouten(item: ZyklusSubstanz | null): string[] | null {
  const zutaten = (item?.ingredients ?? []).slice().sort((a, b) => a.position - b.position)
  return zutaten.find(z => z.substance_catalog?.pk_profiles)?.substance_catalog?.pk_profiles?.routes ?? null
}

async function ladeDoseHistories(cycleIds: string[]): Promise<Map<string, DoseHistory>> {
  const { data: cycleRows, error } = await supabase.from('cycles')
    .select(`id, stack_item_id, started_at, ended_at, start_local_date, end_local_date,
      stack_items(pk_profile_method, ingredients:stack_item_ingredients(position, substance_catalog(pk_profiles(routes))))`)
    .in('id', cycleIds)
  if (error) throw error

  const now = new Date().toISOString()
  const zyklen = (cycleRows ?? []).filter(zyklus => Boolean(zyklus.started_at))
  const ergebnisse = new Map<string, DoseHistory>()
  if (zyklen.length === 0) return ergebnisse

  const stackItemIds = [...new Set(zyklen.map(zyklus => zyklus.stack_item_id).filter(Boolean))]
  // Die Altzeilen brauchen je Zyklus ein eigenes Zeitfenster. Geholt wird
  // einmal ab dem fruehesten Start; zugeordnet wird danach hier.
  const fruehesterStart = zyklen.reduce(
    (fruehester, zyklus) => (zyklus.started_at! < fruehester ? zyklus.started_at! : fruehester),
    now,
  )
  const fields = 'logged_at, dose, unit, method, taken, cycle_id, plan_version_id'

  const [exact, legacy] = await Promise.all([
    supabase.from('dose_logs').select(fields)
      .in('cycle_id', cycleIds).eq('taken', true)
      .lte('logged_at', now).order('logged_at', { ascending: true }),
    stackItemIds.length > 0
      ? supabase.from('dose_logs').select(`${fields}, stack_item_id`)
        .in('stack_item_id', stackItemIds)
        .is('cycle_id', null).is('plan_version_id', null).eq('taken', true)
        .gte('logged_at', fruehesterStart).lt('logged_at', now)
        .order('logged_at', { ascending: true })
      : Promise.resolve({ data: [] as NormalisierteZeile[], error: null }),
  ])
  if (exact.error) throw exact.error
  if (legacy.error) throw legacy.error

  const exaktNachZyklus = new Map<string, NormalisierteZeile[]>()
  for (const zeile of (exact.data ?? []) as NormalisierteZeile[]) {
    if (!zeile.cycle_id) continue
    const liste = exaktNachZyklus.get(zeile.cycle_id)
    if (liste) liste.push(zeile)
    else exaktNachZyklus.set(zeile.cycle_id, [zeile])
  }
  const altNachSubstanz = new Map<string, NormalisierteZeile[]>()
  for (const zeile of (legacy.data ?? []) as NormalisierteZeile[]) {
    const schluessel = zeile.stack_item_id
    if (!schluessel) continue
    const liste = altNachSubstanz.get(schluessel)
    if (liste) liste.push(zeile)
    else altNachSubstanz.set(schluessel, [zeile])
  }

  for (const zyklus of zyklen) {
    const obergrenze = zyklus.ended_at && zyklus.ended_at < now ? zyklus.ended_at : now
    const alt = (altNachSubstanz.get(zyklus.stack_item_id) ?? []).filter(
      zeile => zeile.logged_at >= zyklus.started_at! && zeile.logged_at < obergrenze,
    )
    const zeilen = [...(exaktNachZyklus.get(zyklus.id) ?? []), ...alt]
      .sort((a, b) => a.logged_at.localeCompare(b.logged_at))
    const item = zyklus.stack_items as unknown as ZyklusSubstanz | null
    ergebnisse.set(zyklus.id, zuEreignissen(zeilen, item?.pk_profile_method ?? undefined, ersteProfilRouten(item)))
  }
  return ergebnisse
}

export interface BlutspiegelCurvePoint {
  time: Date
  level: number
  status: 'actual' | 'planned'
}

/**
 * Was eine geplante Menge in Milligramm uebersetzt.
 *
 * Zwei Faktoren, beide gehoeren nicht der Kurve, sondern der Substanz bzw.
 * ihrer Zubereitung — deshalb kommen sie von aussen herein:
 *
 *   iuPerMg   Internationale Einheiten sind eine Wirkstaerke, keine Masse.
 *             Steht im PK-Profil.
 *   mgPerMl   Milliliter sind ein Volumen, keine Menge. Aus der Staerke der
 *             Zutat: 5 mg im Vial auf 2 ml Loesungsmittel sind 2,5 mg/ml.
 *
 * Als Objekt statt als zwei weitere Stellen in der Argumentliste: die Kurve
 * nahm zuletzt sieben Argumente, und das siebte war schon eine Zahl, die man
 * an der Aufrufstelle nicht mehr lesen konnte.
 */
export interface DoseUmrechnung {
  iuPerMg?: number | null
  mgPerMl?: number | null
}

/** Berechnet den Blutspiegel-Verlauf basierend auf echten Einnahme-Events. */
export function calculateHistoryBlutspiegelCurve(
  events: DoseEvent[],
  halfLifeHours: number,
  tmaxHours: number,
  bioavailability: number = 1.0,
  resolutionMinutes: number = 30,
  interruptedAt: Date | null = null,
  // Ohne die Umrechnung faellt jede Einnahme still aus der Summe, deren
  // Einheit nicht schon mg oder mcg ist — genau das liess HCG und HGH
  // verschwinden, und dasselbe gilt fuer ein in Millilitern geplantes Vial.
  umrechnung: DoseUmrechnung = {},
): BlutspiegelCurvePoint[] {
  return calculateCurveTo(
    events,
    interruptedAt ?? new Date(),
    halfLifeHours,
    tmaxHours,
    bioavailability,
    resolutionMinutes,
    umrechnung,
    // Bei einer Unterbrechung endet die Kurve VOR der unbrauchbaren Einnahme.
    interruptedAt != null,
  )
}

// ─── Aktueller Spiegel (Live) ────────────────────────────────────────────────

const INTAKE_MINUTES: Record<string, number> = {
  morgens: 8 * 60,
  mittags: 12 * 60,
  abends: 20 * 60,
}

const EMPTY_CURRENT_LEVEL: CurrentBlutspiegelLevel = {
  currentLevel: 0,
  trend: 'stable',
  sparkData: Array(20).fill(0),
  nextDoseIn: '—',
  levelAfterNextDose: 0,
  peakInMs: null,
  unit: 'mcg',
  interruptedAt: null,
}

function cycleIntakeMinutes(cycle: ResolvedPkSchedule): number {
  const firstKey = (cycle.intake_time ?? '').split(',')[0] ?? ''
  if (INTAKE_MINUTES[firstKey]) return INTAKE_MINUTES[firstKey]
  if (firstKey === 'custom' && cycle.intake_time_custom) {
    const firstCustom = cycle.intake_time_custom.split(',')[0]
    const [h, m] = firstCustom.split(':').map(Number)
    return (h || 0) * 60 + (m || 0)
  }
  return 8 * 60
}

export interface NextPkDose {
  method?: string | null
  cycleId?: string
  planVersionId?: string
  timestamp: Date
  dose: number | null
  unit: string | null
}

export function findNextPkDose(
  cycle: PkScheduleCycle,
  escalations: EscalationRow[],
  now: Date,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
): NextPkDose | null {
  if (FEATURES.planTimelineV2) {
    if (!cycle.timeline) throw new Error('Cycle timeline unavailable')
    const resolved = resolveCycleAt(cycle.timeline, now, timeZone)
    if (resolved.status === 'active' && !resolved.planVersion) throw new Error('Cycle plan version unavailable')
    const next = findNextTimelineIntake(cycle.timeline, now, timeZone)
    return next ? { timestamp: new Date(next.scheduledAt), dose: next.dose, unit: next.unit, method: next.method,
      cycleId: next.cycleId, planVersionId: next.planVersionId } : null
  }
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)

  for (let dayOffset = 0; dayOffset < 366; dayOffset++) {
    const day = addDays(todayStart, dayOffset)
    if (!cycleAppliesToDay(cycle, day)) continue

    const schedule = resolvePkScheduleForDay(cycle, escalations, day)
    if (!schedule) continue

    const doseTime = new Date(day)
    doseTime.setHours(0, 0, 0, 0)
    const mins = cycleIntakeMinutes(schedule)
    doseTime.setMinutes(mins % 60)
    doseTime.setHours(Math.floor(mins / 60))

    if (doseTime.getTime() > now.getTime()) {
      return { timestamp: doseTime, dose: schedule.dose, unit: schedule.unit }
    }
  }

  const fallback = new Date(now)
  fallback.setDate(fallback.getDate() + 1)
  fallback.setHours(8, 0, 0, 0)
  const schedule = resolvePkScheduleForDay(cycle, escalations, fallback)
  if (!schedule) return null
  return { timestamp: fallback, dose: schedule.dose, unit: schedule.unit }
}

function formatDurationShort(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60_000))
  if (totalMin < 60) return `${totalMin}m`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function calculateCurveTo(
  events: DoseEvent[],
  end: Date,
  halfLifeHours: number,
  tmaxHours: number,
  bioavailability: number,
  resolutionMinutes: number,
  umrechnung: DoseUmrechnung = {},
  endExclusive = false,
): BlutspiegelCurvePoint[] {
  const rates = pkRates(halfLifeHours, tmaxHours)
  if (events.length === 0 || !rates || resolutionMinutes <= 0) return []

  const start = events[0].timestamp
  if (start.getTime() > end.getTime()) return []

  const stepMs = resolutionMinutes * 60_000
  const endMs = end.getTime()
  const raw: BlutspiegelCurvePoint[] = []
  const latestActualTimestamp = Math.max(...events
    .filter(event => event.status === 'taken')
    .map(event => event.timestamp.getTime()))
  // Umrechnung einmal je Einnahme statt je Kurvenpunkt.
  const doses = events
    .filter(event => event.status !== 'skipped')
    .map(event => ({
      ms: event.timestamp.getTime(),
      mg: toPkMilligrams(event.dose, event.unit, umrechnung.iuPerMg ?? null, umrechnung.mgPerMl ?? null),
    }))
    .filter((dose): dose is { ms: number; mg: number } => dose.mg != null)
    .sort((a, b) => a.ms - b.ms)
  // Nach 20 Halbwertszeiten der langsameren Konstante bleibt weniger als ein
  // Millionstel einer Dosis — sie faellt aus der Summe. Bei langen Verlaeufen
  // spart das den Grossteil der Rechnung (nur die juengeren Dosen zaehlen).
  const horizonMs = 20 * (Math.LN2 / Math.min(rates.ka, rates.ke)) * 3_600_000
  let oldest = 0

  // Raster plus jede Einnahme als eigener Punkt: sonst laege eine Einnahme
  // zwischen zwei Rasterpunkten, und die Linie stiege sichtbar schon vorher an.
  const imBereich = (ms: number) => ms >= start.getTime() && (endExclusive ? ms < endMs : ms <= endMs)
  const zeiten: number[] = []
  for (let tMs = start.getTime(); imBereich(tMs); tMs += stepMs) zeiten.push(tMs)
  const raster = new Set(zeiten)
  for (const dose of doses) {
    if (!imBereich(dose.ms) || raster.has(dose.ms)) continue
    raster.add(dose.ms) // zwei Einnahmen zur selben Zeit: ein Punkt
    zeiten.push(dose.ms)
  }
  zeiten.sort((a, b) => a - b)

  for (const tMs of zeiten) {
    let total = 0
    while (oldest < doses.length && tMs - doses[oldest].ms > horizonMs) oldest++
    for (let i = oldest; i < doses.length && doses[i].ms < tMs; i++) {
      const dose = doses[i]
      total += singleDoseLevel(dose.mg, bioavailability, (tMs - dose.ms) / 3_600_000, rates)
    }
    raw.push({
      time: new Date(tMs),
      level: Math.max(0, total),
      status: tMs <= latestActualTimestamp ? 'actual' : 'planned',
    })
  }

  const peak = Math.max(...raw.map(p => p.level), 0)
  if (peak <= 0) return raw.map(p => ({ ...p, level: 0 }))

  return raw.map(p => ({
    time: p.time,
    level: (p.level / peak) * 100,
    status: p.status,
  }))
}

function levelAtOrBefore(curve: BlutspiegelCurvePoint[], target: Date): number {
  if (!curve.length) return 0
  let level = curve[0].level
  for (const p of curve) {
    if (p.time.getTime() <= target.getTime()) level = p.level
    else break
  }
  return level
}

function sampleSparkData(curve: BlutspiegelCurvePoint[], count = 10): number[] {
  if (!curve.length) return Array(count).fill(0)
  if (curve.length <= count) {
    const values = curve.map(p => p.level)
    while (values.length < count) values.unshift(values[0] ?? 0)
    return values
  }
  const result: number[] = []
  for (let i = 0; i < count; i++) {
    const idx = Math.round((i / (count - 1)) * (curve.length - 1))
    result.push(curve[idx].level)
  }
  return result
}

function peakOffsetFromCurve(curve: BlutspiegelCurvePoint[], now: Date): number | null {
  if (!curve.length) return null
  let peakPoint = curve[0]
  for (const p of curve) {
    if (p.level >= peakPoint.level) peakPoint = p
  }
  return peakPoint.time.getTime() - now.getTime()
}

function computeTrend(current: number, previous: number): BlutspiegelTrend {
  const diff = current - previous
  if (diff > 2) return 'rising'
  if (diff < -2) return 'falling'
  return 'stable'
}

/** Berechnet den aktuellen Blutspiegel-Wert für JETZT basierend auf den letzten Einnahmen eines Zyklus. */
export async function getCurrentBlutspiegelLevel(
  cycle: PkScheduleCycle,
  escalations: EscalationRow[],
  halfLifeHours: number,
  tmaxHours: number,
  bioavailability: number = 1.0,
  umrechnung: DoseUmrechnung = {},
  pkProfileMethod: string | null = null,
  pkProfileRoutes: readonly string[] | null = null,
): Promise<CurrentBlutspiegelLevel> {
  const history = await loadDoseHistory(cycle.id)
  const { events, interruptedAt } = history
  const takenEvents = events.filter(e => e.status === 'taken')
  const now = new Date()
  const schedule = resolvePkScheduleForDay(cycle, escalations, now)
  const cycleUnit = schedule ? schedule.unit ?? 'mcg' : '—'
  const nextDose = findNextPkDose(cycle, escalations, now)
  const canProject = Boolean(nextDose && (!FEATURES.planTimelineV2 || (
    schedule && pkRouteAccepted(pkRouteStatus(nextDose.method, pkProfileMethod, pkProfileRoutes))
    && nextDose.dose != null && nextDose.dose > 0 && nextDose.unit
    && toPkMilligrams(nextDose.dose, nextDose.unit, umrechnung.iuPerMg ?? null, umrechnung.mgPerMl ?? null) != null
  )))
  const nextDoseIn = nextDose ? formatDurationShort(nextDose.timestamp.getTime() - now.getTime()) : '—'

  if (!takenEvents.length) {
    return {
      ...EMPTY_CURRENT_LEVEL,
      nextDoseIn,
      levelAfterNextDose: canProject ? 0 : null,
      unit: cycleUnit,
      interruptedAt,
    }
  }

  const curve = calculateHistoryBlutspiegelCurve(
    events,
    halfLifeHours,
    tmaxHours,
    bioavailability,
    30,
    interruptedAt ? new Date(interruptedAt) : null,
    umrechnung,
  )

  if (!curve.length) {
    return {
      ...EMPTY_CURRENT_LEVEL,
      nextDoseIn,
      levelAfterNextDose: canProject ? 0 : null,
      unit: cycleUnit,
      interruptedAt,
    }
  }

  const currentLevel = curve[curve.length - 1].level
  const oneHourAgo = new Date(now.getTime() - 3_600_000)
  const trend = computeTrend(currentLevel, levelAtOrBefore(curve, oneHourAgo))

  const sparkCurve = calculateHistoryBlutspiegelCurve(
    events,
    halfLifeHours,
    tmaxHours,
    bioavailability,
    30,
    interruptedAt ? new Date(interruptedAt) : null,
    umrechnung,
  )
  const tenHoursAgo = new Date(now.getTime() - 10 * 3_600_000)
  const recentSpark = sparkCurve.filter(p => p.time.getTime() >= tenHoursAgo.getTime())
  const sparkData = sampleSparkData(
    recentSpark.length >= 20 ? recentSpark.slice(-20) : recentSpark,
    20,
  )

  const futureCurve = interruptedAt || !canProject || !nextDose || nextDose.dose == null || nextDose.unit == null
    ? []
    : calculateCurveTo(
        [...takenEvents, {
          timestamp: nextDose.timestamp,
          dose: nextDose.dose,
          unit: nextDose.unit,
          status: 'planned',
        }],
        new Date(nextDose.timestamp.getTime() + tmaxHours * 3_600_000 * 2),
        halfLifeHours,
        tmaxHours,
        bioavailability,
        30,
        umrechnung,
      )
  const afterNext = nextDose ? futureCurve.filter(p => p.time.getTime() >= nextDose.timestamp.getTime()) : []
  const levelAfterNextDose = !canProject ? null : afterNext.length
    ? Math.max(...afterNext.map(p => p.level))
    : currentLevel

  return {
    currentLevel,
    trend,
    sparkData,
    nextDoseIn,
    levelAfterNextDose,
    peakInMs: peakOffsetFromCurve(curve, now),
    unit: cycleUnit,
    interruptedAt,
  }
}
