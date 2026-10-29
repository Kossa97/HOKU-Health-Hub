import type { SortAbility } from '../lib/stackSort'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, FlaskConical, List, Search, MoreHorizontal, X, Archive, ChevronRight } from 'lucide-react'
import { type Peptide, type PeptideSortKey, PEPTIDE_SORT_GROUPS, SORT_OPTION_LABEL_KEYS } from './model'

/** Glas-Knopf der Titelzeile: 44 px rund, wie der Profil-Knopf der Startseite. */
const GLASS_BUTTON = 'stack-head-btn lg-glass lg-icon-btn shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400'

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
      <div className="relative mb-3 flex min-h-11 shrink-0 items-center gap-2 px-1">
        {/* Titel — groß wie in iOS; kollabiert smooth, sobald die Suche geöffnet wird */}
        <div className={`flex min-w-0 items-baseline gap-2 overflow-hidden transition-[max-width,opacity] duration-300 ${searchOpen ? 'max-w-0 opacity-0' : 'max-w-[70%] opacity-100'}`}>
          <h2 className="lg-large-title min-w-0 truncate">{t('meine_peptide')}</h2>
          {peptides.length > 0 && (
            <span className="shrink-0 text-xl font-semibold tabular-nums text-[var(--lg-text-3)]">{peptides.length}</span>
          )}
        </div>

        {peptides.length > 0 && (
          <>
            {/* Suchfeld — wächst smooth von rechts in die Zeile */}
            <div className={`relative overflow-hidden transition-[max-width] duration-300 ease-out ${searchOpen ? 'max-w-full flex-1' : 'max-w-0'}`}>
              <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--lg-text-3)]" />
              <input
                ref={searchInputRef}
                className="stack-search w-full"
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
              className={GLASS_BUTTON}
            >
              {searchOpen ? <X size={18} /> : <Search size={19} />}
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
                  data-open={filterOpen || undefined}
                  className={GLASS_BUTTON}
                >
                  <MoreHorizontal size={20} />
                </button>

                {filterOpen && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setFilterOpen(false)} />
                    <div className="stack-menu lg-glass absolute right-0 top-full z-30 mt-2 w-64 space-y-3 rounded-[22px] p-3">
                      <div>
                        <p className="stack-menu-label">{t('my_stack_view')}</p>
                        <div role="radiogroup" aria-label={t('my_stack_view')} className="stack-menu-seg">
                          {viewOptions.map(({ mode, icon: Icon, label }) => (
                            <button
                              key={mode}
                              type="button"
                              role="radio"
                              aria-checked={viewMode === mode}
                              onClick={() => setViewMode(mode)}
                              className="flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-[13px] font-semibold"
                            >
                              <Icon size={15} /> {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="stack-menu-label">{t('sort_aria_label')}</p>
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
                      <div className="border-t border-[var(--lg-separator)] pt-2">
                        <button
                          type="button"
                          onClick={() => { setFilterOpen(false); setArchiveViewOpen(true) }}
                          aria-label={t('archiv')}
                          data-my-stack-archive
                          className="stack-head-btn flex min-h-11 w-full items-center gap-3 rounded-2xl px-2 text-[15px] font-semibold text-[var(--lg-text)] transition-colors active:bg-white/[0.08]"
                        >
                          <span aria-hidden="true" className="lg-icon-tile !h-7 !w-7 bg-[#8e8e93]">
                            <Archive size={15} />
                          </span>
                          <span className="flex-1 text-left">{t('archiv')}</span>
                          {archivedCount > 0 && (
                            <span className="text-[15px] tabular-nums text-[var(--lg-text-3)]">{archivedCount}</span>
                          )}
                          <ChevronRight size={16} className="text-[var(--lg-text-4)]" />
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
              className="stack-head-btn lg-btn-primary lg-icon-btn shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
            >
              <Plus size={22} strokeWidth={2.4} aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    </>
  )
}
