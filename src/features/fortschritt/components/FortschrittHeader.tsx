import { Check, Pencil, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface Props {
  rangeLabel: string
  onLogToday: () => void
  hasTodayEntry?: boolean
  /** Daten geladen — die Einladung (Atmen) erst dann, kein Flackern */
  dataReady?: boolean
}

export function FortschrittHeader({
  rangeLabel,
  onLogToday,
  hasTodayEntry = false,
  dataReady = false,
}: Props) {
  const { t } = useTranslation()

  return (
    <header className="fg-head">
      <div>
        <h1 className="fg-title">{t('fortschritt_title')}</h1>
        <div className="fg-subline">
          <span>{rangeLabel}</span>
          {hasTodayEntry && (
            <span className="fg-done"><Check size={14} strokeWidth={2} aria-hidden />{t('fortschritt_done')}</span>
          )}
        </div>
      </div>

      {hasTodayEntry ? (
        <button type="button" onClick={onLogToday} className="lg-btn lg-btn-compact lg-btn-glass lg-glass">
          <Pencil size={16} strokeWidth={1.5} aria-hidden />
          {t('fortschritt_edit_today')}
        </button>
      ) : (
        <button
          type="button"
          onClick={onLogToday}
          className="lg-btn lg-btn-compact lg-btn-tint"
          data-invite={dataReady}
        >
          <Plus size={18} strokeWidth={2} aria-hidden />
          {t('fortschritt_log_today')}
        </button>
      )}
    </header>
  )
}
