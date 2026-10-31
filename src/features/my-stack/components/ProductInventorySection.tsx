import { ChevronDown, FileUp, Package } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { anbruchArt, gueltigeFluessigkeit, gueltigeHaltbarkeit, istLoesungsVial } from '../lib/bestand'
import type { DosageFormKey, InventoryDraft } from '../types'

interface ProductInventorySectionProps {
  /**
   * An beim Anlegen: Bestand mitverfolgen, Packung, Menge. Beim Bearbeiten
   * aus — die Mengen aendert „Bestand aendern" an der Bestand-Anzeige; hier
   * stehen dann die Angaben zur Packung (Charge, Anmischen, Haltbarkeit).
   */
  showInventory?: boolean
  /**
   * Beim Vial stehen Fluessigkeit, Anmischdatum und Haltbarkeit schon im
   * Schritt „Staerke" — dann hier nicht noch einmal.
   */
  anmischenAnderswo?: boolean
  /**
   * Oeffnen, Haltbarkeit und Ablaufdatum stehen in der Zusammensetzung
   * (`HaltbarkeitAngaben`) — dann hier nicht noch einmal.
   */
  haltbarkeitAnderswo?: boolean
  /** Beim Anlegen im Ueberblick aufgeklappt: der Bestand ist dort ein Tipp. */
  anfangsOffen?: boolean
  /**
   * Ohne Staerke bucht nichts ab und gespeichert wird der Bestand auch nicht
   * — dann ein Hinweis statt der Felder.
   */
  bestandOhneStaerke?: boolean
  brand: string
  inventory: InventoryDraft
  dosageForm?: DosageFormKey | null
  /** Fuer das Vial mit fertiger Loesung: geoeffnet statt angemischt, ohne Fluessigkeit. */
  category?: string | null
  onBrandChange: (brand: string) => void
  onInventoryChange: (changes: Partial<InventoryDraft>) => void
}

/** Der Dateiname aus der Adresse — ein kaputtes „%" darin darf nichts sprengen. */
function dateiname(url: string): string {
  const letzter = url.split('/').pop() ?? ''
  try {
    return decodeURIComponent(letzter)
  } catch {
    return letzter
  }
}

function numberValue(value: string): number | null {
  if (value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function ProductInventorySection({
  showInventory = true,
  anmischenAnderswo = false,
  haltbarkeitAnderswo = false,
  anfangsOffen = false,
  bestandOhneStaerke = false,
  brand,
  inventory,
  dosageForm,
  category,
  onBrandChange,
  onInventoryChange,
}: ProductInventorySectionProps) {
  const { t } = useTranslation()
  const contentId = useId()
  const [expanded, setExpanded] = useState(anfangsOffen)
  // Ein Vial mit fertiger Loesung wird geoeffnet wie eine Flasche.
  const art = istLoesungsVial(dosageForm, category) ? 'flasche' : anbruchArt(dosageForm)
  const eingabe = 'input min-h-11 w-full text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400'
  const beschriftung = 'mb-2 block text-sm font-medium text-slate-200'
  const fluessigkeitFalsch = !gueltigeFluessigkeit(inventory.reconstitutionMl)
  const haltbarkeitFalsch = !gueltigeHaltbarkeit(inventory.useWithinDays)

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.035]">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={() => setExpanded(current => !current)}
        className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium text-slate-100 transition-colors duration-200 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 motion-reduce:transition-none"
      >
        <span className="flex items-center gap-2">
          <Package size={17} aria-hidden="true" className="text-sky-300" />
          {showInventory
            ? t('my_stack_product_inventory', { defaultValue: 'Produkt & Bestand' })
            : t('my_stack_product_only')}
        </span>
        <ChevronDown
          size={17}
          aria-hidden="true"
          className={`text-slate-400 transition-transform duration-200 motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div id={contentId} className="space-y-4 border-t border-white/10 p-4">
          <div>
            <label htmlFor={`${contentId}-brand`} className="mb-2 block text-sm font-medium text-slate-200">
              {t('my_stack_brand_optional', { defaultValue: 'Marke (optional)' })}
            </label>
            <input
              id={`${contentId}-brand`}
              value={brand}
              onChange={event => onBrandChange(event.target.value)}
              className="input min-h-11 w-full text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            />
          </div>

          {showInventory && bestandOhneStaerke && (
            <p data-inventory-needs-strength className="text-sm text-slate-400">{t('my_stack_inventory_needs_strength')}</p>
          )}

          {showInventory && !bestandOhneStaerke && <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm font-medium text-slate-200">
            <input
              type="checkbox"
              aria-label={String(t('my_stack_inventory_enabled', { defaultValue: 'Bestand mitverfolgen' }))}
              checked={inventory.enabled}
              onChange={event => onInventoryChange({ enabled: event.target.checked })}
              className="h-5 w-5 cursor-pointer accent-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            />
            {t('my_stack_inventory_enabled', { defaultValue: 'Bestand mitverfolgen' })}
          </label>}

          {showInventory && !bestandOhneStaerke && inventory.enabled && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor={`${contentId}-package-quantity`} className="mb-2 block text-sm font-medium text-slate-200">
                  {t('my_stack_package_quantity', { defaultValue: 'Packungsgröße' })}
                </label>
                <input
                  id={`${contentId}-package-quantity`}
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={inventory.packageQuantity ?? ''}
                  onChange={event => onInventoryChange({ packageQuantity: numberValue(event.target.value) })}
                  className="input min-h-11 w-full text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                />
              </div>
              <div>
                <label htmlFor={`${contentId}-package-unit`} className="mb-2 block text-sm font-medium text-slate-200">
                  {t('my_stack_package_unit', { defaultValue: 'Packungseinheit' })}
                </label>
                <input
                  id={`${contentId}-package-unit`}
                  required
                  value={inventory.packageUnit ?? ''}
                  onChange={event => onInventoryChange({ packageUnit: event.target.value })}
                  className="input min-h-11 w-full text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                />
              </div>
              <div>
                <label htmlFor={`${contentId}-remaining`} className="mb-2 block text-sm font-medium text-slate-200">
                  {t('my_stack_remaining_quantity', { defaultValue: 'Aktueller Bestand' })}
                </label>
                <input
                  id={`${contentId}-remaining`}
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={inventory.remainingQuantity ?? ''}
                  onChange={event => onInventoryChange({ remainingQuantity: numberValue(event.target.value) })}
                  className="input min-h-11 w-full text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                />
              </div>
              <div>
                <label htmlFor={`${contentId}-batch`} className="mb-2 block text-sm font-medium text-slate-200">
                  {t('my_stack_batch_number_optional', { defaultValue: 'Chargennummer (optional)' })}
                </label>
                <input
                  id={`${contentId}-batch`}
                  value={inventory.batchNumber}
                  onChange={event => onInventoryChange({ batchNumber: event.target.value })}
                  className="input min-h-11 w-full text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                />
              </div>
{!haltbarkeitAnderswo && (
              <div className="sm:col-span-2">
                <label htmlFor={`${contentId}-expires`} className="mb-2 block text-sm font-medium text-slate-200">
                  {art
                    ? `${t('my_stack_stock_expires_unopened')} (${t('my_stack_plan_optional', { defaultValue: 'optional' })})`
                    : t('my_stack_expires_at_optional', { defaultValue: 'Ablaufdatum (optional)' })}
                </label>
                <input
                  id={`${contentId}-expires`}
                  type="date"
                  value={inventory.expiresAt ?? ''}
                  onChange={event => onInventoryChange({ expiresAt: event.target.value || null })}
                  className="input min-h-11 w-full text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                />
              </div>
              )}
            </div>
          )}

          {!showInventory && (
            <div data-product-details className="grid gap-4 sm:grid-cols-2">
              {art && !(anmischenAnderswo && art === 'vial') && (
                <>
                  {art === 'vial' && (
                    <div>
                      <label htmlFor={`${contentId}-liquid`} className={beschriftung}>{t('my_stack_stock_liquid')} (ml)</label>
                      <input
                        id={`${contentId}-liquid`}
                        data-field="inventory.reconstitutionMl"
                        type="number"
                        min="0"
                        max="1000"
                        step="any"
                        value={inventory.reconstitutionMl ?? ''}
                        aria-invalid={fluessigkeitFalsch || undefined}
                        onChange={event => onInventoryChange({ reconstitutionMl: numberValue(event.target.value) })}
                        className={eingabe}
                      />
                      {fluessigkeitFalsch && <p role="alert" className="mt-1.5 text-sm text-rose-300">{t('my_stack_stock_liquid_invalid')}</p>}
                    </div>
                  )}
                  {!haltbarkeitAnderswo && <>
                  <div>
                    <label htmlFor={`${contentId}-opened`} className={beschriftung}>
                      {t(art === 'vial' ? 'my_stack_stock_mixed_on' : 'my_stack_stock_opened_on')}
                    </label>
                    <input
                      id={`${contentId}-opened`}
                      type="date"
                      value={inventory.openedAt ?? ''}
                      onChange={event => onInventoryChange({ openedAt: event.target.value || null })}
                      className={eingabe}
                    />
                  </div>
                  <div>
                    <label htmlFor={`${contentId}-within`} className={beschriftung}>
                      {t(art === 'vial' ? 'my_stack_stock_use_within_vial' : 'my_stack_stock_use_within')} ({t('my_stack_stock_days_multiple', { n: '' }).trim()})
                    </label>
                    <input
                      id={`${contentId}-within`}
                      data-field="inventory.useWithinDays"
                      type="number"
                      min="1"
                      max="3650"
                      step="1"
                      value={inventory.useWithinDays ?? ''}
                      aria-invalid={haltbarkeitFalsch || undefined}
                      onChange={event => onInventoryChange({ useWithinDays: numberValue(event.target.value) })}
                      className={eingabe}
                    />
                    {haltbarkeitFalsch && <p role="alert" className="mt-1.5 text-sm text-rose-300">{t('my_stack_stock_days_invalid')}</p>}
                  </div>
                  </>}
                </>
              )}
              <div>
                <label htmlFor={`${contentId}-batch-edit`} className={beschriftung}>{t('my_stack_stock_batch_number')}</label>
                <input
                  id={`${contentId}-batch-edit`}
                  value={inventory.batchNumber}
                  onChange={event => onInventoryChange({ batchNumber: event.target.value })}
                  className={eingabe}
                />
              </div>
              <div>
                <label htmlFor={`${contentId}-source`} className={beschriftung}>{t('my_stack_stock_source')}</label>
                <input
                  id={`${contentId}-source`}
                  value={inventory.batchSource ?? ''}
                  onChange={event => onInventoryChange({ batchSource: event.target.value })}
                  className={eingabe}
                />
              </div>
              {!haltbarkeitAnderswo && (
              <div>
                <label htmlFor={`${contentId}-expires-edit`} className={beschriftung}>
                  {t(art ? 'my_stack_stock_expires_unopened' : 'my_stack_stock_expires')}
                </label>
                <input
                  id={`${contentId}-expires-edit`}
                  type="date"
                  value={inventory.expiresAt ?? ''}
                  onChange={event => onInventoryChange({ expiresAt: event.target.value || null })}
                  className={eingabe}
                />
              </div>
              )}
              <div className="sm:col-span-2">
                <span className={beschriftung}>{t('my_stack_stock_document')}</span>
                {/* Hochgeladen wird erst beim Speichern: wer abbricht oder
                    eine andere Datei waehlt, hinterlaesst nichts im Speicher. */}
                <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-white/15 px-3 py-2 focus-within:ring-2 focus-within:ring-sky-400">
                  <FileUp size={18} aria-hidden="true" className="shrink-0 text-slate-400" />
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-300">
                    {inventory.batchFile
                      ? inventory.batchFile.name
                      : inventory.batchFileUrl
                        ? dateiname(inventory.batchFileUrl)
                        : t('my_stack_stock_document_pick')}
                  </span>
                  <input
                    type="file"
                    className="sr-only"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    aria-label={String(t('my_stack_stock_document'))}
                    onChange={event => {
                      const file = event.target.files?.[0]
                      // Leeren, damit dieselbe Datei erneut gewaehlt werden kann.
                      event.target.value = ''
                      if (file) onInventoryChange({ batchFile: file })
                    }}
                  />
                </label>
                {(inventory.batchFile || inventory.batchFileUrl) && (
                  <button
                    type="button"
                    onClick={() => onInventoryChange({ batchFile: null, batchFileUrl: null })}
                    className="mt-1 min-h-11 px-1 text-sm font-medium text-rose-300"
                  >
                    {t('my_stack_stock_document_remove')}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
