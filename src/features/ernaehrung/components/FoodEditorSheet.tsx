import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Sheet } from './Panel'
import { type Food, type FoodUnit, kcalFromMacros, macroMismatch, parseAmount } from '../lib/nutrition'
import { DIM, ERROR_TEXT, MUTED, WARN_BOX } from '../styles'
import { SheetClose } from '../../../components/ui/SheetClose'
import { ScoreBadge } from './ScoreBadge'

type Field = 'kcal' | 'protein' | 'carbs' | 'fat' | 'sugar' | 'satFat' | 'fiber' | 'salt'
const REQUIRED: Field[] = ['kcal', 'protein', 'carbs', 'fat']
const OPTIONAL: Field[] = ['sugar', 'satFat', 'fiber', 'salt']
const MAX: Record<Field, number> = { kcal: 900, protein: 100, carbs: 100, fat: 100, sugar: 100, satFat: 100, fiber: 100, salt: 100 }
const LABEL_KEY: Record<Field, string> = {
  kcal: 'nutr_f_kcal', protein: 'nutr_protein', carbs: 'nutr_carbs', fat: 'nutr_fat',
  sugar: 'nutr_f_sugar', satFat: 'nutr_f_sat_fat', fiber: 'nutr_f_fiber', salt: 'nutr_f_salt',
}

const show = (n: number | null | undefined) => (n == null ? '' : String(n).replace('.', ','))

/**
 * Lebensmittel anlegen oder die Werte eines vorhandenen korrigieren. Korrigiert
 * jemand einen Open-Food-Facts-Eintrag, entsteht seine eigene Fassung (gleicher
 * Barcode) — die kommt beim nächsten Scan zuerst.
 */
export function FoodEditorSheet({ base, initialName, barcode, busy, onSave, onClose }: {
  base: Food | null
  initialName?: string
  barcode: string | null
  busy: boolean
  onSave: (food: Food) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [name, setName] = useState(base?.name ?? initialName ?? '')
  const [brand, setBrand] = useState(base?.brand ?? '')
  const [unit, setUnit] = useState<FoodUnit>(base?.unit ?? 'g')
  const [servingAmount, setServingAmount] = useState(show(base?.serving?.amount))
  const [servingLabel, setServingLabel] = useState(base?.serving?.label ?? '')
  const [v, setV] = useState<Record<Field, string>>({
    kcal: show(base?.per100.kcal), protein: show(base?.per100.protein ?? 0), carbs: show(base?.per100.carbs ?? 0),
    fat: show(base?.per100.fat ?? 0), sugar: show(base?.per100.sugar), satFat: show(base?.per100.satFat),
    fiber: show(base?.per100.fiber), salt: show(base?.per100.salt),
  })
  const [tried, setTried] = useState(false)

  const value = (f: Field) => (v[f].trim() === '' ? null : parseAmount(v[f]))
  const fieldOk = (f: Field) => {
    const n = value(f)
    if (n == null) return !REQUIRED.includes(f)
    // Gesättigte Fettsäuren sind ein Teil des Fetts.
    if (f === 'satFat') { const fat = value('fat'); if (fat != null && n > fat) return false }
    return n >= 0 && n <= MAX[f]
  }
  const satFatTooHigh = (value('satFat') ?? 0) > (value('fat') ?? Infinity)
  const serving = servingAmount.trim() === '' ? null : parseAmount(servingAmount)
  const servingOk = serving === null || (serving > 0 && serving <= 5000)
  const valid = name.trim().length > 0 && [...REQUIRED, ...OPTIONAL].every(fieldOk) && servingOk
  const per100 = valid ? {
    kcal: value('kcal')!, protein: value('protein')!, carbs: value('carbs')!, fat: value('fat')!,
    sugar: value('sugar'), satFat: value('satFat'), fiber: value('fiber'), salt: value('salt'),
  } : null
  const mismatch = per100 ? macroMismatch(per100) : false
  const isCorrection = base !== null && base.itemId === null

  const submit = () => {
    setTried(true)
    if (!per100) return
    onSave({
      itemId: base?.itemId ?? null,
      source: base?.source ?? 'custom',
      sourceRef: base?.sourceRef ?? null,
      barcode: base?.barcode ?? barcode,
      name: name.trim().slice(0, 120),
      brand: brand.trim().slice(0, 120) || null,
      unit,
      per100,
      serving: serving ? { amount: serving, label: servingLabel.trim().slice(0, 40) || null } : null,
      favorite: base?.favorite ?? false,
    })
  }

  const numberField = (f: Field) => (
    <div key={f} className="min-w-0">
      <label htmlFor={`nutr-f-${f}`} className="label truncate">{t(LABEL_KEY[f])}{f === 'kcal' ? '' : ' (g)'}</label>
      <input id={`nutr-f-${f}`} inputMode="decimal" enterKeyHint="next" value={v[f]} placeholder={OPTIONAL.includes(f) ? '–' : '0'}
        onChange={e => setV({ ...v, [f]: e.target.value })} aria-invalid={tried && !fieldOk(f)}
        className="input" />
    </div>
  )

  return (
    <Sheet labelledBy="nutr-editor-title" busy={busy} onClose={onClose} tall>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 id="nutr-editor-title" className="lg-title2">
            {isCorrection ? t('nutr_correct_title') : base ? t('nutr_edit_food') : t('nutr_create')}
          </h2>
          <p className={`mt-1 text-[13px] ${MUTED}`}>
            {isCorrection ? t('nutr_correct_hint') : t('nutr_per100_hint', { unit })}{(base?.barcode ?? barcode) ? ` · ${base?.barcode ?? barcode}` : ''}
          </p>
        </div>
        <SheetClose onClick={onClose} disabled={busy} />
      </div>

      <label htmlFor="nutr-f-name" className="label mt-4">{t('nutr_f_name')}</label>
      <input id="nutr-f-name" value={name} maxLength={120} onChange={e => setName(e.target.value)} autoFocus={!base}
        enterKeyHint="next" aria-invalid={tried && !name.trim()} className="input" />
      <label htmlFor="nutr-f-brand" className="label mt-3">{t('nutr_f_brand')}</label>
      <input id="nutr-f-brand" value={brand} maxLength={120} onChange={e => setBrand(e.target.value)} enterKeyHint="next" className="input" />

      <p className="label mt-3" id="nutr-unit-label">{t('nutr_f_unit')}</p>
      <div role="radiogroup" aria-labelledby="nutr-unit-label" className="grid grid-cols-2 rounded-[10px] bg-[var(--lg-fill)] p-0.5">
        {(['g', 'ml'] as const).map(u => (
          <button key={u} type="button" role="radio" aria-checked={unit === u} onClick={() => setUnit(u)}
            className={`min-h-9 rounded-[8px] text-[15px] font-medium transition-colors ${unit === u
              ? 'bg-[var(--lg-fill-selected)] text-[var(--lg-text)] shadow-[inset_0_0_0_1px_var(--lg-hair)]'
              : 'text-[var(--lg-text-2)]'}`}>
            {t(u === 'g' ? 'nutr_unit_g' : 'nutr_unit_ml')}
          </button>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between gap-2 px-1">
        <p className={`text-[13px] ${DIM}`}>{t('nutr_per100_hint', { unit })}</p>
        <ScoreBadge per100={per100} unit={unit} />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-3">{REQUIRED.map(numberField)}</div>
      <div className="mt-3 grid grid-cols-2 gap-3">{OPTIONAL.map(numberField)}</div>

      {satFatTooHigh && <p role="alert" className={`mt-2 px-1 ${ERROR_TEXT}`}>{t('nutr_sat_fat_invalid')}</p>}

      {mismatch && per100 && (
        <div className={`mt-3 ${WARN_BOX}`}>
          <AlertTriangle size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--lg-warn-text)]" />
          <span>{t('nutr_mismatch_calc', { calc: Math.round(kcalFromMacros(per100)) })}</span>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <label htmlFor="nutr-f-serving" className="label truncate">{t('nutr_f_serving', { unit })}</label>
          <input id="nutr-f-serving" inputMode="decimal" value={servingAmount} placeholder="–" onChange={e => setServingAmount(e.target.value)}
            aria-invalid={tried && !servingOk} className="input" />
        </div>
        <div className="min-w-0">
          <label htmlFor="nutr-f-serving-label" className="label truncate">{t('nutr_f_serving_label')}</label>
          <input id="nutr-f-serving-label" value={servingLabel} maxLength={40} placeholder={t('nutr_f_serving_label_ph')}
            onChange={e => setServingLabel(e.target.value)} className="input" />
        </div>
      </div>

      {tried && !valid && <p role="alert" className={`mt-3 px-1 ${ERROR_TEXT}`}>{t('nutr_editor_invalid')}</p>}

      <div className="mt-5 flex gap-2">
        <button type="button" data-quiet className="lg-gray-btn flex-1 !min-h-12 !text-[17px]" disabled={busy} onClick={onClose}>{t('cancel')}</button>
        <button type="button" className="lg-btn lg-btn-primary flex-1 !px-4" disabled={busy} onClick={submit}>{t('nutr_save_food')}</button>
      </div>
    </Sheet>
  )
}
