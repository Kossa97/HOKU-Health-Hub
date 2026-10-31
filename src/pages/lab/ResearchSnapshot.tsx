// src/pages/lab/ResearchSnapshot.tsx
import { useTranslation } from 'react-i18next'
import { ArrowRight } from 'lucide-react'
import type { ChartEntry, PubMedArticle } from './pubmed'
import { Ph } from '../../components/ui/Silhouette'

interface ResearchSnapshotProps {
  chartData: ChartEntry[]
  /** Zahlen sind unterwegs; schlug der Abruf fehl, bleibt nur „—" */
  chartLaedt: boolean
  articles: PubMedArticle[]
  onSearch: (query: string) => void
}

interface SnapshotCardProps {
  kicker: string
  title: string
  sub: string
  cta?: string
  onCta?: () => void
  /** Zahlen fehlen noch: Titel und Zeile als Silhouette */
  laedt?: boolean
}

function SnapshotCard({
  kicker, title, sub, cta, onCta, laedt = false,
}: SnapshotCardProps) {
  return (
    <div className="lg-surface lg-flat !rounded-2xl p-4">
      <p className="mb-1 text-[13px] text-[var(--lg-text-2)]">
        {kicker}
      </p>
      <p className="mb-1 truncate text-[22px] font-medium leading-tight tabular-nums text-[var(--lg-text)]">
        {laedt ? <Ph w="46%" h={22} className="my-[3px]" /> : title}
      </p>
      <p className="text-[13px] tabular-nums text-[var(--lg-text-3)]">
        {laedt ? <><span className="sr-only">{sub}</span><Ph w="64%" h={12} className="mt-1" /></> : sub}
      </p>
      {cta && onCta && (
        <button
          type="button"
          onClick={onCta}
          className="-mb-2 mt-1 flex min-h-11 items-center gap-1 text-[15px] font-medium text-[var(--lg-accent-text)]"
        >
          {cta}
          <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

export function ResearchSnapshot({ chartData, chartLaedt, articles, onSearch }: ResearchSnapshotProps) {
  const { t } = useTranslation()
  const top = chartData[0]
  const second = chartData[1]

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 mb-6">
      <SnapshotCard
        kicker={t('lab_snapshot_trending')}
        title={top?.name ?? '—'}
        sub={top
          ? t('lab_snapshot_studies', { count: top.count.toLocaleString() })
          : chartLaedt ? t('lab_snapshot_loading') : ''}
        cta={t('lab_snapshot_discover')}
        onCta={() => top && onSearch(top.name)}
        laedt={!top && chartLaedt}
      />
      <SnapshotCard
        kicker={t('lab_snapshot_top')}
        title={second?.name ?? '—'}
        sub={second
          ? t('lab_snapshot_papers', { count: second.count.toLocaleString() })
          : chartLaedt ? t('lab_snapshot_loading') : ''}
        cta={t('lab_snapshot_discover')}
        onCta={() => second && onSearch(second.name)}
        laedt={!second && chartLaedt}
      />
      <SnapshotCard
        kicker={t('lab_snapshot_new')}
        title={String(articles.length)}
        sub={t('lab_snapshot_loaded', { count: articles.length })}
      />
    </div>
  )
}
