// src/pages/lab/StudySidebar.tsx
import { useTranslation } from 'react-i18next'
import type { FilterState, SortMode, StudyTypeFilter, YearFilter } from './pubmed'

interface StudySidebarProps {
  filters: FilterState
  onFilterChange: (filters: FilterState) => void
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p
      className="text-[11px] uppercase tracking-widest text-[var(--lg-text-3)] mb-2"
    >
      {children}
    </p>
  )
}

function FilterOption({
  label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 text-xs w-full text-left py-0.5 transition-colors duration-150 ${
        active ? 'text-sky-400' : 'text-[var(--lg-text-2)] hover:text-[var(--lg-text)]'
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors duration-150 ${
          active ? 'bg-sky-400 shadow-[0_0_6px_rgba(0,204,245,0.6)]' : 'bg-slate-700'
        }`}
      />
      {label}
    </button>
  )
}

export function StudySidebar({ filters, onFilterChange }: StudySidebarProps) {
  const { t } = useTranslation()

  function set(patch: Partial<FilterState>) {
    onFilterChange({ ...filters, ...patch })
  }

  const studyTypeOptions: Array<{ label: string; value: StudyTypeFilter }> = [
    { label: t('lab_filter_all'),      value: '' },
    { label: t('lab_filter_human'),    value: 'human' },
    { label: t('lab_filter_animal'),   value: 'animal' },
    { label: t('lab_filter_meta'),     value: 'meta' },
    { label: t('lab_filter_clinical'), value: 'clinical' },
  ]

  return (
    <aside className="space-y-6">
      <div className="space-y-1.5">
        <SectionLabel>{t('lab_filter_studytype')}</SectionLabel>
        {studyTypeOptions.map(opt => (
          <FilterOption
            key={opt.value}
            label={opt.label}
            active={filters.studyType === opt.value}
            onClick={() => set({ studyType: opt.value })}
          />
        ))}
      </div>

      <div className="space-y-1.5">
        <SectionLabel>{t('lab_filter_sort')}</SectionLabel>
        {(['date', 'relevance'] as SortMode[]).map(s => (
          <FilterOption
            key={s}
            label={s === 'date' ? t('lab_filter_newest') : t('lab_filter_relevance')}
            active={filters.sort === s}
            onClick={() => set({ sort: s })}
          />
        ))}
      </div>

      <div className="space-y-1.5">
        <SectionLabel>{t('lab_filter_year')}</SectionLabel>
        {(['all', '2024plus', '2025'] as YearFilter[]).map(y => (
          <FilterOption
            key={y}
            label={y === 'all' ? t('lab_filter_year_all') : y === '2024plus' ? '2024+' : '2025'}
            active={filters.year === y}
            onClick={() => set({ year: y })}
          />
        ))}
      </div>
    </aside>
  )
}
