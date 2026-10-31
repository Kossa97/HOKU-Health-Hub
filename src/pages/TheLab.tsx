// src/pages/TheLab.tsx
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import {
  searchPubMedArticles,
  fetchChartCounts,
  buildQuery,
  countActiveFilters,
  getErrorMessage,
  TRENDING_QUERY,
  DEFAULT_FILTER_STATE,
} from './lab/pubmed'
import type { PubMedArticle, ChartEntry, FilterState } from './lab/pubmed'
import { LabHero } from './lab/LabHero'
import { ResearchSnapshot } from './lab/ResearchSnapshot'
import { StudyFeed } from './lab/StudyFeed'
import { FilterSheet } from './lab/FilterSheet'
import { LabLoader } from '../components/LabLoader'
import { ResearchDisclaimer } from '../components/ui/DesignSystem'

export function TheLab() {
  const { t } = useTranslation()

  const [articles, setArticles]               = useState<PubMedArticle[]>([])
  const [chartData, setChartData]             = useState<ChartEntry[]>([])
  const [chartLaedt, setChartLaedt]           = useState(true)
  const [loading, setLoading]                 = useState(true)
  const [errorMessage, setErrorMessage]       = useState<string | null>(null)
  const [isTrending, setIsTrending]           = useState(true)
  const [lastQuery, setLastQuery]             = useState('')
  const [filters, setFilters]                 = useState<FilterState>(DEFAULT_FILTER_STATE)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)

  // Initial loader state — full-screen on first visit only
  const [initialLoad, setInitialLoad]         = useState(true)
  const [loaderFading, setLoaderFading]       = useState(false)

  // Auto-load on mount — articles first, chart after (NCBI rate limit: 3 req/sec)
  useEffect(() => {
    searchPubMedArticles(TRENDING_QUERY, 10)
      .then(setArticles)
      .catch(err => setErrorMessage(getErrorMessage(err)))
      .finally(() => {
        setLoading(false)
        // Fade out the full-screen loader, then unmount it
        setLoaderFading(true)
        setTimeout(() => setInitialLoad(false), 500)
        fetchChartCounts()
          .then(setChartData)
          .catch(() => { /* chart errors are non-fatal */ })
          .finally(() => setChartLaedt(false))
      })
  }, [])

  async function runSearch(textQuery: string, nextFilters: FilterState) {
    const finalQuery = buildQuery(textQuery, nextFilters)
    setLoading(true)
    setErrorMessage(null)
    setLastQuery(textQuery.trim() || 'Peptide')
    try {
      const results = await searchPubMedArticles(finalQuery, 10, nextFilters.sort)
      setArticles(results)
      setIsTrending(false)
    } catch (err) {
      setErrorMessage(getErrorMessage(err))
      toast.error(t('lab_search_failed'))
      setArticles([])
    } finally {
      setLoading(false)
    }
  }

  function handleHeroSearch(query: string) {
    void runSearch(query, filters)
  }

  function handleSidebarFilter(newFilters: FilterState) {
    setFilters(newFilters)
    void runSearch(lastQuery, newFilters)
  }

  function handleSheetApply() {
    void runSearch(lastQuery, filters)
  }

  const activeFilterCount = countActiveFilters(filters)

  return (
    <>
      {/* Full-screen loader — only on initial page load */}
      {initialLoad && <LabLoader art="lab" fadingOut={loaderFading} />}

      <div className="space-y-4">
        <ResearchDisclaimer
          title={t('lab_disclaimer_title')}
          body={t('lab_disclaimer_body')}
        />

        {/* Kopf: Titel, Suche, Schnellsuche */}
        <LabHero onSearch={handleHeroSearch} loading={loading} />

        {/* Research Snapshot */}
        <ResearchSnapshot
          chartData={chartData}
          chartLaedt={chartLaedt}
          articles={articles}
          onSearch={query => void runSearch(query, filters)}
        />

        {/* Mobile filter button */}
        <div className="flex items-center justify-between mb-3 md:hidden">
          <span className="lg-group-title !mx-1 !mb-0">
            {isTrending ? t('lab_trending_mobile') : `„${lastQuery}"`}
          </span>
          <button
            type="button"
            onClick={() => setFilterSheetOpen(true)}
            data-quiet={activeFilterCount === 0 || undefined}
            className="lg-gray-btn !min-h-9 !px-3 !text-[14px]"
          >
            {t('lab_filter_button')}
            {activeFilterCount > 0 && (
              <span className="ml-1.5 font-mono text-[13px] tabular-nums text-[var(--lg-accent-text)]">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Study Feed */}
        <StudyFeed
          articles={articles}
          filters={filters}
          onSidebarFilter={handleSidebarFilter}
          loading={loading}
          errorMessage={errorMessage}
          isTrending={isTrending}
          lastQuery={lastQuery}
          onRetry={() => void runSearch(lastQuery, filters)}
        />

        {/* Mobile Bottom Sheet Filter */}
        <FilterSheet
          open={filterSheetOpen}
          filters={filters}
          resultCount={articles.length}
          onClose={() => setFilterSheetOpen(false)}
          onChange={setFilters}
          onApply={handleSheetApply}
        />
      </div>
    </>
  )
}
