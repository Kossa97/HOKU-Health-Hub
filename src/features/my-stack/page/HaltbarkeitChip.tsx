import { useTranslation } from 'react-i18next'
import { ExpiredBadge } from '../components/ExpiredBadge'
import { ABLAUF_BALD_TAGE } from '../lib/listRow'
import { expiryText } from './model'

/**
 * Die Haltbarkeit als Abzeichen — dasselbe im Karussell und in der Liste:
 * gruen „Haltbar noch n Tage", ab sieben Tagen gelb, heute „Läuft heute ab",
 * abgelaufen das Alarm-Abzeichen — im Karussell mit Wechsel („Abgelaufen!" /
 * „seit n Tagen", `variante="wechsel"`), sonst ausgeschrieben. Ohne Angabe
 * „Nicht gesetzt".
 *
 * `tage` kommt aus `haltbarkeitFuer` (Kalendertage, negativ = abgelaufen).
 * `substanzId` laesst den Alarm-Takt je Substanz neu beginnen.
 * Die Farben stehen bei `.lg-tag` in liquid-glass.css.
 */
export function HaltbarkeitChip({ tage, substanzId, variante = 'still' }: {
  tage: number | null
  substanzId: string
  variante?: 'still' | 'wechsel'
}) {
  const { t } = useTranslation()
  if (tage !== null && tage < 0) return <ExpiredBadge key={substanzId} daysSince={-tage} variante={variante} />

  const ton = tage === null ? 'leer' : tage > ABLAUF_BALD_TAGE ? 'gut' : 'bald'
  const farbton = { leer: undefined, gut: 'good', bald: 'warn' }[ton]
  return (
    <span data-haltbarkeit={ton} data-tone={farbton} className="lg-tag">
      {tage === null
        ? t('peptide_form_not_set', { defaultValue: 'Nicht gesetzt' })
        : expiryText(t, tage)}
    </span>
  )
}
