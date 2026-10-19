import { useCallback, useEffect, useMemo, useState } from 'react'
import { format, parseISO, subDays, differenceInCalendarDays } from 'date-fns'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Dna,
  Download,
  FileText,
  Flame,
  FlaskConical,
  Link2,
  Scale,
  Syringe,
  XCircle,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { StocksChart, type ExtraSeries } from '../features/blutspiegel/chart/StocksChart'
import { levelAt, type LevelPoint } from '../features/blutspiegel/chart/stocksChartMath'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  effectsByPeptide as effectsBySubstance,
  reviewsByPeptide as reviewsBySubstance,
  topSideEffects,
  type EffectRow,
  type ReviewRow,
} from '../lib/insights'
import {
  isWellnessMarker,
  wellnessMarkersWithData,
  wellnessSeries,
  WELLNESS_MARKER_FIELD,
  type DailyLogRow,
} from '../lib/dailyLogs'
import { ResearchDisclaimer } from '../components/ui/DesignSystem'
import { ProtocolPdfModal } from '../components/ProtocolPdfModal'

interface DateRange {
  from: string
  to: string
}

interface WeightLog {
  id: string
  logged_at: string
  weight_kg: number | string
}

interface BloodworkEntry {
  id: string
  tested_at: string
  marker: string
  value: number | string
  unit: string
  notes: string | null
}

interface DoseLog {
  id: string
  stack_item_id: string | null
  logged_at: string
  taken: boolean | null
}

interface Cycle {
  id: string
  stack_item_id: string
  name: string
  start_date: string
  end_date: string | null
  active: boolean
  stack_items: { display_name: string } | null
}

type SupabaseCycleRow = Omit<Cycle, 'stack_items'> & {
  stack_items: { display_name: string } | { display_name: string }[] | null
}

type SupabaseEffectRow = Omit<EffectRow, 'stack_items'> & {
  stack_items: { display_name: string } | { display_name: string }[] | null
}

type SupabaseReviewRow = Omit<ReviewRow, 'stack_items'> & {
  stack_items: { display_name: string } | { display_name: string }[] | null
}

interface ProtocolCopy {
  title: string
  subtitle: string
  currentCycle: string
  customRange: string
  from: string
  to: string
  period: string
  activeCycles: string
  noActiveCycle: string
  charts: string
  weightTitle: string
  bloodworkTitle: string
  adherenceTitle: string
  marker: string
  bloodworkTable: string
  previousCycles: string
  noPreviousCycles: string
  duration: string
  days: string
  adherenceRate: string
  generatePdf: string
  generatingPdf: string
  share: string
  copied: string
  exportError: string
  loading: string
  emptyChart: string
  takenDays: string
  missedDays: string
  user: string
  exportedAt: string
  coverTitle: string
  researchExportHint: string
}

const COPY: Record<'de' | 'en', ProtocolCopy> = {
  de: {
    title: 'Protokoll',
    subtitle: 'Deine Auswertungen',
    currentCycle: 'Aktueller Zyklus',
    customRange: 'Eigener Zeitraum',
    from: 'Von',
    to: 'Bis',
    period: 'Zeitraum',
    activeCycles: 'Aktive Zyklen',
    noActiveCycle: 'Kein aktiver Zyklus - die letzten 30 Tage werden angezeigt.',
    charts: 'Diagramme',
    weightTitle: 'Gewichtsverlauf',
    bloodworkTitle: 'Blutwerte',
    adherenceTitle: 'Einnahme-Adherence',
    marker: 'Marker',
    bloodworkTable: 'Tabelle der Blutwerte',
    previousCycles: 'Vergangene Zyklen',
    noPreviousCycles: 'Noch keine abgeschlossenen Zyklen.',
    duration: 'Dauer',
    days: 'Tage',
    adherenceRate: 'Adherence',
    generatePdf: 'PDF generieren',
    generatingPdf: 'PDF wird erstellt...',
    share: 'Share-Link',
    copied: 'Link kopiert!',
    exportError: 'PDF konnte nicht erstellt werden',
    loading: 'Daten werden geladen...',
    emptyChart: 'Keine Daten im gewählten Zeitraum.',
    takenDays: 'Tage mit ✓',
    missedDays: 'Tage mit ✗',
    user: 'Name',
    exportedAt: 'Datum',
    coverTitle: 'TYD Protokoll',
    researchExportHint: 'PDF-Export = Research-Protokoll für deine Dokumentation',
  },
  en: {
    title: 'Protocol',
    subtitle: 'Your analytics',
    currentCycle: 'Current cycle',
    customRange: 'Custom period',
    from: 'From',
    to: 'To',
    period: 'Period',
    activeCycles: 'Active cycles',
    noActiveCycle: 'No active cycle - showing the last 30 days.',
    charts: 'Charts',
    weightTitle: 'Weight trend',
    bloodworkTitle: 'Bloodwork',
    adherenceTitle: 'Dose adherence',
    marker: 'Marker',
    bloodworkTable: 'Bloodwork table',
    previousCycles: 'Previous cycles',
    noPreviousCycles: 'No completed cycles yet.',
    duration: 'Duration',
    days: 'days',
    adherenceRate: 'Adherence',
    generatePdf: 'Generate PDF',
    generatingPdf: 'Generating PDF...',
    share: 'Share link',
    copied: 'Link copied!',
    exportError: 'Could not create PDF',
    loading: 'Loading data...',
    emptyChart: 'No data in the selected period.',
    takenDays: 'Days with ✓',
    missedDays: 'Days with ✗',
    user: 'Name',
    exportedAt: 'Date',
    coverTitle: 'TYD Protocol',
    researchExportHint: 'PDF export = research protocol for your documentation',
  },
}

// ─── Design constants ────────────────────────────────────────────────────────

const NORMAL_RANGES: Record<string, { min: number | null; max: number | null }> = {
  'IGF-1':       { min: 100,  max: 300  },
  'Testosteron': { min: 264,  max: 916  },
  'Östradiol':   { min: 10,   max: 40   },
  'SHBG':        { min: 10,   max: 57   },
  'LH':          { min: 1.5,  max: 9.3  },
  'FSH':         { min: 1.5,  max: 12.4 },
  'TSH':         { min: 0.4,  max: 4.0  },
  'CRP':         { min: 0,    max: 5.0  },
  'Vitamin D':   { min: 30,   max: 100  },
  'Ferritin':    { min: 30,   max: 400  },
  'Hämoglobin':  { min: 13.5, max: 17.5 },
  'Hematokrit':  { min: 40,   max: 52   },
  'GH':          { min: 0,    max: 3.0  },
  'Kortisol':    { min: 6,    max: 23   },
  'Insulin':     { min: 2,    max: 25   },
  'Energie':     { min: 1,    max: 5    },
  'Schlaf':      { min: 1,    max: 5    },
  'Libido':      { min: 1,    max: 5    },
}

const SERIES_COLORS: Record<string, string> = {
  'Gewicht':     '#00ccf5',
  'IGF-1':       '#8b5cf6',
  'CRP':         '#10b981',
  'Testosteron': '#f59e0b',
  'Insulin':     '#f43f5e',
  'Vitamin D':   '#38bdf8',
  'Östradiol':   '#a78bfa',
  'TSH':         '#34d399',
  'Hämoglobin':  '#fb923c',
  'Hematokrit':  '#e879f9',
  'GH':          '#67e8f9',
  'Kortisol':    '#fde68a',
  'Ferritin':    '#86efac',
  'SHBG':        '#c084fc',
  'LH':          '#f472b6',
  'FSH':         '#94a3b8',
  'Energie':     '#00ccf5',
  'Schlaf':      '#6366f1',
  'Libido':      '#f43f5e',
}

const PRESETS: { key: string; label: string; icon: LucideIcon; markers: string[] }[] = [
  { key: 'weight-igf1',  label: 'Gewicht + IGF-1', icon: Scale,       markers: ['Gewicht', 'IGF-1'] },
  { key: 'gh-panel',     label: 'GH-Panel',         icon: Syringe,     markers: ['Gewicht', 'IGF-1', 'Vitamin D'] },
  { key: 'inflammation', label: 'Entzündung',       icon: Flame,       markers: ['Gewicht', 'CRP'] },
  { key: 'metabolismus', label: 'Metabolismus',     icon: Dna,         markers: ['Gewicht', 'Insulin'] },
  { key: 'hormone',      label: 'Hormone',          icon: FlaskConical, markers: ['Testosteron', 'IGF-1', 'Insulin'] },
  { key: 'wellness',     label: 'Befinden',         icon: Zap,         markers: ['Energie', 'Schlaf', 'Libido'] },
  { key: 'full',         label: 'Alle Marker',      icon: BarChart3,   markers: [] },
]

const CYCLE_COLORS = ['#00ccf5', '#8b5cf6', '#10b981', '#f59e0b', '#f43f5e', '#38bdf8']

function getSeriesColor(marker: string): string {
  return SERIES_COLORS[marker] ?? '#00ccf5'
}

function getNormalRange(marker: string): { min: number | null; max: number | null } {
  return NORMAL_RANGES[marker] ?? { min: null, max: null }
}

function toPercentChange(entries: { date: string; value: number }[]): { date: string; pct: number }[] {
  if (entries.length === 0) return []
  const first = entries[0].value
  if (first === 0) return entries.map(e => ({ date: e.date, pct: 0 }))
  return entries.map(e => ({
    date: e.date,
    pct: Math.round(((e.value - first) / Math.abs(first)) * 1000) / 10,
  }))
}



const SHARE_URL = 'https://tyd-track-your-dose.vercel.app/protokoll?ref=share'

function copyFor(language: string): ProtocolCopy {
  return language.toLowerCase().startsWith('en') ? COPY.en : COPY.de
}

function todayIso() {
  return format(new Date(), 'yyyy-MM-dd')
}

function defaultRange(): DateRange {
  return {
    from: format(subDays(new Date(), 29), 'yyyy-MM-dd'),
    to: todayIso(),
  }
}

function toDate(value: string) {
  return value.includes('T') ? new Date(value) : new Date(`${value}T00:00:00`)
}

function dateKey(value: string) {
  return format(toDate(value), 'yyyy-MM-dd')
}

function numericValue(value: number | string) {
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

function isValidRange(range: DateRange) {
  return Boolean(range.from && range.to && range.from <= range.to)
}

function formatDate(value: string, language: string) {
  return new Intl.DateTimeFormat(language, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(toDate(value))
}

function formatNumber(value: number, language: string, maximumFractionDigits = 1) {
  return new Intl.NumberFormat(language, { maximumFractionDigits }).format(value)
}

function cycleEnd(cycle: Cycle) {
  return cycle.end_date ?? todayIso()
}

function normalizeCycles(rows: SupabaseCycleRow[] | null | undefined): Cycle[] {
  return (rows ?? []).map(row => ({
    ...row,
    stack_items: Array.isArray(row.stack_items) ? row.stack_items[0] ?? null : row.stack_items,
  }))
}

function normalizeEffects(rows: SupabaseEffectRow[] | null | undefined): EffectRow[] {
  return (rows ?? []).map(row => ({
    ...row,
    stack_items: Array.isArray(row.stack_items) ? row.stack_items[0] ?? null : row.stack_items,
  }))
}

function normalizeReviews(rows: SupabaseReviewRow[] | null | undefined): ReviewRow[] {
  return (rows ?? []).map(row => ({
    ...row,
    stack_items: Array.isArray(row.stack_items)
      ? row.stack_items[0] ?? { display_name: '—' }
      : row.stack_items ?? { display_name: '—' },
  }))
}

function rangeFromActiveCycles(cycles: Cycle[]): DateRange {
  if (cycles.length === 0) return defaultRange()
  const starts = cycles.map(cycle => cycle.start_date).sort()
  const ends = cycles.map(cycle => cycle.end_date ?? todayIso()).sort()
  return { from: starts[0], to: ends[ends.length - 1] }
}

function cycleDuration(cycle: Cycle) {
  return differenceInCalendarDays(parseISO(cycleEnd(cycle)), parseISO(cycle.start_date)) + 1
}

function isLogWithinRange(log: DoseLog, range: DateRange) {
  const key = dateKey(log.logged_at)
  return key >= range.from && key <= range.to
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="h-56 rounded-[18px] bg-[var(--lg-surface-2)] flex items-center justify-center text-sm text-[var(--lg-text-2)]">
      {label}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="lg-surface lg-flat" style={{ borderRadius: 18, padding: '10px 10px 11px', minWidth: 0 }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--lg-text-2)', marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</p>
      <p style={{ fontSize: 'clamp(13px, 4vw, 17px)', fontWeight: 700, color, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.01em' }} title={value}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: 'var(--lg-text-3)', marginTop: 4 }}>{sub}</p>}
    </div>
  )
}

/** Ein Kalendertag als Zeitpunkt (Tagesmitte) fuer die Zeitachse. */
const dayTs = (date: string) => parseISO(`${date}T12:00:00`).getTime()

const signedPct = (v: number, language: string) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${formatNumber(Math.abs(v), language, 1)} %`

interface SmallMultipleSeriesProps {
  marker: string; unit: string; color: string
  normalMin: number | null; normalMax: number | null
  points: LevelPoint[]
  lastValue: number | null
}

/**
 * Detailansicht: je Marker ein kleiner Graph auf derselben Zeitachse. Die
 * Graphen sind gekoppelt — wer einen abliest, sieht in allen denselben Tag;
 * der Wert steht dann in der Kopfzeile der Reihe.
 */
function SmallMultiples({ series, start, end, language }: { series: SmallMultipleSeriesProps[]; start: number; end: number; language: string }) {
  const [syncTs, setSyncTs] = useState<number | null>(null)
  const dayFmt = useMemo(() => new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short' }), [language])
  const onScrub = useCallback((p: LevelPoint | null) => setSyncTs(p ? p.ts : null), [])
  const formatTick = useCallback((ts: number) => dayFmt.format(ts), [dayFmt])
  return (
    <>
      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--lg-text-2)', minHeight: 18, marginBottom: 4 }} aria-live="polite">
        {syncTs != null ? formatDate(format(new Date(syncTs), 'yyyy-MM-dd'), language) : ''}
      </p>
      {series.map((row, i) => {
        const isLast = i === series.length - 1
        // Beim Ablesen der Wert der Linie an diesem Tag (wie der Punkt im Graph)
        const shown = syncTs != null ? levelAt(row.points, syncTs) : row.lastValue
        return (
          <div key={row.marker} style={{ marginBottom: isLast ? 0 : 6 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 2, paddingLeft: 4 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: row.color }}>{row.marker}</span>
                <span style={{ fontSize: 12, color: 'var(--lg-text-2)' }}>{row.unit}</span>
                {row.normalMin != null && row.normalMax != null && (
                  <span style={{ fontSize: 11, color: 'var(--lg-text-3)' }}>Norm: {row.normalMin}–{row.normalMax}</span>
                )}
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: row.color, fontVariantNumeric: 'tabular-nums' }}>
                {shown != null ? `${formatNumber(shown, language, 2)} ${row.unit}` : '–'}
              </span>
            </div>
            <StocksChart
              points={row.points}
              start={start}
              end={end}
              accent={row.color}
              height={isLast ? 96 : 74}
              seriesKey={row.marker}
              formatTick={formatTick}
              formatValue={v => formatNumber(v, language, 1)}
              onScrub={onScrub}
              syncTs={syncTs}
              ariaLabel={`${row.marker}: Verlauf`}
              band={row.normalMin != null || row.normalMax != null ? { lo: row.normalMin, hi: row.normalMax, color: row.color } : undefined}
              yInclude={[row.normalMin, row.normalMax].filter((v): v is number => v != null)}
              dots
              percentCap={false}
              minSpan={Math.max(0.5, Math.max(...row.points.map(p => Math.abs(p.level)), 1) * 0.1)}
              intakeStrip={false}
              xAxis={isLast}
              yTicks={2}
            />
          </div>
        )
      })}
    </>
  )
}


export function Protokoll() {
  const { user } = useAuth()
  const { i18n, t } = useTranslation()
  const language = i18n.language || 'de'
  const copy = useMemo(() => copyFor(language), [language])
  const [pdfModalOpen, setPdfModalOpen] = useState(false)

  const [selectorMode, setSelectorMode] = useState<'current' | 'custom'>('current')
  const [range, setRange] = useState<DateRange>(defaultRange)
  const [activeCycles, setActiveCycles] = useState<Cycle[]>([])
  const [completedCycles, setCompletedCycles] = useState<Cycle[]>([])
  const [cycleDoseLogs, setCycleDoseLogs] = useState<DoseLog[]>([])
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([])
  const [bloodwork, setBloodwork] = useState<BloodworkEntry[]>([])
  const [doseLogs, setDoseLogs] = useState<DoseLog[]>([])
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null)
  const [activeMarkers, setActiveMarkers] = useState<string[]>(['Gewicht', 'IGF-1'])
  const [selectedPreset, setSelectedPreset] = useState<string>('weight-igf1')
  const [loadingBase, setLoadingBase] = useState(true)
  const [loadingCharts, setLoadingCharts] = useState(false)
  const [effects, setEffects] = useState<EffectRow[]>([])
  const [reviews, setReviews] = useState<ReviewRow[]>([])
  const [dailyLogs, setDailyLogs] = useState<DailyLogRow[]>([])

  const currentCycleRange = useMemo<DateRange>(() => {
    return rangeFromActiveCycles(activeCycles)
  }, [activeCycles])

  // ─── New derived data ──────────────────────────────────────────────────────

  const availableMarkers = useMemo(() => {
    const blood = Array.from(new Set(bloodwork.map(e => e.marker))).sort()
    const wellness = wellnessMarkersWithData(dailyLogs)
    return ['Gewicht', ...wellness, ...blood]
  }, [bloodwork, dailyLogs])

  const bloodTestDates = useMemo(
    () => Array.from(new Set(bloodwork.map(e => e.tested_at))).sort(),
    [bloodwork],
  )

  const cycleBands = useMemo(() => (
    [...activeCycles, ...completedCycles].map((c, i) => ({
      x1: c.start_date,
      x2: cycleEnd(c),
      name: c.stack_items?.display_name ?? c.name,
      color: CYCLE_COLORS[i % CYCLE_COLORS.length],
    }))
  ), [activeCycles, completedCycles])

  const kpiValues = useMemo(() => {
    const logsWithValue = doseLogs.filter(l => l.taken != null)
    const takenCount = logsWithValue.filter(l => l.taken).length
    const adherencePct = logsWithValue.length > 0
      ? Math.round((takenCount / logsWithValue.length) * 100)
      : null

    const sortedWeights = [...weightLogs]
      .map(l => ({ date: dateKey(l.logged_at), value: numericValue(l.weight_kg) }))
      .filter((e): e is { date: string; value: number } => e.value != null)
      .sort((a, b) => a.date.localeCompare(b.date))
    const firstWeight = sortedWeights[0]?.value ?? null
    const lastWeight  = sortedWeights[sortedWeights.length - 1]?.value ?? null
    const weightDelta = firstWeight != null && lastWeight != null
      ? Math.round((lastWeight - firstWeight) * 10) / 10 : null

    function markerDelta(marker: string): number | null {
      const entries = bloodwork
        .filter(e => e.marker === marker)
        .map(e => ({ date: e.tested_at, value: numericValue(e.value) }))
        .filter((e): e is { date: string; value: number } => e.value != null)
        .sort((a, b) => a.date.localeCompare(b.date))
      if (entries.length < 2) return null
      const first = entries[0].value
      if (first === 0) return null
      return Math.round(((entries[entries.length - 1].value - first) / Math.abs(first)) * 1000) / 10
    }

    return {
      adherencePct,
      weightDelta,
      igf1Delta: markerDelta('IGF-1'),
      crpDelta:  markerDelta('CRP'),
    }
  }, [doseLogs, weightLogs, bloodwork])

  // % Veraenderung ab Start, je Marker eine Linie auf der Zeitachse
  const percentSeries = useMemo(() => {
    const out: Array<{ marker: string; color: string; points: LevelPoint[] }> = []
    const toPoints = (pcts: { date: string; pct: number }[]) => pcts.map(p => ({ ts: dayTs(p.date), level: p.pct }))
    for (const marker of activeMarkers) {
      let pcts: { date: string; pct: number }[]
      if (marker === 'Gewicht') {
        const weightSorted = [...weightLogs]
          .map(l => ({ date: dateKey(l.logged_at), value: numericValue(l.weight_kg) }))
          .filter((e): e is { date: string; value: number } => e.value != null)
          .sort((a, b) => a.date.localeCompare(b.date))
        pcts = toPercentChange(weightSorted)
      } else if (isWellnessMarker(marker)) {
        pcts = toPercentChange(wellnessSeries(dailyLogs, marker))
      } else {
        const entries = bloodwork
          .filter(e => e.marker === marker)
          .map(e => ({ date: e.tested_at, value: numericValue(e.value) }))
          .filter((e): e is { date: string; value: number } => e.value != null)
          .sort((a, b) => a.date.localeCompare(b.date))
        pcts = toPercentChange(entries)
      }
      if (pcts.length) out.push({ marker, color: getSeriesColor(marker), points: toPoints(pcts) })
    }
    return out
  }, [activeMarkers, weightLogs, bloodwork, dailyLogs])

  // Gemeinsame Zeitachse: gewaehlter Zeitraum, erweitert um Werte ausserhalb
  const chartWindow = useMemo(() => {
    // Ein geleertes Datumsfeld zaehlt nicht — sonst wird die ganze Achse NaN.
    const bounds = [range.from, range.to].map(dayTs).filter(Number.isFinite)
    const all = [...percentSeries.flatMap(series => series.points.map(p => p.ts)), ...bounds]
    // Ohne Daten zeigt die Seite keine Graphen — der Wert ist dann egal.
    if (!all.length) all.push(0)
    const from = Math.min(...all)
    const to = Math.max(...all)
    const pad = Math.max(12 * 3_600_000, (to - from) * 0.02)
    return { start: from - pad, end: to + pad }
  }, [percentSeries, range])

  // Fuer den Graph einmal je Datenstand — sonst zeichnet jeder Render den Canvas neu.
  const percentChart = useMemo(() => {
    const dateLabel = (ts: number) => formatDate(format(new Date(ts), 'yyyy-MM-dd'), language)
    const pct = (v: number) => signedPct(v, language)
    return {
      formatTick: dateLabel,
      formatValue: pct,
      scrubLabel: { date: dateLabel, value: pct },
      others: percentSeries.slice(1).map((series): ExtraSeries => ({ key: series.marker, name: series.marker, points: series.points, color: series.color })),
      yInclude: [0, ...percentSeries.flatMap(series => series.points.map(p => p.level))],
      snapTimes: percentSeries.slice(1).flatMap(series => series.points.map(p => p.ts)),
      xBands: cycleBands.map(band => ({ x1: dayTs(band.x1) - 12 * 3_600_000, x2: dayTs(band.x2) + 12 * 3_600_000, color: band.color, label: band.name })),
      xLines: bloodTestDates.map((date, i) => ({ ts: dayTs(date), color: '#00ccf5', label: i === 0 ? 'Bluttest' : undefined })),
    }
  }, [percentSeries, cycleBands, bloodTestDates, language])

  interface SmallMultipleSeries {
    marker: string
    unit: string
    color: string
    normalMin: number | null
    normalMax: number | null
    points: LevelPoint[]
    lastValue: number | null
  }

  const smallMultiplesData = useMemo((): SmallMultipleSeries[] => (
    activeMarkers.map(marker => {
      const color = getSeriesColor(marker)
      const { min: normalMin, max: normalMax } = getNormalRange(marker)
      let data: { date: string; label: string; value: number | null }[]
      let unit: string

      if (marker === 'Gewicht') {
        data = [...weightLogs]
          .sort((a, b) => dateKey(a.logged_at).localeCompare(dateKey(b.logged_at)))
          .map(l => ({ date: dateKey(l.logged_at), label: formatDate(dateKey(l.logged_at), language), value: numericValue(l.weight_kg) }))
        unit = 'kg'
      } else if (isWellnessMarker(marker)) {
        const entries = wellnessSeries(dailyLogs, marker)
        unit = '/5'
        data = entries.map(e => ({ date: e.date, label: formatDate(e.date, language), value: e.value }))
      } else {
        const entries = bloodwork.filter(e => e.marker === marker).sort((a, b) => a.tested_at.localeCompare(b.tested_at))
        unit = entries[0]?.unit ?? ''
        data = entries.map(e => ({ date: e.tested_at, label: formatDate(e.tested_at, language), value: numericValue(e.value) }))
      }

      const points = data
        .filter((d): d is { date: string; label: string; value: number } => d.value != null)
        .map(d => ({ ts: dayTs(d.date), level: d.value }))
      const lastValue = points.length ? points[points.length - 1].level : null

      return { marker, unit, color, normalMin, normalMax, points, lastValue }
    }).filter(series => series.points.length > 0)
  ), [activeMarkers, weightLogs, bloodwork, dailyLogs, language])

  const adherencePerSubstance = useMemo(() => {
    const nameMap = new Map<string, string>()
    ;[...activeCycles, ...completedCycles].forEach(c => {
      if (c.stack_item_id && c.stack_items?.display_name) nameMap.set(c.stack_item_id, c.stack_items.display_name)
    })
    const grouped = new Map<string, { taken: number; total: number }>()
    doseLogs.forEach(log => {
      if (log.taken == null || !log.stack_item_id) return
      const name = nameMap.get(log.stack_item_id) ?? log.stack_item_id
      const existing = grouped.get(name) ?? { taken: 0, total: 0 }
      existing.total++
      if (log.taken) existing.taken++
      grouped.set(name, existing)
    })
    return Array.from(grouped.entries())
      .map(([name, stats], i) => ({ name, pct: Math.round((stats.taken / stats.total) * 100), color: CYCLE_COLORS[i % CYCLE_COLORS.length] }))
      .sort((a, b) => b.pct - a.pct)
  }, [doseLogs, activeCycles, completedCycles])

  const sideEffectStats = useMemo(() => topSideEffects(effects), [effects])
  const substanceEffectStats = useMemo(() => effectsBySubstance(effects), [effects])
  const substanceReviewStats = useMemo(() => reviewsBySubstance(reviews), [reviews])

  const loadBaseData = useCallback(async () => {
    if (!user) return
    setLoadingBase(true)

    const [{ data: activeData }, { data: completedData }] = await Promise.all([
      supabase
        .from('cycles')
        .select('id, stack_item_id, name, start_date, end_date, active, stack_items(display_name)')
        .eq('user_id', user.id)
        .eq('active', true)
        .order('start_date', { ascending: false }),
      supabase
        .from('cycles')
        .select('id, stack_item_id, name, start_date, end_date, active, stack_items(display_name)')
        .eq('user_id', user.id)
        .eq('active', false)
        .order('start_date', { ascending: false }),
    ])

    const active = normalizeCycles(activeData as unknown as SupabaseCycleRow[])
    const completed = normalizeCycles(completedData as unknown as SupabaseCycleRow[])
    setActiveCycles(active)
    setCompletedCycles(completed)
    setRange(current => selectorMode === 'current' ? rangeFromActiveCycles(active) : current)
    setSelectedCycleId(current => selectorMode === 'current' ? null : current)

    if (completed.length > 0) {
      const from = completed.map(cycle => cycle.start_date).sort()[0]
      const to = completed.map(cycle => cycleEnd(cycle)).sort().at(-1) ?? todayIso()
      const { data } = await supabase
        .from('dose_logs')
        .select('id, stack_item_id, logged_at, taken')
        .eq('user_id', user.id)
        .gte('logged_at', from)
        .lte('logged_at', `${to}T23:59:59`)
      setCycleDoseLogs((data ?? []) as DoseLog[])
    } else {
      setCycleDoseLogs([])
    }

    setLoadingBase(false)
  }, [selectorMode, user])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadBaseData()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadBaseData])

  const loadRangeData = useCallback(async () => {
    if (!user || !isValidRange(range)) return
    setLoadingCharts(true)

    const [{ data: weights }, { data: blood }, { data: doses }, { data: effectRows }, { data: reviewRows }, { data: daily }] = await Promise.all([
      supabase
        .from('weight_logs')
        .select('id, logged_at, weight_kg')
        .eq('user_id', user.id)
        .gte('logged_at', range.from)
        .lte('logged_at', `${range.to}T23:59:59`)
        .order('logged_at', { ascending: true }),
      supabase
        .from('bloodwork')
        .select('id, tested_at, marker, value, unit, notes')
        .eq('user_id', user.id)
        .gte('tested_at', range.from)
        .lte('tested_at', range.to)
        .order('tested_at', { ascending: true })
        .order('marker', { ascending: true }),
      supabase
        .from('dose_logs')
        .select('id, stack_item_id, logged_at, taken')
        .eq('user_id', user.id)
        .gte('logged_at', range.from)
        .lte('logged_at', `${range.to}T23:59:59`)
        .order('logged_at', { ascending: true }),
      supabase
        .from('effects')
        .select('id, type, description, severity, stack_item_id, occurred_at, stack_items(display_name)')
        .eq('user_id', user.id)
        .gte('occurred_at', `${range.from}T00:00:00`)
        .lte('occurred_at', `${range.to}T23:59:59`)
        .order('occurred_at', { ascending: false }),
      supabase
        .from('reviews')
        .select('id, stack_item_id, rating, experience, wirkung, vertraeglichkeit, wieder_nehmen, stack_items(display_name)')
        .eq('user_id', user.id)
        .gte('created_at', `${range.from}T00:00:00`)
        .lte('created_at', `${range.to}T23:59:59`),
      supabase
        .from('daily_logs')
        .select('id, log_date, energie, schlaf, libido, notes')
        .eq('user_id', user.id)
        .gte('log_date', range.from)
        .lte('log_date', range.to)
        .order('log_date', { ascending: true }),
    ])

    const bloodEntries = (blood ?? []) as BloodworkEntry[]
    const nextMarkers = Array.from(new Set(bloodEntries.map(entry => entry.marker))).sort((a, b) => a.localeCompare(b))

    setWeightLogs((weights ?? []) as WeightLog[])
    setBloodwork(bloodEntries)
    setDoseLogs((doses ?? []) as DoseLog[])
    setEffects(normalizeEffects(effectRows))
    setReviews(normalizeReviews(reviewRows))
    const dailyEntries = (daily ?? []) as DailyLogRow[]
    setDailyLogs(dailyEntries)
    const wellnessAvailable = wellnessMarkersWithData(dailyEntries)
    // auto-apply preset if current activeMarkers have no data
    setActiveMarkers(prev => {
      const hasBlood = nextMarkers.length > 0
      const hasWellness = wellnessAvailable.length > 0
      if (!hasBlood && !hasWellness) return ['Gewicht']
      const valid = prev.filter(m => {
        if (m === 'Gewicht') return true
        if (isWellnessMarker(m)) return wellnessAvailable.includes(m)
        return nextMarkers.includes(m)
      })
      if (valid.length > 0) return valid
      if (hasWellness) return [...wellnessAvailable]
      return ['Gewicht', nextMarkers[0]]
    })
    setLoadingCharts(false)
  }, [range, user])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadRangeData()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadRangeData])


  const adherenceForCycle = useCallback((cycle: Cycle) => {
    const cycleRange = { from: cycle.start_date, to: cycleEnd(cycle) }
    const logs = cycleDoseLogs.filter(log => (
      log.stack_item_id === cycle.stack_item_id
      && log.taken != null
      && isLogWithinRange(log, cycleRange)
    ))
    if (logs.length === 0) return null
    const taken = logs.filter(log => log.taken).length
    return Math.round((taken / logs.length) * 100)
  }, [cycleDoseLogs])

  const applyPreset = (presetKey: string) => {
    const preset = PRESETS.find(p => p.key === presetKey)
    if (!preset) return
    const candidates = preset.key === 'full' ? availableMarkers : preset.markers
    const valid = candidates.filter(m => {
      if (m === 'Gewicht') return true
      if (isWellnessMarker(m)) return dailyLogs.some(row => row[WELLNESS_MARKER_FIELD[m]] != null)
      return bloodwork.some(e => e.marker === m)
    })
    setActiveMarkers(valid.length > 0 ? valid : ['Gewicht'])
    setSelectedPreset(presetKey)
  }

  const toggleMarker = (marker: string) => {
    setSelectedPreset('')
    setActiveMarkers(prev =>
      prev.includes(marker)
        ? prev.length > 1 ? prev.filter(m => m !== marker) : prev
        : prev.length < 5 ? [...prev, marker] : prev,
    )
  }

  const selectCycle = (cycle: Cycle) => {
    setSelectorMode('custom')
    setSelectedCycleId(cycle.id)
    setRange({ from: cycle.start_date, to: cycleEnd(cycle) })
  }

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: copy.title, text: copy.subtitle, url: SHARE_URL })
      } else {
        await navigator.clipboard.writeText(SHARE_URL)
      }
      toast.success(copy.copied)
    } catch (error) {
      if ((error as Error).name !== 'AbortError') toast.error(copy.exportError)
    }
  }

  const openPdfModal = () => {
    if (!isValidRange(range)) return
    setPdfModalOpen(true)
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="lg-large-title">{copy.title}</h1>
          <p className="mt-0.5 text-[15px] text-[var(--lg-text-2)]">{copy.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" data-quiet className="lg-gray-btn shrink-0 !min-h-12 !px-3.5 whitespace-nowrap max-[379px]:!text-[14px]" onClick={handleShare}>
            <Link2 size={16} /> {copy.share}
          </button>
          <button type="button" className="lg-btn lg-btn-primary min-w-0 flex-1 sm:flex-none !px-4 max-[379px]:!px-3 max-[379px]:!text-[15px]" onClick={openPdfModal} disabled={loadingBase}>
            <Download size={16} /> {copy.generatePdf}
          </button>
        </div>
      </header>

      <ResearchDisclaimer
        compact
        title={t('safety_banner_title')}
        body={t('protokoll_research_export_hint')}
        accent="#00ccf5"
      />

      {/* ── KPI Strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
        <KpiCard label="Adherence" color="var(--lg-good-text)"
          value={kpiValues.adherencePct != null ? `${kpiValues.adherencePct}%` : '—'}
          sub={kpiValues.adherencePct != null && kpiValues.adherencePct >= 80 ? '↑ gut' : undefined} />
        <KpiCard label="Gewicht Δ" color="var(--lg-accent-text)"
          value={kpiValues.weightDelta != null ? `${kpiValues.weightDelta > 0 ? '+' : ''}${formatNumber(kpiValues.weightDelta, language, 1)} kg` : '—'} />
        <KpiCard label="IGF-1 Δ" color="#bf5af2"
          value={kpiValues.igf1Delta != null ? `${kpiValues.igf1Delta > 0 ? '+' : ''}${kpiValues.igf1Delta}%` : '—'} />
        <KpiCard label="CRP Δ" color={kpiValues.crpDelta != null && kpiValues.crpDelta < 0 ? 'var(--lg-good-text)' : 'var(--lg-bad-text)'}
          value={kpiValues.crpDelta != null ? `${kpiValues.crpDelta > 0 ? '+' : ''}${kpiValues.crpDelta}%` : '—'} />
      </div>

      <section className="lg-surface lg-flat p-4">
        <div className="grid grid-cols-2 rounded-full bg-[var(--lg-fill)] p-0.5 mb-4">
          <button
            type="button"
            aria-pressed={selectorMode === 'current'}
            className={`min-h-9 rounded-full px-2 text-[13px] leading-tight font-semibold transition-colors ${selectorMode === 'current' ? 'bg-[var(--lg-fill-selected)] text-[var(--lg-text)] shadow-[0_3px_8px_rgba(0,0,0,0.25)]' : 'text-[var(--lg-text-2)]'}`}
            onClick={() => {
              setSelectorMode('current')
              setRange(currentCycleRange)
              setSelectedCycleId(null)
            }}
          >
            {copy.currentCycle}
          </button>
          <button
            type="button"
            aria-pressed={selectorMode === 'custom'}
            className={`min-h-9 rounded-full px-2 text-[13px] leading-tight font-semibold transition-colors ${selectorMode === 'custom' ? 'bg-[var(--lg-fill-selected)] text-[var(--lg-text)] shadow-[0_3px_8px_rgba(0,0,0,0.25)]' : 'text-[var(--lg-text-2)]'}`}
            onClick={() => setSelectorMode('custom')}
          >
            {copy.customRange}
          </button>
        </div>

        {selectorMode === 'custom' ? (
          // Unter 360 px untereinander, sonst schneidet das Feld die Jahreszahl ab
          <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
            <div>
              <label className="label">{copy.from}</label>
              <input
                className="input"
                type="date"
                value={range.from}
                onChange={event => setRange(current => ({ ...current, from: event.target.value }))}
              />
            </div>
            <div>
              <label className="label">{copy.to}</label>
              <input
                className="input"
                type="date"
                value={range.to}
                onChange={event => setRange(current => ({ ...current, to: event.target.value }))}
              />
            </div>
          </div>
        ) : (
          <div className="rounded-[16px] bg-[var(--lg-surface-2)] p-3">
            <p className="mb-2 text-[13px] font-semibold uppercase tracking-[0.04em] text-[var(--lg-text-3)]">{copy.activeCycles}</p>
            {activeCycles.length > 0 ? (
              <div className="space-y-2">
                {activeCycles.map(cycle => (
                  <div key={cycle.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-[var(--lg-text)] font-semibold">{cycle.stack_items?.display_name ?? cycle.name}</span>
                    <span className="text-[var(--lg-text-2)] text-[13px]">
                      {formatDate(cycle.start_date, language)} - {formatDate(cycleEnd(cycle), language)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--lg-text-2)]">{copy.noActiveCycle}</p>
            )}
          </div>
        )}

        <div className="mt-4 flex items-center gap-2 text-sm text-[var(--lg-text-2)]">
          <CalendarDays size={15} className="text-[var(--lg-accent-text)]" />
          <span>
            {copy.period}: <span className="text-[var(--lg-text)] font-semibold">{formatDate(range.from, language)} - {formatDate(range.to, language)}</span>
          </span>
        </div>
      </section>

      {(loadingBase || loadingCharts) && (
        <div className="lg-surface lg-flat text-center py-6 text-[var(--lg-text-2)]">
          {copy.loading}
        </div>
      )}

      <div className="space-y-4">

        {/* ── Schnell-Ansichten ── */}
        <div>
          <p className="lg-group-title !mx-1">Schnell-Ansichten</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
            {PRESETS.map(p => (
              <button key={p.key} type="button" aria-pressed={selectedPreset === p.key} onClick={() => applyPreset(p.key)} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 36,
                padding: '0 14px', borderRadius: 999, fontSize: 14, fontWeight: 500,
                cursor: 'pointer', whiteSpace: 'nowrap', border: 'none',
                background: selectedPreset === p.key ? 'color-mix(in srgb, var(--accent) 18%, transparent)' : 'var(--lg-fill)',
                color: selectedPreset === p.key ? 'var(--lg-accent-text)' : 'var(--lg-text-2)',
                transition: 'background-color 0.18s, color 0.18s',
              }}><p.icon size={14} />{p.label}</button>
            ))}
          </div>
        </div>

        {/* ── Marker-Toggles ── */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
          {availableMarkers.map(marker => {
            const on = activeMarkers.includes(marker)
            const color = getSeriesColor(marker)
            return (
              <button key={marker} type="button" aria-pressed={on} onClick={() => toggleMarker(marker)} style={{
                display: 'flex', alignItems: 'center', gap: 7, minHeight: 36, padding: '0 13px', borderRadius: 999,
                fontSize: 14, fontWeight: 500, cursor: 'pointer', border: 'none',
                background: on ? 'var(--lg-fill-selected)' : 'var(--lg-fill)',
                color: on ? 'var(--lg-text)' : 'var(--lg-text-2)', transition: 'background-color 0.18s, color 0.18s',
              }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, opacity: on ? 1 : 0.35, flexShrink: 0 }} />
                {marker}
              </button>
            )
          })}
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-[0.04em] text-[var(--lg-text-3)]">{copy.period}</p>
            <p className="lg-title2">{formatDate(range.from, language)} - {formatDate(range.to, language)}</p>
          </div>
          <span className="lg-icon-tile" style={{ background: '#0a84ff' }} aria-hidden="true">
            <FileText size={17} />
          </span>
        </div>

        {/* ── Chart 1: % Veränderung ── */}
        <section className="lg-surface lg-flat" style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <p className="lg-title2" style={{ fontSize: 17 }}>Verlauf — % Veränderung</p>
              <p style={{ fontSize: 13, color: 'var(--lg-text-2)', marginTop: 2 }}>Normalisiert ab Start · Zyklusphasen im Hintergrund</p>
            </div>
            <span className="lg-tag shrink-0" data-tone="accent">% Δ ab Start</span>
          </div>
          {percentSeries.length > 0 ? (
            <>
              <StocksChart
                points={percentSeries[0].points}
                seriesName={percentSeries[0].marker}
                others={percentChart.others}
                start={chartWindow.start}
                end={chartWindow.end}
                accent={percentSeries[0].color}
                height={300}
                seriesKey={percentSeries.map(series => series.marker).join('|')}
                formatTick={percentChart.formatTick}
                formatValue={percentChart.formatValue}
                scrubLabel={percentChart.scrubLabel}
                ariaLabel="Verlauf — % Veränderung"
                axisWidth={50}
                dots
                percentCap={false}
                minSpan={10}
                yInclude={percentChart.yInclude}
                snapTimes={percentChart.snapTimes}
                intakeStrip={false}
                xBands={percentChart.xBands}
                xLines={percentChart.xLines}
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', marginTop: 8, fontSize: 13, fontWeight: 500, color: 'var(--lg-text-2)' }}>
                {percentSeries.map(series => (
                  <span key={series.marker} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span aria-hidden="true" style={{ width: 10, height: 3, borderRadius: 2, background: series.color }} />
                    {series.marker}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <EmptyChart label={copy.emptyChart} />
          )}
        </section>

        {/* ── Chart 2: Small Multiples ── */}
        {smallMultiplesData.length > 0 && (
          <section className="lg-surface lg-flat" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <p className="lg-title2" style={{ fontSize: 17 }}>Detailansicht — echte Einheiten</p>
                <p style={{ fontSize: 13, color: 'var(--lg-text-2)', marginTop: 2 }}>Absolute Werte · Farbband = Normalbereich</p>
              </div>
            </div>
            <SmallMultiples series={smallMultiplesData} start={chartWindow.start} end={chartWindow.end} language={language} />
          </section>
        )}

        {/* ── Persönliche Insights ── */}
        {(sideEffectStats.length > 0 || substanceEffectStats.length > 0 || substanceReviewStats.length > 0) && (
          <section className="lg-surface lg-flat" style={{ padding: 18 }}>
            <p className="lg-title2" style={{ fontSize: 17, marginBottom: 2 }}>{t('protokoll_insights_title')}</p>
            <p style={{ fontSize: 13, color: 'var(--lg-text-2)', marginBottom: 16 }}>{t('protokoll_insights_sub')}</p>

            {sideEffectStats.length > 0 ? (
              <div style={{ marginBottom: 18 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--lg-warn-text)', marginBottom: 8 }}>
                  {t('protokoll_side_effects_title')}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {sideEffectStats.map(item => (
                    <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ flex: 1, fontSize: 15, color: 'var(--lg-text)', lineHeight: 1.35 }}>{item.text}</span>
                      <span className="lg-tag" data-tone="warn">
                        ×{item.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--lg-text-3)', marginBottom: 14 }}>{t('protokoll_side_effects_empty')}</p>
            )}

            {substanceEffectStats.length > 0 && (
              <div style={{ marginBottom: substanceReviewStats.length > 0 ? 18 : 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#bf5af2', marginBottom: 8 }}>
                  {t('protokoll_effects_by_peptide')}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {substanceEffectStats.map(row => (
                    <div key={row.name}>
                      <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--lg-text)', marginBottom: 2 }}>{row.name}</p>
                      <p style={{ fontSize: 13, color: 'var(--lg-text-2)' }}>
                        {t('protokoll_effect_count', { effects: row.effects, side: row.sideEffects, severity: row.avgSeverity })}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {substanceReviewStats.length > 0 && (
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--lg-good-text)', marginBottom: 8 }}>
                  {t('protokoll_reviews_by_peptide')}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {substanceReviewStats.map(row => (
                    <div key={row.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--lg-text)' }}>{row.name}</span>
                      <span style={{ fontSize: 13, color: 'var(--lg-text-2)', textAlign: 'right' }}>
                        {t('protokoll_review_stat', { rating: row.avgRating, count: row.count })}
                        {/* Bewertungen v2: Kriterien, sobald es welche gibt. */}
                        {(row.avgWirkung !== null || row.avgVertraeglichkeit !== null || row.wiederBeantwortet > 0) && (
                          <span data-review-criteria-stat style={{ display: 'block', marginTop: 2 }}>
                            {[
                              row.avgWirkung !== null ? `${t('review_effect')} ${row.avgWirkung}/5` : null,
                              row.avgVertraeglichkeit !== null ? `${t('review_tolerability')} ${row.avgVertraeglichkeit}/5` : null,
                              row.wiederBeantwortet > 0 ? t('review_again_share', { ja: row.wiederJa, von: row.wiederBeantwortet }) : null,
                            ].filter(Boolean).join(' · ')}
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── Adherence je Substanz ── */}
        {adherencePerSubstance.length > 0 && (
          <section className="lg-surface lg-flat" style={{ padding: 18 }}>
            <p className="lg-title2" style={{ fontSize: 17, marginBottom: 2 }}>{copy.adherenceTitle}</p>
            <p style={{ fontSize: 13, color: 'var(--lg-text-2)', marginBottom: 14 }}>Anteil eingenommener Dosen im Zeitraum je Substanz</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {adherencePerSubstance.map(({ name, pct, color }) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--lg-text)', width: 96, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                  <div style={{ flex: 1, height: 6, background: 'var(--lg-fill)', borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, borderRadius: 6, background: `linear-gradient(90deg,${color},${color}aa)`, transition: 'width 0.5s cubic-bezier(.4,0,.2,1)' }} />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600, width: 40, textAlign: 'right', flexShrink: 0, color }}>{pct}%</span>
                </div>
              ))}
            </div>
          </section>
        )}

      </div>

      <section>
        <p className="lg-group-title">{copy.previousCycles}</p>
        {completedCycles.length === 0 ? (
          <div className="lg-surface lg-flat text-center px-5 py-8 text-[15px] text-[var(--lg-text-2)]">
            {copy.noPreviousCycles}
          </div>
        ) : (
          <div className="lg-group lg-rows">
            {completedCycles.map(cycle => {
              const adherence = adherenceForCycle(cycle)
              const selected = selectedCycleId === cycle.id
              return (
                <button
                  key={cycle.id}
                  type="button"
                  aria-pressed={selected}
                  className={`w-full px-4 py-3.5 text-left transition-colors active:bg-white/[0.06] ${selected ? 'bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]' : ''}`}
                  onClick={() => selectCycle(cycle)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[17px] font-semibold text-[var(--lg-text)] truncate">{cycle.stack_items?.display_name ?? cycle.name}</p>
                      <p className="text-[13px] text-[var(--lg-text-2)] mt-0.5">
                        {formatDate(cycle.start_date, language)} - {formatDate(cycleEnd(cycle), language)}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <span className="lg-tag" data-tone="accent">
                          {copy.duration}: {cycleDuration(cycle)} {copy.days}
                        </span>
                        <span className="lg-tag" data-tone="good">
                          <CheckCircle2 size={12} />
                          {copy.adherenceRate}: {adherence == null ? '-' : `${adherence}%`}
                        </span>
                        <span className="lg-tag">
                          <XCircle size={12} />
                          inactive
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-[var(--lg-text-3)] shrink-0 mt-1" />
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </section>

      {pdfModalOpen && user && (
        <ProtocolPdfModal
          userId={user.id}
          initialRange={range}
          uiLang={language}
          onClose={() => setPdfModalOpen(false)}
        />
      )}
    </div>
  )
}
