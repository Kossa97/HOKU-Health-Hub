import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowDownUp, Droplet, X } from 'lucide-react'
import { SectionHeader } from '../../../components/ui/DesignSystem'
import { SyringeFields } from './SyringeFields'
import { formatCalculatorNumber, parseDecimalInput } from '../lib/units'
import {
  BLOOD_MARKERS, CONVERSION_SOURCES, MARKER_BRIDGES, UNIT_FAMILIES,
  compatibleUnits, convertMedicalUnit, defaultMarkerUnit, medicalUnit, unitsForMarker,
} from '../lib/medicalUnits'
import type { MedicalUnit } from '../lib/medicalUnits'

export function UnitConverter() {
  const { t, i18n } = useTranslation()
  const [amount, setAmount] = useState('')
  const [marker, setMarker] = useState('')
  const [from, setFrom] = useState('mg')
  const [to, setTo] = useState('mcg')
  const [capacityMl, setCapacityMl] = useState('1')
  const [capacityUnits, setCapacityUnits] = useState('100')
  const amountRef = useRef<HTMLInputElement>(null)
  const markerRef = useRef<HTMLSelectElement>(null)
  const focusAfterMarkerChange = useRef<'amount' | 'marker' | null>(null)
  useEffect(() => {
    if (focusAfterMarkerChange.current === 'amount') amountRef.current?.focus()
    if (focusAfterMarkerChange.current === 'marker') markerRef.current?.focus()
    focusAfterMarkerChange.current = null
  }, [marker])
  const sourceUnit = medicalUnit(from)
  const availableTargets = compatibleUnits(from, marker).filter(unit => unit.id !== from)
  const syringe = from === 'scale' || to === 'scale'
  const hba1c = sourceUnit.family === 'hba1c'
  const value = parseDecimalInput(amount)
  const ml = parseDecimalInput(capacityMl)
  const units = parseDecimalInput(capacityUnits)
  const blank = amount.trim() === ''
  const invalid = !blank && (value === null || value < 0)
  const invalidSyringe = syringe && (ml === null || ml <= 0 || units === null || units <= 0)
  let result: number | null = null
  let overCapacity = false
  let resultInvalid = false
  if (!blank && !invalid && !invalidSyringe && value !== null) {
    try {
      const scale = ml !== null && units !== null ? { ml, units } : undefined
      result = convertMedicalUnit(value, from, to, marker, scale)
      if (syringe && ml !== null) {
        overCapacity = convertMedicalUnit(value, from, 'mL', marker, scale) > ml
      }
    } catch {
      resultInvalid = true
    }
  }

  const unitLabel = (unit: MedicalUnit) => unit.id === 'scale' ? t('rechner_converter_scale_units')
    : unit.id === 'fraction' ? t('rechner_converter_fraction_unit')
      : unit.id === 'mcg' ? 'µg' : unit.label ?? unit.id
  const options = (choices: MedicalUnit[]) => UNIT_FAMILIES.map(family => {
    const group = choices.filter(unit => unit.family === family)
    return group.length > 0 && <optgroup key={family} label={t(`rechner_converter_${family}`)}>
      {group.map(unit => <option key={unit.id} value={unit.id}>{unitLabel(unit)}</option>)}
    </optgroup>
  })
  const chooseFrom = (next: string) => {
    const targets = compatibleUnits(next, marker).filter(unit => unit.id !== next)
    setFrom(next)
    setTo(targets.some(unit => unit.id === to) ? to : targets[0].id)
  }
  const chooseMarker = (next: string) => {
    const nextFrom = next ? defaultMarkerUnit(next) : from
    const targets = compatibleUnits(nextFrom, next).filter(unit => unit.id !== nextFrom)
    const preferred = next ? MARKER_BRIDGES[next]?.to : to
    focusAfterMarkerChange.current = next ? 'amount' : 'marker'
    setMarker(next)
    setFrom(nextFrom)
    setTo(targets.find(unit => unit.id === preferred)?.id ?? targets[0].id)
    if (next) setAmount('')
  }
  const bridge = MARKER_BRIDGES[marker]
  const sourceUrl = hba1c ? CONVERSION_SOURCES.ngsp : bridge ? CONVERSION_SOURCES[bridge.source] : null
  const concentration = ['mass_concentration', 'molar_concentration'].includes(sourceUnit.family)
  const activity = ['activity', 'activity_concentration'].includes(sourceUnit.family)

  return (
    <section className="lg-surface lg-flat rechner-converter-card">
      <SectionHeader title={t('rechner_converter_title')} subtitle={t('rechner_converter_subtitle')} />
      <div className="rechner-form rechner-converter">
        {marker ? <div className="rechner-converter-scope">
          <div>
            <span className="rechner-converter-scope-label">{t('rechner_converter_marker_selected')}</span>
            <span id="converter-marker-name" className="rechner-converter-marker"><Droplet strokeWidth={1.5} size={15} aria-hidden="true" />{marker === 'Vitamin D' ? 'Vitamin D (25-OH)' : marker}</span>
          </div>
          <button type="button" className="rechner-converter-remove" onClick={() => chooseMarker('')}
            aria-label={t('rechner_converter_remove_marker')} aria-describedby="converter-marker-name">
            <X strokeWidth={1.5} size={18} aria-hidden="true" />
          </button>
        </div> : <label className="rechner-field" htmlFor="converter-marker">
          <span>{t('rechner_converter_marker')}</span>
          <select ref={markerRef} id="converter-marker" className="rechner-select" value={marker}
            onChange={event => chooseMarker(event.target.value)}>
            <option value="">{t('rechner_converter_general')}</option>
            {BLOOD_MARKERS.map(item => <option key={item.name} value={item.name}>
              {item.name === 'Vitamin D' ? 'Vitamin D (25-OH)' : item.name}
            </option>)}
          </select>
        </label>}
        <div className="rechner-converter-fields" data-marker-active={!!marker}>
          <div className="rechner-field">
            <label htmlFor="converter-amount">{t('rechner_converter_from')}</label>
            <div className="rechner-converter-input" data-invalid={invalid || resultInvalid}>
              <input ref={amountRef} id="converter-amount" className="rechner-input" type="text" inputMode="decimal" autoComplete="off"
                placeholder="0" value={amount} onChange={event => setAmount(event.target.value)} aria-invalid={invalid || resultInvalid}
                aria-describedby={invalid || resultInvalid ? 'converter-input-error' : undefined} />
              <select id="converter-from" className="rechner-select" value={from} onChange={event => chooseFrom(event.target.value)}
                aria-label={t('rechner_converter_from_unit')} aria-describedby={marker ? 'converter-marker-hint' : undefined}>
                {options(unitsForMarker(marker))}
              </select>
            </div>
          </div>
          <div className="rechner-converter-swap">
            <button type="button" className="rechner-button" onClick={() => { setFrom(to); setTo(from) }}>
              <ArrowDownUp strokeWidth={1.5} size={15} aria-hidden="true" /> {t('rechner_converter_swap')}
            </button>
          </div>
          <div className="rechner-field">
            <label htmlFor="converter-result">{t('rechner_converter_to')}</label>
            <div className="rechner-converter-input rechner-converter-output">
              <input id="converter-result" className="rechner-input" type="text" readOnly placeholder="—"
                value={result !== null && !resultInvalid ? formatCalculatorNumber(result, i18n.language) : ''}
                aria-describedby="converter-result-hint" />
              <select id="converter-to" className="rechner-select" value={to} onChange={event => setTo(event.target.value)}
                aria-label={t('rechner_converter_to_unit')} aria-describedby={marker ? 'converter-marker-hint' : undefined}>
                {options(availableTargets)}
              </select>
            </div>
          </div>
        </div>
        <span id="converter-result-hint" className="rechner-muted rechner-converter-result-hint">{t('rechner_converter_live_result')}</span>
        {marker && <p id="converter-marker-hint" className="rechner-muted">
          {t('rechner_converter_units_for')} <strong>{marker}</strong>
        </p>}
        {syringe && <SyringeFields idPrefix="converter-syringe" capacityMl={capacityMl}
          capacityUnits={capacityUnits} onChange={(nextMl, nextUnits) => { setCapacityMl(nextMl); setCapacityUnits(nextUnits) }} />}
        <div className="rechner-result" role="status" aria-live="polite" aria-atomic="true">
          {blank ? <p className="rechner-muted">{t('rechner_converter_empty')}</p>
            : invalid || resultInvalid ? <p id="converter-input-error" className="rechner-error">
              {t(resultInvalid && hba1c ? 'rechner_converter_hba1c_invalid' : 'rechner_converter_invalid')}
            </p>
              : invalidSyringe ? <p className="rechner-error">{t('rechner_converter_invalid_syringe')}</p>
                : result !== null && <>
                  <span className="sr-only">{t('rechner_converter_result')}{marker ? ` · ${marker}` : ''}: {formatCalculatorNumber(result, i18n.language)} {unitLabel(medicalUnit(to))}</span>
                  {overCapacity && <p className="rechner-error">{t('rechner_converter_over_capacity')}</p>}
                </>}
        </div>
      </div>
      {(sourceUrl || activity || syringe || (!marker && !concentration && !hba1c)) && <div className="rechner-summary">
        {sourceUrl && <a className="rechner-muted" href={sourceUrl} target="_blank" rel="noopener noreferrer">{t('rechner_converter_source')}</a>}
        {(activity || syringe) && <p className="rechner-muted">{t('rechner_converter_iu_note')}</p>}
        {!marker && !concentration && !hba1c && !activity && !syringe && <p className="rechner-muted">{t('rechner_converter_mass_volume_note')}</p>}
      </div>}
    </section>
  )
}
