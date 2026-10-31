import { useTranslation } from 'react-i18next'
import { Pencil } from 'lucide-react'
import type { EffectiveRange } from '../lib/bloodwork'
import { abstandZurGrenze, roundConverted } from '../lib/bloodwork'
import type { BloodworkEntry } from '../types'
import { formatDisplayDate, formatNumber, formatSigned as signed } from '../lib/format'
import { MUTED, RED, TEXT } from '../styles'
import { ReferenceBar } from './ReferenceBar'

/**
 * Kleine Ansicht einer einzelnen Messung, aufgeklappt unter ihrer Zeile — wie
 * der Kasten „Aktuell", nur fuer diesen Tag. Bearbeiten erst von hier aus.
 */
export function MessungDetail({ id, entry, value, unit, diff, range, inRange, onEdit }: {
  id: string
  entry: BloodworkEntry
  value: number | null
  unit: string
  /** Veraenderung zur vorigen Messung; null bei der ersten. */
  diff: number | null
  range: EffectiveRange | null
  inRange: boolean | null
  onEdit: () => void
}) {
  const { t } = useTranslation()
  const abstand = range ? abstandZurGrenze(value, range, inRange) : null
  return (
    <div
      id={id}
      data-bw-entry-detail
      className="bw-messung-detail mx-3 mb-3 mt-1 flex flex-col gap-3 rounded-2xl p-4"
      style={{ background: 'var(--lg-surface-2)' }}
    >
      <style>{`
        /* Aufklappen: kurz einblenden und 4 px nachruecken, beim Schliessen sofort weg */
        .bw-messung-detail { transition: opacity 180ms cubic-bezier(0.22, 1, 0.36, 1), transform 180ms cubic-bezier(0.22, 1, 0.36, 1); }
        @starting-style { .bw-messung-detail { opacity: 0; transform: translateY(-4px); } }
        @media (prefers-reduced-motion: reduce) {
          @starting-style { .bw-messung-detail { transform: none; } }
        }
      `}</style>
      <div className="flex items-end justify-between gap-3">
        <p className="text-2xl font-medium tabular-nums" style={{ color: inRange === false ? RED : 'var(--lg-accent-text)' }} data-bw-entry-value>
          {formatNumber(value ?? entry.value)}
          <span className="ml-2 font-mono text-[13px] font-normal" style={{ color: MUTED }}>{unit}</span>
        </p>
        <p className="font-mono text-[13px] tabular-nums" style={{ color: MUTED }}>
          {diff != null ? t('bw_entry_change', { value: `${signed(diff)} ${unit}` }) : t('bw_first_value')}
        </p>
      </div>
      {range && range.source !== 'none' && value != null && (
        <ReferenceBar value={value} unit={unit} range={range} inRange={inRange} />
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          {inRange === true && <span className="lg-tag" data-tone="good">{t('bw_in_range')}</span>}
          {inRange === false && (
            <span className="lg-tag" data-tone="bad">
              {abstand ? t(abstand.key, { value: `${formatNumber(roundConverted(abstand.wert))} ${unit}` }) : t('bw_out_range')}
            </span>
          )}
          {inRange === null && <span className="lg-tag">{t('bw_no_reference')}</span>}
        </div>
        <button
          type="button"
          onClick={onEdit}
          aria-label={t('bw_edit_aria', { value: `${formatNumber(entry.value)} ${entry.unit}`, date: formatDisplayDate(entry.tested_at) })}
          data-bw-entry-edit
          className="lg-gray-btn !min-h-10 !px-4 !text-sm"
        >
          <Pencil size={16} strokeWidth={1.5} aria-hidden="true" />
          {t('bw_edit')}
        </button>
      </div>
      {entry.notes && <p className="text-sm leading-relaxed" style={{ color: TEXT }} data-bw-entry-notes>{entry.notes}</p>}
    </div>
  )
}

