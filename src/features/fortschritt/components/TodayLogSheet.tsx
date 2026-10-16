import { useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { format } from 'date-fns'
import { X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../context/AuthContext'
import { reportError } from '../../../lib/monitoring'
import type { DailyLogEntry, WeightLogEntry } from '../types'
import { fieldLabel } from '../styles'
import { dateFieldStyle, WELLNESS_SLIDER_CSS, WellnessSliderRow } from './WellnessSliderRow'
import { METRIC_WHEEL_CSS, MetricWheelPicker } from './MetricWheelPicker'
import {
  loadLogFormValues,
  type SavedLogFormValues,
} from '../lib/metricDefaults'
import { useScrollLock } from '../hooks/useScrollLock'
import { formatNumber } from '../lib/dates'

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
  open: boolean
  onClose: () => void
  onSaved: () => void | Promise<void>
}

export function TodayLogSheet({ logs, weightLogs, open, onClose, onSaved }: Props) {
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
  const [saving, setSaving] = useState(false)
  const [openMetric, setOpenMetric] = useState<'weight' | 'bodyFat' | null>(null)
  const [savedValues, setSavedValues] = useState<SavedLogFormValues | null>(null)

  useScrollLock(open)

  useEffect(() => {
    if (!open) setOpenMetric(null)
  }, [open])

  useEffect(() => {
    if (!open) return
    setSavedValues(readStoredSavedValues(user?.id))
  }, [open, user?.id])
  useLayoutEffect(() => {
    if (open) setDate(todayStr())
  }, [open])

  useEffect(() => {
    if (!open) return
    const values = loadLogFormValues(logs, weightLogs, date, savedValues)
    setEnergie(values.energie)
    setSchlaf(values.schlaf)
    setWohlbefinden(values.wohlbefinden)
    setLibido(values.libido)
    setBodyFat(values.bodyFat)
    setWeight(values.weight)
    setWeightRowId(values.weightRowId)
  }, [date, logs, weightLogs, open, savedValues])

  if (!open) return null

  const save = async () => {
    if (!user) return

    const hasWellness =
      energie != null || schlaf != null || wohlbefinden != null || libido != null || bodyFat != null
    const hasWeight = weight != null

    if (!hasWellness && !hasWeight) {
      toast.error(t('fortschritt_need_value'))
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
      const { error } = await supabase
        .from('daily_logs')
        .upsert(payload, { onConflict: 'user_id,log_date' })
      if (error) {
        setSaving(false)
        reportError(error, 'fortschritt.daily-log-save')
        toast.error(t('fortschritt_save_failed'))
        return
      }
    }

    let savedWeightRowId = weightRowId

    if (hasWeight) {
      const kg = weight
      if (!Number.isFinite(kg)) {
        setSaving(false)
        toast.error(t('fortschritt_weight_invalid'))
        return
      }
      if (weightRowId) {
        const { error } = await supabase.from('weight_logs').update({ weight_kg: kg }).eq('id', weightRowId)
        if (error) {
          setSaving(false)
          reportError(error, 'fortschritt.weight-save')
          toast.error(t('fortschritt_weight_save_failed'))
          return
        }
      } else {
        const { data, error } = await supabase.from('weight_logs').insert({
          user_id: user.id,
          logged_at: `${date}T12:00:00`,
          weight_kg: kg,
        }).select('id').single()
        if (error) {
          setSaving(false)
          reportError(error, 'fortschritt.weight-save')
          toast.error(t('fortschritt_weight_save_failed'))
          return
        }
        savedWeightRowId = data?.id != null ? String(data.id) : null
      }
    }

    const nextSavedValues: SavedLogFormValues = {
      date,
      energie,
      schlaf,
      wohlbefinden,
      libido,
      bodyFat,
      weight,
      weightRowId: savedWeightRowId,
    }
    setSavedValues(nextSavedValues)
    writeStoredSavedValues(user.id, nextSavedValues)
    toast.success(t('fortschritt_saved'))
    await onSaved()
    setSaving(false)
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
        className="fixed inset-0 flex min-h-dvh flex-col overflow-hidden overflow-x-hidden overscroll-y-contain"
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
            flexShrink: 0,
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
                onChange={e => setDate(e.target.value)}
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
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
            </div>
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
            disabled={saving}
            className="btn-primary"
            style={{ flex: 1, minWidth: 0 }}
          >
            {saving ? t('fortschritt_saving') : t('save')}
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
              width: 40,
              height: 40,
              flexShrink: 0,
              borderRadius: 10,
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
