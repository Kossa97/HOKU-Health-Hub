import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { gueltigeHaltbarkeit } from '../lib/bestand'
import type { InventoryDraft } from '../types'

/**
 * Wann das Vial angemischt wurde und wie lange es danach haelt — direkt
 * unter dem Loesungsmittel im Schritt „Staerke". Dort gehoert es hin: wer
 * die Fluessigkeit eintraegt, weiss in dem Moment auch, wann er gemischt hat.
 * Vorher stand beides nur beim Bearbeiten, eingeklappt unter „Produkt"; beim
 * Anlegen fragte niemand danach, und im Vollbild blieb es „Nicht gesetzt".
 * Bei fertiger Loesung (Hormon-Vial) heisst es „Geöffnet am" — gemischt wird
 * dort nichts.
 */
export function AnmischAngaben({ inventory, onChange, loesung = false }: {
  inventory: InventoryDraft
  onChange: (changes: Partial<InventoryDraft>) => void
  /** Fertige Loesung: das Vial wird angebrochen, nicht angemischt. */
  loesung?: boolean
}) {
  const { t } = useTranslation()
  const id = useId()
  const haltbarkeitFalsch = !gueltigeHaltbarkeit(inventory.useWithinDays)
  const eingabe = 'input min-h-11 w-full text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400'
  const beschriftung = 'mb-2 block text-sm font-semibold text-slate-200'
  const optional = t('my_stack_plan_optional', { defaultValue: 'optional' })

  return (
    <div data-anmisch-angaben className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:grid-cols-2">
      <div>
        <label htmlFor={`${id}-opened`} className={beschriftung}>
          {t(loesung ? 'my_stack_stock_opened_on' : 'my_stack_stock_mixed_on')} ({optional})
        </label>
        <input
          id={`${id}-opened`}
          data-field="inventory.openedAt"
          type="date"
          value={inventory.openedAt ?? ''}
          onChange={event => onChange({ openedAt: event.target.value || null })}
          className={eingabe}
        />
      </div>
      <div>
        <label htmlFor={`${id}-within`} className={beschriftung}>
          {t(loesung ? 'my_stack_stock_use_within' : 'my_stack_stock_use_within_vial')} ({t('my_stack_stock_days_multiple', { n: '' }).trim()}, {optional})
        </label>
        <input
          id={`${id}-within`}
          data-field="inventory.useWithinDays"
          type="number"
          inputMode="numeric"
          min="1"
          max="3650"
          step="1"
          value={inventory.useWithinDays ?? ''}
          aria-invalid={haltbarkeitFalsch || undefined}
          onChange={event => {
            const wert = event.target.value === '' ? null : Number(event.target.value)
            onChange({ useWithinDays: wert != null && Number.isFinite(wert) ? wert : null })
          }}
          className={eingabe}
        />
        {haltbarkeitFalsch && <p role="alert" className="mt-1.5 text-sm text-rose-300">{t('my_stack_stock_days_invalid')}</p>}
      </div>
    </div>
  )
}
