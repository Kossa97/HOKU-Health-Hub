import { useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/** Ganze Sekunden bis zum naechsten Takt, mindestens 1. */
function restSekunden(naechsterTakt: number): number {
  return Math.max(1, Math.ceil((naechsterTakt - Date.now()) / 1000))
}

/**
 * „● Live ↻ 4“: der Spiegel aktualisiert sich selbst, das Symbol zeigt es.
 * Die Zahl zaehlt bis zum naechsten Takt herunter; im Takt dreht sich das
 * Symbol kurz (bei „Bewegung reduzieren“ nicht). Kein Knopf — es gibt nichts
 * zu tun. Ist der Zyklus unterbrochen, steht nur der Stand da.
 */
export function LiveStatus({ asOf, refreshing, naechsterTakt, interrupted = false }: {
  asOf: number
  refreshing: boolean
  naechsterTakt: number
  /** Zyklus unterbrochen: kein „Live“, nur der Stand. */
  interrupted?: boolean
}) {
  const { t, i18n } = useTranslation()
  // Dieselbe Sprache wie die Zeitachse des Graphen (useBlutspiegelFormat)
  const lang = i18n?.language ?? 'de'
  const fmt = useMemo(() => new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit' }), [lang])
  const [rest, setRest] = useState(() => restSekunden(naechsterTakt))

  useEffect(() => {
    if (interrupted) return
    setRest(restSekunden(naechsterTakt))
    const id = window.setInterval(() => setRest(restSekunden(naechsterTakt)), 250)
    return () => window.clearInterval(id)
  }, [naechsterTakt, interrupted])

  if (interrupted) {
    return (
      <div className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: 'var(--text-muted)' }} data-bs-live>
        <span className="tabular-nums">{t('pk_overview_as_of', { time: asOf ? fmt.format(asOf) : '—' })}</span>
      </div>
    )
  }

  return (
    <div
      className="flex items-center gap-1.5 text-[13px] font-semibold"
      style={{ color: '#10b981' }}
      role="status"
      aria-label={t('pk_live_auto')}
      title={t('pk_live_auto')}
      data-bs-live
    >
      <span className="relative flex h-2 w-2" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70 motion-reduce:hidden" style={{ background: '#10b981' }} />
        <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: '#10b981' }} />
      </span>
      <span aria-hidden="true">{t('pk_live_label')}</span>
      <span className="ml-1 inline-flex items-center gap-1 tabular-nums" style={{ color: 'var(--text-muted)' }} aria-hidden="true">
        <RefreshCw
          size={13}
          className={refreshing ? 'animate-[spin_700ms_cubic-bezier(0.23,1,0.32,1)] motion-reduce:animate-none' : ''}
          data-bs-refresh-icon
        />
        <span className="inline-block w-[1ch] text-center" data-bs-countdown>{rest}</span>
      </span>
    </div>
  )
}
