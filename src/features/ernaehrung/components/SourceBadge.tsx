import { useTranslation } from 'react-i18next'
import type { FoodSource } from '../lib/nutrition'

/** Herkunft sichtbar machen: wer wissen will, woher eine Zahl kommt, sieht es. */
export function SourceBadge({ source, own }: { source: FoodSource; own: boolean }) {
  const { t } = useTranslation()
  const text = own ? t('nutr_src_mine') : source === 'bls' ? 'BLS' : source === 'off' ? 'OFF' : t('nutr_src_mine')
  const title = own ? t('nutr_src_mine_title') : source === 'bls' ? t('nutr_src_bls_title') : t('nutr_src_off_title')
  return (
    <span title={title} className="shrink-0 rounded px-1 py-px text-[0.6rem] font-extrabold uppercase tracking-wide"
      style={{ background: own ? 'var(--accent-weak)' : 'var(--border)', color: own ? 'var(--accent)' : 'var(--text-dim)' }}>
      {text}
    </span>
  )
}
