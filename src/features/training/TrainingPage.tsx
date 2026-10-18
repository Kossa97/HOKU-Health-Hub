import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Play, Settings } from 'lucide-react'
import type { TrainingRoutine, TrainingSession } from './types'
import { useTrainingText } from './i18n'
import { useTrainingData } from './hooks/useTrainingData'
import { useActiveWorkout } from './hooks/useActiveWorkout'
import { startWorkout, workoutFromSession } from './lib/activeWorkout'
import { formatClock } from './lib/format'
import { Button, Card, TRAINING_ACCENT, TRAINING_CSS } from './components/ui'
import { TodayTab } from './components/today/TodayTab'
import { HistoryTab } from './components/history/HistoryTab'
import { SessionDetailSheet } from './components/history/SessionDetailSheet'
import { ProgressTab } from './components/progress/ProgressTab'
import { SettingsSheet } from './components/settings/SettingsSheet'
import { LiveWorkout } from './components/live/LiveWorkout'
import { QuickLogSheet } from './components/QuickLogSheet'
import { RoutineEditor } from './components/RoutineEditor'

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

  const setTab = (next: Tab) => {
    const p = new URLSearchParams(params)
    if (next === 'today') p.delete('tab'); else p.set('tab', next)
    setParams(p, { replace: true })
  }

  const { workout, begin } = active
  const startEmpty = useCallback(() => {
    if (!workout) begin(startWorkout({ history: data.sessions }))
    setLiveOpen(true)
  }, [workout, begin, data.sessions])

  const startRoutine = (routine: TrainingRoutine) => {
    if (workout && !window.confirm(tt('discard_confirm'))) { setLiveOpen(true); return }
    begin(startWorkout({ routine, history: data.sessions }))
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
      <header style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h1 style={{ flex: 1, fontSize: '1.6rem', fontWeight: 850, letterSpacing: '-0.02em' }}>{tt('title')}</h1>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label={tt('settings')}
          disabled={data.state !== 'ready'}
          className="tyd-train-press"
          style={{ width: 44, height: 44, borderRadius: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-raised)', color: 'var(--text-dim)' }}
        >
          <Settings size={20} aria-hidden="true" />
        </button>
      </header>

      <div role="tablist" aria-label={tt('title')} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, padding: 4, borderRadius: 14, background: 'var(--surface-raised)' }}>
        {TABS.map(id => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className="tyd-train-press"
            style={{
              minHeight: 40, borderRadius: 11, fontWeight: 750, fontSize: '0.88rem',
              background: tab === id ? 'var(--surface)' : 'transparent',
              color: tab === id ? 'var(--text)' : 'var(--text-dim)',
              boxShadow: tab === id ? 'var(--shadow-card)' : undefined,
            }}
          >
            {tt(`tab_${id}`)}
          </button>
        ))}
      </div>

      {workout && !liveOpen && <RunningBanner startedAt={workout.startedAt} title={workout.title} editing={!!workout.sessionId} onResume={() => setLiveOpen(true)} />}

      {data.state === 'loading' && <p style={{ color: 'var(--text-dim)', padding: '24px 0', textAlign: 'center' }}>{tt('loading')}</p>}
      {(data.state === 'error' || data.state === 'missing') && (
        <Card>
          <p style={{ fontWeight: 700 }}>{data.state === 'missing' ? tt('setup_missing') : tt('load_error')}</p>
          <div style={{ marginTop: 12 }}><Button tone="ghost" onClick={data.reload}>{tt('retry')}</Button></div>
        </Card>
      )}

      {data.state === 'ready' && (
        <div role="tabpanel">
          {tab === 'today' && (
            <TodayTab
              data={data}
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
      {routineEdit && <RoutineEditor routine={routineEdit.routine} data={data} onClose={() => setRoutineEdit(null)} />}
      {detail && <SessionDetailSheet session={detail} data={data} onEdit={() => editSession(detail)} onClose={() => setDetail(null)} />}
      {settingsOpen && <SettingsSheet data={data} onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}

function RunningBanner({ startedAt, title, editing, onResume }: { startedAt: string; title: string; editing: boolean; onResume: () => void }) {
  const { tt } = useTrainingText()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])
  return (
    <Card accent={TRAINING_ACCENT} onClick={onResume} style={{ padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 5, background: TRAINING_ACCENT, boxShadow: `0 0 0 4px ${TRAINING_ACCENT}33` }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title || tt('running_banner')}</div>
          {!editing && <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums' }}>{formatClock((now - Date.parse(startedAt)) / 1000)}</div>}
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 800, color: TRAINING_ACCENT }}>
          <Play size={16} aria-hidden="true" /> {tt('resume')}
        </span>
      </div>
    </Card>
  )
}

