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
 * Im Karussell (`wechsel`) wechselt auch die Haltbarkeit im selben
 * 6-Sekunden-Takt wie „Abgelaufen!": „Haltbarkeit" / „noch n Tage", ohne
 * Angabe grau „Haltbarkeit" / „nicht angegeben". Beide Texte liegen
 * uebereinander im selben Rasterfeld — das Abzeichen ist so breit wie der
 * laengere und springt nicht, die Schrift steht mittig. Bei „weniger
 * Bewegung" steht still der zweite Text.
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

  if (variante === 'wechsel') {
    const rest = tage === null
      ? t('my_stack_shelf_life_not_set')
      : tage > 1 ? t('my_stack_shelf_life_days_left', { n: tage })
      : tage === 1 ? t('my_stack_shelf_life_day_left')
      : t('my_stack_shelf_life_today')
    const label = t('my_stack_shelf_life')
    const text = 'col-start-1 row-start-1 whitespace-nowrap'
    return (
      <span data-haltbarkeit={ton} data-tone={farbton} className="lg-tag">
        <span className="sr-only">{`${label}: ${rest}`}</span>
        <span aria-hidden="true" className="grid justify-items-center text-center">
          <span className={`${text} tyd-expired-text-alarm`}>{label}</span>
          <span className={`${text} tyd-expired-text-since tabular-nums`}>{rest}</span>
        </span>
      </span>
    )
  }

  return (
    <span data-haltbarkeit={ton} data-tone={farbton} className="lg-tag">
      {tage === null
        ? t('peptide_form_not_set', { defaultValue: 'Nicht gesetzt' })
        : expiryText(t, tage)}
    </span>
  )
}
