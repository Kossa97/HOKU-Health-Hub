import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { useFortschrittData } from './hooks/useFortschrittData'
import { FortschrittHeader } from './components/FortschrittHeader'
import { FortschrittDashboard } from './components/FortschrittDashboard'
import { StickyRangeBar } from './components/StickyRangeBar'
import { TodayLogSheet } from './components/TodayLogSheet'
import { hasLogForDate } from './lib/metricDefaults'
import { DEFAULT_RANGE_CHIP, rangeFromChip, type RangeChipKey } from './lib/verlaufRange'
import { formatDaySafe } from './lib/dates'
import './glass.css'

export function FortschrittPage() {
  const { t } = useTranslation()
  const { state, reload } = useFortschrittData()
  const [searchParams, setSearchParams] = useSearchParams()
  const [logOpen, setLogOpen] = useState(false)
  const [rangeChip, setRangeChip] = useState<RangeChipKey>(DEFAULT_RANGE_CHIP)

  useEffect(() => {
    if (searchParams.get('tab')) {
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const pageRange = useMemo(
    () => rangeFromChip(rangeChip, state.fullRange),
    [rangeChip, state.fullRange],
  )

  const rangeLabel = `${formatDaySafe(pageRange.from, 'full')} – ${formatDaySafe(pageRange.to, 'full')}`

  const hasTodayEntry = useMemo(
    () => hasLogForDate(state.dailyLogs, state.weightLogs, format(new Date(), 'yyyy-MM-dd')),
    [state.dailyLogs, state.weightLogs],
  )

  return (
    <div className="fg-root">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <StickyRangeBar
        value={rangeChip}
        onChange={setRangeChip}
      />

      <FortschrittHeader
        rangeLabel={rangeLabel}
        onLogToday={() => setLogOpen(true)}
        hasTodayEntry={hasTodayEntry}
        dataReady={state.dataReady}
      />

      {state.loading ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--fg-text-3)', fontSize: '0.9rem', fontWeight: 600 }}>
          {t('fortschritt_loading')}
        </div>
      ) : (
        <FortschrittDashboard
          state={state}
          rangeChip={rangeChip}
          onLogToday={() => setLogOpen(true)}
          onReload={() => void reload()}
        />
      )}

      </div>

      <TodayLogSheet
        logs={state.dailyLogs}
        weightLogs={state.weightLogs}
        open={logOpen}
        onClose={() => setLogOpen(false)}
        onSaved={() => reload()}
      />
    </div>
  )
}

