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
            <span className="fg-done"><Check size={13} strokeWidth={3} aria-hidden />{t('fortschritt_done')}</span>
          )}
        </div>
      </div>

      {hasTodayEntry ? (
        <button type="button" onClick={onLogToday} className="fg-btn fg-btn-glass fg-glass">
          <Pencil size={18} aria-hidden />
          {t('fortschritt_edit_today')}
        </button>
      ) : (
        <button
          type="button"
          onClick={onLogToday}
          className="fg-btn fg-btn-primary"
          data-invite={dataReady}
        >
          <Plus size={20} strokeWidth={2.6} aria-hidden />
          {t('fortschritt_log_today')}
        </button>
      )}
    </header>
  )
}
