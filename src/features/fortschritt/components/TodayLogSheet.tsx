import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { format } from 'date-fns'
import { Check, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../context/AuthContext'
import { reportError } from '../../../lib/monitoring'
import { isMissingColumn } from '../../../lib/dbErrors'
import type { BodyMeasurementEntry, DailyLogEntry, WeightLogEntry } from '../types'
import { fieldLabel } from '../styles'
import { dateFieldStyle, WELLNESS_SLIDER_CSS, WellnessSliderRow } from './WellnessSliderRow'
import { METRIC_WHEEL_CSS, MetricWheelPicker } from './MetricWheelPicker'
import {
  isValidMuscleMass,
  loadLogFormValues,
  MUSCLE_MASS_MAX_KG,
  MUSCLE_MASS_MIN_KG,
  type SavedLogFormValues,
} from '../lib/metricDefaults'
import { useScrollLock } from '../hooks/useScrollLock'
import { useSheetPresence } from '../hooks/useSheetPresence'
import { requestProfileSnapshot } from '../../profil/hooks/useProfileSnapshotSync'
import { formatNumber } from '../lib/dates'
import { measurementRowsToSave, type MeasurementSite } from '../lib/measurements'
import {
  MeasurementSection,
  parseTypedMeasurements,
  type TypedMeasurements,
} from './MeasurementSection'

const SHEET_Z = 10070

/** Volldeckend — var(--surface) ist im Dark-Theme halbtransparent. */
const SHEET_BG = 'var(--app-bg)'

const todayStr = () => format(new Date(), 'yyyy-MM-dd')

const SAVED_VALUES_STORAGE_PREFIX = 'tyd:fortschritt:saved-values:'

function nullableNumber(value: unknown): number | null {
  if (typeof value !== 'number') return null
  return Number.isFinite(value) ? value : null
}

function readStoredSavedValues(userId: string | undefined): SavedLogFormValues | null {
  if (!userId) return null
  try {
    const raw = localStorage.getItem(`${SAVED_VALUES_STORAGE_PREFIX}${userId}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<SavedLogFormValues>
    if (typeof parsed.date !== 'string') return null
    return {
      date: parsed.date,
      energie: nullableNumber(parsed.energie),
      schlaf: nullableNumber(parsed.schlaf),
      wohlbefinden: nullableNumber(parsed.wohlbefinden),
      libido: nullableNumber(parsed.libido),
      bodyFat: nullableNumber(parsed.bodyFat),
      muscleMass: nullableNumber(parsed.muscleMass),
      weight: nullableNumber(parsed.weight),
      weightRowId: typeof parsed.weightRowId === 'string' ? parsed.weightRowId : null,
    }
  } catch {
    return null
  }
}

function writeStoredSavedValues(userId: string, values: SavedLogFormValues) {
  try {
    localStorage.setItem(`${SAVED_VALUES_STORAGE_PREFIX}${userId}`, JSON.stringify(values))
  } catch {
    // Storage can be unavailable in private/restricted browser contexts.
  }
}

interface Props {
  logs: DailyLogEntry[]
  weightLogs: WeightLogEntry[]
  measurements: BodyMeasurementEntry[]
  measurementSites: MeasurementSite[]
  /** `null`, solange die gespeicherte Wahl nicht geladen ist. */
  onMeasurementSitesChange: ((sites: MeasurementSite[]) => void) | null
  open: boolean
  onClose: () => void
  onSaved: () => void | Promise<void>
}

export function TodayLogSheet({
  logs,
  weightLogs,
  measurements,
  measurementSites,
  onMeasurementSitesChange,
  open,
  onClose,
  onSaved,
}: Props) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [date, setDate] = useState(todayStr())
  const [energie, setEnergie] = useState<number | null>(null)
  const [schlaf, setSchlaf] = useState<number | null>(null)
  const [wohlbefinden, setWohlbefinden] = useState<number | null>(null)
  const [libido, setLibido] = useState<number | null>(null)
  const [weight, setWeight] = useState<number | null>(null)
  const [weightRowId, setWeightRowId] = useState<string | null>(null)
  const [bodyFat, setBodyFat] = useState<number | null>(null)
  const [muscleMass, setMuscleMass] = useState<number | null>(null)
  /** Nur was heute getippt wurde — der letzte Wert steht nur als Platzhalter da. */
  const [typed, setTyped] = useState<TypedMeasurements>({})
  const [saving, setSaving] = useState(false)
  /** Kurz nach dem Speichern: Haken im Knopf, dann schließt das Sheet. */
  const [saved, setSaved] = useState(false)
  /** Tageswerte stehen schon in der DB, das Gewicht noch nicht — beim Schließen neu laden. */
  const partiallySavedRef = useRef(false)
  const onSavedRef = useRef(onSaved)
  const [openMetric, setOpenMetric] = useState<'weight' | 'bodyFat' | 'muscleMass' | null>(null)
  const [savedValues, setSavedValues] = useState<SavedLogFormValues | null>(null)

  const { mounted, shown } = useSheetPresence(open)
  // Gesperrt bis das Sheet ganz hinausgefahren ist, nicht nur bis zum Schließen.
  useScrollLock(mounted)

  useEffect(() => { onSavedRef.current = onSaved })

  // Nach einem Teil-Speichern die Seite nachziehen, egal wie das Sheet zugeht
  // (Schließen-Knopf, Zurück-Geste, Seitenwechsel).
  useEffect(() => {
    const reloadIfPartial = () => {
      if (!partiallySavedRef.current) return
      partiallySavedRef.current = false
      void onSavedRef.current()
    }
    if (!open) reloadIfPartial()
    return reloadIfPartial
  }, [open])

  useEffect(() => {
    if (!open) setOpenMetric(null)
  }, [open])

  useEffect(() => {
    if (!open) return
    setSavedValues(readStoredSavedValues(user?.id))
  }, [open, user?.id])
  useLayoutEffect(() => {
    if (open) {
      setDate(todayStr())
      setTyped({})
      // Der Haken vom letzten Speichern gilt nicht mehr
      setSaved(false)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const values = loadLogFormValues(logs, weightLogs, date, savedValues)
    setEnergie(values.energie)
    setSchlaf(values.schlaf)
    setWohlbefinden(values.wohlbefinden)
    setLibido(values.libido)
    setBodyFat(values.bodyFat)
    setMuscleMass(values.muscleMass)
    setWeight(values.weight)
    setWeightRowId(values.weightRowId)
  }, [date, logs, weightLogs, open, savedValues])

  if (!mounted) return null

  const save = async () => {
    if (!user) return

    const hasWellness =
      energie != null || schlaf != null || wohlbefinden != null || libido != null || bodyFat != null
      || muscleMass != null
    const hasWeight = weight != null
    const parsed = parseTypedMeasurements(typed, measurementSites)
    const hasMeasurements = Object.keys(parsed.values).length > 0

    if (parsed.invalid) {
      toast.error(t('umfaenge_invalid'))
      return
    }

    if (muscleMass != null && !isValidMuscleMass(muscleMass)) {
      toast.error(t('fortschritt_muscle_mass_invalid'))
      return
    }

    if (!hasWellness && !hasWeight && !hasMeasurements) {
      toast.error(t('fortschritt_need_value'))
      return
    }

    // Erst prüfen, dann schreiben: ein ungültiges Gewicht darf nicht nach
    // bereits gespeicherten Tageswerten auffallen.
    if (hasWeight && !Number.isFinite(weight)) {
      toast.error(t('fortschritt_weight_invalid'))
      return
    }

    setSaving(true)

    if (hasWellness) {
      const payload: Record<string, unknown> = {
        user_id: user.id,
        log_date: date,
        energie,
        schlaf,
        wohlbefinden,
        libido,
        body_fat_pct: bodyFat,
      }
      const upsertDaily = (row: Record<string, unknown>) => supabase
        .from('daily_logs')
        .upsert(row, { onConflict: 'user_id,log_date' })
      let { error } = await upsertDaily({ ...payload, muscle_mass_kg: muscleMass })
      // Vor der Migration Profil 2a fehlt die Spalte: ohne Muskelmasse geht es trotzdem.
      if (isMissingColumn(error) && muscleMass == null) ({ error } = await upsertDaily(payload))
      if (error) {
        setSaving(false)
        reportError(error, 'fortschritt.daily-log-save')
        toast.error(t('fortschritt_save_failed'))
        return
      }
    }

    let savedWeightRowId = weightRowId

    // Zwei Tabellen, keine Transaktion: scheitert das Gewicht nach den
    // Tageswerten, bleibt das Sheet offen und sagt genau das. Erneutes
    // Speichern legt nichts doppelt an — Tageswerte sind ein Upsert pro
    // Datum, und vor dem Einfügen des Gewichts wird nach der Zeile gesucht.
    const weightFailed = (error: unknown) => {
      setSaving(false)
      reportError(error, 'fortschritt.weight-save')
      if (hasWellness) {
        partiallySavedRef.current = true
        toast.error(t('fortschritt_weight_partial_failed'))
      } else {
        toast.error(t('fortschritt_weight_save_failed'))
      }
    }

    if (hasWeight) {
      const kg = weight
      const loggedAt = `${date}T12:00:00`
      if (!savedWeightRowId) {
        // Kam die Antwort eines früheren Versuchs nicht an, steht die Zeile
        // vielleicht schon da — dann aktualisieren statt doppelt einfügen.
        const { data: existing, error } = await supabase
          .from('weight_logs')
          .select('id')
          .eq('user_id', user.id)
          .eq('logged_at', loggedAt)
          .limit(1)
          .maybeSingle()
        if (error) {
          weightFailed(error)
          return
        }
        if (existing?.id != null) savedWeightRowId = String(existing.id)
      }
      if (savedWeightRowId) {
        const { error } = await supabase.from('weight_logs').update({ weight_kg: kg }).eq('id', savedWeightRowId)
        if (error) {
          weightFailed(error)
          return
        }
      } else {
        const { data, error } = await supabase.from('weight_logs').insert({
          user_id: user.id,
          logged_at: loggedAt,
          weight_kg: kg,
        }).select('id').single()
        if (error) {
          weightFailed(error)
          return
        }
        savedWeightRowId = data?.id != null ? String(data.id) : null
      }
    }

    // Zuletzt: Tageswerte und Gewicht stehen dann schon. Scheitert das hier,
    // bleibt das Sheet offen; erneutes Speichern ist ein Upsert pro Stelle.
    if (hasMeasurements) {
      const { error } = await supabase
        .from('body_measurements')
        .upsert(measurementRowsToSave(user.id, date, parsed.values), {
          onConflict: 'user_id,measured_on,site',
        })
      if (error) {
        setSaving(false)
        reportError(error, 'fortschritt.measurements-save')
        if (hasWellness || hasWeight) partiallySavedRef.current = true
        toast.error(t('umfaenge_save_failed'))
        return
      }
    }

    const nextSavedValues: SavedLogFormValues = {
      date,
      energie,
      schlaf,
      wohlbefinden,
      libido,
      bodyFat,
      muscleMass,
      weight,
      weightRowId: savedWeightRowId,
    }
    setSavedValues(nextSavedValues)
    writeStoredSavedValues(user.id, nextSavedValues)
    // Profilwerte (Gewicht, KFA, Muskelmasse, Umfaenge, Streak) neu rechnen lassen.
    requestProfileSnapshot()
    toast.success(t('fortschritt_saved'))
    await onSaved()
    partiallySavedRef.current = false
    setSaving(false)
    // Der Haken bestätigt, bevor das Sheet hinausfährt (300 ms, Bewegung reduziert: sofort).
    setSaved(true)
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    await new Promise(resolve => setTimeout(resolve, reduce ? 0 : 320))
    onClose()
  }

  /** Unten → oben: häufigste Eingaben stehen zuletzt (Daumen-Zone). */
  const sliders = [
    { key: 'libido', label: t('fortschritt_metric_libido'), value: libido, set: setLibido },
    { key: 'wohlbefinden', label: t('fortschritt_metric_wohlbefinden'), value: wohlbefinden, set: setWohlbefinden },
    { key: 'schlaf', label: t('fortschritt_metric_schlaf_quality'), value: schlaf, set: setSchlaf },
    { key: 'energie', label: t('fortschritt_metric_energie'), value: energie, set: setEnergie },
  ]

  return createPortal(
    <>
      <style>{WELLNESS_SLIDER_CSS}{METRIC_WHEEL_CSS}</style>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="today-log-title"
        data-shown={shown}
        inert={!open}
        className="fs-sheet fixed inset-0 flex min-h-dvh flex-col overflow-hidden overflow-x-hidden overscroll-y-contain"
        style={{
          zIndex: SHEET_Z,
          background: SHEET_BG,
          width: '100%',
          maxWidth: '100vw',
          overscrollBehavior: 'none',
          touchAction: 'manipulation',
        }}
      >
        <div style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div aria-hidden style={{ flex: 1, minHeight: 24 }} />

          <div style={{
            flexShrink: 1,
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
            padding: 'max(20px, calc(env(safe-area-inset-top) + 12px)) 14px 4px',
            background: SHEET_BG,
          }}>
            <h2
              id="today-log-title"
              style={{
                fontSize: '1.05rem',
                fontWeight: 900,
                color: 'var(--text)',
                marginBottom: 10,
              }}
            >
              {t('fortschritt_log_title')}
            </h2>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 12,
              padding: '10px 12px',
              borderRadius: 14,
              background: 'var(--surface-input)',
              border: '1px solid var(--border)',
            }}>
              <label style={{ ...fieldLabel, marginBottom: 0, flexShrink: 0 }}>{t('fortschritt_date')}</label>
              <input
                type="date"
                value={date}
                max={todayStr()}
                onChange={e => { setDate(e.target.value); setTyped({}) }}
                style={dateFieldStyle}
              />
            </div>

            {sliders.map(s => (
              <WellnessSliderRow
                key={s.key}
                label={s.label}
                value={s.value}
                onChange={s.set}
              />
            ))}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', alignItems: 'end', gap: 8, marginTop: 4 }}>
              <MetricWheelPicker
                label={t('fortschritt_metric_weight')}
                unit="kg"
                value={weight}
                onChange={setWeight}
                min={40}
                max={200}
                placeholder={formatNumber(82.5)}
                defaultValue={82.5}
                open={openMetric === 'weight'}
                onOpenChange={next => setOpenMetric(next ? 'weight' : null)}
              />
              <MetricWheelPicker
                label={t('fortschritt_metric_body_fat_short')}
                unit="%"
                value={bodyFat}
                onChange={setBodyFat}
                min={3}
                max={60}
                placeholder={`${formatNumber(18.5)} %`}
                defaultValue={18.5}
                wheelSuffix="%"
                open={openMetric === 'bodyFat'}
                onOpenChange={next => setOpenMetric(next ? 'bodyFat' : null)}
              />
              <MetricWheelPicker
                label={t('fortschritt_metric_muscle_mass')}
                unit="kg"
                value={muscleMass}
                onChange={setMuscleMass}
                min={MUSCLE_MASS_MIN_KG}
                max={MUSCLE_MASS_MAX_KG}
                placeholder={formatNumber(38.5)}
                defaultValue={38.5}
                open={openMetric === 'muscleMass'}
                onOpenChange={next => setOpenMetric(next ? 'muscleMass' : null)}
              />
            </div>

            <MeasurementSection
              sites={measurementSites}
              entries={measurements}
              date={date}
              typed={typed}
              onTyped={(site, text) => setTyped(prev => ({ ...prev, [site]: text }))}
              onSitesChange={onMeasurementSitesChange}
            />
          </div>
        </div>

        <footer style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 14px max(8px, env(safe-area-inset-bottom))',
          borderTop: '1px solid var(--border)',
          background: SHEET_BG,
        }}>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || saved}
            className="lg-btn lg-btn-primary"
            data-state={saved ? 'done' : saving ? 'busy' : 'idle'}
            aria-live="polite"
            style={{ flex: 1, minWidth: 0 }}
          >
            {saved
              ? <><Check size={20} strokeWidth={3} aria-hidden className="lg-pop" />{t('fortschritt_saved_short')}</>
              : saving
                ? <><span className="lg-spinner" aria-hidden />{t('fortschritt_saving')}</>
                : t('fortschritt_save_entry')}
          </button>
          <button
            type="button"
            onClick={onClose}
            data-app-back-close
            aria-label={t('close')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 48,
              height: 48,
              flexShrink: 0,
              borderRadius: 24,
              border: '1px solid var(--border)',
              background: 'var(--surface-input)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </footer>
      </div>
    </>,
    document.body,
  )
}
