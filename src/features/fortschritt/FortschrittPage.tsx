import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { reportError } from '../../lib/monitoring'
import { useFortschrittData } from './hooks/useFortschrittData'
import { FortschrittHeader } from './components/FortschrittHeader'
import { FortschrittDashboard } from './components/FortschrittDashboard'
import { StickyRangeBar } from './components/StickyRangeBar'
import { TodayLogSheet } from './components/TodayLogSheet'
import { hasLogForDate } from './lib/metricDefaults'
import { DEFAULT_RANGE_CHIP, rangeFromChip, type RangeChipKey } from './lib/verlaufRange'
import { formatDaySafe } from './lib/dates'
import { MEASUREMENT_SITES, type MeasurementSite } from './lib/measurements'
import './glass.css'
import { KurvenUmriss, Silhouette } from '../../components/ui/Silhouette'

export function FortschrittPage() {
  const { t } = useTranslation()
  const { state, reload } = useFortschrittData()
  const { user } = useAuth()
  const [measurementSites, setMeasurementSites] = useState<MeasurementSite[]>([])
  // Erst nach erfolgreichem Laden darf die Wahl geschrieben werden — sonst ersetzte [site] die gespeicherte Liste.
  const [sitesLoaded, setSitesLoaded] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const [logOpen, setLogOpen] = useState(false)
  const [rangeChip, setRangeChip] = useState<RangeChipKey>(DEFAULT_RANGE_CHIP)

  useEffect(() => {
    if (searchParams.get('tab')) {
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  // Nach einem Ladefehler versucht es das naechste Oeffnen des Eintrags noch einmal.
  useEffect(() => {
    if (!user || sitesLoaded) return
    let cancelled = false
    void supabase
      .from('profiles')
      .select('measurement_sites')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          reportError(error, 'fortschritt.measurement-sites-load')
          return
        }
        const stored = (data as { measurement_sites?: unknown } | null)?.measurement_sites
        if (Array.isArray(stored)) {
          setMeasurementSites(MEASUREMENT_SITES.filter(site => stored.includes(site)))
        }
        setSitesLoaded(true)
      })
    return () => { cancelled = true }
  }, [user, sitesLoaded, logOpen])

  const changeMeasurementSites = async (next: MeasurementSite[]) => {
    if (!user || !sitesLoaded) return
    const previous = measurementSites
    setMeasurementSites(next)
    const { error } = await supabase.from('profiles').update({ measurement_sites: next }).eq('id', user.id)
    if (error) {
      setMeasurementSites(previous)
      reportError(error, 'fortschritt.measurement-sites-save')
      toast.error(t('umfaenge_sites_save_failed'))
    }
  }

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
        <Silhouette label={t('fortschritt_loading')} abdruck><KurvenUmriss /></Silhouette>
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
        measurements={state.measurements}
        measurementSites={measurementSites}
        onMeasurementSitesChange={sitesLoaded ? sites => void changeMeasurementSites(sites) : null}
        open={logOpen}
        onClose={() => setLogOpen(false)}
        onSaved={() => reload()}
      />
    </div>
  )
}

