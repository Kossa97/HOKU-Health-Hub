import { useEffect, useState } from 'react'
import { Flame, Gauge, HeartPulse, Wind, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { isNative } from '../../../lib/health'
import { supabase } from '../../../lib/supabase'
import { useHealthStoreConsent } from '../hooks/useHealthStoreConsent'
import type { HealthDailyRow } from '../lib/healthDaily'
import { HealthStoreConsentSheet } from './HealthStoreConsentSheet'

type DailyValues = Pick<HealthDailyRow, 'day' | 'active_kcal' | 'spo2_pct' | 'resp_rate' | 'bp_sys' | 'bp_dia'>

/** Der erste Abgleich nach der Einwilligung laeuft im Sheet im Hintergrund; so lange danach wird einmal neu gelesen. */
const FIRST_SYNC_REFETCH_MS = 4000

/** So weit zurueck wird nach dem letzten Wert gesucht (eine Zeile je Tag). */
const LOOKBACK_DAYS = 90

const num = (v: unknown): number | null => (v == null ? null : Number.isFinite(Number(v)) ? Number(v) : null)

/**
 * Vier Werte aus `health_daily` (aktive Energie, SpO2, Atemfrequenz, Blutdruck):
 * je Wert der letzte Tag, der ihn hat, mit dem Datum klein darunter. Ohne
 * Einwilligung statt der Kacheln ein Hinweis, der die Einwilligung erfragt.
 */
export function HealthDailyTiles({ userId }: { userId: string }) {
  const { t, i18n } = useTranslation()
  const { consent, error: consentError, reload } = useHealthStoreConsent(userId)
  const [loaded, setLoaded] = useState<{ for: string; rows: DailyValues[] } | { for: string; failed: true } | null>(null)
  const [asking, setAsking] = useState(false)
  const [afterConsent, setAfterConsent] = useState(false)
  const [round, setRound] = useState(0)
  const granted = Boolean(consent)

  // Einmal nachlesen, wenn der erste Abgleich nach der Einwilligung fertig sein duerfte.
  useEffect(() => {
    if (!afterConsent) return
    const id = setTimeout(() => { setAfterConsent(false); setRound(n => n + 1) }, FIRST_SYNC_REFETCH_MS)
    return () => clearTimeout(id)
  }, [afterConsent])

  useEffect(() => {
    if (!granted) return
    let current = true
    // Select von health_daily geht ohne Einwilligung; hier nur mit, weil ohne der Hinweis erscheint.
    supabase.from('health_daily')
      .select('day, active_kcal, spo2_pct, resp_rate, bp_sys, bp_dia')
      .eq('user_id', userId).order('day', { ascending: false }).limit(LOOKBACK_DAYS)
      .then(({ data, error }) => {
        if (!current) return
        setLoaded(error ? { for: userId, failed: true } : { for: userId, rows: (data ?? []) as DailyValues[] })
      }, () => { if (current) setLoaded({ for: userId, failed: true }) })
    return () => { current = false }
  }, [userId, granted, round])

  if (consentError) {
    return (
      <div role="alert" className="card mt-3 flex items-center justify-between gap-3 text-[15px] text-[var(--lg-text)]">
        {t('health_consent_load_error')}
        <button type="button" data-quiet className="lg-gray-btn shrink-0" onClick={reload}>{t('lab_retry')}</button>
      </div>
    )
  }
  if (consent === undefined) return null

  // Im Web gibt es nichts zu erlauben (das Sheet fragt das System); wer am Handy zugestimmt hat, sieht die Kacheln trotzdem.
  if (!granted && !isNative) return null
  if (!granted) {
    return (
      <div className="lg-surface mt-3 space-y-3 p-4">
        <p className="text-[15px] leading-snug text-[var(--lg-text-2)]">{t('health_daily_hint')}</p>
        <button type="button" className="lg-btn lg-btn-tint" onClick={() => setAsking(true)}>{t('health_daily_hint_action')}</button>
        <HealthStoreConsentSheet
          open={asking}
          onDone={ok => { setAsking(false); if (ok) { reload(); setAfterConsent(true) } }}
        />
      </div>
    )
  }

  const lang = i18n.resolvedLanguage ?? i18n.language
  const number = new Intl.NumberFormat(lang, { maximumFractionDigits: 1 })
  const date = new Intl.DateTimeFormat(lang, { dateStyle: 'medium' })
  const state = loaded && loaded.for === userId ? loaded : null
  const rows = state && 'rows' in state ? state.rows : null

  const latest = (pick: (r: DailyValues) => string | null): { day: string; value: string } | null => {
    for (const r of rows ?? []) {
      const value = pick(r)
      if (value != null) return { day: r.day, value }
    }
    return null
  }
  const withUnit = (v: unknown, unit: string) => { const n = num(v); return n == null ? null : `${number.format(n)} ${unit}` }

  const defs: { key: string; icon: LucideIcon; color: string; label: string; hit: { day: string; value: string } | null }[] = [
    { key: 'kcal', icon: Flame, color: '#ff9f0a', label: t('health_daily_kcal'), hit: latest(r => withUnit(r.active_kcal, 'kcal')) },
    { key: 'spo2', icon: HeartPulse, color: '#0a84ff', label: t('health_daily_spo2'), hit: latest(r => withUnit(r.spo2_pct, '%')) },
    { key: 'resp', icon: Wind, color: '#30d158', label: t('health_daily_resp'), hit: latest(r => withUnit(r.resp_rate, '/min')) },
    {
      key: 'bp', icon: Gauge, color: '#ff375f', label: t('health_daily_bp'),
      hit: latest(r => {
        const sys = num(r.bp_sys), dia = num(r.bp_dia)
        return sys == null || dia == null ? null : `${number.format(sys)}/${number.format(dia)}`
      }),
    },
  ]

  return (
    <div className="mt-3 space-y-2" data-health-daily>
      {state && 'failed' in state && (
        <p role="alert" className="px-1 text-[13px] leading-snug text-[var(--lg-text-3)]">{t('health_daily_load_error')}</p>
      )}
      <div className="grid grid-cols-2 gap-3">
        {defs.map(d => (
          <div key={d.key} className="lg-surface flex min-h-[124px] flex-col justify-between gap-3 p-4">
            <span className="lg-icon-tile" style={{ background: d.color }}>
              <d.icon size={17} strokeWidth={2.4} aria-hidden="true" />
            </span>
            <div>
              <p className="text-[22px] font-semibold leading-tight tabular-nums text-[var(--lg-text)]">
                {state ? (d.hit?.value ?? '—') : '...'}
              </p>
              <p className="mt-1 text-[13px] text-[var(--lg-text-3)]">{d.label}</p>
              {d.hit && <p className="text-[12px] text-[var(--lg-text-4)]">{date.format(new Date(`${d.hit.day}T00:00:00`))}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
