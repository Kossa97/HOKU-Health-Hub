import { useTranslation } from 'react-i18next'
import type { FoodSource } from '../lib/nutrition'

/**
 * Herkunft sichtbar machen: wer wissen will, woher eine Zahl kommt, sieht es. „Meins“ nur für
 * selbst Angelegtes; ein Produkt mit korrigierten Werten nennt seine Herkunft und „von dir
 * korrigiert“. Der Stern (Favorit) ändert an der Herkunft nichts.
 */
export function SourceBadge({ source, edited = false, long = false }: { source: FoodSource; edited?: boolean; long?: boolean }) {
  const { t } = useTranslation()
  const mine = source === 'custom'
  const own = mine || edited
  // `long`: ausgeschrieben (Kopf des Mengenblatts), sonst kurz für Listen.
  const herkunft = source === 'bls' ? (long ? t('nutr_src_bls_long') : 'BLS') : (long ? 'Open Food Facts' : 'OFF')
  const text = mine
    ? t(long ? 'nutr_src_mine_long' : 'nutr_src_mine')
    : edited ? `${herkunft} · ${t(long ? 'nutr_src_edited_long' : 'nutr_src_edited')}` : herkunft
  const title = mine ? t('nutr_src_mine_title')
    : `${source === 'bls' ? t('nutr_src_bls_title') : t('nutr_src_off_title')}${edited ? ` · ${t('nutr_src_edited_long')}` : ''}`
  return (
    <span title={title} className={`shrink-0 rounded-[5px] px-1.5 py-px text-[11px] font-semibold ${own
      ? 'bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] text-[var(--lg-accent-text)]'
      : 'bg-[var(--lg-fill)] text-[var(--lg-text-2)]'}`}>
      {text}
    </span>
  )
}
