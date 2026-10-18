import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { markerName } from '../lib/markerCatalog.en'
import { ChevronLeft, ChevronRight, LayoutGrid, List } from 'lucide-react'
import type { BloodworkEntry, BloodworkReport } from '../types'
import { entryInRange, entryRange } from '../lib/bloodwork'
import type { BioProfile } from '../lib/bioProfile'
import { normalizeMarker } from '../lib/markerCatalog'
import { formatDisplayDate, formatNumber, formatRange } from '../lib/format'
import { MUTED, RED, TEXT } from '../styles'
import { BefundEditor } from './BefundEditor'

type Layout = 'liste' | 'raster'

const LAYOUT_KEY = 'blutwerte-befund-layout'

const loadLayout = (): Layout => {
  try {
    return localStorage.getItem(LAYOUT_KEY) === 'raster' ? 'raster' : 'liste'
  } catch {
    return 'liste'
  }
}

interface Props {
  reports: BloodworkReport[]
  entries: BloodworkEntry[]
  /** Geschlecht/Alter für den Bereich, wenn der Befund keinen eigenen hat. */
  profil?: BioProfile | null
  onChanged: () => void
}

/** Bereich und Urteil in der Einheit des Eintrags (Katalogbereiche werden umgerechnet). */
const bewertung = (entry: BloodworkEntry, profil?: BioProfile | null) => {
  const def = normalizeMarker(entry.marker)
  return {
    range: entryRange(entry, def, entry.unit, profil),
    auffaellig: entryInRange(entry, def, entry.unit, profil) === false,
  }
}

export function BefundListe({ reports, entries, profil, onChanged }: Props) {
  const { t, i18n } = useTranslation()
  const sprache = i18n.resolvedLanguage ?? i18n.language
  const werteLabel = (n: number) => (n === 1 ? t('bw_values_one') : t('bw_values_many', { count: n }))
  const [openId, setOpenId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [layout, setLayout] = useState<Layout>(loadLayout)

  const chooseLayout = (next: Layout) => {
    setLayout(next)
    try {
      localStorage.setItem(LAYOUT_KEY, next)
    } catch {
      /* localStorage nicht verfügbar – Wahl gilt nur für diese Sitzung */
    }
  }

  const byReport = new Map<string, BloodworkEntry[]>()
  entries.forEach(entry => {
    if (entry.report_id == null) return
    const bucket = byReport.get(entry.report_id) ?? []
    bucket.push(entry)
    byReport.set(entry.report_id, bucket)
  })

  if (reports.length === 0) {
    return (
      <div className="lg-surface px-5 py-10 text-center text-[15px]" style={{ color: 'var(--lg-text-2)' }}>
        {t('bw_reports_empty')}
      </div>
    )
  }

  if (openId) {
    const report = reports.find(r => r.id === openId)
    if (report) {
      const values = (byReport.get(report.id) ?? [])
        .slice()
        .sort((a, b) => markerName(a.marker, sprache).localeCompare(markerName(b.marker, sprache), sprache))

      return (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <button
              type="button"
              className="lg-glass lg-icon-btn lg-press shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              onClick={() => setOpenId(null)}
              aria-label={t('back')}
            >
              <ChevronLeft size={22} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="lg-title2 truncate">{formatDisplayDate(report.tested_at)}</p>
              {report.lab_name && <p className="truncate text-[13px]" style={{ color: 'var(--lg-text-2)' }}>{report.lab_name}</p>}
            </div>
            <button type="button" className="lg-btn lg-glass lg-btn-glass lg-btn-compact !px-4 shrink-0" onClick={() => setEditing(true)}>{t('bw_add_to')}</button>
          </div>

          {values.length > 1 && (
            <div className="flex justify-end mb-3">
              <div className="flex gap-0.5 p-0.5 rounded-full" style={{ background: 'var(--lg-fill)' }}>
                <button
                  onClick={() => chooseLayout('liste')}
                  aria-label={t('bw_list_view')}
                  aria-pressed={layout === 'liste'}
                  className="grid h-8 w-10 place-items-center rounded-full transition-colors"
                  style={layout === 'liste' ? { background: 'var(--lg-fill-selected)', color: TEXT } : { color: 'var(--lg-text-2)' }}
                >
                  <List size={16} />
                </button>
                <button
                  onClick={() => chooseLayout('raster')}
                  aria-label={t('bw_grid_view')}
                  aria-pressed={layout === 'raster'}
                  className="grid h-8 w-10 place-items-center rounded-full transition-colors"
                  style={layout === 'raster' ? { background: 'var(--lg-fill-selected)', color: TEXT } : { color: 'var(--lg-text-2)' }}
                >
                  <LayoutGrid size={16} />
                </button>
              </div>
            </div>
          )}

          {values.length === 0 ? (
            <div className="lg-surface">
              <p className="p-5 text-[15px] text-center" style={{ color: 'var(--lg-text-2)' }}>{t('bw_report_no_values')}</p>
            </div>
          ) : layout === 'raster' ? (
            <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
              {values.map(entry => {
                const { range, auffaellig } = bewertung(entry, profil)
                const referenz = formatRange(range.min, range.max, entry.unit)
                return (
                  <div key={entry.id} className="lg-surface !rounded-[20px] p-3.5">
                    <p className="text-[13px] font-semibold leading-tight" style={{ color: TEXT }}>{markerName(entry.marker, sprache)}</p>
                    <p className="text-[17px] font-bold mt-1.5 tabular-nums" style={{ color: auffaellig ? RED : TEXT }}>
                      {formatNumber(entry.value)}{' '}
                      <span className="text-xs font-semibold" style={{ color: MUTED }}>{entry.unit}</span>
                    </p>
                    {referenz && <p className="text-[11px] mt-1 leading-tight" style={{ color: MUTED }}>{referenz}</p>}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="lg-group lg-rows">
              {values.map(entry => {
                const { range, auffaellig } = bewertung(entry, profil)
                const referenz = formatRange(range.min, range.max, entry.unit)
                return (
                  <div
                    key={entry.id}
                    className="flex min-h-[56px] items-center justify-between gap-3 px-4 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-[16px]" style={{ color: TEXT }}>{markerName(entry.marker, sprache)}</p>
                      {referenz && <p className="text-[13px] mt-0.5" style={{ color: MUTED }}>{t('bw_reference', { range: referenz })}</p>}
                    </div>
                    <span className="shrink-0 text-[16px] font-semibold tabular-nums" style={{ color: auffaellig ? RED : TEXT }}>
                      {formatNumber(entry.value)}{' '}
                      <span className="text-xs font-semibold" style={{ color: MUTED }}>{entry.unit}</span>
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {editing && (
            <BefundEditor
              report={report}
              entries={values}
              onClose={() => setEditing(false)}
              onSaved={() => { setEditing(false); onChanged() }}
            />
          )}
        </div>
      )
    }
  }

  return (
    <div className="lg-group lg-rows">
      {reports.map(report => {
        const values = byReport.get(report.id) ?? []
        const auffaelligCount = values.filter(e => bewertung(e, profil).auffaellig).length
        return (
          <button
            key={report.id}
            type="button"
            className="w-full flex min-h-[60px] items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors active:bg-white/[0.06]"
            onClick={() => setOpenId(report.id)}
          >
            <div className="min-w-0">
              <p className="text-[16px] font-semibold" style={{ color: TEXT }}>{formatDisplayDate(report.tested_at)}</p>
              <p className="text-[13px] mt-0.5" style={{ color: 'var(--lg-text-2)' }}>
                {report.lab_name ? `${report.lab_name} · ` : ''}
                {werteLabel(values.length)}
                {auffaelligCount > 0 && <span style={{ color: RED }}> · {t('bw_out_of_range_count', { count: auffaelligCount })}</span>}
              </p>
            </div>
            <ChevronRight size={18} className="shrink-0" style={{ color: MUTED }} />
          </button>
        )
      })}
    </div>
  )
}
