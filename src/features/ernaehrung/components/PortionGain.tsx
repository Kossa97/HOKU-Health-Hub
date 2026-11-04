import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { NutrientStatus } from '../lib/nutrientTargets'
import type { Nutrients } from '../lib/nutrition'

/**
 * „Bringt dir heute“ im Portionsblatt: die Nährstoffe, bei denen diese Menge am meisten
 * hilft (mindestens 15 % des Ziels). „füllt …“, wenn sie eine Lücke bis ins Ziel schließt.
 */
export function PortionGain({ day, portion }: { day: readonly NutrientStatus[]; portion: Nutrients }) {
  const { t } = useTranslation()
  const items = day
    .filter(s => s.def.kind === 'min' && s.target > 0)
    .map(s => {
      const id = s.def.id
      const v = id === 'fiber' ? portion.fiber : id === 'sugar' || id === 'salt' || id === 'satFat' ? null : portion.micros?.[id]
      const add = v ? v / s.target : 0
      return { s, add, fills: s.p < 0.9 && s.p + add >= 0.9 }
    })
    .filter(x => x.add >= 0.15)
    .sort((a, b) => Number(b.fills) - Number(a.fills) || b.add - a.add)
    .slice(0, 3)
  if (!items.length) return null
  return (
    <section aria-labelledby="nutr-gain-title" className="mt-3">
      <h3 id="nutr-gain-title" className="px-1 pb-1.5 text-[13px] font-semibold text-[var(--lg-text-2)]">{t('nutr_gain_title')}</h3>
      <ul className="flex flex-wrap gap-2">
        {items.map(({ s, add, fills }) => (
          <li key={s.def.id} className={`flex min-h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold ${fills
            ? 'bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-[var(--lg-accent-text)]'
            : 'bg-[var(--lg-surface-2)] text-[var(--lg-text)]'}`}>
            {fills && <Check size={13} strokeWidth={3} aria-hidden="true" />}
            {fills
              ? t('nutr_gain_fills', { name: t(`nutr_n_${s.def.id}`) })
              : t('nutr_gain_pct', { pct: Math.round(add * 100), name: t(`nutr_n_${s.def.id}`) })}
          </li>
        ))}
      </ul>
    </section>
  )
}
