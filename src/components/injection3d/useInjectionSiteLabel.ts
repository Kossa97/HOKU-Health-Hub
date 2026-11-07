// src/components/injection3d/useInjectionSiteLabel.ts
import { useTranslation } from 'react-i18next'
import { formatInjectionSite } from '../../lib/injectionHistory'
import { isListInjection } from '../../lib/injectionListEntry'
import type { InjectionLog3D } from '../../lib/injectionLogTypes'

/** Stelle eines Eintrags; Listen-Eintraege aus Region und Seite, uebersetzt. */
export function useInjectionSiteLabel() {
  const { t } = useTranslation()
  return (log: InjectionLog3D) => isListInjection(log)
    ? `${String(t(`injection_region_${log.body_region}`))} ${String(t(`injection_side_${log.body_side}`))} · ${String(t('injection_list_entry', { defaultValue: 'aus der Liste' }))}`
    : formatInjectionSite(log)
}
