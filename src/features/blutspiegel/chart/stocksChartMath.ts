// Reine Rechnungen des Blutspiegel-Graphen — ohne Canvas, damit testbar.
// Vorbild ist die Aktien-App: fester Zeitraum statt Wischen, Y-Achse passt
// sich dem sichtbaren Ausschnitt an, Zeitachse in ruhigen Schritten.

export interface LevelPoint { ts: number; level: number }

export type ChartRange = '1d' | '1w' | '1m' | 'cycle'
export const CHART_RANGES: ChartRange[] = ['1d', '1w', '1m', 'cycle']

const HOUR = 3_600_000
const DAY = 24 * HOUR

const RANGE_SPAN: Record<Exclude<ChartRange, 'cycle'>, number> = {
  '1d': DAY,
  '1w': 7 * DAY,
  '1m': 30 * DAY,
}

/**
 * Sichtbarer Zeitraum. Endet immer bei „jetzt". Beginnt der Verlauf spaeter
 * als der Zeitraum, beginnt der Ausschnitt mit dem Verlauf — kein leerer
 * Streifen links (wie bei einer frisch gelisteten Aktie).
 */
export function rangeBounds(range: ChartRange, now: number, dataStart: number | null): { start: number; end: number } {
  if (range === 'cycle') {
    const start = dataStart ?? now - DAY
    return { start: Math.min(start, now - HOUR), end: now }
  }
  const nominal = now - RANGE_SPAN[range]
  const start = dataStart != null && dataStart > nominal ? dataStart : nominal
  return { start: Math.min(start, now - HOUR), end: now }
}

/** Index des letzten Punkts mit ts <= target (binaere Suche); -1 davor. */
export function indexAtOrBefore(points: LevelPoint[], target: number): number {
  let lo = 0
  let hi = points.length - 1
  if (hi < 0 || points[0].ts > target) return -1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (points[mid].ts <= target) lo = mid
    else hi = mid - 1
  }
  return lo
}

/** Linear interpolierter Spiegel bei ts; null ausserhalb des Verlaufs. */
export function levelAt(points: LevelPoint[], ts: number): number | null {
  if (!points.length || ts < points[0].ts || ts > points[points.length - 1].ts) return null
  const i = indexAtOrBefore(points, ts)
  const a = points[i]
  const b = points[i + 1]
  if (!b || b.ts === a.ts) return a.level
  return a.level + (b.level - a.level) * ((ts - a.ts) / (b.ts - a.ts))
}

/** Punkte im Fenster plus je einen Nachbarn aussen, damit die Linie bis zum Rand reicht. */
export function visibleSlice(points: LevelPoint[], start: number, end: number): LevelPoint[] {
  if (!points.length) return []
  const from = Math.max(0, indexAtOrBefore(points, start))
  let to = indexAtOrBefore(points, end)
  if (to < 0) return []
  to = Math.min(points.length - 1, to + 1)
  return points.slice(from, to + 1)
}

export interface YDomain { lo: number; hi: number; ticks: number[] }

function niceStep(raw: number): number {
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const norm = raw / mag
  const mult = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10
  return mult * mag
}

/**
 * Y-Achse fuer den sichtbaren Ausschnitt: knapp um Min/Max, auf runde
 * Schritte gerundet, nie unter 0. Eine fast flache Kurve bekommt mindestens
 * 2 Prozentpunkte Hoehe, sonst wuerde Rauschen zum Gebirge.
 */
export interface YDomainOptions {
  /** Prozent-Spiegel: nie ueber 100, wenn die Werte 100 nicht ueberschreiten. */
  percentCap?: boolean
  /** Kleinste Spanne der Achse; Standard 2 (Prozentpunkte). */
  minSpan?: number
}

export function niceYDomain(min: number, max: number, targetTicks = 4, options: YDomainOptions = {}): YDomain {
  const { percentCap = true, minSpan = 2 } = options
  // Spiegel und Laborwerte sind nie negativ — nur echte negative Werte (etwa
  // eigene Marker) duerfen die Achse unter 0 ziehen.
  const floor = !percentCap && min < 0 ? -Infinity : 0
  let lo = Math.max(floor, min)
  let hi = Math.max(lo, max)
  if (hi - lo < minSpan) {
    const mid = (hi + lo) / 2
    lo = Math.max(floor, mid - minSpan / 2)
    hi = lo + minSpan
  }
  const pad = (hi - lo) * 0.08
  lo = Math.max(floor, lo - pad)
  // Der Spiegel ist % vom bisherigen Hoechstwert — ueber 100 gibt es nichts zu sehen.
  hi = percentCap && max <= 100 ? Math.min(100, hi + pad) : hi + pad
  const step = niceStep((hi - lo) / targetTicks)
  const niceLo = Math.max(floor, Math.floor(lo / step) * step)
  const niceHi = Math.ceil(hi / step) * step
  const ticks: number[] = []
  for (let v = niceLo; v <= niceHi + step * 1e-6; v += step) ticks.push(Math.round(v * 1000) / 1000)
  return { lo: niceLo, hi: niceHi, ticks }
}

export function yDomainFor(
  points: LevelPoint[], start: number, end: number,
  options: YDomainOptions & { include?: number[]; targetTicks?: number } = {},
): YDomain {
  const { include = [], targetTicks = 4, ...domainOptions } = options
  const slice = visibleSlice(points, start, end)
  if (!slice.length && !include.length) return niceYDomain(0, 100, targetTicks, domainOptions)
  let min = Infinity
  let max = -Infinity
  for (const v of include) {
    if (!Number.isFinite(v)) continue
    if (v < min) min = v
    if (v > max) max = v
  }
  for (const p of slice) {
    const level = p.ts < start ? levelAt(points, start) ?? p.level : p.ts > end ? levelAt(points, end) ?? p.level : p.level
    if (level < min) min = level
    if (level > max) max = level
  }
  return niceYDomain(min, max, targetTicks, domainOptions)
}

const TIME_STEPS = [HOUR, 2 * HOUR, 3 * HOUR, 6 * HOUR, 12 * HOUR, DAY, 2 * DAY, 7 * DAY, 14 * DAY, 28 * DAY, 56 * DAY, 91 * DAY, 182 * DAY, 364 * DAY]

/** Schrittweite der Zeitachse: so fein wie moeglich, mindestens minPx je Beschriftung. */
export function timeStep(start: number, end: number, widthPx: number, minPx = 56): number {
  const maxTicks = Math.max(1, Math.floor(widthPx / minPx))
  return TIME_STEPS.find(step => (end - start) / step <= maxTicks) ?? TIME_STEPS[TIME_STEPS.length - 1]
}

/** Ticks auf lokale Uhrzeit bzw. lokale Mitternacht ausgerichtet. */
export function timeTicks(start: number, end: number, step: number): number[] {
  if (end <= start) return []
  const d = new Date(start)
  if (step < DAY) {
    const hours = step / HOUR
    d.setMinutes(0, 0, 0)
    d.setHours(Math.ceil((d.getHours() + (d.getTime() < start ? 1e-9 : 0)) / hours) * hours)
  } else {
    d.setHours(0, 0, 0, 0)
    if (d.getTime() < start) d.setDate(d.getDate() + 1)
  }
  const ticks: number[] = []
  const days = step / DAY
  while (d.getTime() <= end) {
    if (d.getTime() >= start) ticks.push(d.getTime())
    if (step < DAY) d.setHours(d.getHours() + step / HOUR)
    else d.setDate(d.getDate() + days)
  }
  return ticks
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

/** Abschnitt der Kurve (in ts), der ganz innerhalb oder ganz ausserhalb eines Bereichs liegt. */
export interface ZoneRun { from: number; to: number; inside: boolean }

/**
 * Teilt die Kurve dort, wo sie eine Bereichsgrenze kreuzt (linear zwischen den
 * Punkten). Nebeneinanderliegende Abschnitte gleicher Lage werden zusammengefasst;
 * der erste beginnt bei -Infinity, der letzte endet bei +Infinity.
 */
export function zoneRuns(points: LevelPoint[], lo: number | null, hi: number | null): ZoneRun[] {
  if (!points.length) return []
  const inside = (v: number) => !((lo != null && v < lo) || (hi != null && v > hi))
  const runs: ZoneRun[] = []
  const push = (from: number, to: number, ins: boolean) => {
    const last = runs[runs.length - 1]
    if (last && last.inside === ins) last.to = to
    else runs.push({ from, to, inside: ins })
  }
  if (points.length === 1) return [{ from: -Infinity, to: Infinity, inside: inside(points[0].level) }]
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i]
    const cuts = [lo, hi]
      .filter((g): g is number => g != null && (a.level - g) * (b.level - g) < 0)
      .map(g => a.ts + ((g - a.level) / (b.level - a.level)) * (b.ts - a.ts))
      .sort((x, y) => x - y)
    const marks = [a.ts, ...cuts, b.ts]
    for (let k = 1; k < marks.length; k++) {
      if (marks[k] <= marks[k - 1]) continue
      const t = (marks[k - 1] + marks[k]) / 2
      const v = a.level + ((b.level - a.level) * (t - a.ts)) / (b.ts - a.ts)
      push(marks[k - 1], marks[k], inside(v))
    }
  }
  if (!runs.length) return [{ from: -Infinity, to: Infinity, inside: inside(points[0].level) }]
  runs[0].from = -Infinity
  runs[runs.length - 1].to = Infinity
  return runs
}

/** Grenzen, die ab `from` gelten (bis zum naechsten Schritt). Beide null: kein Bereich. */
export interface LimitStep { from: number; lo: number | null; hi: number | null }

/** Grenzen zum Zeitpunkt ts; vor dem ersten Schritt gilt der erste. */
export function limitsAt(steps: LimitStep[], ts: number): LimitStep | null {
  if (!steps.length) return null
  let current = steps[0]
  for (const s of steps) {
    if (s.from <= ts) current = s
    else break
  }
  return current
}

export type Zone = 'inside' | 'outside' | 'none'
export interface ZoneRunStepped { from: number; to: number; zone: Zone }

/**
 * Wie zoneRuns, aber mit Grenzen, die sich ueber die Zeit aendern (z. B. ein
 * anderer Laborbereich oder eine neue Altersgruppe). Jeder Schritt gilt von
 * seinem `from` bis zum naechsten; ein Schritt ohne Grenzen ergibt 'none'.
 */
export function zoneRunsStepped(points: LevelPoint[], steps: LimitStep[]): ZoneRunStepped[] {
  if (!points.length || !steps.length) return []
  const runs: ZoneRunStepped[] = []
  const push = (from: number, to: number, zone: Zone) => {
    if (to <= from) return
    const last = runs[runs.length - 1]
    if (last && last.zone === zone && last.to === from) last.to = to
    else runs.push({ from, to, zone })
  }
  steps.forEach((step, i) => {
    const von = i === 0 ? -Infinity : step.from
    const bis = i + 1 < steps.length ? steps[i + 1].from : Infinity
    if (step.lo == null && step.hi == null) { push(von, bis, 'none'); return }
    for (const r of zoneRuns(points, step.lo, step.hi)) {
      push(Math.max(von, r.from), Math.min(bis, r.to), r.inside ? 'inside' : 'outside')
    }
  })
  return runs
}

/**
 * Veraenderung des Spiegels seit `start` bis zum letzten Punkt. Beginnt der
 * Verlauf erst danach, zaehlt sein Anfang; endet er davor, gibt es keine.
 */
export function aenderungSeit(points: LevelPoint[], start: number): number | null {
  // Ein einzelner Punkt hat keine Veraenderung
  if (points.length < 2) return null
  const anfang = start < points[0].ts ? points[0].level : levelAt(points, start)
  return anfang == null ? null : points[points.length - 1].level - anfang
}
