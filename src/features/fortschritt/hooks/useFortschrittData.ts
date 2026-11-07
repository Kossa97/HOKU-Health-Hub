import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import i18n from 'i18next'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../context/AuthContext'
import type {
  BloodworkEntry,
  BodyMeasurementEntry,
  CycleRow,
  CycleSubstance,
  DailyLogEntry,
  DateRange,
  DoseLogEntry,
  FortschrittOverviewState,
  OngoingSubstance,
  ProgressPhotoEntry,
  WeightLogEntry,
} from '../types'
import { normalizeCycles, rangeFromActiveSubstances } from '../lib/substances'
import { numeric } from '../lib/metrics'
import { collectPagedRows } from '../lib/pagination'
import { PHOTO_BUCKET, SIGNED_URL_TTL_SECONDS } from '../constants'
import { BATCH_LINK_ERNEUERN_MS, istAdresse, signiereBatchDateien } from '../../../lib/batchFiles'
import { reportError } from '../../../lib/monitoring'
import { isMissingColumn } from '../../../lib/dbErrors'

/**
 * Dauerhafte Substanzen (ohne Zyklus) haben noch keine Datenquelle — die
 * Anzeige dafür ist vorbereitet, bekommt aber bis dahin eine feste leere Liste.
 */
const ONGOING_SUBSTANCES = Object.freeze([]) as unknown as OngoingSubstance[]

function mapDailyLogs(rows: Record<string, unknown>[] | null): DailyLogEntry[] {
  return (rows ?? []).map(row => ({
    log_date: String(row.log_date),
    energie: row.energie != null ? Number(row.energie) : null,
    schlaf: row.schlaf != null ? Number(row.schlaf) : null,
    wohlbefinden: row.wohlbefinden != null ? Number(row.wohlbefinden) : null,
    libido: row.libido != null ? Number(row.libido) : null,
    body_fat_pct: row.body_fat_pct != null ? Number(row.body_fat_pct) : null,
    muscle_mass_kg: row.muscle_mass_kg != null ? Number(row.muscle_mass_kg) : null,
  }))
}

const DAILY_LOG_COLUMNS = 'log_date, energie, schlaf, wohlbefinden, libido, body_fat_pct, muscle_mass_kg'
/** Vor der Migration Profil 2a fehlt `muscle_mass_kg` — dann ohne die Spalte laden. */
const DAILY_LOG_COLUMNS_V1 = 'log_date, energie, schlaf, wohlbefinden, libido, body_fat_pct'


/** Legacy-Fotos tragen eine volle Public-URL; neue Fotos nur den Storage-Pfad. */
export function isLegacyPhotoUrl(photoUrl: string): boolean {
  return istAdresse(photoUrl)
}

async function resolvePhotoDisplayUrls(
  photos: Omit<ProgressPhotoEntry, 'display_url'>[],
): Promise<ProgressPhotoEntry[]> {
  const paths = photos.filter(p => !isLegacyPhotoUrl(p.photo_url)).map(p => p.photo_url)
  const legacy = photos.filter(p => isLegacyPhotoUrl(p.photo_url)).map(p => p.photo_url)
  const signed = new Map<string, string>()
  // Alte Fotos liegen im ebenfalls privaten `batch-files` — auch signiert.
  const [, legacySigned] = await Promise.all([
    paths.length > 0
      ? supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, SIGNED_URL_TTL_SECONDS).then(({ data }) => {
        for (const entry of data ?? []) {
          if (entry.path && entry.signedUrl) signed.set(entry.path, entry.signedUrl)
        }
      })
      : undefined,
    signiereBatchDateien(supabase as never, legacy, SIGNED_URL_TTL_SECONDS).catch(error => {
      reportError(error, 'fortschritt.legacy-photos')
      return new Map<string, string>()
    }),
  ])
  return photos.map(p => ({
    ...p,
    display_url: isLegacyPhotoUrl(p.photo_url) ? (legacySigned.get(p.photo_url) ?? '') : (signed.get(p.photo_url) ?? ''),
  }))
}

export function useFortschrittData() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [dataReady, setDataReady] = useState(false)
  const initialLoadedRef = useRef(false)
  const [cycleSubstances, setCycleSubstances] = useState<CycleSubstance[]>([])
  const [dailyLogs, setDailyLogs] = useState<DailyLogEntry[]>([])
  const [weightLogs, setWeightLogs] = useState<WeightLogEntry[]>([])
  const [bloodwork, setBloodwork] = useState<BloodworkEntry[]>([])
  const [measurements, setMeasurements] = useState<BodyMeasurementEntry[]>([])
  const [photos, setPhotos] = useState<ProgressPhotoEntry[]>([])
  const photosSignedAtRef = useRef(0)
  const photosRef = useRef<ProgressPhotoEntry[]>([])
  useEffect(() => { photosRef.current = photos }, [photos])
  const [doseLogs, setDoseLogs] = useState<DoseLogEntry[]>([])
  const [stackItemNames, setStackItemNames] = useState<Map<string, string>>(new Map())

  const range = useMemo<DateRange>(
    () => rangeFromActiveSubstances(cycleSubstances, ONGOING_SUBSTANCES),
    [cycleSubstances],
  )

  // Volle Historie: ältester Substanz-Start oder ältester Datenpunkt → heute.
  // Basis für den „Alles"-Chip im Verlauf, damit auch beendete Zyklen und
  // Daten vor dem ersten aktiven Zyklus sichtbar bleiben.
  const fullRange = useMemo<DateRange>(() => {
    let from = range.from
    const consider = (d: string | null | undefined) => {
      if (!d) return
      const day = d.slice(0, 10)
      if (day < from) from = day
    }
    for (const c of cycleSubstances) consider(c.startDate)
    for (const o of ONGOING_SUBSTANCES) consider(o.startDate)
    for (const l of dailyLogs) consider(l.log_date)
    for (const w of weightLogs) consider(w.logged_at)
    for (const b of bloodwork) consider(b.tested_at)
    for (const m of measurements) consider(m.measured_on)
    for (const p of photos) consider(p.taken_at)
    return { from, to: range.to }
  }, [range, cycleSubstances, dailyLogs, weightLogs, bloodwork, measurements, photos])

  const load = useCallback(async () => {
    if (!user) return
    if (!initialLoadedRef.current) setLoading(true)

    // Jede Tabelle seitenweise: Supabase liefert pro Abfrage hoechstens 1000
    // Zeilen, sonst fehlte bei langer Historie still der Rest. Die `id` als
    // zweiter Sortierschluessel haelt die Seitengrenzen stabil.
    const [cyclesRes, stackItemsRes] = await Promise.all([
      collectPagedRows((from, to) =>
        supabase
          .from('cycles')
          .select('id, stack_item_id, name, start_date, end_date, active, stack_items(display_name)')
          .eq('user_id', user.id)
          .order('start_date', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to),
      ),
      collectPagedRows((from, to) =>
        supabase
          .from('stack_items')
          .select('id, display_name')
          .eq('user_id', user.id)
          .order('id', { ascending: true })
          .range(from, to),
      ),
    ])

    const cycles = normalizeCycles(cyclesRes.data as unknown as CycleRow[])
    setCycleSubstances(cycles)

    const activeRange = rangeFromActiveSubstances(cycles, ONGOING_SUBSTANCES)
    const toBound = `${activeRange.to}T23:59:59`

    const loadDailyLogs = (columns: string) =>
      collectPagedRows((from, to) =>
        supabase
          .from('daily_logs')
          .select(columns)
          .eq('user_id', user.id)
          .lte('log_date', activeRange.to)
          .order('log_date', { ascending: true })
          .range(from, to),
      )

    const [dailyRes, weightRes, bloodRes, measurementRes, photoRes, doseRes] = await Promise.all([
      loadDailyLogs(DAILY_LOG_COLUMNS).then(res =>
        isMissingColumn(res.error) ? loadDailyLogs(DAILY_LOG_COLUMNS_V1) : res),
      collectPagedRows((from, to) =>
        supabase
          .from('weight_logs')
          .select('id, logged_at, weight_kg')
          .eq('user_id', user.id)
          .lte('logged_at', toBound)
          .order('logged_at', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to),
      ),
      collectPagedRows((from, to) =>
        supabase
          .from('bloodwork')
          .select('id, marker, value, unit, tested_at')
          .eq('user_id', user.id)
          .lte('tested_at', activeRange.to)
          .order('tested_at', { ascending: false })
          .order('id', { ascending: true })
          .range(from, to),
      ),
      collectPagedRows((from, to) =>
        supabase
          .from('body_measurements')
          .select('measured_on, site, value_cm')
          .eq('user_id', user.id)
          .lte('measured_on', activeRange.to)
          .order('measured_on', { ascending: true })
          .order('site', { ascending: true })
          .range(from, to),
      ),
      collectPagedRows((from, to) =>
        supabase
          .from('progress_photos')
          .select('id, photo_url, taken_at, weight_kg, notes')
          .eq('user_id', user.id)
          .lte('taken_at', activeRange.to)
          .order('taken_at', { ascending: false })
          .order('id', { ascending: true })
          .range(from, to),
      ),
      collectPagedRows((from, to) =>
        supabase
          .from('dose_logs')
          .select('stack_item_id, logged_at, taken')
          .eq('user_id', user.id)
          .lte('logged_at', toBound)
          .order('logged_at', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to),
      ),
    ])

    const errors = [cyclesRes, stackItemsRes, dailyRes, weightRes, bloodRes, measurementRes, photoRes, doseRes]
      .map(res => res.error)
      .filter(Boolean)
    if (errors.length > 0) {
      console.error('Fortschritt: Daten laden fehlgeschlagen', errors)
      toast.error(i18n.t('fortschritt_load_failed'))
    }

    setDailyLogs(mapDailyLogs(dailyRes.data as Record<string, unknown>[] | null))
    setWeightLogs(
      (weightRes.data ?? [])
        .map((row: { id: string; logged_at: string; weight_kg: number | string }) => ({
          id: String(row.id),
          logged_at: String(row.logged_at),
          weight_kg: numeric(row.weight_kg),
        }))
        .filter((row): row is { id: string; logged_at: string; weight_kg: number } => row.weight_kg != null),
    )
    setBloodwork(
      (bloodRes.data ?? [])
        .map((row: { id: string; marker: string; value: number | string; unit: string; tested_at: string }) => ({
          id: String(row.id),
          marker: String(row.marker),
          value: numeric(row.value) ?? 0,
          unit: String(row.unit ?? ''),
          tested_at: String(row.tested_at),
        }))
        .filter(row => row.value != null),
    )
    setMeasurements(
      (measurementRes.data ?? [])
        .map((row: { measured_on: string; site: BodyMeasurementEntry['site']; value_cm: number | string }) => ({
          measured_on: String(row.measured_on),
          site: row.site,
          value_cm: numeric(row.value_cm),
        }))
        .filter((row): row is BodyMeasurementEntry => row.value_cm != null),
    )

    const rawPhotos = (photoRes.data ?? []).map((row: { id: string; photo_url: string; taken_at: string; weight_kg: number | string | null; notes: string | null }) => ({
      id: String(row.id),
      photo_url: String(row.photo_url),
      taken_at: String(row.taken_at),
      weight_kg: numeric(row.weight_kg),
      notes: row.notes ?? null,
    }))
    setPhotos(await resolvePhotoDisplayUrls(rawPhotos))
    photosSignedAtRef.current = Date.now()

    setDoseLogs((doseRes.data ?? []) as DoseLogEntry[])

    const names = new Map<string, string>()
    for (const item of stackItemsRes.data ?? []) {
      names.set(String(item.id), String(item.display_name))
    }
    setStackItemNames(names)
    initialLoadedRef.current = true
    setDataReady(true)
    setLoading(false)
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  // Signierte Foto-Links laufen nach einer Stunde ab. Kommt die Seite nach
  // laengerer Pause wieder in den Vordergrund (Geraet geschlafen, Tab im
  // Hintergrund — Timer liefen dann nicht), werden sie neu geholt.
  useEffect(() => {
    const auffrischen = () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - photosSignedAtRef.current < BATCH_LINK_ERNEUERN_MS) return
      const current = photosRef.current
      if (current.length === 0) return
      photosSignedAtRef.current = Date.now()
      void resolvePhotoDisplayUrls(current).then(setPhotos)
    }
    document.addEventListener('visibilitychange', auffrischen)
    return () => document.removeEventListener('visibilitychange', auffrischen)
  }, [])

  // Stabile Referenz: die Felder sind schon stabil, ein neues Objektliteral pro
  // Render würde aber jeden `useMemo` der Konsumenten mit `state` in den Deps
  // entwerten (Verlauf rechnet dort alle Metriken und Marker neu).
  const state = useMemo<FortschrittOverviewState>(() => ({
    loading,
    dataReady,
    range,
    fullRange,
    cycleSubstances,
    ongoingSubstances: ONGOING_SUBSTANCES,
    dailyLogs,
    weightLogs,
    bloodwork,
    measurements,
    photos,
    doseLogs,
    stackItemNames,
  }), [
    loading,
    dataReady,
    range,
    fullRange,
    cycleSubstances,
    dailyLogs,
    weightLogs,
    bloodwork,
    measurements,
    photos,
    doseLogs,
    stackItemNames,
  ])

  return { state, reload: load }
}
