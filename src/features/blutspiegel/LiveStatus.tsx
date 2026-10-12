import { useMemo } from 'react'
import { RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/**
 * „● Live · Stand 10:02“ mit Aktualisieren-Knopf. Der Punkt pulsiert (bei
 * „Bewegung reduzieren“ nicht), das Symbol dreht sich, solange geladen wird.
 */
export function LiveStatus({ asOf, refreshing, onRefresh, interrupted = false }: {
  asOf: number
  refreshing: boolean
  onRefresh: () => void
  /** Zyklus unterbrochen: kein „Live“, nur der Stand. */
  interrupted?: boolean
}) {
  const { t, i18n } = useTranslation()
  // Dieselbe Sprache wie die Zeitachse des Graphen (useBlutspiegelFormat)
  const lang = i18n?.language ?? 'de'
  const fmt = useMemo(() => new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit' }), [lang])
  const zeit = asOf ? fmt.format(asOf) : '—'
  return (
    <div className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: 'var(--text-muted)' }} data-bs-live>
      {!interrupted && (
        <span className="flex items-center gap-1.5" style={{ color: '#10b981' }}>
          <span className="relative flex h-2 w-2" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70 motion-reduce:hidden" style={{ background: '#10b981' }} />
            <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: '#10b981' }} />
          </span>
          {t('pk_live_label')}
        </span>
      )}
      <span className="tabular-nums">{t('pk_overview_as_of', { time: zeit })}</span>
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        aria-label={t('pk_refresh')}
        title={t('pk_refresh')}
        className="-my-2 flex h-9 w-9 items-center justify-center rounded-full disabled:opacity-60"
        style={{ color: 'var(--text-muted)' }}
        data-bs-refresh
      >
        <RefreshCw size={15} aria-hidden="true" className={refreshing ? 'animate-spin motion-reduce:animate-none' : ''} />
      </button>
    </div>
  )
}
