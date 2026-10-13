/**
 * Der Blutspiegel im Stil der Aktien-App — fuer Home (kompakt) und die
 * Simulationsseite (voll). Keine Karten, keine Rahmen: Substanz-Leiste,
 * grosse Zahl, Zeitraum, Graph, Kennzahlen als schlichte Tabelle.
 */
import { memo, useCallback, useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { fractionEliminatedPerHour } from '../../lib/pkModel'
import { methodLabel } from '../../lib/intakeMethods'
import type { PkRequirement } from '../my-stack/lib/pkReadiness'
import { behebbar, type EntryCurve, type MissingEntry, type ReadyEntry, type UnsupportedEntry } from './entries'
import { useBlutspiegelData } from './useBlutspiegelData'
import { UEBERSICHT_PFAD, detailPfad } from './pfade'
import { LiveStatus } from './LiveStatus'
import { formatOffset, useBlutspiegelFormat } from './format'
import { StocksChart } from './chart/StocksChart'
import {
  CHART_RANGES,
  aenderungSeit,
  rangeBounds,
  type ChartRange,
  type LevelPoint,
} from './chart/stocksChartMath'

const DAY = 24 * 3_600_000

// ── Bausteine ─────────────────────────────────────────────────────────────

const MUTED: CSSProperties = { color: 'var(--text-muted)' }
const HAIRLINE = '1px solid var(--border)'

function Sparkline({ points, accent }: { points: LevelPoint[]; accent: string }) {
  if (points.length < 2) return <span style={{ width: 48, height: 20, display: 'inline-block' }} />
  let min = Infinity
  let max = -Infinity
  for (const p of points) { min = Math.min(min, p.level); max = Math.max(max, p.level) }
  const span = Math.max(1, max - min)
  const t0 = points[0].ts
  const dt = Math.max(1, points[points.length - 1].ts - t0)
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${((p.ts - t0) / dt * 48).toFixed(1)},${(18 - (p.level - min) / span * 16).toFixed(1)}`).join('')
  return (
    <svg width={48} height={20} viewBox="0 0 48 20" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d={d} fill="none" stroke={accent} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function lastDay(points: LevelPoint[], now: number): LevelPoint[] {
  return points.filter(p => p.ts >= now - DAY)
}

const TickerStrip = memo(function TickerStrip({
  entries, curves, selectedKey, onSelect, compact, now,
}: {
  entries: ReadyEntry[]
  curves: Map<string, EntryCurve>
  selectedKey: string
  onSelect: (key: string) => void
  compact: boolean
  now: number
}) {
  const f = useBlutspiegelFormat()
  return (
    <div
      role="group"
      aria-label={f.t('pk_select_substance')}
      style={{
        display: 'flex', gap: compact ? 6 : 8, overflowX: 'auto', scrollbarWidth: 'none',
        margin: '0 -16px', padding: '0 16px 2px', WebkitOverflowScrolling: 'touch',
      }}
    >
      {entries.map(entry => {
        const curve = curves.get(entry.key)
        const selected = entry.key === selectedKey
        return (
          <button
            key={entry.key}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(entry.key)}
            style={{
              flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, minHeight: 44,
              padding: compact ? '6px 10px' : '8px 12px', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: selected ? 'var(--surface-raised)' : 'transparent',
              textAlign: 'left', fontFamily: 'inherit',
              transition: 'background 0.2s ease',
            }}
          >
            <span style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', whiteSpace: 'nowrap', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {entry.name}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums' }}>
                {curve?.current != null ? `${f.pct(curve.current)} %` : '—'}
              </span>
            </span>
            {!compact && curve && <Sparkline points={lastDay(curve.points, now)} accent={entry.accent} />}
          </button>
        )
      })}
    </div>
  )
})

function RangeControl({ value, onChange }: { value: ChartRange; onChange: (r: ChartRange) => void }) {
  const { t } = useTranslation()
  return (
    <div role="radiogroup" aria-label={t('pk_range_select')} style={{ display: 'flex', gap: 4 }}>
      {CHART_RANGES.map(range => {
        const active = range === value
        return (
          <button
            key={range}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(range)}
            style={{
              flex: '0 0 auto', minHeight: 36, minWidth: 52, padding: '0 12px', borderRadius: 999, border: 'none',
              background: active ? 'var(--surface-raised)' : 'transparent',
              color: active ? 'var(--text)' : 'var(--text-dim)',
              fontSize: 14, fontWeight: active ? 800 : 600, cursor: 'pointer', fontFamily: 'inherit',
              transition: 'background 0.2s ease, color 0.2s ease',
            }}
          >
            {t(`pk_range_${range}`)}
          </button>
        )
      })}
    </div>
  )
}

function StatTable({ rows }: { rows: Array<{ label: string; value: string }> }) {
  // Drei Spalten wie in der Aktien-App; auf schmalen Geraeten zwei.
  return (
    <dl
      className="blutspiegel-stats"
      style={{ display: 'grid', columnGap: 0, rowGap: 0, margin: 0 }}
    >
      {rows.map(row => (
        <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '7px 12px 7px 0', minWidth: 0 }}>
          <dt style={{ ...MUTED, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.label}</dt>
          <dd style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function UnsupportedRow({ entry }: { entry: UnsupportedEntry }) {
  const { t } = useTranslation()
  // Eine Zeile: Name und der kurze Grund; der ausfuehrliche steht im Tooltip.
  const lang = entry.reason === 'unit_conversion' ? t('pk_unsupported_unit')
    : entry.reason === 'route' ? t('pk_unsupported_route', { method: methodLabel(t, entry.method) })
      : t('pk_unsupported_profile')
  const kurz = entry.reason === 'unit_conversion' ? t('pk_nocurve_unit')
    : entry.reason === 'route' ? t('pk_nocurve_route', { method: methodLabel(t, entry.method) })
      : t('pk_nocurve_profile')
  return (
    <div className="flex min-h-[52px] items-baseline gap-2 py-3.5" style={{ borderTop: HAIRLINE }} title={lang} data-bs-nocurve={entry.reason}>
      <span className="shrink-0 text-[15px] font-bold" style={{ color: 'var(--text)' }}>{entry.name}</span>
      <span className="truncate text-[13px]" style={MUTED}>{kurz}</span>
    </div>
  )
}

export function NoCurveRow({ entry }: { entry: MissingEntry | UnsupportedEntry }) {
  return entry.kind === 'missing' ? <MissingRow entry={entry} /> : <UnsupportedRow entry={entry} />
}

/** Kennzahlen + Erklaerungen. Eigene, gemerkte Komponente: beim Ablesen rendert nur der Kopf neu. */
const DetailStats = memo(function DetailStats({
  entry, curve, start, end, now,
}: {
  entry: ReadyEntry
  curve: EntryCurve | undefined
  start: number
  end: number
  now: number
}) {
  const f = useBlutspiegelFormat()
  const { t } = f
  const [explainOpen, setExplainOpen] = useState(false)
  const p = entry.profile
  const points = curve?.points ?? []

  let high: number | null = null
  let low: number | null = null
  for (const pt of points) {
    if (pt.ts < start || pt.ts > end) continue
    high = high == null ? pt.level : Math.max(high, pt.level)
    low = low == null ? pt.level : Math.min(low, pt.level)
  }

  const statRows = [
    { label: t('pk_stat_high'), value: high != null ? `${f.pct(high)} %` : '—' },
    { label: t('pk_stat_low'), value: low != null ? `${f.pct(low)} %` : '—' },
    { label: t('pk_stat_last_peak'), value: formatOffset(curve?.lastPeak ? curve.lastPeak.ts - now : null, t) },
    { label: t('pk_stat_next'), value: formatOffset(entry.nextDoseAt != null ? entry.nextDoseAt - now : null, t) },
    { label: t('pk_short_half'), value: `${f.num(p.half_life_hours)} h` },
    { label: t('pk_short_tmax'), value: `${f.num(p.tmax_hours)} h` },
    { label: t('pk_short_f'), value: `${Math.round(p.bioavailability_sc * 100)} %` },
    { label: t('pk_short_vd'), value: p.vd_l_kg != null ? `${f.num(p.vd_l_kg)} L/kg` : '—' },
    { label: t('pk_short_ke'), value: `${(Math.LN2 / p.half_life_hours).toFixed(3)} /h` },
  ]

  const explanations = [
    { label: t('pk_stat_last_peak'), text: t('pk_stat_peak_sub') },
    { label: t('pk_short_half'), text: t('pk_stat_half_life_sub', { h: f.num(p.half_life_hours), h2: f.num(p.half_life_hours * 2), h5: f.num(p.half_life_hours * 5) }) },
    { label: t('pk_short_tmax'), text: t('pk_stat_tmax_sub', { h: f.num(p.tmax_hours) }) },
    { label: t('pk_short_f'), text: t('pk_stat_bioavailability_sub', { pct: Math.round(p.bioavailability_sc * 100) }) },
    { label: t('pk_short_vd'), text: `${t('pk_stat_vd_sub')} ${p.vd_l_kg != null && p.vd_l_kg > 1 ? t('pk_stat_vd_high') : t('pk_stat_vd_low')}` },
    { label: t('pk_short_ke'), text: t('pk_stat_ke_sub', { pct: f.pct(fractionEliminatedPerHour(p.half_life_hours) * 100) }) },
  ]

  return (
    <>
      <StatTable rows={statRows} />
      <div style={{ borderTop: HAIRLINE }}>
        <button
          type="button"
          aria-expanded={explainOpen}
          onClick={() => setExplainOpen(o => !o)}
          style={{
            width: '100%', minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 15, fontWeight: 700, color: 'var(--text)',
          }}
        >
          {t('pk_explain_title')}
          <ChevronDown size={18} style={{ transform: explainOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease', color: 'var(--text-muted)' }} />
        </button>
        {explainOpen && (
          <dl style={{ margin: '0 0 8px' }}>
            {explanations.map(e => (
              <div key={e.label} style={{ padding: '8px 0' }}>
                <dt style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{e.label}</dt>
                <dd style={{ margin: '2px 0 0', fontSize: 13, lineHeight: 1.55, color: 'var(--text-dim)' }}>{e.text}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </>
  )
})

function MissingRow({ entry }: { entry: MissingEntry }) {
  const { t } = useTranslation()
  const labels: Record<PkRequirement, string> = {
    complete_tracking: t('pk_requirement_complete_tracking'),
    method: t('pk_requirement_method'),
    dose: t('pk_requirement_dose'),
    unit: t('pk_requirement_unit'),
    time: t('pk_requirement_time'),
  }
  // Eine Zeile: Name und was fehlt. Die ganze Zeile fuehrt zum Ergaenzen.
  return (
    <Link
      to={`/my-stack?edit=${encodeURIComponent(entry.stackItemId)}&intent=pk`}
      aria-label={`${entry.name}: ${t('pk_complete_action')}`}
      className="-mx-3 flex min-h-[52px] items-center gap-3 rounded-xl px-3 transition-colors duration-100 active:bg-[var(--surface-raised)]"
      style={{ borderTop: HAIRLINE, color: 'var(--text)', WebkitTapHighlightColor: 'transparent' }}
      data-bs-nocurve="missing"
    >
      <span className="flex min-w-0 flex-1 items-baseline gap-2">
        <span className="shrink-0 text-[15px] font-bold">{entry.name}</span>
        <span className="truncate text-[13px]" style={MUTED}>
          {t('pk_nocurve_missing', { requirements: entry.missing.map(r => labels[r]).join(', ') })}
        </span>
      </span>
      <ChevronRight size={16} aria-hidden="true" style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
    </Link>
  )
}

/** Letzte Einnahmen, neueste zuerst — das Gegenstück zu „Messungen“ bei den Blutwerten. */
function LetzteEinnahmen({ doses }: { doses: EntryCurve['doses'] }) {
  const f = useBlutspiegelFormat()
  const liste = doses.slice(-10).reverse()
  return (
    <section aria-labelledby="bs-doses-title">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '12px 0 4px' }}>
        <h2 id="bs-doses-title" style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)' }}>{f.t('pk_recent_doses')}</h2>
        <span style={{ fontSize: 14, ...MUTED, fontVariantNumeric: 'tabular-nums' }}>{doses.length}</span>
      </div>
      <ul>
        {liste.map((d, i) => (
          <li key={`${d.ts}-${i}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '12px 0', borderBottom: HAIRLINE, fontVariantNumeric: 'tabular-nums' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{f.scrub(d.ts)}</span>
            <span style={{ fontSize: 15, color: 'var(--text)' }}>{f.num(d.dose)} <span style={MUTED}>{d.unit}</span></span>
          </li>
        ))}
      </ul>
    </section>
  )
}

// ── Ansicht ───────────────────────────────────────────────────────────────

export function BlutspiegelView({ variant, initialKey, einzeln = false }: {
  variant: 'full' | 'compact'
  initialKey?: string | null
  /** Detailseite einer Substanz: ohne Substanz-Leiste und ohne „Unvollständig“ (beides steht in der Übersicht). */
  einzeln?: boolean
}) {
  const data = useBlutspiegelData()
  const f = useBlutspiegelFormat()
  const { t } = f
  const compact = variant === 'compact'
  const [pickedKey, setPickedKey] = useState<string | null>(initialKey ?? null)
  const [range, setRange] = useState<ChartRange>('1d')
  const [scrub, setScrub] = useState<LevelPoint | null>(null)
  // Zurueckgeblaettert: Ende des sichtbaren Fensters; null folgt „jetzt".
  const [viewEnd, setViewEnd] = useState<number | null>(null)

  const gefunden = data.ready.find(e => e.key === pickedKey)
  // Detailseite: eine unbekannte Adresse zeigt nie still eine andere Substanz.
  const selected = gefunden ?? (einzeln && pickedKey ? null : data.ready[0] ?? null)
  const curve = selected ? data.curves.get(selected.key) : undefined
  // Nur, was sich beheben laesst; ein Vitamin ohne PK-Profil waere bloss
  // Rauschen. Kompakt (Home) nur fehlende Angaben.
  const missing = useMemo(
    () => data.entries.filter((e): e is MissingEntry | UnsupportedEntry => (compact ? e.kind === 'missing' : behebbar(e))),
    [data.entries, compact],
  )

  const scrubLabel = useMemo(() => ({ date: f.scrub, value: (v: number) => `${f.pct(v)} %` }), [f])
  const select = useCallback((key: string) => { setPickedKey(key); setScrub(null); setViewEnd(null) }, [])
  const changeRange = useCallback((r: ChartRange) => { setRange(r); setScrub(null); setViewEnd(null) }, [])

  // Zeitraum friert „jetzt" je Datenstand ein — sonst liefe die Achse jede Sekunde.
  const lastTs = curve?.points.length ? curve.points[curve.points.length - 1].ts : null
  const firstTs = curve?.points.length ? curve.points[0].ts : null
  const asOf = data.asOf
  const bounds = rangeBounds(compact ? '1d' : range, Math.max(asOf, lastTs ?? 0), firstTs)
  // Das Fenster laesst sich bis zum Beginn des Verlaufs zurueckwischen.
  const span = bounds.end - bounds.start
  const chartEnd = viewEnd != null ? Math.min(bounds.end, Math.max(viewEnd, (firstTs ?? bounds.start) + span)) : bounds.end
  const pan = firstTs != null && bounds.end - firstTs > span + 60_000
    ? { min: firstTs, max: bounds.end, onPan: (end: number) => setViewEnd(end >= bounds.end - 1000 ? null : end), jumpLabel: t('pk_axis_now_title') }
    : undefined

  if (data.error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p role="alert" style={{ fontSize: 14, ...MUTED }}>{t('pk_data_load_error')}</p>
        <LiveStatus asOf={asOf} refreshing={data.refreshing} naechsterTakt={data.naechsterTakt} interrupted />
      </div>
    )
  }
  if (data.loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: compact ? 160 : 280, justifyContent: 'center' }}>
        <Loader2 size={18} color="var(--accent)" className="animate-spin" />
        <span style={{ fontSize: 14, ...MUTED }}>{t('pk_live_loading')}</span>
      </div>
    )
  }

  if (!selected && einzeln && pickedKey) {
    return (
      <div style={{ padding: '24px 0', textAlign: 'center' }} data-bs-not-found>
        <p style={{ fontSize: 15, color: 'var(--text-dim)', marginBottom: 6 }}>{t('pk_not_found')}</p>
        <Link to={UEBERSICHT_PFAD} style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>{t('pk_back_overview')}</Link>
      </div>
    )
  }

  if (!selected) {
    return (
      <div>
        {missing.length > 0
          ? missing.map(entry => <NoCurveRow key={entry.key} entry={entry} />)
          : (
            <div style={{ padding: '24px 0', textAlign: 'center' }}>
              <p style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 6 }}>{t('pk_no_ready_items')}</p>
              {compact && (
                <Link to="/simulation" style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>{t('pk_open_simulation')}</Link>
              )}
            </div>
          )}
      </div>
    )
  }

  const points = curve?.points ?? []
  const effectiveRange: ChartRange = compact ? '1d' : range
  // Beginnt der Verlauf erst im Zeitraum, zaehlt sein Anfang. Endet er davor
  // (unterbrochener Zyklus), gibt es keine Veraenderung „im Zeitraum".
  // Der Kopf bleibt beim Ablesen stehen; der abgelesene Wert steht im Schild ueber dem Graph.
  const shown = curve?.current != null && points.length ? points[points.length - 1] : null
  const change = shown ? aenderungSeit(points, bounds.start) : null
  // Neutral: zwischen zwei Dosen faellt der Spiegel immer — kein Warnsignal.
  const changeColor = 'var(--text-dim)'
  const subline = t(`pk_range_label_${effectiveRange}`)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 10 : 14 }}>
      {data.ready.length > 1 && !einzeln && (
        <TickerStrip entries={data.ready} curves={data.curves} selectedKey={selected.key} onSelect={select} compact={compact} now={asOf} />
      )}

      {/* Kopf: Name, Wert, Veraenderung */}
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0, paddingBottom: compact ? 6 : 10, borderBottom: compact ? 'none' : HAIRLINE }}>
          <h2 style={{
            fontSize: compact ? 22 : 34, fontWeight: 900, letterSpacing: '-0.03em', color: 'var(--text)', lineHeight: 1.05,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0,
          }}>
            {selected.name}
          </h2>
          {selected.profile.name !== selected.name && (
            <span style={{ fontSize: compact ? 13 : 16, ...MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {selected.profile.name}
            </span>
          )}
          {compact && (
            <Link
              to={detailPfad(selected.key)}
              style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', minHeight: 44, fontSize: 14, fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}
            >
              {t('pk_more')} <ChevronRight size={16} />
            </Link>
          )}
        </div>
        <div style={{ marginTop: compact ? 0 : 10 }}>
          <p style={{ display: 'flex', alignItems: 'baseline', gap: 10, fontVariantNumeric: 'tabular-nums' }}>
            <span style={{ fontSize: compact ? 22 : 26, fontWeight: 800, color: 'var(--text)' }}>
              {shown ? `${f.pct(shown.level)} %` : '—'}
            </span>
            {change != null && (
              <span style={{ fontSize: compact ? 15 : 18, fontWeight: 700, color: changeColor }}>{f.signed(change)}</span>
            )}
          </p>
          <p style={{ fontSize: compact ? 13 : 16, color: 'var(--text-dim)', marginTop: 2 }}>{subline}</p>
          {!compact && <p style={{ fontSize: 13, ...MUTED, marginTop: 2 }}>{t('pk_model_note')}</p>}
        </div>
        <div style={{ marginTop: 6 }}>
          <LiveStatus asOf={asOf} refreshing={data.refreshing} naechsterTakt={data.naechsterTakt} interrupted={curve?.interruptedAt != null} />
        </div>
        {curve?.interruptedAt != null && (
          <p role="status" style={{ marginTop: 6, fontSize: 13, fontWeight: 700, color: '#fbbf24' }}>{t('pk_interrupted')}</p>
        )}
      </div>

      {!compact && <RangeControl value={range} onChange={changeRange} />}

      {/* Fuer Screenreader: der abgelesene Wert (sichtbar steht er im Schild im Graph). */}
      <p className="sr-only" aria-live="polite">{scrub ? `${scrubLabel.date(scrub.ts)}: ${scrubLabel.value(scrub.level)}` : ''}</p>
      {points.length ? (
        <StocksChart
          points={points}
          start={chartEnd - span}
          end={chartEnd}
          pan={pan}
          accent={selected.accent}
          height={compact ? 210 : 340}
          seriesKey={selected.key}
          intakes={curve?.intakes}
          formatTick={f.tick}
          formatValue={f.num}
          onScrub={setScrub}
          scrubLabel={scrubLabel}
          liveEnd={curve?.interruptedAt == null}
          ariaLabel={t('pk_chart_aria', {
            name: selected.name,
            value: curve?.current != null ? f.pct(curve.current) : '—',
            range: t(`pk_range_label_${effectiveRange}`),
          })}
        />
      ) : (
        <p style={{ fontSize: 14, ...MUTED, padding: '32px 0', textAlign: 'center' }}>{t('pk_confirm_hint')}</p>
      )}

      {!compact && (
        <>
          <DetailStats entry={selected} curve={curve} start={bounds.start} end={bounds.end} now={asOf} />
          {einzeln && curve && curve.doses.length > 0 && <LetzteEinnahmen doses={curve.doses} />}
          {missing.length > 0 && !einzeln && (
            <div>
              <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', padding: '12px 0 4px' }}>{t('pk_incomplete_title')}</p>
              {missing.map(entry => <NoCurveRow key={entry.key} entry={entry} />)}
            </div>
          )}
        </>
      )}

      {compact && missing.length > 0 && (
        <Link to="/simulation" style={{ fontSize: 13, ...MUTED }}>
          {t('pk_incomplete_count', { count: missing.length })}
        </Link>
      )}
    </div>
  )
}
