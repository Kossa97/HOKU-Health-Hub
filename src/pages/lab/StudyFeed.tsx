// src/pages/lab/StudyFeed.tsx
import { Flame, Loader2, BookOpen, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { PubMedArticle, FilterState } from './pubmed'
import { StudyCard } from './StudyCard'
import { StudySidebar } from './StudySidebar'

interface StudyFeedProps {
  articles: PubMedArticle[]
  filters: FilterState
  onSidebarFilter: (filters: FilterState) => void
  loading: boolean
  errorMessage: string | null
  isTrending: boolean
  lastQuery: string
  onRetry: () => void
}

export function StudyFeed({
  articles,
  filters,
  onSidebarFilter,
  loading,
  errorMessage,
  isTrending,
  lastQuery,
  onRetry,
}: StudyFeedProps) {
  const { t } = useTranslation()
  const featured = articles[0]
  const rest     = articles.slice(1)

  return (
    <div className="flex gap-6 items-start">
      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden md:block w-52 shrink-0 sticky top-4 self-start">
        <StudySidebar filters={filters} onFilterChange={onSidebarFilter} />
      </div>

      {/* Feed */}
      <div className="flex-1 min-w-0">
        {/* Section label */}
        {!loading && !errorMessage && articles.length > 0 && (
          <div className="flex items-end justify-between border-b border-[var(--lg-separator)] pb-2 mb-4">
            <div>
              {isTrending ? (
                <div className="flex items-center gap-1.5">
                  <Flame size={13} className="text-orange-400" />
                  <span
                    className="text-[13px] font-semibold uppercase tracking-[0.04em] text-[var(--lg-text-2)]"
                  >
                    {t('lab_trending_label')}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <Search size={12} className="text-[var(--lg-text-2)]" />
                  <span
                    className="text-[13px] font-semibold uppercase tracking-[0.04em] text-[var(--lg-text-2)]"
                  >
                    „{lastQuery}"
                  </span>
                </div>
              )}
              <p className="text-[11px] text-[var(--lg-text-3)] mt-0.5">
                {isTrending
                  ? t('lab_trending_sub')
                  : t('lab_results_count', { count: articles.length })}
              </p>
            </div>
            <span
              className="text-[11px] text-[var(--lg-text-3)]"
            >
              {t('lab_source_label')}
            </span>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="lg-surface lg-flat text-center py-10 text-[var(--lg-text-2)]">
            <Loader2 size={28} className="mx-auto mb-3 text-[var(--lg-accent-text)] animate-spin" />
            <p className="text-sm">
              {isTrending ? t('lab_loading_trending') : t('lab_loading_search')}
            </p>
          </div>
        )}

        {/* Error */}
        {!loading && errorMessage && (
          <div className="lg-surface lg-flat text-center px-5 py-8" data-tone="bad">
            <p className="text-[15px] text-[var(--lg-bad-text)] mb-3">{errorMessage}</p>
            <button type="button" onClick={onRetry} className="lg-gray-btn mx-auto" data-quiet>
              {t('lab_retry')}
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && !errorMessage && articles.length === 0 && (
          <div className="lg-surface lg-flat text-center py-10 text-[var(--lg-text-2)]">
            <BookOpen size={28} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">
              {isTrending ? t('lab_no_studies') : t('lab_no_results_query', { query: lastQuery })}
            </p>
          </div>
        )}

        {/* Featured card */}
        {!loading && !errorMessage && featured && (
          <StudyCard article={featured} variant="featured" />
        )}

        {/* Compact feed */}
        {!loading && !errorMessage && rest.length > 0 && (
          <div className="space-y-3">
            {rest.map(article => (
              <StudyCard key={article.id} article={article} variant="compact" />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
