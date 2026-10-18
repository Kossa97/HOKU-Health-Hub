import { useTranslation } from 'react-i18next'
import type { FoodSource } from '../lib/nutrition'

/** Herkunft sichtbar machen: wer wissen will, woher eine Zahl kommt, sieht es. */
export function SourceBadge({ source, own }: { source: FoodSource; own: boolean }) {
  const { t } = useTranslation()
  const text = own ? t('nutr_src_mine') : source === 'bls' ? 'BLS' : source === 'off' ? 'OFF' : t('nutr_src_mine')
  const title = own ? t('nutr_src_mine_title') : source === 'bls' ? t('nutr_src_bls_title') : t('nutr_src_off_title')
  return (
    <span title={title} className={`shrink-0 rounded-[5px] px-1.5 py-px text-[11px] font-semibold ${own
      ? 'bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] text-[var(--lg-accent-text)]'
      : 'bg-[var(--lg-fill)] text-[var(--lg-text-2)]'}`}>
      {text}
    </span>
  )
}
