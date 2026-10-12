/**
 * Detailseite eines Blutwerts — aufgebaut wie eine Aktie in der Aktien-App:
 * Name, Kasten mit Wert und Referenzbereich, Verlauf (derselbe Graph
 * wie im Blutspiegel), Zeitraum, Kennzahlen, Einordnung und die Messungen.
 */
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { format, subMonths, subYears } from 'date-fns'
import { ArrowDown, ArrowUp, ChevronDown, ChevronLeft, Plus } from 'lucide-react'
import { KATEGORIE_KEY, markerErklaerung, markerName } from '../lib/markerCatalog.en'
import type { MarkerSummary } from '../lib/bloodwork'
import { chooseDisplayUnit, entryInRange, entryRange, roundConverted, toNumber } from '../lib/bloodwork'
import type { BioProfile } from '../lib/bioProfile'
import { unitChoices, type UnitSystem } from '../lib/unitConversion'
import { GUIDANCE_STAND, markerGuidance, type GuidanceItem } from '../lib/markerGuidance'
import type { BloodworkEntry, BloodworkReport } from '../types'
import { formatDisplayDate, formatNumber, formatSigned as signed } from '../lib/format'
import { CYAN, GREEN, MUTED, PANEL_STYLE, PILL_GRAY, PILL_GREEN, PILL_RED, RED, RED_WEAK, TEXT } from '../styles'
import { ReferenceBar } from './ReferenceBar'
import { TrendIcon, trendColor } from './trend'
import { AXIS_WIDTH, StocksChart } from '../../blutspiegel/chart/StocksChart'
import { timeStep, timeTicks, type LevelPoint } from '../../blutspiegel/chart/stocksChartMath'
import { ZyklusStreifen } from './ZyklusStreifen'
import type { CycleTimeline } from '../../../lib/planTimeline'
import { TAG_MS, msTag, tagMs, zyklusZeilen } from '../lib/zyklusZeilen'

export type RangeFilter = '3M' | '6M' | '1J' | '2J' | 'ALL'

const RANGES: Array<[RangeFilter, string]> = [
  ['3M', 'bw_range_3m'], ['6M', 'bw_range_6m'], ['1J', 'bw_range_1y'], ['2J', 'bw_range_2y'], ['ALL', 'bw_range_all'],
]

/** Messpunkt in der Mitte seines Tags — dort, wo der Tag auch in den Zyklus-Zeilen liegt. */
const HALBER_TAG = TAG_MS / 2
const CHART_H = 250
/** Linienfarbe ohne Referenzbereich (Hex, der Graph mischt Transparenz hinein). */
const NEUTRAL_LINE = '#22c3e6'

interface Props {
  summary: MarkerSummary
  /** Zyklen aus My Stack fuer die Zeitstreifen unter dem Verlauf. */
  zyklen?: { timelines: CycleTimeline[]; namen: ReadonlyMap<string, string> }
  /** Befunde — fuer die Herkunft einer Messung (Labor). */
  reports?: BloodworkReport[]
  onBack: () => void
  onAdd: () => void
  onEdit: (entry: BloodworkEntry) => void
  /** Einheitensystem aller Marker; markerUnit ueberschreibt es fuer diesen. */
  unitSystem?: UnitSystem
  markerUnit?: string | null
  onMarkerUnit?: (unit: string | null) => void
  /** Geschlecht/Alter für den Bereich je Messung, wenn sie keinen Laborbereich hat. */
  profil?: BioProfile | null
}

/** Monats-Ticks (1., 2., 3., 6. oder 12. Monat), so fein, wie die Breite erlaubt. */
function monthTicks(start: number, end: number, widthPx: number): { ticks: number[]; step: number } {
  if (end - start < 75 * TAG_MS) {
    const step = timeStep(start, end, widthPx)
    return { step, ticks: timeTicks(start, end, step) }
  }
  const months = (end - start) / (30.4 * TAG_MS)
  const maxTicks = Math.max(1, Math.floor(widthPx / 52))
  const every = [1, 2, 3, 6, 12, 24].find(n => months / n <= maxTicks) ?? 24
  const d = new Date(start)
  d.setDate(1); d.setHours(0, 0, 0, 0)
  if (d.getTime() < start) d.setMonth(d.getMonth() + 1)
  // Auf ein Vielfaches ausrichten, damit die Ticks beim Zeitraumwechsel nicht springen.
  while (d.getMonth() % Math.min(every, 12) !== 0) d.setMonth(d.getMonth() + 1)
  const ticks: number[] = []
  while (d.getTime() <= end) {
    ticks.push(d.getTime())
    d.setMonth(d.getMonth() + every)
  }
  return { ticks, step: every * 30 * TAG_MS }
}

export function MarkerDetail({ summary, zyklen, reports = [], onBack, onAdd, onEdit, unitSystem = 'konventionell', markerUnit = null, onMarkerUnit, profil }: Props) {
  const { t, i18n } = useTranslation()
  const sprache = i18n.resolvedLanguage ?? i18n.language
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>('1J')
  const [offen, setOffen] = useState<'niedrig' | 'hoch' | null>(null)

  const { name, latest, range, inRange, def, trend } = summary
  const unit = summary.displayUnit
  const anzeigeName = markerName(name, sprache)
  const shownValue = summary.displayValue ?? (latest ? toNumber(latest.value) : null)
  const shownUnit = summary.displayValue != null ? unit : (latest?.unit ?? '')

  const lineColor = inRange === false ? '#ef4444' : inRange === true ? '#10b981' : NEUTRAL_LINE

  // Alle umrechenbaren Messungen, alt → neu
  const allPoints: LevelPoint[] = useMemo(() => summary.points
    .filter(p => p.value != null)
    .map(p => ({ ts: tagMs(p.entry.tested_at) + HALBER_TAG, level: p.value as number }))
    .sort((a, b) => a.ts - b.ts), [summary.points])

  // Zeitfenster: endet heute (oder beim spaeteren Messdatum)
  const heute = format(new Date(), 'yyyy-MM-dd')
  const lastDay = allPoints.length ? msTag(allPoints[allPoints.length - 1].ts) : heute
  const bisTag = lastDay > heute ? lastDay : heute
  const end = tagMs(bisTag) + TAG_MS
  const start = useMemo(() => {
    const endDate = new Date(end)
    if (rangeFilter === '3M') return subMonths(endDate, 3).getTime()
    if (rangeFilter === '6M') return subMonths(endDate, 6).getTime()
    if (rangeFilter === '1J') return subYears(endDate, 1).getTime()
    if (rangeFilter === '2J') return subYears(endDate, 2).getTime()
    // Alles: ab dem ersten Wert, mit etwas Luft links
    const first = allPoints[0]?.ts ?? end - 90 * TAG_MS
    return first - Math.max(7 * TAG_MS, (end - first) * 0.04)
  }, [rangeFilter, end, allPoints])

  const fenster = { von: msTag(start), bis: bisTag }
  const streifen = zyklen
    ? zyklusZeilen(zyklen.timelines, zyklen.namen, fenster, heute, Intl.DateTimeFormat().resolvedOptions().timeZone)
    : { zeilen: [], weitere: 0 }

  const inWindow = allPoints.filter(p => p.ts >= start && p.ts <= end)
  const excludedCount = summary.points.filter(p => {
    if (p.value != null) return false
    const ts = tagMs(p.entry.tested_at) + HALBER_TAG
    return ts >= start && ts <= end
  }).length

  // Graph-Formatierung
  const monthFmt = useMemo(() => new Intl.DateTimeFormat(sprache, { month: 'short' }), [sprache])
  const dayFmt = useMemo(() => new Intl.DateTimeFormat(sprache, { day: 'numeric', month: 'short' }), [sprache])
  const formatTick = useCallback((ts: number, step: number) => {
    if (step < 28 * TAG_MS) return dayFmt.format(ts)
    const d = new Date(ts)
    return d.getMonth() === 0 || step >= 360 * TAG_MS ? String(d.getFullYear()) : monthFmt.format(ts)
  }, [dayFmt, monthFmt])
  const scrubLabel = useMemo(() => ({
    date: (ts: number) => formatDisplayDate(msTag(ts)),
    value: (v: number) => `${formatNumber(v)} ${unit}`,
  }), [unit])
  const formatValue = useCallback((v: number) => formatNumber(v), [])
  // Jede Messung hat ihren eigenen Bereich (Labor, Altersgruppe, allgemein). Weichen
  // sie voneinander ab, wechselt das Band ab der jeweiligen Messung — sonst ein Band.
  const steps = useMemo(() => {
    const roh = summary.points
      .filter(p => p.value != null)
      .map(p => {
        // Gerundet wie der Bereich im Kasten, damit Band und Text uebereinstimmen
        const r = entryRange(p.entry, def, unit, profil)
        return { from: tagMs(p.entry.tested_at) + HALBER_TAG, lo: r.min, hi: r.max }
      })
      .sort((a, b) => a.from - b.from)
    const zusammen = roh.filter((st, i) => i === 0 || st.lo !== roh[i - 1].lo || st.hi !== roh[i - 1].hi)
    return zusammen.length > 1 ? zusammen : undefined
  }, [summary.points, def, unit, profil])
  const band = useMemo(() => (range.source !== 'none' || steps
    ? { lo: range.min, hi: range.max, color: '#10b981', steps }
    : undefined), [range, steps])
  // Im Referenzbereich gruen, darueber und darunter rot — Linie, Punkte und Ablesen
  const zoneColors = useMemo(() => (range.source !== 'none' || steps
    ? { lo: range.min, hi: range.max, inside: '#10b981', outside: '#ef4444', steps, neutral: NEUTRAL_LINE }
    : undefined), [range, steps])
  // Nur der aktuelle Bereich: alte Bereiche ausserhalb des Fensters sollen die Achse nicht strecken
  const yInclude = [range.min, range.max].filter((v): v is number => v != null)
  const values = allPoints.map(p => p.level)
  // Mindesthoehe der Achse: 10 % des groessten Werts, damit Rauschen flach bleibt.
  const groesster = values.length ? Math.max(...values.map(Math.abs)) : 0
  const minSpan = groesster > 0 ? groesster * 0.1 : 1

  // Abstand zur naeheren Grenze fuer die Plakette. Richtung nach der naeheren
  // Grenze: das Urteil kommt aus ungerundeten Werten, ein gerundeter Wert kann
  // genau auf der Grenze liegen.
  const abstand = (() => {
    const v = summary.displayValue
    if (v == null || inRange !== false) return null
    const above = range.max != null && (range.min == null || Math.abs(v - range.max) <= Math.abs(v - range.min))
    if (above) return { key: 'bw_badge_above', wert: v - range.max! }
    return range.min != null ? { key: 'bw_badge_below', wert: range.min - v } : null
  })()
  const monthYear = useMemo(() => new Intl.DateTimeFormat(sprache, { month: '2-digit', year: 'numeric' }), [sprache])

  const guidance = def ? markerGuidance(def.name, sprache) : null
  const labNamen = useMemo(() => new Map(reports.map(r => [r.id, r.lab_name])), [reports])
  const standDatum = monthYear.format(new Date(`${GUIDANCE_STAND}-01T00:00:00`))

  const sectionTitle = 'text-xl font-extrabold tracking-tight'

  return (
    <div className="flex flex-col gap-6 pb-4">
      {/* Kopf */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="-ml-2 flex min-h-11 items-center gap-0.5 pr-2 text-[17px] font-medium"
          style={{ color: CYAN }}
          aria-label={t('back')}
        >
          <ChevronLeft size={24} strokeWidth={2.4} aria-hidden="true" />
          {t('bw_title')}
        </button>
        <button
          type="button"
          onClick={onAdd}
          aria-label={t('bw_add_value_aria')}
          className="flex h-11 w-11 items-center justify-center rounded-full"
          style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', color: TEXT }}
        >
          <Plus size={22} aria-hidden="true" />
        </button>
      </div>

      {/* Name und Kategorie */}
      <div className="-mt-2 flex flex-col gap-1">
        {/* Eine Zeile: Name links (laeuft durch, wenn er nicht passt), Kategorie rechts */}
        <div className="flex items-baseline gap-2">
          <LaufName text={anzeigeName} />
          <p className="shrink-0 text-[15px]" style={{ color: MUTED }} data-bw-kategorie>{t(KATEGORIE_KEY[summary.kategorie])}</p>
        </div>
        {def && <KurzErklaerung text={markerErklaerung(def, sprache)} />}
      </div>

      {/* Wert, Einheit und Referenzbereich — der Kasten wie in der ersten Fassung */}
      <div className="p-5" style={PANEL_STYLE} data-bw-hero>
        {latest && shownValue != null ? (
          <div className="flex flex-col gap-3">
            <p className="-mb-2 text-sm font-semibold" style={{ color: MUTED }} data-bw-hero-label>{t('bw_current_label')}</p>
            <div className="flex items-end justify-between gap-3">
              <p className="text-3xl font-bold tabular-nums" style={{ color: inRange === false ? RED : CYAN }} data-bw-hero-value>
                {formatNumber(shownValue)}
                <span className="ml-1.5 text-base font-semibold" style={{ color: MUTED }}>{shownUnit}</span>
              </p>
              {trend && (
                <div className="flex items-center gap-1 text-sm font-semibold tabular-nums" style={{ color: trendColor(summary) }}>
                  <TrendIcon trend={trend} />
                  {trend === 'same' ? t('bw_trend_same') : formatNumber(Math.abs(summary.diff))}
                </div>
              )}
            </div>
            {(() => {
              // Einheit nur fuer diesen Marker; „Automatisch" folgt dem Schalter in der Uebersicht.
              const katalog = def?.einheit ?? ''
              const units = [...(markerUnit ? [markerUnit] : []), ...summary.entries.map(e => e.unit)]
              const choices = onMarkerUnit ? unitChoices(def?.name ?? name, katalog, units) : []
              if (choices.length < 2 || !onMarkerUnit) return null
              // Was ohne eigene Wahl tatsaechlich gezeigt wuerde — samt Rueckfall.
              const automatisch = chooseDisplayUnit(def, name, latest.value, latest.unit, { system: unitSystem })
              return (
                <div className="flex items-center gap-2">
                  <label className="text-xs" style={{ color: MUTED }} htmlFor="bw-marker-unit">{t('bw_unit_label')}</label>
                  <select
                    id="bw-marker-unit"
                    className="select"
                    style={{ color: TEXT, width: 'auto', paddingTop: 4, paddingBottom: 4, fontSize: 13 }}
                    value={markerUnit && choices.includes(markerUnit) ? markerUnit : ''}
                    onChange={e => onMarkerUnit(e.target.value || null)}
                  >
                    <option value="">{t('bw_unit_auto', { unit: automatisch })}</option>
                    {choices.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              )
            })()}
            {range.source !== 'none' ? (
              <ReferenceBar value={shownValue} unit={shownUnit} range={range} inRange={inRange} />
            ) : (
              <p className="text-xs" style={{ color: MUTED }} data-bw-no-range>
                {range.keinStandard ? t('bw_range_no_standard_women') : t('bw_no_reference_set')}
              </p>
            )}
            <div data-bw-status>
              {inRange === true && <span className="badge" style={{ background: 'rgba(16,185,129,0.12)', color: GREEN }}>{t('bw_in_range')}</span>}
              {inRange === false && (
                <span className="badge" style={{ background: RED_WEAK, color: RED }}>
                  {abstand ? t(abstand.key, { value: `${formatNumber(roundConverted(abstand.wert))} ${shownUnit}` }) : t('bw_out_range')}
                </span>
              )}
              {inRange === null && <span className="badge" style={{ background: 'var(--border)', color: MUTED }}>{t('bw_no_reference')}</span>}
            </div>
          </div>
        ) : (
          <p style={{ color: MUTED }}>{t('bw_no_test_for', { name: anzeigeName })}</p>
        )}
      </div>

      {/* Verlauf */}
      {allPoints.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {/* Zeitraum ueber dem Graph */}
          <div
            role="group"
            aria-label={t('bw_period_aria')}
            className="mb-1.5 grid grid-cols-5 gap-1 rounded-[10px] p-[3px]"
            style={{ background: 'var(--surface-raised)' }}
          >
            {RANGES.map(([key, label]) => {
              const on = rangeFilter === key
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setRangeFilter(key)}
                  className="min-h-[34px] rounded-lg text-[13px] font-bold transition-colors"
                  style={on
                    ? { background: 'var(--surface)', color: TEXT, boxShadow: '0 1px 2px rgba(0,0,0,0.18)' }
                    : { color: MUTED }}
                >
                  {t(label)}
                </button>
              )
            })}
          </div>
          {inWindow.length > 0 ? (
            <StocksChart
              points={allPoints}
              start={start}
              end={end}
              accent={lineColor}
              height={CHART_H}
              seriesKey={`${name}|${unit}`}
              formatTick={formatTick}
              xTicks={monthTicks}
              formatValue={formatValue}
              scrubLabel={scrubLabel}
              ariaLabel={t('bw_chart_aria', { name: anzeigeName })}
              band={band}
              dots
              yInclude={yInclude}
              percentCap={false}
              minSpan={minSpan}
              intakeStrip={false}
              zoneColors={zoneColors}
            />
          ) : (
            <div className="flex items-center justify-center text-center text-sm" style={{ height: CHART_H, color: MUTED }}>
              {t('bw_no_values_period')}
            </div>
          )}
          {/* Die Zyklus-Zeilen enden vor der Werte-Achse — auf derselben Zeitachse wie der Graph. */}
          <div style={{ marginLeft: AXIS_WIDTH, marginRight: AXIS_WIDTH }}>
            <ZyklusStreifen zeilen={streifen.zeilen} weitere={streifen.weitere} />
          </div>
          {excludedCount > 0 && (
            <p className="text-xs" style={{ color: MUTED }}>
              {excludedCount === 1 ? t('bw_excluded_one') : t('bw_excluded_many', { count: excludedCount })}
            </p>
          )}
        </div>
      )}

      {/* Hinweise und Ursachen */}
      <section aria-labelledby="bw-meaning-title" className="flex flex-col gap-2.5">
        <h2 id="bw-meaning-title" className={sectionTitle} style={{ color: TEXT }}>{t('bw_assessment_title')}</h2>
        {/* Die Kurzerklaerung steht oben unter dem Namen. */}
        {!def && <p className="text-[15px] leading-relaxed" style={{ color: 'var(--text-dim, var(--text-muted))' }}>{t('bw_no_explanation')}</p>}
        {guidance && (
          <>
            <p className="text-sm leading-relaxed" style={{ color: MUTED }}>{guidance.text.hinweis}</p>
            {/* Immer zugeklappt: nie nach dem eigenen Wert ausgewaehlt. */}
            <div className="overflow-hidden rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }} data-bw-guidance>
              {([
                ['niedrig', 'bw_guidance_low', ArrowDown, guidance.text.niedrig],
                ['hoch', 'bw_guidance_high', ArrowUp, guidance.text.hoch],
              ] as const).map(([key, label, Icon, items], i) => {
                const auf = offen === key
                const panelId = `bw-guidance-${key}`
                return (
                  <div key={key} style={i > 0 ? { borderTop: '1px solid var(--border)' } : undefined}>
                    <button
                      type="button"
                      aria-expanded={auf}
                      aria-controls={panelId}
                      onClick={() => setOffen(auf ? null : key)}
                      className="flex min-h-[52px] w-full items-center gap-3 px-3.5 text-left text-base font-bold"
                      style={{ color: TEXT }}
                    >
                      <Icon size={18} strokeWidth={2.2} aria-hidden="true" style={{ color: MUTED }} />
                      <span className="flex-1">{t(label)}</span>
                      <ChevronDown
                        size={18}
                        strokeWidth={2.2}
                        aria-hidden="true"
                        className="transition-transform"
                        style={{ color: MUTED, transform: auf ? 'rotate(180deg)' : undefined }}
                      />
                    </button>
                    {auf && (
                      <div id={panelId} className="flex flex-col gap-2.5 pb-3.5 pl-11 pr-3.5 text-sm leading-relaxed" style={{ color: 'var(--text-dim, var(--text-muted))' }}>
                        {items.map((item: GuidanceItem, j: number) => (
                          <p key={j} style={item.label ? undefined : { color: TEXT }}>
                            {item.label && <><strong style={{ color: TEXT }}>{item.label}</strong><br /></>}
                            {item.text}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
        {!guidance && <p className="text-xs" style={{ color: MUTED }}>{t('bw_disclaimer')}</p>}
      </section>

      {/* Messungen */}
      <section aria-labelledby="bw-history-title" className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between">
          <h2 id="bw-history-title" className={sectionTitle} style={{ color: TEXT }}>{t('bw_measurements')}</h2>
          <span className="text-sm tabular-nums" style={{ color: MUTED }}>{summary.entries.length}</span>
        </div>
        {summary.entries.length === 0 && (
          <p className="py-4 text-sm" style={{ color: MUTED }}>{t('bw_no_entries')}</p>
        )}
        <ul>
          {summary.points.map((p, i) => {
            const e = p.entry
            const v = p.value != null ? p.value : toNumber(e.value)
            const u = p.value != null ? unit : e.unit
            // Veraenderung zum naechstaelteren umrechenbaren Wert
            const older = p.value != null ? summary.points.slice(i + 1).find(o => o.value != null) : undefined
            const diff = older && p.value != null ? p.value - (older.value as number) : null
            const status = entryInRange(e, def, unit, profil)
            const pillColor = status === false ? PILL_RED : status === true ? PILL_GREEN : PILL_GRAY
            const lab = e.report_id ? labNamen.get(e.report_id) : null
            const source = e.report_id ? [t('bw_source_report'), lab].filter(Boolean).join(' · ') : t('bw_source_manual')
            return (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => onEdit(e)}
                  data-bw-entry-edit
                  aria-label={t('bw_edit_aria', { value: `${formatNumber(e.value)} ${e.unit}`, date: formatDisplayDate(e.tested_at) })}
                  className="flex min-h-14 w-full items-center gap-3 py-3 text-left"
                  style={{ borderBottom: '1px solid var(--border)', color: TEXT }}
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-base font-bold tabular-nums">{formatDisplayDate(e.tested_at)}</span>
                    <span className="truncate text-[13px]" style={{ color: MUTED }}>{source}</span>
                  </span>
                  <span className="text-right tabular-nums">
                    <span className="block text-base font-bold">{formatNumber(v)}</span>
                    <span className="block text-xs" style={{ color: MUTED }}>{u}</span>
                  </span>
                  <span
                    className="min-w-[62px] rounded-[7px] px-2 py-[5px] text-right text-[13px] font-bold tabular-nums text-white"
                    style={{ background: pillColor }}
                  >
                    {diff != null ? signed(diff) : p.value != null ? t('bw_first_value') : '–'}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      {/* Quellen ganz unten, gebuendelt und eingeklappt */}
      {guidance && (
        <details className="text-xs leading-relaxed" style={{ color: MUTED }} data-bw-sources>
          <summary className="min-h-9 cursor-pointer py-2 font-semibold" style={{ color: CYAN }}>
            {t('bw_sources_count', { count: guidance.quellen.length })}
          </summary>
          <ul className="flex flex-col gap-1.5 pb-2">
            {guidance.quellen.map(q => (
              <li key={q.url}>
                <a href={q.url} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline" style={{ color: CYAN }}>{q.label}</a>
              </li>
            ))}
          </ul>
          <p>{t('bw_guidance_footer', { date: standDatum })}</p>
        </details>
      )}
    </div>
  )
}

/** Kurzerklaerung unter dem Namen, immer ganz ausgeschrieben. */
function KurzErklaerung({ text }: { text: string }) {
  return (
    <p className="mt-1 text-sm leading-relaxed" style={{ color: MUTED }} data-bw-intro>{text}</p>
  )
}

/**
 * Markername als Ueberschrift in einer Zeile. Passt er nicht, laeuft er
 * langsam hin und zurueck (mit Pausen an den Enden); bei „weniger Bewegung“
 * wird er stattdessen mit „…“ gekuerzt.
 */
function LaufName({ text }: { text: string }) {
  const boxRef = useRef<HTMLHeadingElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)
  const [ueber, setUeber] = useState(0)
  const ruhig = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  useLayoutEffect(() => {
    const box = boxRef.current
    const inner = textRef.current
    if (!box || !inner) return
    const messen = () => setUeber(Math.max(0, Math.ceil(inner.scrollWidth - box.clientWidth)))
    messen()
    const ro = new ResizeObserver(messen)
    ro.observe(box)
    return () => ro.disconnect()
  }, [text])

  useLayoutEffect(() => {
    const inner = textRef.current
    if (!inner || ueber <= 0 || ruhig) return
    // ~35 px/s, je 1,5 s Pause an beiden Enden
    const fahrt = (ueber / 35) * 1000
    const pause = 1500
    const dauer = 2 * (fahrt + pause)
    const a = pause / dauer
    const b = (pause + fahrt) / dauer
    const c = (2 * pause + fahrt) / dauer
    const anim = inner.animate([
      { transform: 'translateX(0)', offset: 0 },
      { transform: 'translateX(0)', offset: a, easing: 'ease-in-out' },
      { transform: `translateX(${-ueber}px)`, offset: b },
      { transform: `translateX(${-ueber}px)`, offset: c, easing: 'ease-in-out' },
      { transform: 'translateX(0)', offset: 1 },
    ], { duration: dauer, iterations: Infinity })
    return () => anim.cancel()
  }, [ueber, ruhig])

  const laeuft = ueber > 0 && !ruhig
  return (
    <h1
      ref={boxRef}
      className="min-w-0 shrink overflow-hidden whitespace-nowrap text-[2rem] font-black leading-tight tracking-tight"
      style={{
        color: TEXT,
        ...(ruhig ? { textOverflow: 'ellipsis' } : {}),
        // Weiche Kante rechts, damit der laufende Name nicht hart abgeschnitten wirkt
        ...(laeuft ? { maskImage: 'linear-gradient(to right, #000 calc(100% - 18px), transparent)', WebkitMaskImage: 'linear-gradient(to right, #000 calc(100% - 18px), transparent)' } : {}),
      }}
      title={ueber > 0 ? text : undefined}
      data-bw-name
      data-bw-name-laeuft={laeuft || undefined}
    >
      <span ref={textRef} className={ruhig ? '' : 'inline-block'}>{text}</span>
    </h1>
  )
}
