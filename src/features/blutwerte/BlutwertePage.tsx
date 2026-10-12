import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { LayoutGrid, List, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import type { BloodworkEntry, BloodworkReport } from './types'
import { AUFFAELLIG, auffaelligeWerte, buildMarkerSummaries, filterByKategorie, sortSummaries, ungepruefteWerte, type MarkerFilter, type SortMode } from './lib/bloodwork'
import { formatDisplayDate, formatEingabe, formatLongDate } from './lib/format'
import { SONSTIGE, normalizeMarker } from './lib/markerCatalog'
import { CYAN, TEXT, MUTED } from './styles'
import { markerName } from './lib/markerCatalog.en'
import { Sheet } from '../compliance/components/Sheet'
import { MarkerList, type MarkerLayout, type PillMode } from './components/MarkerList'
import { MarkerDetail } from './components/MarkerDetail'
import { GridControls } from './components/GridControls'
import { AuffaelligeWerte } from './components/AuffaelligeWerte'
import { BefundListe } from './components/BefundListe'
import { EntryModal, emptyDraft, refText, sameRef, type EntryDraft, type ParsedEntry } from './components/EntryModal'
import { AddSheet } from './components/AddSheet'
import { ImportFlow } from './components/import/ImportFlow'
import type { CycleTimeline } from '../../lib/planTimeline'
import { loadCycleHistory } from '../my-stack/services/planLifecycle'
import { reportError } from '../../lib/monitoring'
import { loadUnitPrefs, saveUnitPrefs, withMarkerUnit } from './lib/unitPrefs'
import type { UnitPrefs } from './lib/bloodwork'
import type { UnitSystem } from './lib/unitConversion'
import { bioVollstaendig } from './lib/bioProfile'
import { REFERENZBEREICHE } from './lib/referenzbereiche'
import { useBioProfil } from './components/useBioProfil'
import { BioProfilHinweis, BioProfilSheet } from './components/BioProfil'

const BIO_HINWEIS_KEY = 'blutwerte-bio-hinweis-aus'
const bioHinweisAus = (): boolean => {
  try {
    return localStorage.getItem(BIO_HINWEIS_KEY) === '1'
  } catch {
    return false
  }
}

const MARKER_LAYOUT_KEY = 'blutwerte-marker-layout'

const loadMarkerLayout = (): MarkerLayout => {
  try {
    return localStorage.getItem(MARKER_LAYOUT_KEY) === 'liste' ? 'liste' : 'raster'
  } catch {
    return 'raster'
  }
}

export function BlutwertePage() {
  const { user } = useAuth()
  const { t, i18n } = useTranslation()
  const sprache = i18n.resolvedLanguage ?? i18n.language
  const [loeschen, setLoeschen] = useState<BloodworkEntry | null>(null)
  const [loeschenAusFormular, setLoeschenAusFormular] = useState(false)
  // Zyklen aus My Stack fuer die Zeitstreifen im Verlauf. Fehlen sie
  // (Fehler, keine Zyklen), bleibt der Verlauf einfach ohne Streifen.
  // Zyklen je Konto gemerkt: nach einem Kontowechsel nie die des vorherigen zeigen.
  const [zyklenVon, setZyklenVon] = useState<{ userId: string; timelines: CycleTimeline[]; namen: Map<string, string> } | null>(null)
  const [loescht, setLoescht] = useState(false)
  const [entries, setEntries] = useState<BloodworkEntry[]>([])
  const [reports, setReports] = useState<BloodworkReport[]>([])
  const [view, setView] = useState<'marker' | 'befunde'>('marker')
  const [loading, setLoading] = useState(true)
  // Einmal geladen: spaeteres Neuladen (nach Speichern, Import …) laesst den
  // Inhalt stehen, statt ihn kurz durch „Laden …" zu ersetzen.
  const [geladen, setGeladen] = useState(false)
  const [ladeFehler, setLadeFehler] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedMarker, setSelectedMarker] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  // Import per KI: aus dem „+"-Blatt als Foto oder als Dokument.
  const [importMode, setImportMode] = useState<'photo' | 'document' | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [draft, setDraft] = useState<EntryDraft>(emptyDraft())
  // Vorausgewaehlt: der Filter „Auffällige“ — was Aufmerksamkeit braucht.
  const [kategorie, setKategorie] = useState<MarkerFilter>(AUFFAELLIG)
  const [sortMode, setSortMode] = useState<SortMode>('kategorie')
  // Wie in der Aktien-App: Tippen auf eine Plakette wechselt fuer alle Zeilen
  // zwischen Veraenderung und Referenzbereich.
  const [pillMode, setPillMode] = useState<PillMode>('change')
  const togglePill = useCallback(() => setPillMode(m => (m === 'change' ? 'range' : 'change')), [])
  const [markerLayout, setMarkerLayout] = useState<MarkerLayout>(loadMarkerLayout)
  const toggleLayout = () => {
    const next: MarkerLayout = markerLayout === 'raster' ? 'liste' : 'raster'
    setMarkerLayout(next)
    try {
      localStorage.setItem(MARKER_LAYOUT_KEY, next)
    } catch {
      /* localStorage nicht verfügbar – Wahl gilt nur für diese Sitzung */
    }
  }

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [entriesResult, reportsResult] = await Promise.all([
      supabase
        .from('bloodwork')
        .select('*')
        .eq('user_id', user.id)
        .order('tested_at', { ascending: false })
        .order('marker', { ascending: true }),
      supabase
        .from('bloodwork_reports')
        .select('*')
        .eq('user_id', user.id)
        .order('tested_at', { ascending: false }),
    ])

    // i18n.t statt t: sonst wuerde jeder Sprachwechsel alles neu laden.
    setLadeFehler(!!entriesResult.error)
    if (entriesResult.error) toast.error(i18n.t('bw_load_error'))
    else setEntries((entriesResult.data ?? []) as BloodworkEntry[])

    // Die Tabelle existiert erst nach der separat auszuführenden Migration —
    // bis dahin bleibt die Befunde-Ansicht einfach leer, kein Fehler-Toast.
    if (!reportsResult.error) setReports((reportsResult.data ?? []) as BloodworkReport[])

    setLoading(false)
    setGeladen(true)
  }, [user, i18n])

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) void load()
    })
    return () => { cancelled = true }
  }, [load])

  useEffect(() => {
    if (!user) return
    let aktuell = true
    // Die Zyklen sind eine Beigabe: scheitert das Laden, bleibt der Verlauf ohne sie.
    const userId = user.id
    loadCycleHistory(supabase as never, userId).then(
      verlauf => { if (aktuell) setZyklenVon({ userId, ...verlauf }) },
      error => reportError(error, 'blutwerte.cycle-history'),
    )
    return () => { aktuell = false }
  }, [user])

  const zyklen = zyklenVon && zyklenVon.userId === user?.id ? zyklenVon : undefined

  // Gewaehlte Einheiten aus dem Profil. Bis sie geladen sind, bleiben die
  // Schalter gesperrt — sonst wuerde eine Aenderung aus dem leeren Stand die
  // gespeicherte Wahl je Marker ueberschreiben. Scheitert das Laden, bleibt es
  // bei den Standard-Einheiten; die Werte selbst sind davon nicht betroffen.
  const [unitPrefsVon, setUnitPrefsVon] = useState<{ userId: string; prefs: UnitPrefs } | null>(null)
  useEffect(() => {
    if (!user) return
    let aktuell = true
    const userId = user.id
    loadUnitPrefs(userId).then(
      prefs => { if (aktuell) setUnitPrefsVon({ userId, prefs }) },
      error => reportError(error, 'blutwerte.unit-prefs'),
    )
    return () => { aktuell = false }
  }, [user])
  const unitsReady = !!unitPrefsVon && unitPrefsVon.userId === user?.id
  const unitPrefs = useMemo(() => (unitsReady ? unitPrefsVon!.prefs : {}), [unitsReady, unitPrefsVon])
  // Speichern der Reihe nach, damit eine aeltere Wahl nie eine neuere ueberholt.
  const unitSaves = useRef<Promise<void>>(Promise.resolve())
  const changeUnitPrefs = useCallback((next: UnitPrefs) => {
    if (!user || !unitsReady) return
    const userId = user.id
    setUnitPrefsVon({ userId, prefs: next })
    unitSaves.current = unitSaves.current
      .then(() => saveUnitPrefs(userId, next))
      .catch(error => {
        reportError(error, 'blutwerte.unit-prefs-save')
        toast.error(i18n.t('bw_units_save_error'))
        // Stand aus der Datenbank zeigen, statt zu raten, was gespeichert ist.
        return loadUnitPrefs(userId).then(
          prefs => setUnitPrefsVon({ userId, prefs }),
          loadError => reportError(loadError, 'blutwerte.unit-prefs'),
        )
      })
  }, [user, unitsReady, i18n])
  const setUnitSystem = (system: UnitSystem) => changeUnitPrefs({ ...unitPrefs, system })
  const setMarkerUnit = (name: string, unit: string | null) => changeUnitPrefs(withMarkerUnit(unitPrefs, name, unit))

  // Geschlecht und Alter waehlen den Bereich, wenn ein Befund keinen eigenen hat.
  const { profil: bioProfil, speichern: speichereBio } = useBioProfil()
  const [bioSheet, setBioSheet] = useState(false)
  const [bioHinweisWeg, setBioHinweisWeg] = useState(bioHinweisAus)
  const bioHinweisAusblenden = () => {
    setBioHinweisWeg(true)
    try {
      localStorage.setItem(BIO_HINWEIS_KEY, '1')
    } catch {
      /* localStorage nicht verfuegbar – gilt nur fuer diese Sitzung */
    }
  }

  const summaries = useMemo(() => buildMarkerSummaries(entries, unitPrefs, bioProfil), [entries, unitPrefs, bioProfil])
  // Hinweis nur, wenn er etwas aendern wuerde: ein Wert ohne Laborbereich bei
  // einem Marker mit Bereichen nach Geschlecht/Alter — und eine Angabe fehlt.
  const zeigeBioHinweis = !!bioProfil && !bioVollstaendig(bioProfil) && !bioHinweisWeg
    && entries.some(e => e.ref_min == null && e.ref_max == null && REFERENZBEREICHE[normalizeMarker(e.marker)?.name ?? ''])

  const zeigtAuffaellige = kategorie === AUFFAELLIG
  const showSonstige = useMemo(() => summaries.some(s => s.kategorie === SONSTIGE), [summaries])

  const visibleSummaries = useMemo(
    // Bei „Auffällige“ zeigt die Seite die Liste, nicht das Raster — dann nichts zu rechnen.
    () => (zeigtAuffaellige ? [] : sortSummaries(filterByKategorie(summaries, kategorie), sortMode)),
    [summaries, kategorie, sortMode, zeigtAuffaellige],
  )

  const auffaellig = useMemo(() => auffaelligeWerte(summaries), [summaries])
  const ungeprueft = useMemo(() => ungepruefteWerte(summaries).length, [summaries])
  const erstLaden = loading && !geladen

  const latestDate = useMemo(() => {
    if (entries.length === 0) return null
    return entries.reduce((max, e) => (e.tested_at > max ? e.tested_at : max), entries[0].tested_at)
  }, [entries])

  const openNew = (marker?: string) => {
    // Wechseljahre aendern sich selten: die Angabe der letzten Messung desselben Markers vorschlagen
    const vorher = marker ? entries.find(e => e.marker === marker && e.menopause) : undefined
    setDraft({ ...emptyDraft(marker), menopause: vorher?.menopause ?? '' })
    setShowForm(true)
  }

  const openEdit = (entry: BloodworkEntry) => {
    setDraft({
      id: entry.id,
      reportId: entry.report_id,
      originalUnit: entry.unit,
      originalRef: { min: refText(entry.ref_min), max: refText(entry.ref_max) },
      tested_at: entry.tested_at,
      marker: entry.marker,
      custom: !normalizeMarker(entry.marker),
      value: formatEingabe(entry.value),
      unit: entry.unit,
      refMin: refText(entry.ref_min),
      refMax: refText(entry.ref_max),
      menopause: entry.menopause ?? '',
    })
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setDraft(emptyDraft())
  }

  // Neu: ganze Zeile. Bearbeiten: nur Datum, Wert und Einheit — Marker und
  // Notiz bleiben. Bei Werten aus einem Befund gehoert das Datum dem Befund
  // und wird nicht mitgeschickt. Die Laborreferenz gilt fuer ihre Einheit:
  // aendert sich die Einheit, faellt sie weg (dann gilt der Katalogbereich).
  const save = async (parsed: ParsedEntry) => {
    if (!user) return
    setSaving(true)
    const { id, reportId, originalUnit, originalRef } = draft
    // Ein Laborbereich gilt fuer seine Einheit: aendert sich nur die Einheit,
    // ohne dass der Bereich angepasst wurde, faellt er weg.
    const refUnveraendert = !!originalRef && sameRef(draft, originalRef)
    const ref = id && refUnveraendert && parsed.unit !== originalUnit
      ? { ref_min: null, ref_max: null }
      : { ref_min: parsed.ref_min, ref_max: parsed.ref_max }
    const { error } = id
      ? await supabase.from('bloodwork').update({
        ...(reportId ? {} : { tested_at: parsed.tested_at }),
        value: parsed.value,
        unit: parsed.unit,
        ...ref,
        ...(parsed.menopause !== undefined ? { menopause: parsed.menopause } : {}),
      }).eq('id', id).eq('user_id', user.id)
      : await supabase.from('bloodwork').insert({
        user_id: user.id,
        tested_at: parsed.tested_at,
        marker: parsed.marker,
        value: parsed.value,
        unit: parsed.unit,
        ...ref,
        // Beim Anlegen nur senden, wenn angegeben (leer ist ohnehin der Standard)
        ...(parsed.menopause ? { menopause: parsed.menopause } : {}),
        notes: null,
      })
    setSaving(false)
    if (error) return toast.error(t(id ? 'bw_update_error' : 'bw_save_error'))
    toast.success(t(id ? 'bw_updated' : 'bw_saved'))
    closeForm()
    void load()
  }

  // Loeschen ueber ein eigenes Sheet statt des Browser-Fensters.
  const remove = (entry: BloodworkEntry) => setLoeschen(entry)

  const loeschenBestaetigt = async () => {
    if (!loeschen || !user) return
    setLoescht(true)
    const { error } = await supabase.from('bloodwork').delete().eq('id', loeschen.id).eq('user_id', user.id)
    setLoescht(false)
    if (error) return toast.error(t('bw_delete_error'))
    toast.success(t('bw_deleted'))
    setLoeschen(null)
    if (loeschenAusFormular) {
      setLoeschenAusFormular(false)
      closeForm()
    }
    void load()
  }

  const loeschenAbbrechen = () => {
    setLoeschen(null)
    if (loeschenAusFormular) {
      setLoeschenAusFormular(false)
      setShowForm(true)
    }
  }

  const loeschenSheet = loeschen && (
    <Sheet labelledBy="bw-delete-title" busy={loescht} onClose={loeschenAbbrechen} role="alertdialog" data-bw-delete-sheet>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-300">
          <Trash2 size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 id="bw-delete-title" className="text-lg font-bold text-white">{t('bw_delete_title')}</h2>
          <p className="mt-0.5 text-sm text-slate-400">
            {t('bw_delete_desc', { marker: markerName(loeschen.marker, sprache), date: formatDisplayDate(loeschen.tested_at) })}
          </p>
        </div>
      </div>
      <div className="mt-5 flex gap-2">
        <button type="button" autoFocus data-app-back-close disabled={loescht} onClick={loeschenAbbrechen} className="min-h-11 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 text-sm font-semibold text-slate-300 disabled:opacity-50">
          {t('cancel')}
        </button>
        <button type="button" data-bw-delete-confirm disabled={loescht} onClick={() => void loeschenBestaetigt()} className="min-h-11 flex-1 rounded-xl bg-red-600 px-4 text-sm font-bold text-white disabled:opacity-50">
          {t('delete')}
        </button>
      </div>
    </Sheet>
  )

  const modal = showForm && (
    <EntryModal
      draft={draft}
      frageWechseljahre={bioProfil?.sex === 'female'}
      profil={bioProfil}
      markerLocked={!!draft.id || (!!draft.marker && selectedMarker === draft.marker)}
      saving={saving}
      onChange={setDraft}
      onCancel={closeForm}
      onSave={save}
      onDelete={draft.id ? () => {
        const entry = entries.find(e => e.id === draft.id)
        if (!entry) return
        // Formular nur ausblenden: Abbrechen im Sheet fuehrt mit den Eingaben zurueck.
        setShowForm(false)
        setLoeschenAusFormular(true)
        remove(entry)
      } : undefined}
    />
  )

  // ---------- View 2: Marker detail ----------
  if (selectedMarker) {
    const summary = summaries.find(s => s.name === selectedMarker)
    if (summary) {
      return (
        <div>
          <MarkerDetail
            summary={summary}
            zyklen={zyklen}
            reports={reports}
            unitSystem={unitPrefs.system ?? 'konventionell'}
            markerUnit={unitPrefs.marker?.[summary.name] ?? null}
            onMarkerUnit={unitsReady ? unit => setMarkerUnit(summary.name, unit) : undefined}
            profil={bioProfil}
            onBack={() => setSelectedMarker(null)}
            onAdd={() => openNew(selectedMarker)}
            onEdit={openEdit}
          />
          {modal}
          {loeschenSheet}
        </div>
      )
    }
  }

  // ---------- Übersicht: wie die Aktien-App ----------
  const headerButton = 'flex h-11 w-11 items-center justify-center rounded-full'
  return (
    <div>
      {/* Titel und Knoepfe in einer Reihe, das Datum kleiner darunter ueber die
          volle Breite — so bleibt es immer einzeilig. */}
      <header className="mb-4 grid items-start gap-x-3" style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
        <h1 className="min-w-0 text-[2rem] font-black leading-tight tracking-tight" style={{ color: TEXT }}>{t('bw_title')}</h1>
        <div className="mt-1 flex shrink-0 items-center rounded-full px-1" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)' }}>
          {view === 'marker' && (
            // Zeigt, wohin es geht: im Raster das Listen-Symbol und umgekehrt.
            <button
              type="button"
              className={headerButton}
              style={{ color: TEXT }}
              onClick={toggleLayout}
              aria-label={t(markerLayout === 'raster' ? 'bw_list_view' : 'bw_grid_view')}
              title={t(markerLayout === 'raster' ? 'bw_list_view' : 'bw_grid_view')}
              data-bw-layout-toggle={markerLayout}
            >
              {markerLayout === 'raster' ? <List size={20} /> : <LayoutGrid size={19} />}
            </button>
          )}
          <button type="button" className={headerButton} style={{ color: TEXT }} onClick={() => setShowAdd(true)} aria-label={t('bw_add_title')} title={t('bw_add_title')} aria-haspopup="dialog">
            <Plus size={22} />
          </button>
        </div>
        <p className="col-span-2 truncate text-[1.5rem] font-extrabold leading-tight tracking-tight" style={{ color: MUTED }}>
          {/* Stand der Uebersicht: das Datum der letzten Messung. */}
          {latestDate ? t('bw_as_of', { date: formatLongDate(latestDate, sprache) }) : t('bw_overview_empty_date')}
        </p>
      </header>

      {/* Ansicht: Marker / Befunde; unter Marker der Filter „Auffällige“ (vorausgewählt) */}
      <div className="mb-3 flex rounded-full p-1" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)' }}>
        {([['marker', t('bw_view_markers')], ['befunde', t('bw_view_reports')]] as [typeof view, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            aria-pressed={view === key}
            className="min-h-9 flex-1 rounded-full px-3 text-sm whitespace-nowrap transition-colors"
            style={view === key
              ? { background: 'var(--surface)', color: TEXT, fontWeight: 800, boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }
              : { color: MUTED, fontWeight: 600 }}
          >
            {label}
          </button>
        ))}
      </div>

      {erstLaden && (
        <div className="p-10 text-center" style={{ color: MUTED }}>
          {t('bw_loading')}
        </div>
      )}

      {!erstLaden && zeigeBioHinweis && (
        <BioProfilHinweis onOeffnen={() => setBioSheet(true)} onAusblenden={bioHinweisAusblenden} />
      )}
      {bioSheet && bioProfil && (
        <BioProfilSheet start={bioProfil} speichern={speichereBio} onClose={() => setBioSheet(false)} />
      )}

      {!erstLaden && view === 'befunde' && (
        <BefundListe reports={reports} entries={entries} profil={bioProfil} onChanged={load} />
      )}

      {!erstLaden && view === 'marker' && (
        <>
          <GridControls
            kategorie={kategorie}
            auffaellig={auffaellig.length}
            sortMode={sortMode}
            unitSystem={unitPrefs.system ?? 'konventionell'}
            unitsReady={unitsReady}
            onUnitSystem={setUnitSystem}
            showSonstige={showSonstige}
            onKategorie={setKategorie}
            onSortMode={setSortMode}
          />

          {ladeFehler && entries.length === 0 ? (
            // Nie „keine Werte“ zeigen, wenn nur das Laden scheiterte — unter keinem Filter.
            <div className="py-8 mb-4 text-center" data-bw-load-error>
              <p className="text-sm" style={{ color: TEXT }}>{t('bw_load_error')}</p>
              <button type="button" className="mt-3 min-h-11 px-3 text-sm font-semibold" style={{ color: CYAN }} onClick={() => void load()}>
                {t('ai_consent_retry')}
              </button>
            </div>
          ) : zeigtAuffaellige ? (
            <AuffaelligeWerte
              summaries={auffaellig}
              ungeprueft={ungeprueft}
              hatWerte={entries.length > 0}
              onSelect={setSelectedMarker}
              onAlleMarker={() => setKategorie(null)}
              layout={markerLayout}
              pillMode={pillMode}
              onTogglePill={togglePill}
            />
          ) : (
            <MarkerList
              summaries={visibleSummaries}
              layout={markerLayout}
              grouped={sortMode === 'kategorie' && kategorie === null}
              pillMode={pillMode}
              onTogglePill={togglePill}
              onSelect={setSelectedMarker}
            />
          )}
        </>
      )}

      {!erstLaden && view !== 'befunde' && (
        <p className="text-xs text-center mt-5" style={{ color: MUTED }}>{t('bw_disclaimer')}</p>
      )}

      {modal}
      {loeschenSheet}
      {showAdd && (
        <AddSheet
          onClose={() => setShowAdd(false)}
          onPick={choice => {
            setShowAdd(false)
            if (choice === 'manual') openNew()
            else setImportMode(choice)
          }}
        />
      )}
      {importMode && <ImportFlow mode={importMode} onClose={() => setImportMode(null)} onSaved={load} />}
    </div>
  )
}
