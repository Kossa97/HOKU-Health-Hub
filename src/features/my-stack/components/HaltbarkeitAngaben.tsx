import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { aufbrauchenBis, gueltigeHaltbarkeit, haltbarkeitArt } from '../lib/bestand'
import { formatLocalDay } from '../lib/localDays'
import type { DosageFormKey, InventoryDraft, StackCategory } from '../types'

/**
 * Haltbarkeit in der Zusammensetzung: wann geoeffnet und wie lange danach
 * haltbar — mit dem Wort, das zur Form passt (`haltbarkeitArt`) —, dazu das
 * Ablaufdatum der Packung. Wo nur das Ablaufdatum zaehlt (Ampulle, Kapsel,
 * Tablette, Pflaster), steht nur das. Frueher fragte das Anlegen nur beim
 * Pulver-Vial danach, und im Vollbild blieb es „Nicht gesetzt".
 */
export function HaltbarkeitAngaben({ dosageForm, category, inventory, onChange }: {
  dosageForm: DosageFormKey
  category: StackCategory | null
  inventory: InventoryDraft
  onChange: (changes: Partial<InventoryDraft>) => void
}) {
  const { t, i18n } = useTranslation()
  const id = useId()
  const art = haltbarkeitArt(dosageForm, category)
  const haltbarkeitFalsch = !gueltigeHaltbarkeit(inventory.useWithinDays)
  const bis = art ? aufbrauchenBis(inventory.openedAt, inventory.useWithinDays, inventory.expiresAt) : null
  const eingabe = 'input min-h-11 w-full text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400'
  const beschriftung = 'mb-2 block text-sm font-semibold text-slate-200'
  const optional = t('my_stack_plan_optional', { defaultValue: 'optional' })

  return (
    <section data-haltbarkeit={art ?? 'ablauf'} aria-labelledby={`${id}-title`} className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <h3 id={`${id}-title`} className="text-sm font-semibold text-white">{t('my_stack_shelf_life', { defaultValue: 'Haltbarkeit' })}</h3>
      {dosageForm === 'ampoule' && (
        <p className="text-sm text-slate-400">{t('my_stack_shelf_ampoule_hint')}</p>
      )}
      {art && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-opened`} className={beschriftung}>
              {t(`my_stack_shelf_opened_${art}`)} ({optional})
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
              {t(`my_stack_shelf_within_${art}`)} ({t('my_stack_stock_days_multiple', { n: '' }).trim()}, {optional})
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
      )}
      <div>
        <label htmlFor={`${id}-expires`} className={beschriftung}>
          {t('my_stack_shelf_expiry')} ({optional})
        </label>
        <input
          id={`${id}-expires`}
          data-field="inventory.expiresAt"
          type="date"
          value={inventory.expiresAt ?? ''}
          onChange={event => onChange({ expiresAt: event.target.value || null })}
          className={eingabe}
        />
      </div>
      {bis && (
        <p data-haltbarkeit-bis className="flex items-baseline justify-between gap-3 border-t border-white/10 pt-3 text-sm text-slate-400">
          <span>{t('my_stack_shelf_use_by')}</span>
          <span className="font-semibold tabular-nums text-white">{formatLocalDay(bis, i18n?.language || 'de')}</span>
        </p>
      )}
    </section>
  )
}
