import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Play, Settings } from 'lucide-react'
import type { TrainingRoutine, TrainingSession } from './types'
import { useTrainingText } from './i18n'
import { useTrainingData, type TrainingData } from './hooks/useTrainingData'
import { useActiveWorkout } from './hooks/useActiveWorkout'
import { useHealthConsentAsk } from './hooks/useHealthConsentAsk'
import { startWorkout, workoutFromSession, type ActiveWorkout } from './lib/activeWorkout'
import { formatClock } from './lib/format'
import { buildSuggestFn } from './lib/suggest'
import { Button, Card, TRAINING_ACCENT, TRAINING_CSS } from './components/ui'
import { TodayTab } from './components/today/TodayTab'
import { HistoryTab } from './components/history/HistoryTab'
import { SessionDetailSheet } from './components/history/SessionDetailSheet'
import { ProgressTab } from './components/progress/ProgressTab'
import { SettingsSheet } from './components/settings/SettingsSheet'
import { LiveWorkout } from './components/live/LiveWorkout'
import { describeNextSet } from './components/live/nextSet'
import { QuickLogSheet } from './components/QuickLogSheet'
import { RoutineEditor } from './components/RoutineEditor'
import { KurvenUmriss, Silhouette } from '../../components/ui/Silhouette'
import { useAuth } from '../../context/AuthContext'
import { HealthStoreConsentSheet } from '../wearables/components/HealthStoreConsentSheet'

/**
 * Der Workout-Tracker (`/training`).
 *
 * Einstieg von aussen ueber Query-Parameter: `?start=empty` startet ein leeres
 * Training, `?log=activity` oeffnet „Aktivitaet eintragen" — so kann der
 * Schnellzugriff direkt dorthin springen.
 */

type Tab = 'today' | 'history' | 'progress'
const TABS: Tab[] = ['today', 'history', 'progress']

export function TrainingPage() {
  const { tt } = useTrainingText()
  const data = useTrainingData()
  const active = useActiveWorkout()
  const [params, setParams] = useSearchParams()
  const tab: Tab = TABS.includes(params.get('tab') as Tab) ? params.get('tab') as Tab : 'today'

  const [liveOpen, setLiveOpen] = useState(false)
  const [quickLog, setQuickLog] = useState<{ session: TrainingSession | null } | null>(null)
  const [routineEdit, setRoutineEdit] = useState<{ routine: (Omit<TrainingRoutine, 'id'> & { id?: string }) | null } | null>(null)
  const [detail, setDetail] = useState<TrainingSession | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { user } = useAuth()
  // Uhr-Import an, aber keine Einwilligung: einmal fragen, bis dahin pausiert der Import.
  const consentAsk = useHealthConsentAsk(user?.id ?? null, data.healthImportPaused)

  const setTab = (next: Tab) => {
    const p = new URLSearchParams(params)
    if (next === 'today') p.delete('tab'); else p.set('tab', next)
    setParams(p, { replace: true })
  }

  const { workout, begin } = active
  // Vorschlag (Doppelprogression) fuer die Startwerte der Saetze.
  const suggest = useMemo(
    () => buildSuggestFn({ history: data.sessions, unit: data.settings.unit, customExercises: data.customExercises }),
    [data.sessions, data.settings.unit, data.customExercises],
  )
  const startEmpty = useCallback(() => {
    if (!workout) begin(startWorkout({ history: data.sessions, suggest }))
    setLiveOpen(true)
  }, [workout, begin, data.sessions, suggest])

  const startRoutine = (routine: TrainingRoutine) => {
    if (workout && !window.confirm(tt('discard_confirm'))) { setLiveOpen(true); return }
    begin(startWorkout({ routine, history: data.sessions, suggest }))
    setLiveOpen(true)
  }

  // Einstieg aus dem Schnellzugriff — erst, wenn die Daten da sind („Vorher"-Werte).
  useEffect(() => {
    if (data.state !== 'ready') return
    const start = params.get('start')
    const log = params.get('log')
    if (!start && !log) return
    // Die URL ist hier die Aussenwelt: erst nach dem Rendern reagieren, nicht mitten darin.
    // Auch das Entfernen der Parameter gehoert hinein — sonst raeumt der
    // Neulauf des Effekts den Zeitgeber ab, bevor er feuert.
    const id = window.setTimeout(() => {
      const p = new URLSearchParams(params)
      p.delete('start'); p.delete('log')
      setParams(p, { replace: true })
      if (start === 'empty') startEmpty()
      if (log === 'activity') setQuickLog({ session: null })
    }, 0)
    return () => window.clearTimeout(id)
  }, [data.state, params, setParams, startEmpty])

  const editSession = (session: TrainingSession) => {
    setDetail(null)
    if (session.exercises.length === 0 && session.kind !== 'strength') {
      setQuickLog({ session })
      return
    }
    // Dieselbe Einheit ist schon offen: weitermachen statt die Aenderungen zu verwerfen.
    if (workout?.sessionId === session.id) { setLiveOpen(true); return }
    // Jedes andere offene Training (neu oder in Bearbeitung) nur nach Rueckfrage ersetzen.
    if (workout && !window.confirm(tt('discard_confirm'))) return
    begin(workoutFromSession(session))
    setLiveOpen(true)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 24 }}>
      <style>{TRAINING_CSS}</style>
      {/* Kopf: großer Titel wie in iOS, Einstellungen als Glasknopf */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 4px' }}>
        <h1 className="lg-large-title" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tt('title')}</h1>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label={tt('settings')}
          disabled={data.state !== 'ready'}
          className="lg-glass lg-icon-btn lg-press"
          style={{ flexShrink: 0, opacity: data.state !== 'ready' ? 0.4 : 1 }}
        >
          <Settings size={20} aria-hidden="true" />
        </button>
      </header>

      {/* Reiter wie ein iOS-Segment: eingelassene Füllung, die Wahl als grauer Stein */}
      <div role="tablist" aria-label={tt('title')} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', padding: 2, borderRadius: 999, background: 'var(--lg-fill)' }}>
        {TABS.map(id => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className="tyd-train-press"
            style={{
              minHeight: 34, borderRadius: 999, fontWeight: 600, fontSize: 15,
              background: tab === id ? 'var(--lg-fill-selected)' : 'transparent',
              color: tab === id ? 'var(--lg-text)' : 'var(--lg-text-2)',
              boxShadow: tab === id ? '0 3px 8px rgba(0,0,0,0.25)' : undefined,
            }}
          >
            {tt(`tab_${id}`)}
          </button>
        ))}
      </div>

      {workout && !liveOpen && <RunningBanner workout={workout} data={data} onResume={() => setLiveOpen(true)} />}

      {/* Laden: der Umriss der Karten statt eines Textes (wie überall in der App) */}
      {data.state === 'loading' && <Silhouette label={tt('loading')} abdruck><KurvenUmriss /></Silhouette>}
      {(data.state === 'error' || data.state === 'missing') && (
        <Card>
          <p data-umriss-nicht-merken style={{ fontSize: 17, fontWeight: 600 }}>{data.state === 'missing' ? tt('setup_missing') : tt('load_error')}</p>
          <div style={{ marginTop: 12 }}><Button tone="ghost" onClick={data.reload}>{tt('retry')}</Button></div>
        </Card>
      )}

      {data.state === 'ready' && (
        <div role="tabpanel">
          {tab === 'today' && (
            <TodayTab
              data={data}
              dotQuiet={liveOpen}
              onStartRoutine={startRoutine}
              onStartEmpty={startEmpty}
              onLogActivity={() => setQuickLog({ session: null })}
              onEditRoutine={routine => setRoutineEdit({ routine })}
              onOpenSession={setDetail}
              onShowHistory={() => setTab('history')}
            />
          )}
          {tab === 'history' && <HistoryTab data={data} onOpen={setDetail} />}
          {tab === 'progress' && <ProgressTab data={data} />}
        </div>
      )}

      {workout && liveOpen && (
        <LiveWorkout
          workout={workout}
          dispatch={active.dispatch}
          data={data}
          onMinimize={() => setLiveOpen(false)}
          onDiscard={() => { active.clear(); setLiveOpen(false) }}
          onSaved={() => { active.clear(); setLiveOpen(false) }}
        />
      )}
      {quickLog && (
        <QuickLogSheet
          session={quickLog.session}
          bodyWeightKg={data.context.latestWeightKg}
          onSave={data.saveSession}
          onDelete={quickLog.session ? () => data.removeSession(quickLog.session!.id) : undefined}
          onClose={() => setQuickLog(null)}
        />
      )}
      {routineEdit && (
        <RoutineEditor
          routine={routineEdit.routine}
          data={data}
          onClose={() => setRoutineEdit(null)}
          onStart={routine => { setRoutineEdit(null); startRoutine(routine) }}
        />
      )}
      {detail && <SessionDetailSheet session={detail} data={data} onEdit={() => editSession(detail)} onClose={() => setDetail(null)} />}
      {settingsOpen && <SettingsSheet data={data} onClose={() => setSettingsOpen(false)} />}
      <HealthStoreConsentSheet
        open={consentAsk.open && !liveOpen && !settingsOpen}
        onDone={granted => { consentAsk.done(); if (granted) data.reloadHealthConsent() }}
      />
    </div>
  )
}

/**
 * Minimierte Leiste: Titel, Dauer und — laeuft gerade eine Pause — der
 * Countdown mit dem naechsten Satz, im Sekundentakt.
 */
function RunningBanner({ workout, data, onResume }: { workout: ActiveWorkout; data: TrainingData; onResume: () => void }) {
  const { tt, lang, locale } = useTrainingText()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])
  const editing = !!workout.sessionId
  // Eine abgelaufene Pause raeumt erst der Timer im Logger weg; hier zaehlt nur, was noch laeuft.
  const restLeftS = workout.restEndsAt != null && workout.restEndsAt > now ? Math.ceil((workout.restEndsAt - now) / 1000) : null
  const next = restLeftS != null ? describeNextSet(workout, lang, locale, data.settings.unit, data.customExercises) : null
  const sub = [
    editing ? null : formatClock((now - Date.parse(workout.startedAt)) / 1000),
    restLeftS != null && next ? tt('banner_rest', { clock: formatClock(restLeftS), set: next.set }) : null,
    next ? [next.exercise, next.target].filter(Boolean).join(' ') : null,
  ].filter(Boolean).join(' · ')
  return (
    <Card onClick={onResume} style={{ padding: '12px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 5, flexShrink: 0, background: TRAINING_ACCENT, boxShadow: `0 0 0 4px ${TRAINING_ACCENT}33` }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{workout.title || tt('running_banner')}</div>
          {sub && <div style={{ fontSize: 13, color: restLeftS != null ? TRAINING_ACCENT : 'var(--lg-text-3)', fontVariantNumeric: 'tabular-nums', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>}
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 15, fontWeight: 600, color: TRAINING_ACCENT }}>
          <Play size={16} aria-hidden="true" /> {tt('resume')}
        </span>
      </div>
    </Card>
  )
}

