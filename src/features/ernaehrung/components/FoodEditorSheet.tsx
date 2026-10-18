import { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Sheet } from '../../compliance/components/Sheet'
import { type Food, type FoodUnit, kcalFromMacros, macroMismatch, parseAmount } from '../lib/nutrition'
import { PRESSABLE, chip, dim, input, label, muted } from '../styles'

type Field = 'kcal' | 'protein' | 'carbs' | 'fat' | 'sugar' | 'fiber' | 'salt'
const REQUIRED: Field[] = ['kcal', 'protein', 'carbs', 'fat']
const OPTIONAL: Field[] = ['sugar', 'fiber', 'salt']
const MAX: Record<Field, number> = { kcal: 900, protein: 100, carbs: 100, fat: 100, sugar: 100, fiber: 100, salt: 100 }
const LABEL_KEY: Record<Field, string> = {
  kcal: 'nutr_f_kcal', protein: 'nutr_protein', carbs: 'nutr_carbs', fat: 'nutr_fat',
  sugar: 'nutr_f_sugar', fiber: 'nutr_f_fiber', salt: 'nutr_f_salt',
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
    fat: show(base?.per100.fat ?? 0), sugar: show(base?.per100.sugar), fiber: show(base?.per100.fiber), salt: show(base?.per100.salt),
  })
  const [tried, setTried] = useState(false)

  const value = (f: Field) => (v[f].trim() === '' ? null : parseAmount(v[f]))
  const fieldOk = (f: Field) => {
    const n = value(f)
    if (n == null) return !REQUIRED.includes(f)
    return n >= 0 && n <= MAX[f]
  }
  const serving = servingAmount.trim() === '' ? null : parseAmount(servingAmount)
  const servingOk = serving === null || (serving > 0 && serving <= 5000)
  const valid = name.trim().length > 0 && [...REQUIRED, ...OPTIONAL].every(fieldOk) && servingOk
  const per100 = valid ? {
    kcal: value('kcal')!, protein: value('protein')!, carbs: value('carbs')!, fat: value('fat')!,
    sugar: value('sugar'), fiber: value('fiber'), salt: value('salt'),
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
    <div key={f}>
      <label htmlFor={`nutr-f-${f}`} style={label}>{t(LABEL_KEY[f])}{f === 'kcal' ? '' : ' (g)'}</label>
      <input id={`nutr-f-${f}`} inputMode="decimal" enterKeyHint="next" value={v[f]} placeholder={OPTIONAL.includes(f) ? '–' : '0'}
        onChange={e => setV({ ...v, [f]: e.target.value })} aria-invalid={tried && !fieldOk(f)}
        className="mt-1" style={{ ...input, border: tried && !fieldOk(f) ? '1px solid var(--cat-rose)' : input.border }} />
    </div>
  )

  return (
    <Sheet labelledBy="nutr-editor-title" busy={busy} onClose={onClose} tall>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 id="nutr-editor-title" className="text-lg font-extrabold" style={{ color: 'var(--text)' }}>
            {isCorrection ? t('nutr_correct_title') : base ? t('nutr_edit_food') : t('nutr_create')}
          </h2>
          <p className="text-[0.76rem]" style={muted}>
            {isCorrection ? t('nutr_correct_hint') : t('nutr_per100_hint', { unit })}{(base?.barcode ?? barcode) ? ` · ${base?.barcode ?? barcode}` : ''}
          </p>
        </div>
        <button type="button" data-app-back-close aria-label={t('close')} onClick={onClose} disabled={busy}
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${PRESSABLE}`} style={dim}><X size={20} /></button>
      </div>

      <label htmlFor="nutr-f-name" className="mt-3 block" style={label}>{t('nutr_f_name')}</label>
      <input id="nutr-f-name" value={name} maxLength={120} onChange={e => setName(e.target.value)} autoFocus={!base}
        enterKeyHint="next" aria-invalid={tried && !name.trim()} className="mt-1" style={input} />
      <label htmlFor="nutr-f-brand" className="mt-3 block" style={label}>{t('nutr_f_brand')}</label>
      <input id="nutr-f-brand" value={brand} maxLength={120} onChange={e => setBrand(e.target.value)} enterKeyHint="next" className="mt-1" style={input} />

      <p className="mt-3" style={label} id="nutr-unit-label">{t('nutr_f_unit')}</p>
      <div role="radiogroup" aria-labelledby="nutr-unit-label" className="mt-1 flex gap-2">
        {(['g', 'ml'] as const).map(u => (
          <button key={u} type="button" role="radio" aria-checked={unit === u} onClick={() => setUnit(u)} className={PRESSABLE} style={chip(unit === u)}>
            {t(u === 'g' ? 'nutr_unit_g' : 'nutr_unit_ml')}
          </button>
        ))}
      </div>

      <p className="mt-4 text-[0.78rem] font-semibold" style={dim}>{t('nutr_per100_hint', { unit })}</p>
      <div className="mt-1.5 grid grid-cols-2 gap-3">{REQUIRED.map(numberField)}</div>
      <div className="mt-3 grid grid-cols-3 gap-3">{OPTIONAL.map(numberField)}</div>

      {mismatch && per100 && (
        <div className="mt-3 flex gap-2 rounded-xl p-2.5 text-[0.78rem]" style={{ background: 'color-mix(in srgb, var(--cat-amber) 12%, transparent)', color: 'var(--text-dim)' }}>
          <AlertTriangle size={16} aria-hidden="true" className="mt-0.5 shrink-0" style={{ color: 'var(--cat-amber)' }} />
          <span>{t('nutr_mismatch_calc', { calc: Math.round(kcalFromMacros(per100)) })}</span>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="nutr-f-serving" style={label}>{t('nutr_f_serving', { unit })}</label>
          <input id="nutr-f-serving" inputMode="decimal" value={servingAmount} placeholder="–" onChange={e => setServingAmount(e.target.value)}
            aria-invalid={tried && !servingOk} className="mt-1" style={input} />
        </div>
        <div>
          <label htmlFor="nutr-f-serving-label" style={label}>{t('nutr_f_serving_label')}</label>
          <input id="nutr-f-serving-label" value={servingLabel} maxLength={40} placeholder={t('nutr_f_serving_label_ph')}
            onChange={e => setServingLabel(e.target.value)} className="mt-1" style={input} />
        </div>
      </div>

      {tried && !valid && <p role="alert" className="mt-3 text-[0.78rem]" style={{ color: 'var(--cat-rose)' }}>{t('nutr_editor_invalid')}</p>}

      <div className="mt-5 flex gap-2">
        <button type="button" className="btn-secondary flex-1" disabled={busy} onClick={onClose}>{t('cancel')}</button>
        <button type="button" className="btn-primary flex-1" disabled={busy} onClick={submit}>{t('nutr_save_food')}</button>
      </div>
    </Sheet>
  )
}
