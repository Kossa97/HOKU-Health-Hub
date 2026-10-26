import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { markerName } from '../../lib/markerCatalog.en'
import type { MergeConflict } from '../../lib/mergeRows'
import { formatNumber } from '../../lib/format'
import { CYAN, MUTED, TEXT } from '../../styles'
import { SheetGriff } from '../../../../components/ui/SheetGriff'

interface Props {
  conflicts: MergeConflict[]
  /** Für jeden Konflikt-Key: true = neuen Wert übernehmen (ersetzen), false = vorhandenen behalten. */
  onResolve: (replaceByKey: Record<string, boolean>) => void
  onCancel: () => void
}

/** Lässt den Nutzer je doppelt erkanntem Marker zwischen vorhandenem und neuem Wert wählen. */
export function ConflictResolver({ conflicts, onResolve, onCancel }: Props) {
  const { t, i18n } = useTranslation()
  const [choices, setChoices] = useState<Record<string, boolean>>({})

  const pick = (key: string, replace: boolean) => setChoices(c => ({ ...c, [key]: replace }))

  const apply = () =>
    onResolve(Object.fromEntries(conflicts.map(c => [c.key, choices[c.key] ?? false])))

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-end justify-center px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-[var(--tyd-popup-top)]" data-app-modal data-app-back-close data-app-back-dirty-on-interaction onClick={onCancel}>
      <div
        className="lg-sheet w-full max-w-lg px-5 pb-5 pt-2 space-y-4 overflow-y-auto overscroll-contain max-h-full"
        onClick={e => e.stopPropagation()}
      >
        <SheetGriff className="!mb-1" onClose={onCancel} />
        <h2 className="lg-title2" style={{ color: TEXT }}>{t('bw_conflict_title')}</h2>
        <p className="text-sm leading-relaxed" style={{ color: MUTED }}>
          {t('bw_conflict_desc')}
        </p>

        {conflicts.map(c => {
          const replace = choices[c.key] ?? false
          return (
            <div key={c.key} className="rounded-[20px] p-4" style={{ background: 'var(--lg-surface-2)' }}>
              <p className="text-sm font-bold mb-2" style={{ color: TEXT }}>{markerName(c.incoming.marker, i18n.resolvedLanguage ?? i18n.language)}</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => pick(c.key, false)}
                  className="rounded-xl p-3 text-left transition-colors"
                  aria-pressed={!replace}
                  style={{
                    background: !replace ? 'var(--lg-fill-selected)' : 'var(--lg-fill)',
                    opacity: !replace ? 1 : 0.6,
                  }}
                >
                  <p className="text-[0.65rem] uppercase tracking-wide" style={{ color: MUTED }}>{t('bw_keep')}</p>
                  <p className="text-sm font-bold" style={{ color: TEXT }}>
                    {formatNumber(c.existing.value)} <span style={{ color: MUTED }}>{c.existing.unit}</span>
                  </p>
                </button>
                <button
                  onClick={() => pick(c.key, true)}
                  className="rounded-xl p-3 text-left transition-colors"
                  aria-pressed={replace}
                  style={{
                    background: replace ? 'var(--lg-fill-selected)' : 'var(--lg-fill)',
                    opacity: replace ? 1 : 0.6,
                  }}
                >
                  <p className="text-[0.65rem] uppercase tracking-wide" style={{ color: CYAN }}>{t('bw_replace')}</p>
                  <p className="text-sm font-bold" style={{ color: TEXT }}>
                    {formatNumber(c.incoming.value)} <span style={{ color: MUTED }}>{c.incoming.unit}</span>
                  </p>
                </button>
              </div>
            </div>
          )
        })}

        <button className="btn-primary w-full" onClick={apply}>{t('bw_apply')}</button>
      </div>
    </div>
  )
}
