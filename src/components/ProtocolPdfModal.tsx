import { useEffect, useMemo, useRef, useState } from 'react'
import { format, subDays } from 'date-fns'
import { Download, Dumbbell, FileText, Loader2, Share, SlidersHorizontal, Stethoscope, Users, X, type LucideIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import { denyProps } from '../lib/denyFeedback'
import { loadProtocolData } from '../lib/protocolPdf/loadProtocolData'
import { SECTIONS } from '../lib/protocolPdf/sections'
import { PRESETS, applyPreset, matchPreset, type ActivePreset, type PresetId } from '../lib/protocolPdf/presets'
import { loadPdfExportPrefs, savePdfExportPrefs } from '../lib/protocolPdf/persistence'
import { buildProtocolPdf, pdfFileName } from '../lib/protocolPdf/renderProtocolPdf'
import { canSharePdf, handOffPdf } from '../lib/protocolPdf/sharePdf'
import { PdfPagesPreview, type PdfPagesPreviewLabels } from './protocolPdf/PdfPagesPreview'
import { PdfInfoSheet } from './protocolPdf/PdfInfoSheet'
import type { ProtocolData, PdfLang, PdfDateRange, SectionId } from '../lib/protocolPdf/types'

interface Props {
  userId: string
  initialRange: PdfDateRange
  uiLang: string
  onClose: () => void
  /** Optional: Demo/Preview ohne Supabase-Load (z. B. /__pdfpreview). */
  previewData?: ProtocolData
  /** page = Vollseite im Layout statt Overlay-Modal. */
  variant?: 'modal' | 'page'
}

type UILang = PdfLang

const T: Record<UILang, {
  title: string; titleShort: string; presets: string; custom: string; sections: string
  period: string; from: string; to: string
  note: string; notePlaceholder: string; language: string; download: string; share: string; generating: string
  info: string; days: (n: number) => string; rangeCustom: string; customDesc: string; shareRetry: string
  loading: string; noneSelected: string; empty: string; emptyClick: (label: string) => string
  invalidRange: string
  loadError: string; genError: string
  personalHint: string
  livePreview: string; previewUpdating: string; previewEmpty: string; previewError: string
  pageOf: (page: number, total: number) => string; enlarge: (page: number) => string
  prevPage: string; nextPage: string; close: string; zoomHint: string
}> = {
  de: {
    title: 'PDF-Protokoll erstellen',
    titleShort: 'PDF-Protokoll',
    presets: 'Muster',
    custom: 'Eigene',
    sections: 'Inhalte',
    period: 'Zeitraum',
    from: 'Von', to: 'Bis',
    note: 'Notizen / Fragen',
    notePlaceholder: 'z. B. Fragen an den Arzt oder Coach …',
    language: 'Sprache des PDFs',
    download: 'PDF herunterladen',
    share: 'PDF teilen',
    info: 'So funktioniert der PDF-Generator',
    days: n => `${n} Tage`,
    rangeCustom: 'Eigener',
    customDesc: 'Häkchen selbst setzen.',
    shareRetry: 'Das PDF ist fertig — tippe noch einmal auf „Teilen“.',
    generating: 'PDF wird erstellt …',
    loading: 'Daten werden geladen …',
    noneSelected: 'Wähle mindestens einen Inhalt aus.',
    empty: 'keine Daten',
    emptyClick: label => `Keine Daten für „${label}“ im gewählten Zeitraum.`,
    invalidRange: 'Der Zeitraum passt nicht: „Von“ muss vor „Bis“ liegen.',
    loadError: 'Daten konnten nicht geladen werden',
    genError: 'PDF konnte nicht erstellt werden',
    personalHint: 'Ohne „Persönliche Angaben“ wird das PDF anonymisiert (z. B. fürs Forum).',
    livePreview: 'Live-Vorschau',
    previewUpdating: 'Vorschau wird aktualisiert …',
    previewEmpty: 'Wähle Inhalte, um die Vorschau zu sehen.',
    previewError: 'Vorschau konnte nicht erzeugt werden.',
    pageOf: (page, total) => `Seite ${page} von ${total}`,
    enlarge: page => `Seite ${page} vergrößern`,
    prevPage: 'Vorherige Seite',
    nextPage: 'Nächste Seite',
    close: 'Schließen',
    zoomHint: 'Doppeltippen oder mit zwei Fingern zoomen',
  },
  en: {
    title: 'Create PDF report',
    titleShort: 'PDF report',
    presets: 'Templates',
    custom: 'Custom',
    sections: 'Contents',
    period: 'Period',
    from: 'From', to: 'To',
    note: 'Notes / questions',
    notePlaceholder: 'e.g. questions for your doctor or coach …',
    language: 'PDF language',
    download: 'Download PDF',
    share: 'Share PDF',
    info: 'How the PDF generator works',
    days: n => `${n} days`,
    rangeCustom: 'Custom',
    customDesc: 'Tick the boxes yourself.',
    shareRetry: 'The PDF is ready — tap “Share” once more.',
    generating: 'Generating PDF …',
    loading: 'Loading data …',
    noneSelected: 'Select at least one section.',
    empty: 'no data',
    emptyClick: label => `No data for “${label}” in the selected period.`,
    invalidRange: 'Check the period: “From” must come before “To”.',
    loadError: 'Could not load data',
    genError: 'Could not create PDF',
    personalHint: 'Without “Personal details” the PDF is anonymised (e.g. for forums).',
    livePreview: 'Live preview',
    previewUpdating: 'Updating preview …',
    previewEmpty: 'Select contents to see the preview.',
    previewError: 'Could not generate preview.',
    pageOf: (page, total) => `Page ${page} of ${total}`,
    enlarge: page => `Enlarge page ${page}`,
    prevPage: 'Previous page',
    nextPage: 'Next page',
    close: 'Close',
    zoomHint: 'Double-tap or pinch to zoom',
  },
}

const DEFAULT_PRESET: PresetId = 'arzt'
const PRESET_ICONS: Record<ActivePreset, LucideIcon> = { arzt: Stethoscope, coach: Dumbbell, forum: Users, custom: SlidersHorizontal }
const QUICK_RANGES = [7, 30, 90] as const

/** Die letzten `days` Tage bis heute. */
function lastDays(days: number): PdfDateRange {
  const to = new Date()
  return { from: format(subDays(to, days - 1), 'yyyy-MM-dd'), to: format(to, 'yyyy-MM-dd') }
}

function quickRangeOf(range: PdfDateRange): number | null {
  return QUICK_RANGES.find(days => {
    const r = lastDays(days)
    return r.from === range.from && r.to === range.to
  }) ?? null
}
const DATE_INPUT_CLASS = 'input block min-w-0 appearance-none text-left [&::-webkit-date-and-time-value]:text-left'
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function initialLang(uiLang: string): UILang {
  return uiLang.toLowerCase().startsWith('en') ? 'en' : 'de'
}

function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false
  const t = Date.parse(`${value}T00:00:00`)
  return Number.isFinite(t)
}

/** Leere Zwischenwerte beim Jahres-Spinner der date-Inputs verwerfen. */
function isValidRange(range: PdfDateRange): boolean {
  return isValidIsoDate(range.from) && isValidIsoDate(range.to) && range.from <= range.to
}

function availableSectionIds(data: ProtocolData): Set<SectionId> {
  return new Set(
    SECTIONS.filter(s => s.alwaysAvailable || s.hasData(data)).map(s => s.id),
  )
}

function pruneSelection(selected: Iterable<SectionId>, data: ProtocolData): Set<SectionId> {
  const available = availableSectionIds(data)
  return new Set([...selected].filter(id => available.has(id)))
}

function restoreSelection(
  data: ProtocolData,
  prefs: ReturnType<typeof loadPdfExportPrefs>,
): { selected: Set<SectionId>; lang?: UILang } {
  if (!prefs) {
    return { selected: new Set(applyPreset(DEFAULT_PRESET, data)) }
  }

  if (prefs.preset !== 'custom') {
    return {
      selected: new Set(applyPreset(prefs.preset, data)),
      lang: prefs.lang,
    }
  }

  const restored = [...pruneSelection(prefs.sections, data)]
  if (restored.length === 0) {
    return { selected: new Set(applyPreset(DEFAULT_PRESET, data)), lang: prefs.lang }
  }
  return { selected: new Set(restored), lang: prefs.lang }
}

export function ProtocolPdfModal({ userId, initialRange, uiLang, onClose, previewData, variant = 'modal' }: Props) {
  const isPage = variant === 'page'
  const [lang, setLang] = useState<UILang>(() => {
    const prefs = loadPdfExportPrefs(userId)
    return prefs?.lang ?? initialLang(uiLang)
  })
  const [range, setRange] = useState<PdfDateRange>(initialRange)
  const [data, setData] = useState<ProtocolData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<SectionId>>(new Set())
  const [note, setNote] = useState('')
  const [generating, setGenerating] = useState(false)
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null)
  const [previewBusy, setPreviewBusy] = useState(false)
  const [previewError, setPreviewError] = useState(false)
  /** „Eigene" angetippt: bleibt aktiv, auch wenn die Häkchen gerade einem Muster gleichen. */
  const [pinCustom, setPinCustom] = useState(false)
  /** „Eigener" Zeitraum angetippt: die Datumsfelder sind dran. */
  const [pinCustomRange, setPinCustomRange] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const shareable = useMemo(() => canSharePdf(), [])
  // `lang` ist die Sprache des PDFs; die Seite selbst spricht die App-Sprache.
  const uiL = initialLang(uiLang)
  const t = T[uiL]
  // Nur für die Fehlermeldung beim Laden — keine Abhängigkeit des Ladens,
  // sonst lädt ein Sprachwechsel neu und setzt die Häkchen zurück.
  const uiLRef = useRef(uiL)
  uiLRef.current = uiL
  const prefsReady = useRef(false)
  const initialLoadDone = useRef(false)
  const loadGenRef = useRef(0)
  const previewGenRef = useRef(0)


  // Daten laden: Zeitraum debouncen, Prefs nur beim ersten Load anwenden.
  // Bei späteren Range-Änderungen Auswahl nur auf verfügbare Sektionen beschneiden
  // (nicht jedes Mal neu aus Prefs überschreiben — das leerte die Vorschau).
  useEffect(() => {
    if (!isValidRange(range)) return

    const gen = ++loadGenRef.current
    let cancelled = false
    setLoading(true)

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const d = previewData ?? await loadProtocolData(userId, range)
          if (cancelled || gen !== loadGenRef.current) return
          setData(d)

          if (!initialLoadDone.current) {
            const prefs = loadPdfExportPrefs(userId)
            const restored = restoreSelection(d, prefs)
            setSelected(restored.selected)
            // „Eigene" nur, wenn die eigene Auswahl wirklich zurückkam (nicht der Arzt-Ersatz).
            if (prefs?.preset === 'custom' && pruneSelection(prefs.sections, d).size > 0) setPinCustom(true)
            if (restored.lang) setLang(restored.lang)
            initialLoadDone.current = true
            prefsReady.current = true
          } else {
            setSelected(prev => {
              const pruned = pruneSelection(prev, d)
              if (pruned.size > 0) return pruned
              const prefs = loadPdfExportPrefs(userId)
              const fallback =
                prefs?.preset && prefs.preset !== 'custom' ? prefs.preset : DEFAULT_PRESET
              return new Set(applyPreset(fallback, d))
            })
          }
        } catch {
          if (!cancelled && gen === loadGenRef.current) {
            toast.error(T[uiLRef.current].loadError)
          }
        } finally {
          if (!cancelled && gen === loadGenRef.current) setLoading(false)
        }
      })()
    }, 280)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [userId, range, previewData])

  const activePreset: ActivePreset = pinCustom
    ? 'custom'
    : data
      ? matchPreset([...selected], data)
      : DEFAULT_PRESET

  useEffect(() => {
    if (!prefsReady.current || loading || !data) return
    savePdfExportPrefs(userId, {
      preset: activePreset,
      sections: [...selected],
      lang,
    })
  }, [userId, activePreset, selected, lang, loading, data])

  const availability = useMemo(() => {
    const map = new Map<SectionId, boolean>()
    if (data) {
      for (const s of SECTIONS) map.set(s.id, Boolean(s.alwaysAvailable || s.hasData(data)))
    }
    return map
  }, [data])

  const selectPreset = (id: ActivePreset) => {
    if (!data) return
    if (id === 'custom') {
      setPinCustom(true)
      return
    }
    setPinCustom(false)
    setSelected(new Set(applyPreset(id, data)))
  }

  const toggle = (id: SectionId) => {
    const section = SECTIONS.find(s => s.id === id)
    if (!section) return
    // Leere Abschnitte sind aria-disabled: den Klick faengt der app-weite
    // „geht nicht"-Hinweis ab (src/lib/denyFeedback.ts). Das hier ist nur
    // die Absicherung.
    if (!(availability.get(id) ?? false)) return
    // Wie im Mockup: gleicht die neue Auswahl einem Muster, springt die Karte dorthin.
    setPinCustom(false)
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const quickRange = pinCustomRange ? null : quickRangeOf(range)
  const rangeIndex = quickRange == null ? QUICK_RANGES.length : QUICK_RANGES.indexOf(quickRange as typeof QUICK_RANGES[number])
  const pickRange = (days: number | null) => {
    if (days == null) {
      setPinCustomRange(true)
      return
    }
    setPinCustomRange(false)
    setRange(lastDays(days))
  }

  const updateRange = (patch: Partial<PdfDateRange>) => {
    setRange(prev => {
      const next = { ...prev, ...patch }
      // Leere Zwischenwerte vom date-Input (z. B. Jahres-Spinner) ignorieren.
      if (patch.from !== undefined && patch.from !== '' && !isValidIsoDate(patch.from)) return prev
      if (patch.to !== undefined && patch.to !== '' && !isValidIsoDate(patch.to)) return prev
      if (patch.from === '' || patch.to === '') return prev
      return next
    })
  }

  const selectedKey = useMemo(() => [...selected].sort().join('|'), [selected])

  // Live-Vorschau: das PDF bauen; PdfPagesPreview rastert die Seiten mit pdf.js.
  // Auch ohne Häkchen: Cover + Disclaimer rendern (leerer Zeitraum / Forum ohne Daten).
  // Bei ungültigem Zeitraum bleibt die letzte Vorschau stehen.
  useEffect(() => {
    if (!data || !isValidRange(range)) {
      setPreviewBusy(false)
      setPreviewError(false)
      return
    }

    const gen = ++previewGenRef.current
    let cancelled = false
    setPreviewBusy(true)
    setPreviewError(false)

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const doc = await buildProtocolPdf(data, {
            lang,
            range,
            sections: [...selected],
            note,
            preset: activePreset,
          })
          if (cancelled || gen !== previewGenRef.current) return

          setPdfBytes(doc.output('arraybuffer'))
        } catch (err) {
          console.error('[pdf-preview]', err)
          if (!cancelled && gen === previewGenRef.current) setPreviewError(true)
        } finally {
          if (!cancelled && gen === previewGenRef.current) setPreviewBusy(false)
        }
      })()
    }, 350)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [data, selectedKey, lang, range, note, activePreset, selected])

  const pdfOptions = () => ({ lang, range, sections: [...selected], note, preset: activePreset })


  // Steht die Vorschau, ist das PDF schon fertig: dann geht das Teilen-Menü
  // sofort auf, solange die Geste noch frisch ist (iOS verlangt das).
  const generate = async () => {
    if (!data || !isValidRange(range)) return
    setGenerating(true)
    try {
      const opts = pdfOptions()
      const ready = pdfBytes && !previewBusy && !previewError && !loading
      const blob = ready
        ? new Blob([pdfBytes], { type: 'application/pdf' })
        : (await buildProtocolPdf(data, opts)).output('blob')
      const outcome = await handOffPdf(blob, pdfFileName(opts))
      if (outcome === 'retry') toast(t.shareRetry)
      else if (!isPage && outcome !== 'cancelled') onClose()
    } catch {
      toast.error(t.genError)
    } finally {
      setGenerating(false)
    }
  }

  const showNoteField = selected.has('notes')

  // Sprache des PDFs: kleiner Umschalter wie ein iOS-Segment.
  const langToggle = (
    <div role="group" aria-label={t.language} title={t.language} className="mr-1 flex rounded-full bg-[var(--lg-fill)] p-0.5">
      {(['de', 'en'] as const).map(l => (
        <button
          key={l}
          type="button"
          aria-pressed={lang === l}
          onClick={() => setLang(l)}
          // Sichtbar 28 px hoch, getroffen wird auf 44 px.
          className={`tyd-press relative h-7 min-w-10 rounded-full px-2.5 text-[12px] font-semibold tracking-[0.02em] before:absolute before:-inset-y-2 before:inset-x-0 before:content-[''] ${
            lang === l
              ? 'bg-[var(--lg-fill-selected)] text-[var(--lg-text)] shadow-[0_2px_6px_rgba(0,0,0,0.25)]'
              : 'text-[var(--lg-text-3)]'
          }`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )

  // Die Karten zeigen nur den Namen; die Beschreibung steht im „i" und hier für Screenreader.
  const presetCards: { id: ActivePreset; label: string; description: string }[] = [
    ...PRESETS.map(p => ({ id: p.id, label: p.label[uiL], description: p.description[uiL] })),
    { id: 'custom', label: t.custom, description: t.customDesc },
  ]

  const rangeOptions = [
    ...QUICK_RANGES.map(days => ({ key: String(days), label: t.days(days), days: days as number | null })),
    { key: 'custom', label: t.rangeCustom, days: null },
  ]

  const previewLabels: PdfPagesPreviewLabels = {
    title: t.livePreview,
    updating: t.previewUpdating,
    empty: t.previewEmpty,
    error: t.previewError,
    pageOf: t.pageOf,
    enlarge: t.enlarge,
    prev: t.prevPage,
    next: t.nextPage,
    close: t.close,
    zoomHint: t.zoomHint,
  }

  return (
    <div
      className={isPage
        ? 'lg-backdrop w-[calc(100%+1.5rem)] -mx-3 -mt-4 flex flex-col min-h-[calc(100dvh-4.5rem)]'
        : 'fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-[calc(0.5rem+env(safe-area-inset-top))]'}
      data-app-modal={isPage ? undefined : true}
      onClick={isPage ? undefined : onClose}
    >
      <div
        className={isPage
          ? 'w-full flex flex-col flex-1 min-h-0'
          : 'lg-sheet lg-sheet-solid overflow-hidden w-full sm:max-w-5xl flex flex-col max-h-full'}
        onClick={isPage ? undefined : (e => e.stopPropagation())}
      >
        <div className={`shrink-0 flex items-center justify-between gap-2 ${isPage ? 'pl-4 pr-1 pt-1 pb-1' : 'pl-5 pr-2 pt-3 pb-1'}`}>
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={18} className="text-[var(--lg-accent-text)] shrink-0" aria-hidden="true" />
            {/* Auf dem Handy der kurze Titel, er passt ganz; ab Tablet-Breite der lange */}
            <h2 className="lg-title2 truncate">
              <span className="sm:hidden">{t.titleShort}</span>
              <span className="hidden sm:inline">{t.title}</span>
            </h2>
            <button
              type="button"
              onClick={() => setInfoOpen(true)}
              aria-label={t.info}
              title={t.info}
              className="tyd-press -ml-1 grid h-11 w-9 shrink-0 place-items-center"
            >
              <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--lg-fill)] text-[var(--lg-text-2)]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
                  <path d="M12 11v6" /><path d="M12 7h.01" />
                </svg>
              </span>
            </button>
          </div>
          <div className="flex items-center shrink-0">
            {langToggle}
            <button type="button" onClick={onClose} data-app-back-close aria-label={t.close} className="lg-icon-btn !text-[var(--lg-text-2)]">
              <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-[var(--lg-fill)]"><X size={17} /></span>
            </button>
          </div>
        </div>

        {/* Muster als Karten — ein Tipp setzt die Häkchen; „Eigene" lässt sie, wie sie sind. */}
        <div className="shrink-0 px-4 pt-2 pb-1">
          <p className="lg-group-title !mx-1">{t.presets}</p>
          <div className="grid grid-cols-4 gap-2" role="group" aria-label={t.presets}>
            {presetCards.map(card => {
              const active = activePreset === card.id
              const Icon = PRESET_ICONS[card.id]
              return (
                <button
                  key={card.id}
                  type="button"
                  aria-pressed={active}
                  aria-description={card.description}
                  disabled={loading || !data}
                  onClick={() => selectPreset(card.id)}
                  className={`tyd-press flex min-h-[84px] min-w-0 flex-col items-center justify-center gap-2 rounded-[16px] px-1 disabled:opacity-50 ${
                    active
                      ? 'bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] shadow-[inset_0_0_0_1.5px_var(--lg-accent)]'
                      : 'bg-[var(--lg-fill)]'
                  }`}
                >
                  <span
                    className={`grid h-9 w-9 place-items-center rounded-full transition-colors duration-150 ${
                      active ? 'bg-[var(--lg-accent)] text-[var(--accent-contrast)]' : 'bg-[var(--lg-fill)] text-[var(--lg-text-2)]'
                    }`}
                    aria-hidden="true"
                  >
                    <Icon size={18} strokeWidth={2.2} />
                  </span>
                  <span className="max-w-full truncate text-[13px] font-semibold tracking-[-0.01em] text-[var(--lg-text)]">
                    {card.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
          <div className={`lg:w-[380px] lg:shrink-0 overflow-y-auto px-4 py-4 space-y-4 ${isPage ? '' : 'max-h-[42vh] lg:max-h-none'}`}>
          <div>
            <p className="lg-group-title !mx-1">{t.period}</p>
            {/* Schnellwahl als Segment; der Daumen gleitet zur Wahl. */}
            <div role="group" aria-label={t.period} className="relative mb-2 grid grid-cols-4 rounded-[12px] bg-[var(--lg-fill)] p-0.5">
              <span
                aria-hidden="true"
                className="absolute left-0.5 top-0.5 h-8 w-[calc((100%-4px)/4)] rounded-[10px] bg-[var(--lg-fill-selected)] shadow-[0_3px_8px_rgba(0,0,0,0.28)] motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-[cubic-bezier(0.32,0.72,0,1)]"
                style={{ transform: `translateX(${rangeIndex * 100}%)` }}
              />
              {rangeOptions.map((opt, i) => (
                <button
                  key={opt.key}
                  type="button"
                  aria-pressed={rangeIndex === i}
                  onClick={() => pickRange(opt.days)}
                  className={`relative h-8 text-[13px] font-semibold transition-colors ${rangeIndex === i ? 'text-[var(--lg-text)]' : 'text-[var(--lg-text-2)]'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {/* Unter 360 px untereinander, sonst schneidet das Feld die Jahreszahl ab */}
            {/* iOS gibt Datumsfeldern eine Eigenbreite: ohne min-w-0/appearance
                ragt „Bis" über den Rand hinaus. */}
            <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
              <label className="block min-w-0">
                <span className="label !mb-1">{t.from}</span>
                <input
                  type="date"
                  value={range.from}
                  max={range.to}
                  onChange={e => updateRange({ from: e.target.value })}
                  onFocus={() => setPinCustomRange(true)}
                  className={`${DATE_INPUT_CLASS} ${quickRange == null ? 'shadow-[inset_0_0_0_1.5px_color-mix(in_srgb,var(--accent)_70%,transparent)]' : ''}`}
                />
              </label>
              <label className="block min-w-0">
                <span className="label !mb-1">{t.to}</span>
                <input
                  type="date"
                  value={range.to}
                  min={range.from}
                  onChange={e => updateRange({ to: e.target.value })}
                  onFocus={() => setPinCustomRange(true)}
                  className={`${DATE_INPUT_CLASS} ${quickRange == null ? 'shadow-[inset_0_0_0_1.5px_color-mix(in_srgb,var(--accent)_70%,transparent)]' : ''}`}
                />
              </label>
            </div>
          </div>

          <div>
            <p className="lg-group-title !mx-1">{t.sections}</p>
            {loading ? (
              <div className="flex items-center gap-2 py-6 justify-center text-[var(--lg-text-2)] text-sm">
                <Loader2 size={16} className="animate-spin" /> {t.loading}
              </div>
            ) : (
              // Unter 360 px einspaltig: sonst brechen Wörter wie „Zusammenfassung" mitten im Wort
              <div className="grid grid-cols-1 gap-1.5 min-[360px]:grid-cols-2">
                {SECTIONS.map(s => {
                  const has = availability.get(s.id) ?? false
                  const checked = selected.has(s.id)
                  return (
                    <button
                      key={s.id}
                      type="button"
                      {...denyProps(!has, t.emptyClick(s.label[uiL]))}
                      title={!has ? t.emptyClick(s.label[uiL]) : undefined}
                      onClick={() => toggle(s.id)}
                      aria-pressed={checked && has}
                      className={`tyd-press flex min-h-11 min-w-0 items-center gap-2 rounded-[14px] px-2.5 py-2 text-left ${
                        !has
                          ? 'bg-[var(--lg-fill)] opacity-40'
                          : checked
                            ? 'bg-[color-mix(in_srgb,var(--accent)_16%,transparent)]'
                            : 'bg-[var(--lg-fill)]'
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                          checked && has ? 'bg-[var(--lg-accent)]' : 'shadow-[inset_0_0_0_1.5px_var(--lg-text-3)]'
                        }`}
                      >
                        {checked && has && (
                          <svg viewBox="0 0 12 12" className="h-3 w-3 text-[var(--accent-contrast)]" fill="none" stroke="currentColor" strokeWidth="2.2">
                            <path d="M2.5 6.5l2.2 2.2L9.5 3.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                      {/* Trennen nur im Deutschen (lange Komposita); Englisch bricht an Leerzeichen. */}
                      <span lang={uiL} className={`min-w-0 flex-1 ${uiL === 'de' ? 'hyphens-auto' : 'hyphens-manual'} [overflow-wrap:break-word] text-[13px] font-medium leading-snug ${has ? 'text-[var(--lg-text)]' : 'text-[var(--lg-text-3)]'}`}>
                        {s.label[uiL]}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
            <p className="mt-2 px-1 text-[12px] leading-snug text-[var(--lg-text-3)]">{t.personalHint}</p>
          </div>

          {showNoteField && (
            <div>
              <p className="lg-group-title !mx-1">{t.note}</p>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder={t.notePlaceholder}
                rows={3}
                className="input resize-none"
              />
            </div>
          )}
        </div>

          {/* Die Seiten haben ihre eigene Höhe (A4); im Modal und am Desktop scrollt die Spalte. */}
          <div className={`flex-1 min-h-0 pb-1 lg:overflow-y-auto ${isPage ? '' : 'min-h-[38vh] overflow-y-auto'}`}>
            <PdfPagesPreview
              bytes={data ? pdfBytes : null}
              building={previewBusy}
              failed={previewError}
              notice={isValidRange(range) ? null : t.invalidRange}
              labels={previewLabels}
            />
          </div>
        </div>

        {/* Als Seite schwebt der Knopf über der Tab-Leiste, darunter blendet der Inhalt aus. */}
        {isPage && <div aria-hidden="true" className="h-28 shrink-0" />}
        <div className={isPage ? 'pdf-share-dock' : 'shrink-0 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]'}>
          <button
            type="button"
            onClick={() => { void generate() }}
            // Laden und Erstellen sind gleich vorbei — dort bleibt der Knopf
            // stumm. Ein falscher Zeitraum bleibt, bis man ihn aendert: dort
            // sagt der Knopf, warum er nicht geht.
            // Während ein neuer Zeitraum lädt, wäre das PDF noch das alte.
            disabled={generating || data == null || loading}
            {...denyProps(!isValidRange(range), t.invalidRange)}
            className="lg-btn lg-btn-primary pointer-events-auto w-full"
          >
            {generating
              ? <><Loader2 size={16} className="animate-spin" /> {t.generating}</>
              : shareable
                ? <><Share size={16} /> {t.share}</>
                : <><Download size={16} /> {t.download}</>}
          </button>
        </div>
        {/* Im Inneren, nicht daneben: das Portal reicht Klicks im React-Baum
            nach oben weiter, außen würde der Modal-Hintergrund schließen. */}
        {infoOpen && <PdfInfoSheet lang={uiL} onClose={() => setInfoOpen(false)} />}
      </div>
    </div>
  )
}
