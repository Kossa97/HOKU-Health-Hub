import { useTranslation } from 'react-i18next'
import type { ExtractedValue } from '../../lib/extractResult'
import { conversionHint } from '../../lib/conversionHint'
import { CYAN, MUTED, TEXT } from '../../styles'

export interface ReviewRow extends ExtractedValue {
  /** Wird übernommen, wenn true. */
  selected: boolean
}

interface Props {
  rows: ReviewRow[]
  onChange: (index: number, row: ReviewRow) => void
}

export function ReviewTable({ rows, onChange }: Props) {
  const { t } = useTranslation()
  if (rows.length === 0) {
    return (
      <p className="text-sm text-center py-6" style={{ color: MUTED }}>{t('bw_no_values_found')}</p>
    )
  }

  return (
    <div className="space-y-3">
      {rows.map((row, index) => {
        const label = row.marker.trim() || t('bw_value')
        return (
          <div
            key={index}
            className="rounded-2xl p-4"
            style={{
              background: 'var(--lg-surface-2)',
              boxShadow: row.selected ? 'inset 0 0 0 1px var(--accent-border, rgba(0, 204, 245, 0.45))' : undefined,
              opacity: row.selected ? 1 : 0.5,
            }}
          >
            <div className="flex items-center gap-3 mb-3">
              <input
                type="checkbox"
                checked={row.selected}
                onChange={() => onChange(index, { ...row, selected: !row.selected })}
                aria-label={row.selected ? t('bw_deselect', { label }) : t('bw_select', { label })}
                className="shrink-0"
                style={{ width: 18, height: 18, accentColor: CYAN }}
              />

              <input
                className="input flex-1"
                aria-label={t('bw_marker')}
                value={row.marker}
                onChange={e => onChange(index, { ...row, marker: e.target.value })}
              />

              {!row.matched && (
                <span className="lg-tag shrink-0">{t('bw_new_marker')}</span>
              )}
            </div>

            {/* Unter 360 px zwei Spalten: vier Beschriftungen passen dort nicht nebeneinander */}
            <div className="grid grid-cols-2 gap-2 min-[360px]:grid-cols-4">
              <div>
                <label className="label">{t('bw_value')}</label>
                <input
                  className="input"
                  inputMode="decimal"
                  aria-label={t('bw_value')}
                  value={String(row.value)}
                  onChange={e => onChange(index, { ...row, value: Number(e.target.value.replace(',', '.')) })}
                />
              </div>
              <div>
                <label className="label">{t('bw_unit')}</label>
                <input
                  className="input"
                  aria-label={t('bw_unit')}
                  value={row.unit}
                  onChange={e => onChange(index, { ...row, unit: e.target.value })}
                />
              </div>
              <div>
                <label className="label">{t('bw_ref_min')}</label>
                <input
                  className="input"
                  inputMode="decimal"
                  aria-label={t('bw_ref_min')}
                  value={row.ref_min == null ? '' : String(row.ref_min)}
                  onChange={e => {
                    const raw = e.target.value.trim()
                    onChange(index, { ...row, ref_min: raw === '' ? null : Number(raw.replace(',', '.')) })
                  }}
                />
              </div>
              <div>
                <label className="label">{t('bw_ref_max')}</label>
                <input
                  className="input"
                  inputMode="decimal"
                  aria-label={t('bw_ref_max')}
                  value={row.ref_max == null ? '' : String(row.ref_max)}
                  onChange={e => {
                    const raw = e.target.value.trim()
                    onChange(index, { ...row, ref_max: raw === '' ? null : Number(raw.replace(',', '.')) })
                  }}
                />
              </div>
            </div>

            {(() => {
              const hint = conversionHint(row.marker, row.unit, row.value)
              return hint ? (
                <p className="text-xs mt-2" style={{ color: 'var(--lg-accent-text, var(--accent))' }}>
                  {hint} <span style={{ color: MUTED }}>{t('bw_conversion_note')}</span>
                </p>
              ) : null
            })()}
          </div>
        )
      })}

      <p className="text-xs leading-relaxed" style={{ color: MUTED }}>
        <span className="font-medium" style={{ color: TEXT }}>{t('bw_check_title')}</span>{' '}
        {t('bw_check_desc')}
      </p>
    </div>
  )
}
