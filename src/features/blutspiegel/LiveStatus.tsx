import { useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { BLUTSPIEGEL_COUNTDOWN_MS } from './useBlutspiegelData'

const ROT = '#ef4444'

/** Restzeit bis null, als „4.37“ — zwei Nachkommastellen wie im alten Karussell. */
function restAnzeige(naechsterTakt: number): string {
  return (Math.max(0, naechsterTakt - Date.now()) / 1000).toFixed(2)
}

/**
 * Die LIVE-Zeile aus dem alten Blutspiegel-Karussell (Commit c931c883):
 * roter pulsierender Punkt, „LIVE“, ein Countdown von 5.00 mit Hundertsteln;
 * ist er abgelaufen, dreht sich eine Sekunde lang das Aktualisieren-Symbol,
 * waehrend neu gerechnet wird. Alles in Rot, in Monospace. Kein Knopf.
 * Bei „Bewegung reduzieren“ pulsiert und dreht nichts. Ist der Zyklus
 * unterbrochen, steht nur der Stand da.
 */
export function LiveStatus({ asOf, refreshing, naechsterTakt, interrupted = false }: {
  asOf: number
  refreshing: boolean
  naechsterTakt: number
  /** Zyklus unterbrochen: kein „Live“, nur der Stand. */
  interrupted?: boolean
}) {
  const { t, i18n } = useTranslation()
  const lang = i18n?.language ?? 'de'
  const fmt = useMemo(() => new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit' }), [lang])
  // Die Restzeit gehoert zu einem Takt; fuer einen neuen gilt bis zur ersten
  // Messung der volle Countdown — nie die alte „0.00“.
  const [rest, setRest] = useState(() => ({ takt: naechsterTakt, text: restAnzeige(naechsterTakt) }))
  const anzeige = rest.takt === naechsterTakt ? rest.text : (BLUTSPIEGEL_COUNTDOWN_MS / 1000).toFixed(2)

  useEffect(() => {
    if (interrupted || refreshing) return
    // 50 ms wie im Original: fluessig genug fuer die Hundertstel, ohne jeden Frame.
    const id = window.setInterval(() => setRest({ takt: naechsterTakt, text: restAnzeige(naechsterTakt) }), 50)
    return () => window.clearInterval(id)
  }, [naechsterTakt, interrupted, refreshing])

  if (interrupted) {
    return (
      <div className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: 'var(--text-muted)' }} data-bs-live>
        <span className="tabular-nums">{t('pk_overview_as_of', { time: asOf ? fmt.format(asOf) : '—' })}</span>
      </div>
    )
  }

  return (
    <div
      className="flex items-center gap-1.5 font-mono text-[12px] tracking-[0.04em]"
      style={{ color: ROT }}
      role="status"
      aria-label={t('pk_live_auto')}
      title={t('pk_live_auto')}
      data-bs-live
    >
      <span className="bs-live-punkt h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: ROT }} aria-hidden="true" />
      <span className="font-bold uppercase" aria-hidden="true">{t('pk_live_label')}</span>
      <span className="inline-flex min-w-[4ch] items-center tabular-nums" aria-hidden="true">
        {refreshing
          ? <RefreshCw size={12} strokeWidth={2.5} className="bs-live-dreh" data-bs-refresh-icon />
          : <span data-bs-countdown>{anzeige}</span>}
      </span>
      <style>{`
        @keyframes bs-live-puls { 0%, 100% { opacity: 1 } 50% { opacity: .3 } }
        @keyframes bs-live-dreh { to { transform: rotate(360deg) } }
        .bs-live-punkt { animation: bs-live-puls 1.5s ease-in-out infinite }
        .bs-live-dreh { animation: bs-live-dreh .8s linear infinite }
        @media (prefers-reduced-motion: reduce) { .bs-live-punkt, .bs-live-dreh { animation: none } }
      `}</style>
    </div>
  )
}
