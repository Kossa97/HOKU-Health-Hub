// src/pages/PeptideLibrary.tsx
import { useState, useMemo } from 'react'
import { FlaskConical, Search, SlidersHorizontal, X } from 'lucide-react'
import { peptipediaText } from '../features/peptipedia/content/legacyLabels'
import { PEPTIPEDIA_UI_COPY } from '../features/peptipedia/content/uiCopy'
import { getPublishedPeptides } from '../features/peptipedia/content'
import type { PeptipediaLocale, PeptideCategory, ResearchStatus } from '../features/peptipedia/content/types'
import { PeptideCard } from './lab/PeptideCard'
import { usePeptipediaHead } from '../features/peptipedia/usePeptipediaHead'
import type { PeptipediaMode } from '../features/peptipedia/routing'

// ─── Filter/Sort types ────────────────────────────────────────────────────────

type SortKey = 'sort_order' | 'name_asc' | 'name_desc'

interface Filters {
  kind:          'all' | 'individual' | 'blend'
  category:      PeptideCategory | 'all'
  status:        ResearchStatus  | 'all'
  humanEvidence: 'all' | 'yes' | 'strong'
  tag:           string
}

const DEFAULT_FILTERS: Filters = {
  kind:          'all',
  category:      'all',
  status:        'all',
  humanEvidence: 'all',
  tag:           '',
}

const SORT_OPTIONS: Array<{ value: SortKey; labelKey: string }> = [
  { value: 'sort_order',  labelKey: 'plib_sort_default' },
  { value: 'name_asc',    labelKey: 'plib_sort_name_asc' },
  { value: 'name_desc',   labelKey: 'plib_sort_name_desc' },
]

const CATEGORIES: Array<{ value: PeptideCategory | 'all'; labelKey: string }> = [
  { value: 'all',              labelKey: 'plib_all' },
  { value: 'heilung',          labelKey: 'plib_cat_s_heilung' },
  { value: 'wachstumshormon',  labelKey: 'plib_cat_wachstumshormon' },
  { value: 'stoffwechsel',     labelKey: 'plib_cat_stoffwechsel' },
  { value: 'nootropikum',      labelKey: 'plib_cat_nootropikum' },
  { value: 'anti_aging',       labelKey: 'plib_cat_anti_aging' },
  { value: 'sexualgesundheit', labelKey: 'plib_cat_sexualgesundheit' },
  { value: 'grundlagen',       labelKey: 'plib_cat_grundlagen' },
]

// ─── Pill Button ─────────────────────────────────────────────────────────────

function Pill({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-9 px-3 rounded-lg text-[14px] transition-colors duration-150 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--lg-accent)] ${
        active
          ? 'bg-[var(--lg-fill-selected)] text-[var(--lg-text)]'
          : 'bg-[var(--lg-fill)] text-[var(--lg-text-2)]'
      }`}
    >
      {children}
    </button>
  )
}

// ─── Main ────────────────────────────────────────────────────────────────────

export function PeptideLibrary({ locale = 'de', mode = 'public' }: { locale?: PeptipediaLocale; mode?: PeptipediaMode }) {
  usePeptipediaHead(locale, undefined, mode === 'public')
  const t = peptipediaText(locale)
  const peptides = useMemo(() => getPublishedPeptides(locale), [locale])
  const [query, setQuery]             = useState('')
  const [filters, setFilters]         = useState<Filters>(DEFAULT_FILTERS)
  const [sort, setSort]               = useState<SortKey>('sort_order')
  const [showFilters, setShowFilters] = useState(false)

  // Collect all unique tags
  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    peptides.forEach(p => (p.researchAreas ?? []).forEach(t => tagSet.add(t)))
    return Array.from(tagSet).sort()
  }, [peptides])

  // Count active filters
  const activeFilterCount = [
    filters.kind !== 'all',
    filters.category !== 'all',
    filters.status   !== 'all',
    filters.humanEvidence !== 'all',
    filters.tag      !== '',
    sort             !== 'sort_order',
  ].filter(Boolean).length

  // Filter + Sort
  const filtered = useMemo(() => {
    let list = [...peptides]

    // Text search
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.tldr.toLowerCase().includes(q) ||
        (p.fullName ?? '').toLowerCase().includes(q) ||
        (p.aliases ?? []).some(alias => alias.toLowerCase().includes(q)) ||
        (p.blend?.components ?? []).some(component => component.name.toLowerCase().includes(q)) ||
        (p.researchAreas ?? []).some(t => t.toLowerCase().includes(q))
      )
    }

    // Category
    if (filters.kind !== 'all') list = list.filter(p => filters.kind === 'blend' ? !!p.blend : !p.blend)
    if (filters.category !== 'all') list = list.filter(p => p.category === filters.category)

    // Status
    if (filters.status !== 'all') list = list.filter(p => p.researchStatus === filters.status)

    // Human evidence
    if (filters.humanEvidence === 'yes') {
      list = list.filter(p => p.evidenceMatrix.human !== 'none')
    } else if (filters.humanEvidence === 'strong') {
      list = list.filter(p => p.evidenceMatrix.human === 'strong' || p.evidenceMatrix.human === 'moderate')
    }

    // Tag
    if (filters.tag) {
      list = list.filter(p => (p.researchAreas ?? []).includes(filters.tag))
    }

    // Sort
    list.sort((a, b) => {
      if (sort === 'name_asc')   return a.name.localeCompare(b.name)
      if (sort === 'name_desc')  return b.name.localeCompare(a.name)
      return 0
    })

    return list
  }, [peptides, query, filters, sort])

  function resetFilters() {
    setFilters(DEFAULT_FILTERS)
    setSort('sort_order')
    setQuery('')
  }

  return (
    <div>
      {/* Hero */}
      <div className="mb-4">
        <div>
          <p className="mb-1 text-[13px] text-[var(--lg-text-3)]">{t('plib_hero_kicker')}</p>
          <h1 className="lg-large-title">Peptipedia</h1>
          <p className="mt-1 mb-4 text-[15px] leading-snug text-[var(--lg-text-2)]">{t('plib_hero_sub')}</p>

          {/* Search + Filter toggle */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={16} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--lg-text-3)] pointer-events-none" />
              <input type="search" aria-label={t('plib_search_placeholder')} value={query} onChange={e => setQuery(e.target.value)}
                placeholder={t('plib_search_placeholder')}
                className="min-h-11 w-full bg-[var(--lg-fill)] border-0 rounded-[10px] pl-9 pr-4 py-2.5 text-[16px] text-[var(--lg-text)] placeholder:text-[var(--lg-text-3)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--lg-accent)]" />
            </div>
            <button type="button" aria-label={locale === 'de' ? 'Filter anzeigen' : 'Show filters'} aria-expanded={showFilters} onClick={() => setShowFilters(f => !f)}
              className={`flex min-h-11 min-w-11 items-center justify-center gap-1.5 px-3 rounded-[10px] text-sm transition-colors duration-150 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--lg-accent)] ${
                showFilters || activeFilterCount > 0
                  ? 'bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] text-[var(--lg-accent-text)]'
                  : 'bg-[var(--lg-fill)] text-[var(--lg-text-2)]'
              }`}>
              <SlidersHorizontal size={16} strokeWidth={1.5} />
              {activeFilterCount > 0 && <span className="font-mono text-[13px] tabular-nums">{activeFilterCount}</span>}
            </button>
          </div>
        </div>
      </div>

      {/* ── Filter Panel ──────────────────────────────────────────────────────── */}
      {showFilters && (
        <div className="lg-surface p-4 mb-4 space-y-4">

          {/* Sort */}
          <div>
            <p className="mb-2 text-[13px] text-[var(--lg-text-3)]">{t('plib_sort_label')}</p>
            <div className="flex flex-wrap gap-2">
              {SORT_OPTIONS.map(o => (
                <Pill key={o.value} active={sort === o.value} onClick={() => setSort(o.value)}>
                  {t(o.labelKey)}
                </Pill>
              ))}
            </div>
          </div>

          {/* Category */}
          <div>
            <p className="mb-2 text-[13px] text-[var(--lg-text-3)]">{t('plib_category_label')}</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(c => (
                <Pill key={c.value} active={filters.category === c.value}
                  onClick={() => setFilters(f => ({ ...f, category: c.value }))}>
                  {t(c.labelKey)}
                </Pill>
              ))}
            </div>
          </div>

          {/* Research Status */}
          <div>
            <p className="mb-2 text-[13px] text-[var(--lg-text-3)]">{t('plib_status_label')}</p>
            <div className="flex flex-wrap gap-2">
              {([['all', 'plib_all'], ['preclinical', 'plib_status_preclinical'], ['phase_1', 'plib_status_phase_1'], ['phase_2', 'plib_status_phase_2'], ['human_research', 'plib_status_human_research'], ['historical_approval', 'plib_status_historical_approval'], ['approved', 'plib_status_approved'], ['unverified', 'plib_status_unverified']] as const).map(([val, labelKey]) => (
                <Pill key={val} active={filters.status === val}
                  onClick={() => setFilters(f => ({ ...f, status: val }))}>
                  {t(labelKey)}
                </Pill>
              ))}
            </div>
          </div>

          {/* Human Evidence */}
          <div>
            <p className="mb-2 text-[13px] text-[var(--lg-text-3)]">{t('plib_human_evidence_label')}</p>
            <div className="flex flex-wrap gap-2">
              {([['all', 'plib_all'], ['yes', 'plib_human_yes'], ['strong', 'plib_human_strong']] as const).map(([val, labelKey]) => (
                <Pill key={val} active={filters.humanEvidence === val}
                  onClick={() => setFilters(f => ({ ...f, humanEvidence: val }))}>
                  {t(labelKey)}
                </Pill>
              ))}
            </div>
          </div>

          {/* Tags */}
          {allTags.length > 0 && (
            <div>
              <p className="mb-2 text-[13px] text-[var(--lg-text-3)]">{t('plib_tags_label')}</p>
              <div className="flex flex-wrap gap-2">
                <Pill active={filters.tag === ''} onClick={() => setFilters(f => ({ ...f, tag: '' }))}>
                  {t('plib_all')}
                </Pill>
                {allTags.map(tag => (
                  <Pill key={tag} active={filters.tag === tag}
                    onClick={() => setFilters(f => ({ ...f, tag: f.tag === tag ? '' : tag }))}>
                    {tag}
                  </Pill>
                ))}
              </div>
            </div>
          )}

          {/* Reset */}
          {activeFilterCount > 0 && (
            <button type="button" onClick={resetFilters}
              className="flex min-h-11 items-center gap-1.5 text-[15px] font-medium text-[var(--lg-accent-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--lg-accent)]">
              <X size={16} strokeWidth={1.5} />
              {t('plib_reset_filters')}
            </button>
          )}
        </div>
      )}

      {/* ── Category quick tabs (if no filter panel) ─────────────────────────── */}
      {!showFilters && (
        <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>button]:shrink-0">
          {CATEGORIES.map(cat => (
            <Pill key={cat.value} active={filters.category === cat.value}
              onClick={() => setFilters(f => ({ ...f, category: cat.value }))}>
              {t(cat.labelKey)}
            </Pill>
          ))}
        </div>
      )}

      <div className="flex gap-2 flex-wrap mb-3" role="group" aria-label={locale === 'de' ? 'Profiltyp' : 'Profile type'}>
        {(['all', 'individual', 'blend'] as const).map(kind => <Pill key={kind} active={filters.kind === kind} onClick={() => setFilters(f => ({ ...f, kind }))}>
          {kind === 'blend' ? 'Blends' : kind === 'individual' ? (locale === 'de' ? 'Einzelprofile' : 'Individual profiles') : (locale === 'de' ? 'Alle Profile' : 'All profiles')}
        </Pill>)}
      </div>

      {/* Count */}
      {(
        <p className="mx-1 mb-3 text-[13px] text-[var(--lg-text-3)]">
          {t('plib_count', { count: filtered.length })}
          {activeFilterCount > 0 && ` · ${t('plib_filtered')}`}
        </p>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(peptide => <PeptideCard key={peptide.slug} peptide={peptide} locale={locale} mode={mode} />)}
      </div>

      {/* Empty */}
      {filtered.length === 0 && (
        <div className="text-center py-12 text-[var(--lg-text-3)]">
          <FlaskConical size={28} strokeWidth={1.5} className="mx-auto mb-3" />
          <p className="text-[15px] text-[var(--lg-text-2)]">{t('plib_empty')}</p>
          {activeFilterCount > 0 && (
            <button type="button" onClick={resetFilters}
              className="mt-2 min-h-11 text-[15px] font-medium text-[var(--lg-accent-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--lg-accent)]">
              {t('plib_reset_filters_short')}
            </button>
          )}
        </div>
      )}

      <div className="mt-8 flex items-start gap-2 rounded-2xl bg-[var(--lg-surface-2)] px-4 py-3">
        <FlaskConical size={16} strokeWidth={1.5} className="text-[var(--lg-warn-text)] shrink-0 mt-px" />
        <p className="text-[13px] text-[var(--lg-text-2)] leading-snug">
          {PEPTIPEDIA_UI_COPY[locale].disclaimer}
        </p>
      </div>
    </div>
  )
}
