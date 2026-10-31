import { useTranslation } from 'react-i18next'
import type { FoodSource } from '../lib/nutrition'

/** Herkunft sichtbar machen: wer wissen will, woher eine Zahl kommt, sieht es. */
export function SourceBadge({ source, own, long = false }: { source: FoodSource; own: boolean; long?: boolean }) {
  const { t } = useTranslation()
  // `long`: ausgeschrieben (Kopf des Mengenblatts), sonst kurz für Listen.
  const text = own || source === 'custom'
    ? t(long ? 'nutr_src_mine_long' : 'nutr_src_mine')
    : source === 'bls' ? (long ? t('nutr_src_bls_long') : 'BLS') : (long ? 'Open Food Facts' : 'OFF')
  const title = own ? t('nutr_src_mine_title') : source === 'bls' ? t('nutr_src_bls_title') : t('nutr_src_off_title')
  return (
    <span title={title} className={`shrink-0 rounded-[6px] px-1.5 py-px text-[11px] font-medium ${own
      ? 'bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] text-[var(--lg-accent-text)]'
      : 'bg-[var(--lg-fill)] text-[var(--lg-text-2)]'}`}>
      {text}
    </span>
  )
}
