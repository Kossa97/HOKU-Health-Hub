// src/pages/lab/FilterSheet.tsx
import { useEffect } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DEFAULT_FILTER_STATE } from './pubmed'
import type { FilterState, SortMode, YearFilter } from './pubmed'

const ALL_PEPTIDES = [
  'BPC-157', 'TB-500', 'Ipamorelin', 'CJC-1295',
  'Semaglutide', 'Tirzepatide', 'Selank', 'Epithalon',
]

interface FilterSheetProps {
  open: boolean
  filters: FilterState
  resultCount: number
  onClose: () => void
  onChange: (filters: FilterState) => void
  onApply: () => void
}

export function FilterSheet({
  open,
  filters,
  resultCount,
  onClose,
  onChange,
  onApply,
}: FilterSheetProps) {
  const { t } = useTranslation()

  // Close on Escape key
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  function togglePeptide(p: string) {
    const next = filters.peptides.includes(p)
      ? filters.peptides.filter(x => x !== p)
      : [...filters.peptides, p]
    onChange({ ...filters, peptides: next })
  }

  function reset() {
    onChange(DEFAULT_FILTER_STATE)
  }

  return (
    <>
      {/* Backdrop — backdrop-filter is safe here (not a scrollable container) */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Sheet panel — NO backdrop-filter on this element or its children */}
      <div className="fixed inset-x-2 bottom-2 z-50 flex justify-center pointer-events-none pb-[env(safe-area-inset-bottom)]">
        <div
          data-app-modal
          data-app-back-dirty-on-interaction
          role="dialog"
          aria-modal="true"
          aria-label={String(t('lab_filter_title'))}
          // Form des Glas-Sheets, aber fest gefüllt: Weichzeichner bricht hier das Scrollen in iOS Safari
          className="lg-sheet w-full max-w-lg overflow-hidden pointer-events-auto"
          style={{ background: '#1c1c1e', WebkitBackdropFilter: 'none', backdropFilter: 'none' }}
        >
          <div className="pt-2 pb-1">
            <span className="lg-grabber" aria-hidden="true" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between pl-5 pr-2 pt-1 pb-2">
            <h2 className="lg-title2">{t('lab_filter_title')}</h2>
            <button
              type="button"
              onClick={onClose}
              data-app-back-close
              aria-label={t('close')}
              className="lg-icon-btn text-[var(--lg-text-2)]"
            >
              <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-[var(--lg-fill)]"><X size={17} /></span>
            </button>
          </div>

          {/* Scrollable content — NO backdrop-filter here (breaks overflow-y on iOS Safari) */}
          <div className="overflow-y-auto max-h-[55vh] px-5 pt-2 pb-4 space-y-5">
            {/* Peptid */}
            <div>
              <p className="label">{t('lab_filter_peptide')}</p>
              <div className="flex flex-wrap gap-2">
                {ALL_PEPTIDES.map(p => {
                  const active = filters.peptides.includes(p)
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => togglePeptide(p)}
                      aria-pressed={active}
                      className={`min-h-9 px-3.5 rounded-full text-[14px] font-medium transition-colors ${
                        active
                          ? 'bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] text-[var(--lg-accent-text)]'
                          : 'bg-[var(--lg-fill)] text-[var(--lg-text-2)]'
                      }`}
                    >
                      {p}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Sortieren */}
            <div>
              <p className="label">{t('lab_filter_sort')}</p>
              <div className="flex rounded-full bg-[var(--lg-fill)] p-0.5">
                {(['date', 'relevance'] as SortMode[]).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onChange({ ...filters, sort: s })}
                    aria-pressed={filters.sort === s}
                    className={`flex-1 min-h-9 rounded-full text-[14px] font-semibold transition-colors ${
                      filters.sort === s
                        ? 'bg-[var(--lg-fill-selected)] text-[var(--lg-text)] shadow-[0_3px_8px_rgba(0,0,0,0.25)]'
                        : 'text-[var(--lg-text-2)]'
                    }`}
                  >
                    {s === 'date' ? t('lab_filter_newest') : t('lab_filter_relevance')}
                  </button>
                ))}
              </div>
            </div>

            {/* Jahr */}
            <div>
              <p className="label">{t('lab_filter_year_label')}</p>
              <div className="flex rounded-full bg-[var(--lg-fill)] p-0.5">
                {(['all', '2024plus', '2025'] as YearFilter[]).map(y => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => onChange({ ...filters, year: y })}
                    aria-pressed={filters.year === y}
                    className={`flex-1 min-h-9 rounded-full text-[14px] font-semibold transition-colors ${
                      filters.year === y
                        ? 'bg-[var(--lg-fill-selected)] text-[var(--lg-text)] shadow-[0_3px_8px_rgba(0,0,0,0.25)]'
                        : 'text-[var(--lg-text-2)]'
                    }`}
                  >
                    {y === 'all' ? t('lab_filter_year_all') : y === '2024plus' ? '2024+' : '2025'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 px-4 pt-2 pb-4">
            <button type="button" data-quiet className="lg-gray-btn flex-1 !min-h-12 !text-[17px]" onClick={reset}>
              {t('lab_filter_reset')}
            </button>
            <button
              type="button"
              className="lg-btn lg-btn-primary !px-4"
              style={{ flex: 2 }}
              onClick={() => {
                onApply()
                onClose()
              }}
            >
              {t('lab_filter_apply', { count: resultCount })}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
