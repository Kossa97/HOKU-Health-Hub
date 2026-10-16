import type { SortAbility } from '../lib/stackSort'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, FlaskConical, List, Search, MoreHorizontal, X, Archive, ChevronRight } from 'lucide-react'
import { type Peptide, type PeptideSortKey, PEPTIDE_SORT_GROUPS, SORT_OPTION_LABEL_KEYS } from './model'

const GHOST_BUTTON = 'stack-head-btn stack-head-btn--ghost flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/70 text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400'

/**
 * Kopfzeile: Titel mit Anzahl, dann Suche · Menue · Plus.
 *
 * Drei Knoepfe, jede Aktion an genau einer Stelle. Plus ist die Hauptaktion
 * und steht ganz rechts am Daumen. Alles, was man selten braucht — Ansicht,
 * Sortierung, Archiv — liegt im Menue; vorher stand das Archiv zweimal da,
 * einmal als Knopf und einmal im Menue.
 */
export function MyStackHeader({
  searchOpen,
  peptides,
  searchInputRef,
  search,
  setSearch,
  closeSearch,
  handleNewPeptide,
  setSearchOpen,
  setFilterOpen,
  setArchiveViewOpen,
  loadArchived,
  archivedCount,
  filterOpen,
  setViewMode,
  viewMode,
  wirksameSortierung,
  setSortBy,
  moeglicheSortierungen,
}: {
  searchOpen: boolean
  peptides: Peptide[]
  searchInputRef: RefObject<HTMLInputElement | null>
  search: string
  setSearch: Dispatch<SetStateAction<string>>
  closeSearch: () => void
  handleNewPeptide: () => void
  setSearchOpen: Dispatch<SetStateAction<boolean>>
  setFilterOpen: Dispatch<SetStateAction<boolean>>
  setArchiveViewOpen: Dispatch<SetStateAction<boolean>>
  loadArchived: () => Promise<void>
  archivedCount: number
  filterOpen: boolean
  setViewMode: (mode: "vials" | "list") => void
  viewMode: "vials" | "list"
  wirksameSortierung: PeptideSortKey
  setSortBy: Dispatch<SetStateAction<PeptideSortKey>>
  moeglicheSortierungen: Set<SortAbility>
}) {
  const { t } = useTranslation()

  // Das Archiv wird erst beim Oeffnen des Menues geladen — dann steht seine
  // Anzahl in der Zeile, bevor man sie antippt.
  useEffect(() => {
    if (!filterOpen) return
    void loadArchived()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFilterOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterOpen])

  const viewOptions = [
    { mode: 'vials' as const, icon: FlaskConical, label: t('my_stack_view_vials') },
    { mode: 'list' as const, icon: List, label: t('my_stack_view_list') },
  ]

  return (
    <>
      <div className="relative mb-4 flex shrink-0 items-center gap-2">
        {/* Titel — kollabiert smooth, sobald die Suche geöffnet wird */}
        <div className={`flex min-w-0 items-center gap-2 overflow-hidden transition-[max-width,opacity] duration-300 ${searchOpen ? 'max-w-0 opacity-0' : 'max-w-[70%] opacity-100'}`}>
          <FlaskConical size={18} className="shrink-0 text-sky-400" />
          <h2 className="min-w-0 truncate font-semibold text-white">{t('meine_peptide')}</h2>
          {peptides.length > 0 && (
            <span className="badge shrink-0 bg-slate-700 text-slate-400">{peptides.length}</span>
          )}
        </div>

        {peptides.length > 0 && (
          <>
            {/* Suchfeld — wächst smooth von rechts in die Zeile */}
            <div className={`relative overflow-hidden transition-[max-width] duration-300 ease-out ${searchOpen ? 'max-w-full flex-1' : 'max-w-0'}`}>
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                ref={searchInputRef}
                className="input w-full pl-9 text-sm"
                placeholder={t('peptid_suchen')}
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Escape') closeSearch() }}
              />
            </div>

            {!searchOpen && <div className="flex-1" />}

            {/* Lupe / Schließen */}
            <button
              type="button"
              onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
              aria-label={searchOpen ? t('close') : t('peptid_suchen')}
              className={GHOST_BUTTON}
            >
              {searchOpen ? <X size={18} /> : <Search size={18} />}
            </button>

            {/* Menue: Ansicht, Sortierung, Archiv */}
            {!searchOpen && (
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setFilterOpen(o => !o)}
                  aria-label={t('my_stack_more_options')}
                  title={t('my_stack_more_options')}
                  aria-haspopup="true"
                  aria-expanded={filterOpen}
                  data-my-stack-menu
                  className={filterOpen
                    ? 'stack-head-btn flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-400/50 bg-cyan-400/10 text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400'
                    : GHOST_BUTTON}
                >
                  <MoreHorizontal size={18} />
                </button>

                {filterOpen && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setFilterOpen(false)} />
                    <div className="stack-menu absolute right-0 top-full z-30 mt-2 w-60 space-y-3 rounded-2xl border border-slate-800 bg-[var(--surface-raised)] p-3 shadow-2xl">
                      <div>
                        <p className="mb-1.5 text-xs font-semibold text-slate-400">{t('my_stack_view')}</p>
                        <div role="radiogroup" aria-label={t('my_stack_view')} className="flex rounded-xl border border-slate-800 bg-slate-900/70 p-1">
                          {viewOptions.map(({ mode, icon: Icon, label }) => (
                            <button
                              key={mode}
                              type="button"
                              role="radio"
                              aria-checked={viewMode === mode}
                              onClick={() => setViewMode(mode)}
                              className={`flex min-h-8 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                                viewMode === mode ? 'bg-cyan-400 text-slate-950' : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              <Icon size={14} /> {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="mb-1.5 text-xs font-semibold text-slate-400">{t('sort_aria_label')}</p>
                        <select
                          className="select w-full pr-8 text-sm"
                          value={wirksameSortierung}
                          aria-label={t('sort_aria_label')}
                          onChange={e => setSortBy(e.target.value as PeptideSortKey)}
                        >
                          <option value="active_name">{t('sort_option_active_name')}</option>
                          {PEPTIDE_SORT_GROUPS
                            .filter(group => !group.needs || moeglicheSortierungen.has(group.needs))
                            .map(group => (
                            <optgroup key={group.labelKey} label={t(group.labelKey)}>
                              {group.options.map(key => (
                                <option key={key} value={key}>{t(SORT_OPTION_LABEL_KEYS[key])}</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </div>
                      <div className="border-t border-slate-800 pt-2">
                        <button
                          type="button"
                          onClick={() => { setFilterOpen(false); setArchiveViewOpen(true) }}
                          aria-label={t('archiv')}
                          data-my-stack-archive
                          className="stack-head-btn flex min-h-10 w-full items-center gap-2.5 rounded-xl px-2 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/[0.04] hover:text-white"
                        >
                          <Archive size={16} className="text-slate-400" />
                          <span className="flex-1 text-left">{t('archiv')}</span>
                          {archivedCount > 0 && (
                            <span className="text-xs font-semibold tabular-nums text-slate-500">{archivedCount}</span>
                          )}
                          <ChevronRight size={16} className="text-slate-500" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Neue Substanz — die Hauptaktion der Seite, deshalb als einziger
                Knopf gefuellt und ganz rechts, in beiden Ansichten. Die
                „Neu"-Kachel im Karussell steht links vor der ersten Substanz
                und ist nur per Wisch zu finden; von hier aus braucht man sie
                nicht zu kennen. Er bleibt auch bei offener Suche stehen:
                findet sie nichts, ist genau das der Moment, die Substanz
                anzulegen. */}
            <button
              type="button"
              onClick={handleNewPeptide}
              aria-label={String(t('neues_peptid_title'))}
              title={String(t('neues_peptid_title'))}
              data-my-stack-add
              data-ob="btn-peptid-anlegen"
              className="stack-head-btn flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-400 text-slate-950 shadow-[0_0_18px_rgba(34,211,238,0.28)] hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
            >
              <Plus size={20} strokeWidth={2.4} aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    </>
  )
}
