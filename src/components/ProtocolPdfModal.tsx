import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, FileText, Loader2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { denyProps } from '../lib/denyFeedback'
import { loadProtocolData } from '../lib/protocolPdf/loadProtocolData'
import { SECTIONS } from '../lib/protocolPdf/sections'
import { PRESETS, applyPreset, matchPreset, type ActivePreset, type PresetId } from '../lib/protocolPdf/presets'
import { loadPdfExportPrefs, savePdfExportPrefs } from '../lib/protocolPdf/persistence'
import { buildProtocolPdf, downloadProtocolPdf } from '../lib/protocolPdf/renderProtocolPdf'
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
  title: string; titleShort: string; intro: string; presets: string; custom: string; sections: string
  period: string; from: string; to: string
  note: string; notePlaceholder: string; language: string; download: string; generating: string
  loading: string; noneSelected: string; empty: string; emptyClick: (label: string) => string
  invalidRange: string
  loadError: string; genError: string
  personalHint: string
  livePreview: string; previewUpdating: string; previewEmpty: string; previewError: string
}> = {
  de: {
    title: 'PDF-Protokoll erstellen',
    titleShort: 'PDF-Protokoll',
    intro: 'Wähle ein Muster oder setze die Häkchen selbst. Die Vorschau aktualisiert sich live.',
    presets: 'Muster',
    custom: 'Benutzerdefiniert',
    sections: 'Inhalte',
    period: 'Zeitraum',
    from: 'Von', to: 'Bis',
    note: 'Notizen / Fragen',
    notePlaceholder: 'z. B. Fragen an den Arzt oder Coach …',
    language: 'Sprache',
    download: 'PDF herunterladen',
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
  },
  en: {
    title: 'Create PDF report',
    titleShort: 'PDF report',
    intro: 'Pick a template or tick the boxes yourself. The preview updates live.',
    presets: 'Templates',
    custom: 'Custom',
    sections: 'Contents',
    period: 'Period',
    from: 'From', to: 'To',
    note: 'Notes / questions',
    notePlaceholder: 'e.g. questions for your doctor or coach …',
    language: 'Language',
    download: 'Download PDF',
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
  },
}

const DEFAULT_PRESET: PresetId = 'arzt'
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

function revokePreviewUrl(url: string | null | undefined) {
  if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewKey, setPreviewKey] = useState(0)
  const [previewBusy, setPreviewBusy] = useState(false)
  const [previewError, setPreviewError] = useState(false)
  const t = T[lang]
  const prefsReady = useRef(false)
  const initialLoadDone = useRef(false)
  const previewUrlRef = useRef<string | null>(null)
  const loadGenRef = useRef(0)
  const previewGenRef = useRef(0)

  // Sprache nur für Fehlermeldungen — nicht als load-Dependency, sonst setzt ein
  // Sprachwechsel die Häkchen-Auswahl durch einen Reload zurück.
  const langRef = useRef(lang)
  langRef.current = lang

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
            toast.error(T[langRef.current].loadError)
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

  const activePreset: ActivePreset = data
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

  const selectPreset = (id: PresetId) => {
    if (!data) return
    setSelected(new Set(applyPreset(id, data)))
  }

  const toggle = (id: SectionId) => {
    const section = SECTIONS.find(s => s.id === id)
    if (!section) return
    // Leere Abschnitte sind aria-disabled: den Klick faengt der app-weite
    // „geht nicht"-Hinweis ab (src/lib/denyFeedback.ts). Das hier ist nur
    // die Absicherung.
    if (!(availability.get(id) ?? false)) return
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
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

  // Live-Vorschau: Blob-URL + iframe-Remount (data:-URIs werden in Chrome oft weiß
  // und aktualisieren sich nach Range-Wechseln nicht mehr).
  // Auch ohne Häkchen: Cover + Disclaimer rendern (leerer Zeitraum / Forum ohne Daten).
  useEffect(() => {
    if (!data || !isValidRange(range)) {
      setPreviewBusy(false)
      setPreviewError(false)
      revokePreviewUrl(previewUrlRef.current)
      previewUrlRef.current = null
      setPreviewUrl(null)
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
            preset: activePreset === 'custom' ? undefined : activePreset,
          })
          if (cancelled || gen !== previewGenRef.current) return

          const blob = doc.output('blob')
          const url = URL.createObjectURL(blob)
          revokePreviewUrl(previewUrlRef.current)
          previewUrlRef.current = url
          setPreviewUrl(url)
          setPreviewKey(k => k + 1)
        } catch (err) {
          console.error('[pdf-preview]', err)
          if (!cancelled && gen === previewGenRef.current) {
            setPreviewError(true)
            revokePreviewUrl(previewUrlRef.current)
            previewUrlRef.current = null
            setPreviewUrl(null)
          }
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

  useEffect(() => () => {
    revokePreviewUrl(previewUrlRef.current)
  }, [])


  const generate = async () => {
    if (!data || !isValidRange(range)) return
    setGenerating(true)
    try {
      await downloadProtocolPdf(data, {
        lang,
        range,
        sections: [...selected],
        note,
        preset: activePreset,
      })
      if (!isPage) onClose()
    } catch {
      toast.error(t.genError)
    } finally {
      setGenerating(false)
    }
  }

  const showNoteField = selected.has('notes')

  const langToggle = (
    <button
      type="button"
      onClick={() => setLang(lang === 'de' ? 'en' : 'de')}
      className="min-h-11 px-2 text-[13px] font-semibold text-[var(--lg-text-2)]"
      aria-label={t.language}
      title={t.language}
    >
      <span className={lang === 'de' ? 'text-[var(--lg-accent-text)]' : 'text-[var(--lg-text-3)]'}>DE</span>
      <span className="text-[var(--lg-text-3)] mx-0.5">/</span>
      <span className={lang === 'en' ? 'text-[var(--lg-accent-text)]' : 'text-[var(--lg-text-3)]'}>EN</span>
    </button>
  )

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
          </div>
          <div className="flex items-center shrink-0">
            {langToggle}
            <button type="button" onClick={onClose} data-app-back-close aria-label={lang === 'de' ? 'Schließen' : 'Close'} className="lg-icon-btn !text-[var(--lg-text-2)]">
              <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-[var(--lg-fill)]"><X size={17} /></span>
            </button>
          </div>
        </div>

        {/* Muster-Tabs + Inhalt darunter — mobil zuerst */}
        <div className="shrink-0 px-4 pt-2 pb-3">
          <p className="lg-group-title !mx-1">{t.presets}</p>
          <div className="rounded-[18px] bg-[var(--lg-fill)] p-0.5">
            <div
              className="grid grid-cols-3"
              role="tablist"
              aria-label={t.presets}
            >
              {PRESETS.map(preset => {
                const active = activePreset === preset.id
                return (
                  <button
                    key={preset.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    disabled={loading || !data}
                    onClick={() => selectPreset(preset.id)}
                    className={`min-h-9 rounded-full px-2 text-center text-[14px] font-semibold transition-colors disabled:opacity-50 ${
                      active
                        ? 'bg-[var(--lg-fill-selected)] text-[var(--lg-text)] shadow-[0_3px_8px_rgba(0,0,0,0.25)]'
                        : 'text-[var(--lg-text-2)]'
                    }`}
                  >
                    {preset.label[lang]}
                  </button>
                )
              })}
            </div>
            <div
              className={`mt-0.5 rounded-full px-2 py-1.5 text-center text-[12px] font-semibold transition-colors ${
                activePreset === 'custom'
                  ? 'bg-[color-mix(in_srgb,var(--lg-warn)_16%,transparent)] text-[var(--lg-warn-text)]'
                  : 'text-[var(--lg-text-3)]'
              }`}
              aria-live="polite"
            >
              {t.custom}
            </div>
          </div>
          <p className="mt-2 px-1 text-[13px] leading-snug text-[var(--lg-text-2)]">
            {activePreset === 'custom'
              ? t.intro
              : (PRESETS.find(preset => preset.id === activePreset) ?? PRESETS[0]).description[lang]}
          </p>
        </div>

        <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
          <div className={`lg:w-[380px] lg:shrink-0 overflow-y-auto px-4 py-4 space-y-4 ${isPage ? '' : 'max-h-[42vh] lg:max-h-none'}`}>
          <div>
            <p className="lg-group-title !mx-1">{t.period}</p>
            {/* Unter 360 px untereinander, sonst schneidet das Feld die Jahreszahl ab */}
            <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
              <label className="block">
                <span className="label !mb-1">{t.from}</span>
                <input
                  type="date"
                  value={range.from}
                  max={range.to}
                  onChange={e => updateRange({ from: e.target.value })}
                  className="input"
                />
              </label>
              <label className="block">
                <span className="label !mb-1">{t.to}</span>
                <input
                  type="date"
                  value={range.to}
                  min={range.from}
                  onChange={e => updateRange({ to: e.target.value })}
                  className="input"
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
                      {...denyProps(!has, t.emptyClick(s.label[lang]))}
                      title={!has ? t.emptyClick(s.label[lang]) : undefined}
                      onClick={() => toggle(s.id)}
                      aria-pressed={checked && has}
                      className={`flex min-h-11 min-w-0 items-center gap-2 rounded-[14px] px-2.5 py-2 text-left transition-colors ${
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
                      <span lang={lang} className={`min-w-0 flex-1 hyphens-auto [overflow-wrap:break-word] text-[13px] font-medium leading-snug ${has ? 'text-[var(--lg-text)]' : 'text-[var(--lg-text-3)]'}`}>
                        {s.label[lang]}
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

          <div className={`flex-1 ${isPage ? 'min-h-[50vh]' : 'min-h-[38vh]'} lg:min-h-0 flex flex-col`}>
            <div className="shrink-0 px-4 pt-3 pb-1.5 flex items-center justify-between gap-2">
              <p className="lg-group-title !mx-1 !mb-0">{t.livePreview}</p>
              {previewBusy && (
                <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--lg-text-2)]">
                  <Loader2 size={12} className="animate-spin" /> {t.previewUpdating}
                </span>
              )}
            </div>
            <div className="relative mx-4 flex-1 min-h-0 overflow-hidden rounded-[18px] bg-[#d1d1d6]">
              {previewUrl ? (
                <iframe
                  key={previewKey}
                  title={t.livePreview}
                  src={previewUrl}
                  className="absolute inset-0 h-full w-full border-0 bg-white"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-[#3a3a3c]">
                  {previewError ? t.previewError : t.previewEmpty}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="shrink-0 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => { void generate() }}
            // Laden und Erstellen sind gleich vorbei — dort bleibt der Knopf
            // stumm. Ein falscher Zeitraum bleibt, bis man ihn aendert: dort
            // sagt der Knopf, warum er nicht geht.
            disabled={generating || data == null}
            {...denyProps(!isValidRange(range), t.invalidRange)}
            className="lg-btn lg-btn-primary w-full"
          >
            {generating
              ? <><Loader2 size={16} className="animate-spin" /> {t.generating}</>
              : <><Download size={16} /> {t.download}</>}
          </button>
        </div>
      </div>
    </div>
  )
}
