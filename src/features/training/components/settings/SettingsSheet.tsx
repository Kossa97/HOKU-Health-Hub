import { useState, type CSSProperties, type ReactNode } from 'react'
import toast from 'react-hot-toast'
import { RefreshCw, ShieldCheck } from 'lucide-react'
import { isAndroid, isIOS, isNative, requestPermissions } from '../../../../lib/health'
import { requestNotificationPermission, useNotificationSupport } from '../../../../lib/notificationPermission'
import { NotificationHint } from '../../../../components/NotificationHint'
import type { TrainingData } from '../../hooks/useTrainingData'
import { useTrainingText, type TrainingTextKey } from '../../i18n'
import { formatNumber, parseDecimal } from '../../lib/format'
import { fromDisplayWeight, toDisplayWeight } from '../../lib/stats'
import type { TrainingSettings } from '../../types'
import { Button, Card, Chip, Field, TrainingSheet, inputStyle } from '../ui'
import { ExportSection, ImportSection } from './DataSection'
import { SectionHeading, Switch } from './parts'
import { hintStyle, noteStyle } from './styles'

const REST_OPTIONS_S = [0, 30, 60, 90, 120, 180, 240] as const
const WEEKLY_GOALS = [1, 2, 3, 4, 5, 6, 7] as const
const STANDARD_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25, 0.5] as const
const MAX_BAR_KG = 50

const rowStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8 }
const cardStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 16 }

function restLabel(seconds: number, off: string): string {
  if (seconds === 0) return off
  if (seconds < 60) return `${seconds} s`
  const min = Math.floor(seconds / 60)
  const sec = seconds % 60
  return sec ? `${min}:${String(sec).padStart(2, '0')} min` : `${min} min`
}

export function SettingsSheet({ data, onClose }: { data: TrainingData; onClose: () => void }) {
  const { tt, locale } = useTrainingText()
  const { settings } = data
  const [busy, setBusy] = useState(false)

  function save(patch: Partial<TrainingSettings>): Promise<void> {
    return data.updateSettings({ ...settings, ...patch }).catch(() => {
      toast.error(tt('settings_save_error'))
    })
  }

  return (
    <TrainingSheet title={tt('settings_title')} onClose={onClose} tall busy={busy}>
      <GeneralSection settings={settings} save={save} locale={locale} />
      <HealthSection data={data} save={save} />
      <Glp1Section data={data} save={save} />
      <ImportSection data={data} onBusyChange={setBusy} />
      <ExportSection data={data} />

      <section aria-labelledby="training-settings-privacy">
        <SectionHeading id="training-settings-privacy">{tt('settings_section_privacy')}</SectionHeading>
        <Card style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <ShieldCheck size={20} aria-hidden="true" style={{ flexShrink: 0, color: 'var(--lg-text-3)', marginTop: 2 }} />
          <p style={{ ...hintStyle, color: 'var(--lg-text-3)' }}>{tt('settings_privacy_text')}</p>
        </Card>
      </section>
    </TrainingSheet>
  )
}

type Save = (patch: Partial<TrainingSettings>) => Promise<void>

function GeneralSection({ settings, save, locale }: { settings: TrainingSettings; save: Save; locale: string }) {
  const notificationSupport = useNotificationSupport()
  const { tt } = useTrainingText()
  const { unit } = settings
  const plates = [...new Set([...STANDARD_PLATES_KG, ...settings.platesKg])].sort((a, b) => b - a)
  const barDisplay = String(toDisplayWeight(settings.barKg, unit))

  function commitBar(input: HTMLInputElement) {
    const value = parseDecimal(input.value)
    const kg = value == null ? null : fromDisplayWeight(value, unit)
    if (kg == null || kg < 0 || kg > MAX_BAR_KG) {
      toast.error(tt('settings_bar_invalid'))
      input.value = barDisplay
      return
    }
    if (Math.abs(kg - settings.barKg) < 0.001) return
    void save({ barKg: kg })
  }

  function togglePlate(kg: number) {
    const next = settings.platesKg.includes(kg)
      ? settings.platesKg.filter(p => p !== kg)
      : [...settings.platesKg, kg].sort((a, b) => b - a)
    void save({ platesKg: next })
  }

  return (
    <section aria-labelledby="training-settings-general">
      <SectionHeading id="training-settings-general">{tt('settings_section_general')}</SectionHeading>
      <Card style={cardStyle}>
        <ChipGroup label={tt('settings_unit')}>
          <Chip active={unit === 'kg'} onClick={() => unit !== 'kg' && void save({ unit: 'kg' })}>kg</Chip>
          <Chip active={unit === 'lb'} onClick={() => unit !== 'lb' && void save({ unit: 'lb' })}>lb</Chip>
        </ChipGroup>

        <ChipGroup label={tt('settings_rest')} hint={tt('settings_rest_hint')}>
          {REST_OPTIONS_S.map(s => (
            <Chip key={s} active={settings.defaultRestS === s} onClick={() => void save({ defaultRestS: s })}>
              {restLabel(s, tt('settings_rest_off'))}
            </Chip>
          ))}
        </ChipGroup>
        <Switch checked={settings.restSound} onChange={next => void save({ restSound: next })} label={tt('rest_sound')} />
        <Switch
          checked={settings.restNotify}
          onChange={next => {
            // Erlaubnis nur auf ausdruecklichen Wunsch und aus dem Tippen heraus
            if (next) void requestNotificationPermission()
            void save({ restNotify: next })
          }}
          label={tt('rest_notify')}
        />
        {settings.restNotify && <NotificationHint state={notificationSupport} />}

        <ChipGroup
          label={tt('settings_weekly_goal')}
          hint={settings.weeklyGoal === 1
            ? tt('settings_weekly_goal_hint_one')
            : tt('settings_weekly_goal_hint', { count: settings.weeklyGoal })}
        >
          {WEEKLY_GOALS.map(n => (
            <Chip key={n} active={settings.weeklyGoal === n} onClick={() => void save({ weeklyGoal: n })}>
              <span style={{ display: 'inline-block', minWidth: 12, textAlign: 'center' }}>{n}</span>
            </Chip>
          ))}
        </ChipGroup>

        <Field label={`${tt('settings_bar')} (${unit})`} hint={tt('settings_bar_hint')}>
          <input
            key={`${unit}-${settings.barKg}`}
            defaultValue={barDisplay}
            inputMode="decimal"
            enterKeyHint="done"
            autoComplete="off"
            className="tyd-train-input"
            style={{ ...inputStyle, maxWidth: 160, fontVariantNumeric: 'tabular-nums' }}
            onBlur={event => commitBar(event.currentTarget)}
            onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }}
          />
        </Field>

        <ChipGroup label={tt('settings_plates')} hint={tt('settings_plates_hint')}>
          {plates.map(kg => (
            <Chip key={kg} active={settings.platesKg.includes(kg)} onClick={() => togglePlate(kg)}>
              {formatNumber(kg, locale, 2)} kg
            </Chip>
          ))}
        </ChipGroup>
      </Card>
    </section>
  )
}

function ChipGroup({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span className="label" style={{ marginBottom: 0 }}>{label}</span>
      <div style={rowStyle}>{children}</div>
      {hint && <span style={{ fontSize: 13, color: 'var(--lg-text-3)', paddingInline: 4 }}>{hint}</span>}
    </div>
  )
}

function HealthSection({ data, save }: { data: TrainingData; save: Save }) {
  const { tt } = useTrainingText()
  const enabled = data.settings.healthImport
  const [pending, setPending] = useState(false)
  const [note, setNote] = useState<TrainingTextKey | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)

  async function toggle(next: boolean) {
    // Ausschalten geht immer — auch im Browser, die Einstellung gilt fuer alle Geraete.
    if (!next) { setNote(null); await save({ healthImport: false }); return }
    if (!isNative) { setNote('settings_health_web'); return }
    setPending(true)
    try {
      const result = await requestPermissions()
      if (!result.available) { setNote('settings_health_unavailable'); return }
      if (!result.granted && !result.grantedPermissions?.length) { setNote('settings_health_denied'); return }
      setNote(null)
      await save({ healthImport: true })
    } catch {
      setNote('settings_health_unavailable')
    } finally {
      setPending(false)
    }
  }

  async function syncNow() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const { created, enriched } = await data.syncHealthWorkouts()
      const text = tt('settings_health_sync_result', { created, enriched })
      setSyncResult(text)
      toast.success(text)
    } catch {
      toast.error(tt('settings_health_sync_error'))
    } finally {
      setSyncing(false)
    }
  }

  const platformHint: TrainingTextKey = !isNative
    ? 'settings_health_web'
    : isAndroid ? 'settings_health_hint_android' : 'settings_health_hint_ios'

  return (
    <section aria-labelledby="training-settings-health">
      <SectionHeading id="training-settings-health">{tt('settings_section_health')}</SectionHeading>
      <Card style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Switch
          checked={enabled}
          onChange={next => void toggle(next)}
          label={tt('settings_health_toggle')}
          disabled={pending}
        />
        <p style={hintStyle}>{tt(platformHint)}</p>
        {note && note !== platformHint && <p role="status" style={noteStyle}>{tt(note)}</p>}
        {/* Nur iOS liest Workouts; auf Android gaebe der Knopf immer „0 neu". */}
        {enabled && isIOS && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Button tone="ghost" onClick={syncNow} disabled={syncing}>
              <RefreshCw size={16} aria-hidden="true" />
              {syncing ? tt('settings_health_syncing') : tt('settings_health_sync')}
            </Button>
            {syncResult && <span role="status" style={hintStyle}>{syncResult}</span>}
          </div>
        )}
      </Card>
    </section>
  )
}

function Glp1Section({ data, save }: { data: TrainingData; save: Save }) {
  const { tt } = useTrainingText()
  const mode = data.settings.glp1Mode
  const names = data.context.glp1Names.filter(Boolean)
  const options: Array<{ value: boolean | null; key: TrainingTextKey }> = [
    { value: null, key: 'settings_glp1_auto' },
    { value: true, key: 'settings_glp1_on' },
    { value: false, key: 'settings_glp1_off' },
  ]

  return (
    <section aria-labelledby="training-settings-glp1">
      <SectionHeading id="training-settings-glp1">{tt('settings_section_glp1')}</SectionHeading>
      <Card style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={hintStyle}>{tt('settings_glp1_hint')}</p>
        <div role="group" aria-label={tt('settings_section_glp1')} style={rowStyle}>
          {options.map(option => (
            <Chip
              key={option.key}
              active={mode === option.value}
              onClick={() => mode !== option.value && void save({ glp1Mode: option.value })}
            >
              {tt(option.key)}
            </Chip>
          ))}
        </div>
        {mode === null && (
          <p role="status" style={{ ...hintStyle, overflowWrap: 'anywhere' }}>
            {names.length > 0
              ? tt('settings_glp1_detected', { names: names.join(', ') })
              : tt('settings_glp1_not_detected')}
          </p>
        )}
      </Card>
    </section>
  )
}
