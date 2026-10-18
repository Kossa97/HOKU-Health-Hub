import { useState } from 'react'
import type { PeptipediaLocale } from '../content/types'
import { PEPTIPEDIA_UI_COPY } from '../content/uiCopy'
import { calculateReconstitution } from '../lib/reconstitution'

const fields = ['vialAmountMg', 'diluentMl', 'targetDose', 'syringeCapacityMl', 'syringeUnits'] as const
const inputClass = 'mt-1.5 min-h-11 w-full min-w-0 bg-[var(--lg-fill)] border border-transparent rounded-xl px-3 py-2.5 text-[16px] text-[var(--lg-text)] outline-none focus:border-[var(--lg-accent)]'

export function PeptideCalculatorPanel({ locale }: { locale: PeptipediaLocale }) {
  const copy = PEPTIPEDIA_UI_COPY[locale].calculator
  const [values, setValues] = useState<Record<typeof fields[number], string>>({ vialAmountMg: '', diluentMl: '', targetDose: '', syringeCapacityMl: '', syringeUnits: '' })
  const [unit, setUnit] = useState('')
  const [result, setResult] = useState<ReturnType<typeof calculateReconstitution> | null>(null)
  const [error, setError] = useState('')
  const labels = { vialAmountMg: `${copy.vialAmount} (mg)`, diluentMl: `${copy.diluent} (ml)`, targetDose: copy.targetDose, syringeCapacityMl: `${copy.syringeCapacity} (ml)`, syringeUnits: copy.syringeUnits }
  const format = (value: number) => new Intl.NumberFormat(locale, { maximumSignificantDigits: 6 }).format(value)
  return (
    <div className="lg-surface lg-flat p-5">
      <h2 className="lg-title2 mb-2">{PEPTIPEDIA_UI_COPY[locale].tabs.calculator}</h2>
      <p className="text-[13px] text-[var(--lg-text-2)] leading-snug mb-4">{copy.disclaimer}</p>
      <form className="space-y-4" onSubmit={event => {
        event.preventDefault()
        setResult(null)
        const missing = fields.find(field => !values[field].trim())
        if (missing) { setError(`${labels[missing]}: ${locale === 'de' ? 'Bitte einen Wert eingeben.' : 'Enter a value.'}`); return }
        if (!unit) { setError(`${copy.targetUnit}: ${locale === 'de' ? 'Bitte auswählen.' : 'Choose a unit.'}`); return }
        try {
          const calculated = calculateReconstitution({ vialAmountMg: Number(values.vialAmountMg), diluentMl: Number(values.diluentMl), targetDose: Number(values.targetDose), syringeCapacityMl: Number(values.syringeCapacityMl), syringeUnits: Number(values.syringeUnits), targetUnit: unit as 'mg' | 'mcg' })
          setResult(calculated)
          setError('')
        } catch (caught) {
          const field = caught instanceof Error ? caught.message : ''
          if (field in labels) setError(`${labels[field as keyof typeof labels]}: ${locale === 'de' ? 'Muss größer als null sein.' : 'Must be greater than zero.'}`)
          else if (field === 'target_exceeds_vial') setError(locale === 'de' ? 'Die Zielmenge übersteigt den gesamten Vial-Inhalt.' : 'The target exceeds the total vial content.')
          else if (field === 'target_exceeds_syringe_capacity') setError(locale === 'de' ? 'Das berechnete Volumen passt nicht in die angegebene Spritze.' : 'The calculated volume exceeds the syringe capacity.')
          else setError(locale === 'de' ? 'Diese Zahlen liegen außerhalb des berechenbaren Bereichs.' : 'These numbers are outside the calculable range.')
        }
      }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {fields.map(field => <label key={field} className="min-w-0 text-[13px] font-medium text-[var(--lg-text-2)]">{labels[field]}
            <input type="number" inputMode="decimal" step="any" value={values[field]} className={inputClass}
              onChange={event => { setValues({ ...values, [field]: event.target.value }); setResult(null); setError('') }} />
          </label>)}
          <label className="text-[13px] font-medium text-[var(--lg-text-2)]">{copy.targetUnit}
            <select value={unit} className={inputClass} onChange={event => { setUnit(event.target.value); setResult(null); setError('') }}>
              <option value="">{locale === 'de' ? 'Bitte wählen' : 'Choose a unit'}</option><option value="mcg">µg (mcg)</option><option value="mg">mg</option>
            </select>
          </label>
        </div>
        <button type="submit" className="lg-btn lg-btn-primary w-full">{copy.calculate}</button>
        {error && <p role="alert" className="text-[15px] text-[var(--lg-bad-text)]">{error}</p>}
        {result && <div role="status" className="rounded-[16px] bg-[var(--lg-surface-2)] px-4 py-3 text-[15px] text-[var(--lg-text-2)] space-y-2">
          <p>{copy.result}: <strong className="text-[var(--lg-accent-text)]">{format(result.drawMl)} ml</strong> · {format(result.drawUnits)} {locale === 'de' ? 'Skaleneinheiten' : 'scale units'}</p>
          <p>{format(result.concentrationMcgPerMl)} µg/ml · {result.dosesPerVial} {locale === 'de' ? 'vollständige Zielmengen pro Vial' : 'complete target amounts per vial'}</p>
        </div>}
      </form>
    </div>
  )
}
