import type { SortAbility } from '../lib/stackSort'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, FlaskConical, List, Search, SlidersHorizontal, X, Archive } from 'lucide-react'
import { type Peptide, type PeptideSortKey, PEPTIDE_SORT_GROUPS, SORT_OPTION_LABEL_KEYS } from './model'

/**
 * Kopfzeile: Titel mit Anzahl, Plus (Neue Substanz), Suche, Archiv und Ansicht/Sortierung.
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
  filterOpen: boolean
  setViewMode: (mode: "vials" | "list") => void
  viewMode: "vials" | "list"
  wirksameSortierung: PeptideSortKey
  setSortBy: Dispatch<SetStateAction<PeptideSortKey>>
  moeglicheSortierungen: Set<SortAbility>
}) {
  const { t } = useTranslation()
  return (
    <>
      <div className="relative mb-4 flex shrink-0 items-center gap-2">
        {/* Titel — kollabiert smooth, sobald die Suche geöffnet wird */}
        <div className={`flex min-w-0 items-center gap-2 overflow-hidden transition-all duration-300 ${searchOpen ? 'max-w-0 opacity-0' : 'max-w-[70%] opacity-100'}`}>
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

            {/* Neue Substanz — die Hauptaktion der Seite, deshalb als einziger
                Knopf gefuellt, in beiden Ansichten. Die „Neu"-Kachel im
                Karussell steht links vor der ersten Substanz und ist nur per
                Wisch zu finden; von hier aus braucht man sie nicht zu kennen.
                Der gestrichelte Knopf ueber der Liste ist damit entfallen.
                Er bleibt auch bei offener Suche stehen: findet sie nichts,
                ist genau das der Moment, die Substanz anzulegen. */}
            <button
              type="button"
              onClick={handleNewPeptide}
              aria-label={String(t('neues_peptid_title'))}
              title={String(t('neues_peptid_title'))}
              data-my-stack-add
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-400 text-slate-950 shadow-[0_0_18px_rgba(34,211,238,0.28)] transition-colors hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
            >
              <Plus size={20} strokeWidth={2.4} aria-hidden="true" />
            </button>

            {/* Lupe / Schließen */}
            <button
              type="button"
              onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
              aria-label={searchOpen ? t('close') : t('peptid_suchen')}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/70 text-slate-300 transition-colors hover:border-cyan-400/50 hover:text-cyan-300"
            >
              {searchOpen ? <X size={18} /> : <Search size={18} />}
            </button>

            {!searchOpen && (
              <button
                type="button"
                onClick={() => { setFilterOpen(false); setArchiveViewOpen(true); loadArchived() }}
                aria-label={t('archiv')}
                title={t('archiv')}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/70 text-slate-300 transition-colors hover:border-cyan-400/50 hover:text-cyan-300"
              >
                <Archive size={18} />
              </button>
            )}

            {/* Ansicht + Sortierung (Popover) */}
            {!searchOpen && (
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setFilterOpen(o => !o)}
                  aria-label={t('sort_aria_label')}
                  aria-expanded={filterOpen}
                  className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-colors ${
                    filterOpen
                      ? 'border-cyan-400/50 bg-cyan-400/10 text-cyan-300'
                      : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-cyan-400/50 hover:text-cyan-300'
                  }`}
                >
                  <SlidersHorizontal size={18} />
                </button>

                {filterOpen && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setFilterOpen(false)} />
                    <div className="absolute right-0 top-full z-30 mt-2 w-56 space-y-3 rounded-xl border border-slate-800 bg-[var(--surface-raised)] p-3 shadow-2xl">
                      <div>
                        <p className="mb-1.5 text-xs font-semibold text-slate-400">Ansicht</p>
                        <div className="flex rounded-xl border border-slate-800 bg-slate-900/70 p-1">
                          <button
                            type="button"
                            onClick={() => setViewMode('vials')}
                            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                              viewMode === 'vials' ? 'bg-cyan-400 text-slate-950' : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            <FlaskConical size={14} /> Vials
                          </button>
                          <button
                            type="button"
                            onClick={() => setViewMode('list')}
                            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                              viewMode === 'list' ? 'bg-cyan-400 text-slate-950' : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            <List size={14} /> Liste
                          </button>
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
                      <button
                        type="button"
                        onClick={() => { setFilterOpen(false); setArchiveViewOpen(true); loadArchived() }}
                        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-cyan-400/50 hover:text-cyan-300"
                      >
                        <Archive size={14} /> {t('archiv')}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
