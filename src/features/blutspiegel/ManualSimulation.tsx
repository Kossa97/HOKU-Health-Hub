/**
 * Manuelle Simulation: theoretischer Verlauf einer (oder mehrerer) Gaben fuer
 * ein PK-Profil — derselbe Graph wie der Live-Spiegel, X-Achse in Stunden
 * nach der ersten Gabe.
 */
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Activity, ChevronDown } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { denyProps } from '../../lib/denyFeedback'
import { fractionEliminatedPerHour } from '../../lib/pkModel'
import { runSimulation, type PkProfile, type SimResult } from './simulation'
import { pickNiceTicks } from '../../components/liveCycleChart/chartMath'
import { StocksChart, type ChartMarker } from './chart/StocksChart'
import { useBlutspiegelFormat } from './format'
import type { LevelPoint } from './chart/stocksChartMath'

const HOUR = 3_600_000

// ── Oberflaeche ───────────────────────────────────────────────────────────

const LABEL: CSSProperties = { fontSize: 13, fontWeight: 500, color: 'var(--lg-text-3)', display: 'block', marginBottom: 8, paddingLeft: 4 }
const INPUT: CSSProperties = {
  width: '100%', minHeight: 44, padding: '10px 12px', borderRadius: 12, boxSizing: 'border-box',
  background: 'var(--lg-fill)', border: 'none', color: 'var(--lg-text)',
  fontSize: 16, fontWeight: 500, fontFamily: 'inherit',
}

/** Akzent des gewählten Looks als #rrggbb für den Canvas-Graphen (der kann keine CSS-Variablen). */
function lookAccent(): string {
  const v = typeof document === 'undefined' ? '' : getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
  return /^#[0-9a-f]{6}$/i.test(v) ? v : '#00ccf5'
}

const hourTicks = (start: number, end: number, widthPx: number) => {
  const ticks = pickNiceTicks(start / HOUR, end / HOUR, widthPx, 56).map(h => h * HOUR)
  return { ticks, step: ticks.length > 1 ? ticks[1] - ticks[0] : HOUR }
}

export function ManualSimulation({ preselectProfileId, startOffen = false }: { preselectProfileId: string | null; /** Eigene Seite: gleich aufgeklappt. */ startOffen?: boolean }) {
  const { t } = useTranslation()
  const f = useBlutspiegelFormat()
  const [profiles, setProfiles] = useState<PkProfile[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [dose, setDose] = useState('')
  const [unit, setUnit] = useState<'mg' | 'mcg' | 'IU'>('mcg')
  const [route, setRoute] = useState<'SC' | 'IM' | 'oral'>('SC')
  const [multiDose, setMultiDose] = useState(false)
  const [interval, setIntervalH] = useState('8')
  const [numDoses, setNumDoses] = useState('3')
  // Das Ergebnis haelt fest, womit gerechnet wurde — spaetere Eingaben
  // aendern Kurve und Beschriftung erst nach erneutem „Starten".
  const [run, setRun] = useState<{ sim: SimResult; profile: PkProfile; multiDose: boolean; key: string } | null>(null)
  const [open, setOpen] = useState(startOffen)
  const [scrub, setScrub] = useState<LevelPoint | null>(null)

  useEffect(() => {
    let cancelled = false
    void supabase.from('pk_profiles').select('*').order('name').then(({ data }) => {
      if (cancelled) return
      const list = (data as PkProfile[]) ?? []
      setProfiles(list)
      setSelectedId(preselectProfileId && list.some(p => p.id === preselectProfileId) ? preselectProfileId : list[0]?.id ?? '')
    })
    return () => { cancelled = true }
  }, [preselectProfileId])

  const profile = profiles.find(p => p.id === selectedId) ?? null

  const start = useCallback(() => {
    if (!profile) return
    setScrub(null)
    const count = Math.min(10, Math.max(1, Number(numDoses)))
    setRun({
      sim: runSimulation(profile, multiDose, Number(interval), count),
      profile,
      multiDose,
      key: `${profile.id}:${multiDose}:${interval}:${count}`,
    })
  }, [profile, multiDose, interval, numDoses])

  const result = run?.sim ?? null
  const scrubLabel = useMemo(() => ({
    date: (ts: number) => t('pk_hours_value', { h: f.num(Math.round((ts / HOUR) * 10) / 10) }),
    value: (v: number) => `${f.pct(v)} %`,
  }), [t, f])
  const points = useMemo(() => result?.data.map(p => ({ ts: p.t * HOUR, level: p.c })) ?? [], [result])

  const markers = useMemo((): ChartMarker[] => {
    if (!result) return []
    const onset = result.data.find(p => p.c >= 25)
    const list: ChartMarker[] = [
      ...(onset ? [{ ts: onset.t * HOUR, label: t('pk_legend_onset'), color: '#06b6d4' }] : []),
      { ts: result.tmaxActual * HOUR, label: t('pk_legend_peak'), color: '#f59e0b' },
    ]
    if (result.t10 < result.xMax) list.push({ ts: result.t10 * HOUR, label: t('pk_marker_end'), color: '#9aa6bf' })
    return list
  }, [result, t])

  const hours = (h: number) => Math.round(h * 10) / 10

  return (
    <section>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', minHeight: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'none', border: 'none', padding: '0 4px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
        }}
      >
        <span>
          <span className="lg-title2" style={{ display: 'block' }}>{t('pk_manual_title')}</span>
          {!open && <span style={{ display: 'block', fontSize: 13, color: 'var(--lg-text-2)', marginTop: 2 }}>{t('pk_manual_tap')}</span>}
        </span>
        <ChevronDown size={18} strokeWidth={1.5} style={{ color: 'var(--lg-text-3)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s cubic-bezier(0.22, 1, 0.36, 1)' }} />
      </button>

      {open && (
        <div className="lg-surface" style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16 }}>
          <p style={{ fontSize: 15, color: 'var(--lg-text-2)', lineHeight: 1.45 }}>{t('pk_manual_intro')}</p>

          <div>
            <label style={LABEL} htmlFor="sim-profile">{t('pk_field_substance')}</label>
            {profiles.length === 0 ? (
              <p style={{ fontSize: 14, color: 'var(--lg-text-2)' }}>{t('pk_no_profiles')}</p>
            ) : (
              <select id="sim-profile" value={selectedId} onChange={e => setSelectedId(e.target.value)} style={INPUT}>
                {profiles.map(p => <option key={p.id} value={p.id}>{p.name} — T½ {p.half_life_hours}h</option>)}
              </select>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8 }}>
            <div>
              <label style={LABEL} htmlFor="sim-dose">{t('pk_field_dose')}</label>
              <input id="sim-dose" type="number" inputMode="decimal" placeholder={t('pk_field_dose_placeholder')}
                value={dose} onChange={e => setDose(e.target.value)} style={INPUT} />
            </div>
            <div>
              <label style={LABEL} htmlFor="sim-unit">{t('pk_field_unit')}</label>
              <select id="sim-unit" value={unit} onChange={e => setUnit(e.target.value as 'mg' | 'mcg' | 'IU')} style={{ ...INPUT, width: 'auto' }}>
                <option>mcg</option><option>mg</option><option>IU</option>
              </select>
            </div>
            <div>
              <label style={LABEL} htmlFor="sim-route">{t('pk_field_route')}</label>
              <select id="sim-route" value={route} onChange={e => setRoute(e.target.value as 'SC' | 'IM' | 'oral')} style={{ ...INPUT, width: 'auto' }}>
                <option>SC</option><option>IM</option><option>oral</option>
              </select>
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 44, cursor: 'pointer' }}>
            <span>
              <span style={{ display: 'block', fontSize: 16, fontWeight: 500, color: 'var(--lg-text)' }}>{t('pk_multi_title')}</span>
              <span style={{ display: 'block', fontSize: 13, color: 'var(--lg-text-2)', marginTop: 2 }}>{t('pk_multi_sub')}</span>
            </span>
            <input type="checkbox" role="switch" checked={multiDose} onChange={e => setMultiDose(e.target.checked)}
              style={{ width: 22, height: 22, accentColor: 'var(--accent)' }} />
          </label>

          {multiDose && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={LABEL} htmlFor="sim-interval">{t('pk_interval_label')}</label>
                <input id="sim-interval" type="number" value={interval} onChange={e => setIntervalH(e.target.value)} style={INPUT} />
              </div>
              <div>
                <label style={LABEL} htmlFor="sim-count">{t('pk_num_doses_label')}</label>
                <input id="sim-count" type="number" min="2" max="10" value={numDoses} onChange={e => setNumDoses(e.target.value)} style={INPUT} />
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={start}
            {...denyProps(!profile, t('pk_select_first'))}
            className="lg-btn lg-btn-primary w-full"
          >
            <Activity size={18} strokeWidth={1.5} /> {t('pk_start')}
          </button>

          {result && run && (() => { const profile = run.profile; const multiDose = run.multiDose; return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
              <div>
                <p style={{ fontSize: 17, fontWeight: 500, color: 'var(--lg-text)' }}>{t('pk_curve_title', { name: profile.name })}</p>
                <p style={{ fontSize: 13, color: 'var(--lg-text-2)', marginTop: 2 }}>{t('pk_curve_sub')}</p>
                <p className="sr-only" aria-live="polite">
                  {scrub ? `${scrubLabel.date(scrub.ts)}: ${scrubLabel.value(scrub.level)}` : ''}
                </p>
              </div>
              <StocksChart
                points={points}
                start={0}
                end={result.xMax * HOUR}
                accent={lookAccent()}
                height={300}
                seriesKey={run.key}
                markers={markers}
                formatTick={ts => `${f.num(Math.round(ts / HOUR))} h`}
                xTicks={hourTicks}
                formatValue={f.num}
                onScrub={setScrub}
                scrubLabel={scrubLabel}
                ariaLabel={t('pk_curve_title', { name: profile.name })}
              />

              <p style={{ fontSize: 17, fontWeight: 500, color: 'var(--lg-text)', marginTop: 8 }}>{t('pk_results_title')}</p>
              <p style={{ fontSize: 13, color: 'var(--lg-text-2)' }}>
                <Trans i18nKey="pk_results_intro" values={{ name: profile.name }} components={{ b: <strong style={{ color: 'var(--lg-text)', fontWeight: 500 }} /> }} />
              </p>
              <div className="lg-rows" style={{ borderRadius: 12, background: 'var(--lg-surface-2)', overflow: 'hidden' }}>
                {[
                  { label: t('pk_res_peak_label'), value: '100 %', explain: t('pk_res_peak_explain') },
                  { label: t('pk_res_tmax_label', { h: f.num(hours(result.tmaxActual)) }), value: t('pk_hours_value', { h: f.num(hours(result.tmaxActual)) }), explain: t('pk_res_tmax_explain', { h: f.num(hours(result.tmaxActual)) }) },
                  { label: t('pk_res_half_label', { h: f.num(profile.half_life_hours) }), value: t('pk_hours_value', { h: f.num(profile.half_life_hours) }),
                    explain: t('pk_res_half_explain', { h: f.num(profile.half_life_hours), h2: f.num(profile.half_life_hours * 2), h5: f.num(profile.half_life_hours * 5) }) },
                  { label: t('pk_res_duration_label'),
                    value: result.t10 < result.xMax ? t('pk_hours_value', { h: f.num(hours(result.t10)) }) : t('pk_hours_over', { h: f.num(Math.round(result.xMax)) }),
                    explain: t('pk_res_duration_explain') },
                  { label: t('pk_res_f_label', { pct: Math.round(profile.bioavailability_sc * 100) }), value: `${Math.round(profile.bioavailability_sc * 100)} %`,
                    explain: t('pk_res_f_explain', { pct: Math.round(profile.bioavailability_sc * 100) }) },
                  { label: t('pk_res_vd_label', { vd: profile.vd_l_kg != null ? `${f.num(profile.vd_l_kg)} L/kg` : '—' }), value: profile.vd_l_kg != null ? `${f.num(profile.vd_l_kg)} L/kg` : '—',
                    explain: `${t('pk_stat_vd_sub')} ${profile.vd_l_kg != null && profile.vd_l_kg > 1 ? t('pk_res_vd_high') : t('pk_res_vd_low')}` },
                  { label: t('pk_res_ke_label', { ke: (Math.LN2 / profile.half_life_hours).toFixed(3) }), value: `${(Math.LN2 / profile.half_life_hours).toFixed(3)} /h`,
                    explain: t('pk_stat_ke_sub', { pct: f.pct(fractionEliminatedPerHour(profile.half_life_hours) * 100) }) },
                  ...(multiDose ? [{
                    label: t('pk_res_accum_label', { f: result.accumFactor.toFixed(2) }), value: `${result.accumFactor.toFixed(2)}×`,
                    explain: `${t('pk_res_accum_explain', { f: result.accumFactor.toFixed(2) })} ${result.accumFactor > 2 ? t('pk_res_accum_strong') : result.accumFactor > 1.5 ? t('pk_res_accum_noticeable') : t('pk_res_accum_low')}`,
                  }] : []),
                ].map(row => (
                  <div key={row.label} style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <span style={{ fontSize: 15, color: 'var(--lg-text)' }}>{row.label}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 400, color: 'var(--lg-text)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{row.value}</span>
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: 13, lineHeight: 1.5, color: 'var(--lg-text-2)' }}>{row.explain}</p>
                  </div>
                ))}
              </div>
              {profile.notes && (
                <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--lg-text-2)' }}>
                  <strong style={{ color: 'var(--lg-text)', fontWeight: 500 }}>{t('pk_note_prefix')}</strong>{profile.notes}
                </p>
              )}
            </div>
          ) })()}
        </div>
      )}
    </section>
  )
}
