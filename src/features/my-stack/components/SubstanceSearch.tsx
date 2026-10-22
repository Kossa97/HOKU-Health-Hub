import { AlertCircle, Check, Plus, ScanLine, Search, X } from 'lucide-react'
import { useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { STACK_CATEGORIES } from '../lib/categories'
import { istKombination } from '../lib/kombination'
import { SubstanceBrowser } from './SubstanceBrowser'
import type { StackCategory, SubstanceCatalogEntry } from '../types'

export interface SubstanceSearchProps {
  query: string
  /** Die Treffer zur Eingabe. Leer, solange niemand tippt. */
  entries: SubstanceCatalogEntry[]
  /** Der ganze Katalog — fuer das Blaettern, nicht fuer die Suche. */
  allEntries?: SubstanceCatalogEntry[]
  category: StackCategory | null
  /** Der Katalogeintrag, an dem der Entwurf haengt — null bei freier Eingabe. */
  selectedEntry?: SubstanceCatalogEntry | null
  catalogUnavailable?: boolean
  nameError?: boolean
  categoryError?: boolean
  onQueryChange: (query: string) => void
  onSelect: (entry: SubstanceCatalogEntry) => void
  onAddCustom: (name: string) => void
  onDetach: () => void
  onCategoryChange: (category: StackCategory) => void
  /** Die Frage ueber dem Suchfeld — beim Bearbeiten nicht „hinzufuegen". */
  question?: string
  /** Barcode oder Etikett scannen. Fehlt, wo nicht neu angelegt wird. */
  onScan?: () => void
  /**
   * Als eigene Substanz bestaetigt. Erst dann fragt die Seite nach der
   * Kategorie — getippter Text allein waehlt noch nichts, und ein Treffer
   * bringt seine Kategorie mit.
   */
  customConfirmed?: boolean
  /** Eigene Substanz zuruecknehmen: wieder suchen. */
  onUndoCustom?: () => void
}

export function SubstanceSearch({
  query,
  entries,
  allEntries = [],
  category,
  selectedEntry = null,
  catalogUnavailable = false,
  nameError = false,
  categoryError = false,
  onQueryChange,
  onSelect,
  onAddCustom,
  onDetach,
  onCategoryChange,
  question,
  onScan,
  customConfirmed = false,
  onUndoCustom,
}: SubstanceSearchProps) {
  const { t } = useTranslation()
  const hasQuery = query.trim().length > 0
  // „Kombipräparat · Fluticason + Azelastin". Wer „Dymista" waehlt, soll sehen,
  // woraus es besteht — im naechsten Schritt stehen genau diese Zeilen da.
  const kombinationsHinweis = (entry: SubstanceCatalogEntry): string => ([
    String(t('my_stack_combination', { defaultValue: 'Kombipräparat' })),
    (entry.component_names ?? []).join(' + '),
  ].filter(Boolean).join(' · '))
  const inputRef = useRef<HTMLInputElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [resultsDismissed, setResultsDismissed] = useState(false)
  const selectedIndex = entries.length === 0 ? -1 : Math.min(activeIndex, entries.length - 1)
  // Steht eine Katalogwahl, ist die Suche vorbei: keine Trefferliste mehr und
  // kein zweiter Weg daneben. Genau das fehlte — der Zustand „gewaehlt“ hatte
  // kein Aussehen, deshalb liess er sich mit einem Tastendruck zerstoeren,
  // ohne dass jemand es sah.
  const showResults = !selectedEntry && !customConfirmed && hasQuery && entries.length > 0 && !resultsDismissed

  function handleResultsKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      setResultsDismissed(true)
      inputRef.current?.focus()
      return
    }

    if (entries.length === 0) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex(Math.min(selectedIndex + 1, entries.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex(Math.max(selectedIndex - 1, 0))
    } else if (event.key === 'Home') {
      event.preventDefault()
      setActiveIndex(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      setActiveIndex(entries.length - 1)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelect(entries[selectedIndex])
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="stack-substance-search" className="mb-2 block text-sm font-semibold text-slate-200">
          {question ?? t('my_stack_question', { defaultValue: 'Was möchtest du hinzufügen?' })}
        </label>
        {selectedEntry ? (
          <div
            data-substance-selected={selectedEntry.id}
            className="flex min-h-11 items-center gap-3 rounded-xl border border-[color:var(--accent-border)] bg-[color:var(--accent-weak)] px-3 py-2"
          >
            <Check aria-hidden="true" size={18} className="shrink-0 text-[color:var(--accent)]" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-white">{selectedEntry.canonical_name}</span>
              <span data-substance-selected-hint className="block truncate text-[12px] text-slate-400">
                {istKombination(selectedEntry)
                  ? kombinationsHinweis(selectedEntry)
                  : selectedEntry.pk_profile_id
                    ? t('my_stack_from_catalog_pk', { defaultValue: 'Aus dem Katalog · PK-Profil vorhanden' })
                    : t('my_stack_from_catalog', { defaultValue: 'Aus dem Katalog' })}
              </span>
            </span>
            <button
              type="button"
              onClick={onDetach}
              aria-label={String(t('my_stack_detach_catalog', { defaultValue: 'Auswahl lösen' }))}
              className="grid min-h-11 min-w-11 shrink-0 cursor-pointer place-items-center rounded-lg text-slate-400 transition-colors duration-200 hover:bg-white/[0.08] hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 motion-reduce:transition-none"
            >
              <X aria-hidden="true" size={18} />
            </button>
          </div>
        ) : customConfirmed ? (
          <div
            data-substance-custom
            className="flex min-h-11 items-center gap-3 rounded-xl border border-[color:var(--accent-border)] bg-[color:var(--accent-weak)] px-3 py-2"
          >
            <Check aria-hidden="true" size={18} className="shrink-0 text-[color:var(--accent)]" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-white">{query}</span>
              <span className="block truncate text-[12px] text-slate-400">{t('my_stack_custom_substance', { defaultValue: 'Eigene Substanz' })}</span>
            </span>
            {onUndoCustom && (
              <button
                type="button"
                onClick={onUndoCustom}
                aria-label={String(t('my_stack_detach_catalog', { defaultValue: 'Auswahl lösen' }))}
                className="grid min-h-11 min-w-11 shrink-0 cursor-pointer place-items-center rounded-lg text-slate-400 transition-colors duration-200 hover:bg-white/[0.08] hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 motion-reduce:transition-none"
              >
                <X aria-hidden="true" size={18} />
              </button>
            )}
          </div>
        ) : (
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input
                ref={inputRef}
                id="stack-substance-search"
                type="search"
                value={query}
                onChange={event => {
                  setResultsDismissed(false)
                  onQueryChange(event.target.value)
                }}
                data-field="displayName"
                aria-invalid={nameError || undefined}
                aria-describedby={nameError ? 'stack-substance-name-error' : undefined}
                autoComplete="off"
                className="input min-h-11 w-full pl-11 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                placeholder={String(t('my_stack_search_placeholder', { defaultValue: 'Substanz oder Produkt suchen' }))}
              />
            </div>
            {onScan && (
              <button
                type="button"
                data-substance-scan
                onClick={onScan}
                aria-label={String(t('my_stack_scan', { defaultValue: 'Scannen' }))}
                className="grid min-h-11 min-w-11 shrink-0 cursor-pointer place-items-center rounded-xl border border-slate-400/20 bg-slate-400/[0.06] text-slate-200 transition-colors duration-200 hover:border-sky-400/30 hover:bg-sky-400/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 motion-reduce:transition-none"
              >
                <ScanLine aria-hidden="true" size={20} />
              </button>
            )}
          </div>
        )}
        {nameError && (
          <p id="stack-substance-name-error" role="alert" className="mt-2 flex items-center gap-2 text-sm text-rose-300">
            <AlertCircle aria-hidden="true" size={16} />
            {t('my_stack_name_required', { defaultValue: 'Bitte wähle oder benenne eine Substanz.' })}
          </p>
        )}
      </div>

      {showResults && (
        <div
          role="listbox"
          tabIndex={0}
          aria-activedescendant={`stack-substance-option-${selectedIndex}`}
          aria-label={String(t('my_stack_catalog_results', { defaultValue: 'Katalogtreffer' }))}
          onKeyDown={handleResultsKeyDown}
          className="space-y-2 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          {entries.map((entry, index) => (
            <button
              key={entry.id}
              id={`stack-substance-option-${index}`}
              type="button"
              role="option"
              tabIndex={-1}
              aria-selected={index === selectedIndex}
              onMouseMove={() => setActiveIndex(index)}
              onClick={() => onSelect(entry)}
              className={`min-h-11 w-full cursor-pointer rounded-2xl border px-4 py-3 text-left transition-colors duration-200 focus-visible:outline-none motion-reduce:transition-none ${index === selectedIndex
                ? 'border-sky-400/40 bg-sky-400/[0.08]'
                : 'border-slate-400/20 bg-slate-400/[0.06] hover:border-sky-400/30 hover:bg-sky-400/[0.06]'
              }`}
            >
              <span className="block font-semibold text-white">{entry.canonical_name}</span>
              {istKombination(entry) && (
                <span data-substance-combination className="mt-1 block text-sm text-[color:var(--accent)]">
                  {kombinationsHinweis(entry)}
                </span>
              )}
              {entry.aliases.length > 0 && (
                <span className="mt-1 block text-sm text-slate-400">{entry.aliases.join(', ')}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Blaettern statt tippen. Nur solange nichts gewaehlt und nichts
          getippt ist: wer schon sucht, will Treffer sehen, keine Liste
          daneben. */}
      {!selectedEntry && !customConfirmed && !hasQuery && allEntries.length > 0 && (
        <SubstanceBrowser entries={allEntries} onSelect={onSelect} />
      )}

      {!selectedEntry && !customConfirmed && hasQuery && (
        <button
          type="button"
          onClick={() => onAddCustom(query)}
          className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-sky-400/30 bg-sky-400/[0.06] px-4 py-3 font-semibold text-sky-300 transition-colors duration-200 hover:bg-sky-400/[0.11] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 motion-reduce:transition-none"
        >
          <Plus aria-hidden="true" size={18} />
          {t('my_stack_add_custom', { defaultValue: 'Als eigene Substanz hinzufügen' })}
        </button>
      )}

      {catalogUnavailable && (
        <p className="flex items-start gap-2 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-3 text-sm text-amber-100">
          <AlertCircle aria-hidden="true" className="mt-0.5 shrink-0" size={16} />
          {t('my_stack_catalog_unavailable', { defaultValue: 'Der Katalog ist gerade nicht erreichbar. Freie Eingabe bleibt verfügbar.' })}
        </p>
      )}

      {/* Das Kategoriefeld gilt nur der eigenen Substanz — und erst, wenn sie
          als solche bestaetigt ist. Ein Katalogeintrag bringt seine Kategorie
          mit (`catalog_selected` setzt sie), und getippter Text ist noch keine
          Wahl. Sichtbar bleibt sie in der Zusammenfassung. */}
      {!selectedEntry && customConfirmed && (
      <div>
        <label htmlFor="stack-category" className="mb-2 block text-sm font-semibold text-slate-200">
          {t('my_stack_category', { defaultValue: 'Kategorie' })}
        </label>
        <select
          id="stack-category"
          value={category ?? ''}
          onChange={event => onCategoryChange(event.target.value as StackCategory)}
          data-field="category"
          aria-invalid={categoryError || undefined}
          aria-describedby={categoryError ? 'stack-category-error' : undefined}
          className="select min-h-11 w-full text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          <option value="">{t('my_stack_category_select', { defaultValue: 'Kategorie wählen' })}</option>
          {STACK_CATEGORIES.map(option => (
            <option key={option.key} value={option.key}>{t(option.labelKey)}</option>
          ))}
        </select>
        {categoryError && (
          <p id="stack-category-error" role="alert" className="mt-2 flex items-center gap-2 text-sm text-rose-300">
            <AlertCircle aria-hidden="true" size={16} />
            {t('my_stack_category_required', { defaultValue: 'Bitte wähle eine Kategorie.' })}
          </p>
        )}
      </div>
      )}
    </div>
  )
}
