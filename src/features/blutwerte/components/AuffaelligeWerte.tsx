import { CheckCircle2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { MarkerSummary } from '../lib/bloodwork'
import { CYAN, GREEN, MUTED, TEXT } from '../styles'
import { MarkerList, type MarkerLayout, type PillMode } from './MarkerList'

interface Props {
  summaries: MarkerSummary[]
  /** Gemessen, aber ohne Referenzbereich — nicht geprueft, also nie „im Bereich". */
  ungeprueft: number
  /** Gibt es ueberhaupt Messwerte? Sonst ein Einstiegshinweis statt „alles im Bereich". */
  hatWerte: boolean
  onSelect: (name: string) => void
  onAlleMarker: () => void
  layout: MarkerLayout
  pillMode: PillMode
  onTogglePill: () => void
}

/**
 * Filter „Auffällige“ unter „Marker“: die zuletzt gemessenen Werte ausserhalb
 * des Referenzbereichs, mit Leerzustaenden.
 */
export function AuffaelligeWerte({ summaries, ungeprueft, hatWerte, onSelect, onAlleMarker, layout, pillMode, onTogglePill }: Props) {
  const { t } = useTranslation()

  const ungeprueftHinweis = ungeprueft > 0 && (
    <p className="text-xs mt-2" style={{ color: MUTED }} data-bw-unchecked>{t('bw_flagged_unchecked', { count: ungeprueft })}</p>
  )

  if (summaries.length === 0) {
    // Gruen nur, wenn wirklich alles geprueft ist und im Bereich liegt.
    const allesGeprueft = hatWerte && ungeprueft === 0
    return (
      <div className="py-8 mb-4 text-center" data-bw-flagged-empty>
        {allesGeprueft && <CheckCircle2 size={22} className="mx-auto mb-2" style={{ color: GREEN }} aria-hidden="true" />}
        <p className="text-sm" style={{ color: hatWerte ? TEXT : MUTED }}>
          {t(!hatWerte ? 'bw_flagged_no_data' : allesGeprueft ? 'bw_flagged_none' : 'bw_flagged_none_checked')}
        </p>
        {hatWerte && ungeprueftHinweis}
        {hatWerte && (
          <button type="button" className="mt-3 min-h-11 px-3 text-sm font-semibold" style={{ color: CYAN }} onClick={onAlleMarker}>
            {t('bw_flagged_show_all')}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="mb-4">
      <div role="region" aria-label={t('bw_out_of_range_title', { count: summaries.length })} data-bw-flagged>
        <MarkerList summaries={summaries} layout={layout} grouped={false} pillMode={pillMode} onTogglePill={onTogglePill} onSelect={onSelect} />
      </div>
      {ungeprueftHinweis}
    </div>
  )
}
