/**
 * Marker-Uebersicht nach dem Vorbild der Aktien-App, wahlweise als Raster
 * (Karten, zwei nebeneinander) oder als Liste (eine Zeile je Marker). Beide
 * zeigen Name und Datum, den Verlauf als Mini-Kurve mit den Grenzen des
 * Referenzbereichs gestrichelt, den neuesten Wert und eine farbige Plakette.
 *
 * Farbe heisst hier Befund, nicht Richtung: gruen im Bereich, rot ausserhalb,
 * grau ohne Referenz. Ein Anstieg ist nicht von sich aus gut oder schlecht.
 * Die Plakette zeigt die Veraenderung zur vorigen Messung oder — nach Tippen,
 * fuer alle Marker — den Referenzbereich.
 */
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'
import { KATEGORIE_KEY, markerName } from '../lib/markerCatalog.en'
import type { KategorieFilter } from '../lib/markerCatalog'
import type { MarkerSummary } from '../lib/bloodwork'
import { formatDisplayDate, formatNumber, formatRange, formatSigned } from '../lib/format'
import { changeSincePrevious, markerStatus, sparklineGeometry, type MarkerStatus } from '../lib/sparkline'
import { MUTED, PILL_GRAY, PILL_GREEN, PILL_RED, TEXT } from '../styles'

export type PillMode = 'change' | 'range'
export type MarkerLayout = 'raster' | 'liste'

const STATUS_COLOR: Record<MarkerStatus, string> = {
  in: PILL_GREEN,
  out: PILL_RED,
  unchecked: PILL_GRAY,
  none: PILL_GRAY,
}

const SPARK_W = 140
const SPARK_H = 44
const ROW_SPARK_W = 56
const ROW_SPARK_H = 36

/** Mini-Kurve ueber die volle Kartenbreite; Linien bleiben beim Strecken gleich duenn. */
function CardSparkline({ summary, color }: { summary: MarkerSummary; color: string }) {
  const g = sparklineGeometry(summary, SPARK_W, SPARK_H)
  return (
    <div style={{ position: 'relative' }}>
    <svg width="100%" height={SPARK_H} viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} preserveAspectRatio="none" aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
      {g.bounds.map((y, i) => (
        <line key={i} x1={0} x2={SPARK_W} y1={y} y2={y} stroke={color} strokeOpacity={0.75} strokeWidth={1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
      ))}
      {g.area && <path d={g.area} fill={color} fillOpacity={0.16} />}
      {g.line && <path d={g.line} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
    </svg>
    {/* Letzter Wert als Punkt — ausserhalb des gestreckten SVG, damit er rund bleibt.
        Bei nur einer Messung ist er das Einzige, was den Wert zeigt. */}
    {g.last && (
      <span
        aria-hidden="true"
        style={{
          position: 'absolute', width: 6, height: 6, borderRadius: '50%', background: color,
          left: `calc(${(g.last.x / SPARK_W) * 100}% - 3px)`, top: g.last.y - 3,
        }}
      />
    )}
    </div>
  )
}

/** Kleine Mini-Kurve fuer die Listenzeile, feste Groesse. */
function RowSparkline({ summary, color }: { summary: MarkerSummary; color: string }) {
  const gradId = useId()
  const g = sparklineGeometry(summary, ROW_SPARK_W, ROW_SPARK_H)
  return (
    <svg width={ROW_SPARK_W} height={ROW_SPARK_H} viewBox={`0 0 ${ROW_SPARK_W} ${ROW_SPARK_H}`} aria-hidden="true" style={{ flexShrink: 0, overflow: 'visible' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {g.bounds.map((y, i) => (
        <line key={i} x1={0} x2={ROW_SPARK_W} y1={y} y2={y} stroke={color} strokeOpacity={0.75} strokeWidth={1} strokeDasharray="3 3" />
      ))}
      {g.area && <path d={g.area} fill={`url(#${gradId})`} />}
      {g.line && <path d={g.line} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />}
      {g.last && <circle cx={g.last.x} cy={g.last.y} r={2.5} fill={color} />}
    </svg>
  )
}


interface CardProps {
  summary: MarkerSummary
  pillMode: PillMode
  onSelect: (name: string) => void
  onTogglePill: () => void
}

/** Was Karte und Zeile gleich zeigen: Wert, Farbe, Plakette, Vorleselabel. */
function useMarkerView(summary: MarkerSummary, pillMode: PillMode) {
  const { t, i18n } = useTranslation()
  const sprache = i18n.resolvedLanguage ?? i18n.language
  const status = markerStatus(summary)
  const color = STATUS_COLOR[status]
  const latest = summary.latest
  const name = markerName(summary.name, sprache)
  const shownValue = summary.displayValue ?? latest?.value
  const shownUnit = summary.displayValue != null ? summary.displayUnit : latest?.unit ?? summary.displayUnit
  const change = changeSincePrevious(summary)
  const referenz = formatRange(summary.range.min, summary.range.max, '')
  // „Erstwert" nur, wenn es wirklich der erste ist; sonst sind die frueheren
  // Werte nicht in diese Einheit umrechenbar — dann kein Vergleich.
  const changeText = change != null ? formatSigned(change) : summary.entries.length > 1 ? '—' : t('bw_pill_first')
  const rangeText = referenz ?? t('bw_pill_no_range')
  const pillText = pillMode === 'change' ? changeText : rangeText
  const statusText = t(`bw_status_${status}`)

  const ariaLabel = latest
    ? t('bw_row_aria', { name, value: `${formatNumber(shownValue!)} ${shownUnit ?? ''}`.trim(), status: statusText, date: formatDisplayDate(latest.tested_at) })
    : `${name}, ${t('bw_no_test').replace(/^[–-]\s*/, '')}`

  const pillAria = t(pillMode === 'change' ? 'bw_pill_aria_change' : 'bw_pill_aria_range', { value: pillText, status: statusText })
  return { t, status, color, latest, name, shownValue, shownUnit, pillText, pillTexts: [changeText, rangeText], pillAria, ariaLabel }
}

function MarkerCard({ summary, pillMode, onSelect, onTogglePill }: CardProps) {
  const { t, status, color, latest, name, shownValue, shownUnit, pillTexts, pillAria, ariaLabel } = useMarkerView(summary, pillMode)
  // Schriftgroesse nach dem laengeren der beiden Texte — in beiden Modi gleich.
  const longest = Math.max(...pillTexts.map(text => text.length))

  // Die ganze Karte oeffnet den Marker (unsichtbare Flaeche darunter); die
  // Plakette liegt darueber und hat ihre eigene Aufgabe. So bleibt der Inhalt
  // ein normales Layout — Wert und Plakette stehen nebeneinander, statt sich
  // bei langen Werten zu ueberlappen.
  return (
    <div className="bw-marker-card lg-surface lg-flat" style={{ opacity: latest ? 1 : 0.55 }}>
      <button
        type="button"
        onClick={() => onSelect(summary.name)}
        aria-label={ariaLabel}
        style={{ position: 'absolute', inset: 0, background: 'none', border: 'none', borderRadius: 'inherit', cursor: 'pointer', padding: 0 }}
      />
      <div
        style={{
          position: 'relative', minHeight: 180, boxSizing: 'border-box', padding: '14px 12px 12px 14px', pointerEvents: 'none',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 6,
        }}
      >
        {/* Name, Datum und Wert stehen schon im Label der Karte. */}
        <div aria-hidden="true" style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: TEXT, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {name}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {latest ? formatDisplayDate(latest.tested_at) : t('bw_no_test')}
          </p>
        </div>
        {latest && <CardSparkline summary={summary} color={color} />}
        {latest && (
          // Reicht der Platz nicht, rutscht die Plakette unter den Wert — nichts wird
          // gekuerzt. Damit die Karte beim Umschalten gleich gross bleibt, ist die
          // Plakette immer so breit wie der laengere ihrer beiden Texte.
          <div className="bw-card-bottom">
            <div aria-hidden="true" style={{ flexShrink: 0, maxWidth: '100%', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
              <p style={{ margin: 0, fontSize: 20, fontWeight: 800, lineHeight: 1.1, color: TEXT }}>{formatNumber(shownValue!)}</p>
              <p style={{ margin: 0, fontSize: 11, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis' }}>{shownUnit}</p>
            </div>
            <button
              type="button"
              onClick={onTogglePill}
              aria-label={pillAria}
              data-bw-status={status}
              style={{
                pointerEvents: 'auto', flexShrink: 0, minWidth: 56, marginLeft: 'auto', minHeight: 32,
                padding: longest > 7 ? '0 6px' : '0 8px',
                borderRadius: 7, border: 'none', background: color, color: '#fff', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: longest > 9 ? 11 : longest > 7 ? 12 : 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', textAlign: 'right', whiteSpace: 'nowrap',
              }}
            >
              {/* Beide Texte in derselben Zelle; der nicht gezeigte haelt nur die Breite. */}
              <span style={{ display: 'grid', justifyItems: 'end' }}>
                {pillTexts.map((text, i) => (
                  <span key={i} style={{ gridArea: '1 / 1', visibility: i === (pillMode === 'change' ? 0 : 1) ? 'visible' : 'hidden' }}>
                    {text}
                  </span>
                ))}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function MarkerRow({ summary, pillMode, onSelect, onTogglePill }: CardProps) {
  const { t, status, color, latest, name, shownValue, shownUnit, pillText, pillAria, ariaLabel } = useMarkerView(summary, pillMode)
  return (
    <div style={{ display: 'flex', alignItems: 'center', paddingInline: '16px 12px' }}>
      <button
        type="button"
        onClick={() => onSelect(summary.name)}
        aria-label={ariaLabel}
        style={{
          flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0',
          background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
        }}
      >
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 17, fontWeight: 800, color: TEXT, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {name}
          </span>
          <span style={{ display: 'block', marginTop: 2, fontSize: 14, color: MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {latest ? formatDisplayDate(latest.tested_at) : t('bw_no_test')}
          </span>
        </span>
        {latest && <RowSparkline summary={summary} color={color} />}
        {latest && (
          <span style={{ flexShrink: 0, minWidth: 44, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
            <span style={{ display: 'block', fontSize: 18, fontWeight: 700, color: TEXT, whiteSpace: 'nowrap' }}>
              {formatNumber(shownValue!)}
            </span>
            <span style={{ display: 'block', fontSize: 12, color: MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {shownUnit}
            </span>
          </span>
        )}
      </button>
      {latest && (
        <button
          type="button"
          onClick={onTogglePill}
          aria-label={pillAria}
          data-bw-status={status}
          style={{
            marginLeft: 8, flexShrink: 0, minWidth: 66, minHeight: 32, padding: '0 8px', borderRadius: 7, border: 'none',
            background: color, color: '#fff', cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums', textAlign: 'right', whiteSpace: 'nowrap',
          }}
        >
          {pillText}
        </button>
      )}
    </div>
  )
}

interface Props {
  summaries: MarkerSummary[]
  layout: MarkerLayout
  /** Nur in der Liste: Ueberschrift je Kategorie. */
  grouped: boolean
  pillMode: PillMode
  onTogglePill: () => void
  onSelect: (name: string) => void
}

const GRID = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 } as const

/**
 * Raster: immer zwei Karten nebeneinander, gleich gross, ohne Kategorie-
 * Ueberschriften — sie liessen nach jeder ungeraden Kategorie eine halbe Reihe
 * leer; nach Kategorie filtern die Tabs darueber. Liste: eine Zeile je Marker,
 * auf Wunsch nach Kategorie gruppiert.
 */
export function MarkerList({ summaries, layout, grouped, pillMode, onTogglePill, onSelect }: Props) {
  const { t } = useTranslation()
  const [showUntested, setShowUntested] = useState(false)
  const tested = summaries.filter(s => s.latest)
  const untested = summaries.filter(s => !s.latest)

  if (summaries.length === 0) {
    return <p style={{ padding: '32px 0', textAlign: 'center', fontSize: 14, color: MUTED }}>{t('bw_no_markers')}</p>
  }

  const raster = layout === 'raster'
  const Item = raster ? MarkerCard : MarkerRow
  const item = (s: MarkerSummary) => (
    <Item key={s.name} summary={s} pillMode={pillMode} onSelect={onSelect} onTogglePill={onTogglePill} />
  )
  const block = (items: MarkerSummary[]) => (raster
    ? <div style={GRID}>{items.map(item)}</div>
    : <div className="lg-group lg-rows">{items.map(item)}</div>)

  const groups: Array<{ kategorie: string; items: MarkerSummary[] }> = []
  if (grouped && !raster) {
    for (const s of tested) {
      const current = groups[groups.length - 1]
      if (current && current.kategorie === s.kategorie) current.items.push(s)
      else groups.push({ kategorie: s.kategorie, items: [s] })
    }
  }

  return (
    <div>
      {groups.length > 0
        ? groups.map(group => (
          <section key={group.kategorie} aria-label={t(KATEGORIE_KEY[group.kategorie as KategorieFilter] ?? group.kategorie)} className="mt-6 first:mt-1">
            <h3 className="lg-group-title">
              {t(KATEGORIE_KEY[group.kategorie as KategorieFilter] ?? group.kategorie)}
            </h3>
            {block(group.items)}
          </section>
        ))
        : tested.length > 0 && block(tested)}

      {untested.length > 0 && (
        <div style={{ marginTop: tested.length ? 12 : 0 }}>
          <button
            type="button"
            aria-expanded={showUntested}
            onClick={() => setShowUntested(v => !v)}
            style={{
              width: '100%', minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'none', border: 'none', padding: '0 4px',
              cursor: 'pointer', fontFamily: 'inherit', fontSize: 15, fontWeight: 600, color: MUTED,
            }}
          >
            {t('bw_untested_count', { count: untested.length })}
            <ChevronDown size={18} style={{ transform: showUntested ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
          </button>
          {showUntested && block(untested)}
        </div>
      )}
    </div>
  )
}
