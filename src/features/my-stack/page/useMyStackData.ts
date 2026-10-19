import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { supabase } from '../../../lib/supabase'
import { FEATURES } from '../../../config/features'
import type { CycleTimeline } from '../../../lib/planTimeline'
import type { SubstanceCatalogEntry } from '../types'
import { loadStackItems } from '../services/stackItems'
import { searchSubstanceCatalog } from '../services/substanceCatalog'
import { loadCycleTimelines } from '../services/planLifecycle'
import { isLocalColorMigrationComplete, migrateLocalColors } from '../lib/colorMigration'
import { asPeptide, mergeCatalogEntries, type Cycle, type Escalation, type InventoryItem, type Peptide } from './model'

/**
 * Die Daten der My-Stack-Seite und ihr Laden — aus MyStackPage.tsx
 * ausgelagert. Beim ersten Einhaengen laedt der Hook Stack und Zyklen (danach
 * gilt die Seite als geladen) und im Hintergrund Bestand, Zeitleisten,
 * Dosisanpassungen und Katalog.
 *
 * Die Setter, die die Seite nach eigenen Aenderungen selbst braucht
 * (Zeitleisten ersetzen, Rekonstitution sofort zeigen), gibt er mit heraus.
 */
export function useMyStackData({ stackDataClient, userId }: {
  stackDataClient: typeof supabase
  userId: string | undefined
}) {
  const { t } = useTranslation()
  // Wie vorher `user!.id`: ohne Nutzer scheitert das Laden sichtbar, statt
  // mit user_id = undefined still eine leere Liste zu liefern.
  const requireUserId = (): string => {
    if (!userId) throw new Error('My Stack: kein angemeldeter Nutzer')
    return userId
  }
  const [inventory, setInventory]             = useState<InventoryItem[]>([])
  const [peptides, setPeptides]               = useState<Peptide[]>([])
  const [loading, setLoading]                 = useState(true)
  const [initialLoad, setInitialLoad]         = useState(true)
  const [cycles, setCycles]                   = useState<Cycle[]>([])
  const [cycleTimelines, setCycleTimelines]   = useState<CycleTimeline[]>([])
  const [timelineLoadError, setTimelineLoadError] = useState(false)
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [catalogEntries, setCatalogEntries] = useState<SubstanceCatalogEntry[]>([])
  const [catalogUnavailable, setCatalogUnavailable] = useState(false)
  const initialLoadPromiseRef = useRef<Promise<void> | null>(null)
  const [archivedPeptides, setArchivedPeptides]   = useState<Peptide[]>([])
  const [escalations, setEscalations]             = useState<Escalation[]>([])

  const loadInventory = async () => {
    const { data } = await supabase.from('inventory_items').select('*').eq('user_id', requireUserId()).order('name')
    if (data) setInventory(data as InventoryItem[])
  }
  const publishPeptides = (snapshot: {
    peptides: Peptide[]
    catalogEntries: SubstanceCatalogEntry[]
  }) => {
    setCatalogEntries(current => mergeCatalogEntries(
      current,
      snapshot.catalogEntries,
    ))
    setPeptides(snapshot.peptides)
  }
  const loadPeptides = async (publish = true) => {
    let data = await loadStackItems(stackDataClient as never, false)
    if (!isLocalColorMigrationComplete(localStorage)) {
      const archived = await loadStackItems(stackDataClient as never, true)
      const migrated = await migrateLocalColors(stackDataClient as never, [...data, ...archived], localStorage)
      if (migrated) data = await loadStackItems(stackDataClient as never, false)
    }
    const snapshot = {
      peptides: data.map(asPeptide),
      catalogEntries: data.flatMap(item => item.ingredients.map(ingredient => ingredient.substance_catalog).filter(
        (entry): entry is SubstanceCatalogEntry => entry !== null,
      )),
    }
    if (publish) publishPeptides(snapshot)
    return snapshot
  }
  const loadArchived = async () => {
    try {
      const data = await loadStackItems(supabase as never, true)
      setArchivedPeptides(data
        .map(asPeptide)
        .sort((a, b) => (b.archived_at ?? '').localeCompare(a.archived_at ?? '')))
    } catch {
      toast.error(t('error'))
    }
  }
  const loadCycles = async () => {
    const { data } = await stackDataClient.from('cycles').select('*').eq('user_id', requireUserId())
    if (data) setCycles(data as Cycle[])
  }
  const loadTimelines = async (throwOnError = false) => {
    if (!FEATURES.planTimelineV2) return
    setTimelineLoading(true)
    setTimelineLoadError(false)
    try {
      setCycleTimelines(await loadCycleTimelines(stackDataClient as never, requireUserId(), { includeUnavailable: true }))
    } catch (error) {
      setTimelineLoadError(true)
      if (throwOnError) throw error
    } finally {
      setTimelineLoading(false)
    }
  }
  /**
   * Zeitleisten und Stack zusammen neu laden — nach einer Aenderung, die
   * beide betrifft (Konflikt geloest, Zeitzone bestaetigt). Fehler werden
   * weitergeworfen. Ohne `quiet` zeigt die Seite dabei Laden und Fehler an;
   * mit `quiet` meldet nur der Aufrufer selbst (die Zeitzonen-Pruefung hat
   * ihre eigene Fehlerzeile).
   */
  const reloadTimelinesAndPeptides = async ({ quiet = false }: { quiet?: boolean } = {}) => {
    if (!quiet) {
      setTimelineLoading(true)
      setTimelineLoadError(false)
    }
    try {
      const [nextTimelines, nextPeptides] = await Promise.all([
        loadCycleTimelines(stackDataClient as never, requireUserId(), { includeUnavailable: true }),
        loadPeptides(false),
      ])
      setCycleTimelines(nextTimelines)
      publishPeptides(nextPeptides)
    } catch (error) {
      if (!quiet) setTimelineLoadError(true)
      throw error
    } finally {
      if (!quiet) setTimelineLoading(false)
    }
  }
  const loadEscalations = async () => {
    const { data } = await supabase.from('dose_escalations').select('*').eq('user_id', requireUserId()).order('start_after_days').order('start_date')
    if (data) setEscalations(data as Escalation[])
  }
  useEffect(() => {
    // Leaving the page before the queries settle, or within the loader's fade,
    // must not write state into an unmounted component: the fade timer would
    // otherwise still fire half a second later.
    let cancelled = false
    let fadeTimer: number | undefined

    if (!initialLoadPromiseRef.current) {
      initialLoadPromiseRef.current = Promise.all([
        loadPeptides(),
        loadCycles(),
      ]).then(() => undefined)

      void Promise.allSettled([
        loadInventory(),
        loadTimelines(),
        loadEscalations(),
        searchSubstanceCatalog(supabase as never, '').then(result => {
          setCatalogEntries(current => mergeCatalogEntries(current, result.entries))
          setCatalogUnavailable(result.unavailable)
        }),
      ])
    }

    initialLoadPromiseRef.current
      .finally(() => {
        if (cancelled) return
        // Blendet den Vollbild-Lader aus (`fadingOut = !loading`) und haengt
        // ihn danach ab — wie in The Lab.
        setLoading(false)
        fadeTimer = window.setTimeout(() => setInitialLoad(false), 500)
      })

    return () => {
      cancelled = true
      if (fadeTimer !== undefined) window.clearTimeout(fadeTimer)
    }
  }, [])

  return {
    inventory, peptides, setPeptides, loading, initialLoad,
    cycles, cycleTimelines, setCycleTimelines, timelineLoadError,
    timelineLoading, catalogEntries, catalogUnavailable,
    archivedPeptides, escalations,
    loadInventory, loadPeptides, loadArchived, loadCycles, loadTimelines, loadEscalations,
    reloadTimelinesAndPeptides,
  }
}
