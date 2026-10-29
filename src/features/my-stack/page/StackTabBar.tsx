import { useTranslation } from 'react-i18next'
import { denyProps } from '../../../lib/denyFeedback'
import { STACK_TABS, type StackTabKey } from '../lib/stackTabs'

/**
 * Die Reiter: „Alle" und alle sechs Kategorien, feste Plaetze.
 *
 * Leere bleiben stehen und sind gedimmt — „Medikamente" ohne Inhalt sagt,
 * dass die App das auch kann; versteckt saehe das niemand. Antippen laesst
 * sie rot wackeln (denyFeedback). Die Leiste wischt waagerecht, das
 * Karussell darunter auch: deshalb ist sie flach, mit Kapseln wie in iOS,
 * und die gewaehlte hell abgesetzt (stack-glass.css).
 */
export function StackTabBar({ counts, openTab, onSelect }: {
  counts: ReadonlyMap<StackTabKey, number>
  openTab: StackTabKey
  onSelect: (key: StackTabKey) => void
}) {
  const { t } = useTranslation()
  return (
    <div
      data-stack-tabs
      role="tablist"
      aria-label={String(t('my_stack_category', { defaultValue: 'Kategorie' }))}
      className="no-scrollbar -mx-3 mb-2 flex shrink-0 snap-x scroll-px-4 gap-2 overflow-x-auto overflow-y-hidden overscroll-none touch-pan-x px-4 py-1"
    >
      {STACK_TABS.map(reiter => {
        const anzahl = counts.get(reiter.key) ?? 0
        const offen = reiter.key === openTab
        const reiterName = String(t(reiter.labelKey, { defaultValue: reiter.defaultValue }))
        return (
          <button
            key={reiter.key}
            type="button"
            role="tab"
            aria-selected={offen}
            data-stack-tab={reiter.key}
            data-stack-tab-count={anzahl}
            {...denyProps(anzahl === 0, String(t('my_stack_tab_locked', {
              defaultValue: 'Noch keine Substanz unter „{{category}}“.',
              category: reiterName,
            })))}
            onClick={() => { if (anzahl > 0) onSelect(reiter.key) }}
            className="stack-tab snap-start"
          >
            {reiterName}
            {anzahl > 0 && <span>{anzahl}</span>}
          </button>
        )
      })}
    </div>
  )
}
