// src/pages/lab/PeptideCard.tsx
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { peptipediaDetailPath, type PeptipediaMode } from '../../features/peptipedia/routing'
import { peptipediaText } from '../../features/peptipedia/content/legacyLabels'
import { PEPTIPEDIA_UI_COPY } from '../../features/peptipedia/content/uiCopy'
import type { PeptipediaView, PeptipediaLocale } from '../../features/peptipedia/content/types'
import {
  CATEGORY_LABEL_KEYS,
  STATUS_LABEL_KEYS,
  STATUS_TONES,
} from '../../features/peptipedia/display'

interface PeptideCardProps {
  peptide: PeptipediaView
  locale: PeptipediaLocale
  mode?: PeptipediaMode
}

export function PeptideCard({ peptide, locale, mode = 'public' }: PeptideCardProps) {
  const t = peptipediaText(locale)
  const evidenceCopy = PEPTIPEDIA_UI_COPY[locale].evidence
  const approvedRegions = [...new Set(peptide.approvals?.filter(approval => approval.status === 'approved').map(approval => approval.region))]

  const detailPath = peptipediaDetailPath(locale, peptide.slug, mode)

  return (
    <article className="lg-surface lg-flat relative cursor-pointer overflow-hidden transition-transform duration-150 active:scale-[0.98] motion-reduce:transition-none">
      <div className="relative p-4">
        {/* Kategorie und Identität */}
        <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className="text-[13px] text-[var(--lg-text-3)]">
            {t(CATEGORY_LABEL_KEYS[peptide.category])}
          </span>
          <span className="flex items-baseline gap-1.5 text-[13px]">
            <span className="text-[var(--lg-text-3)]">{locale === 'de' ? 'Identität' : 'Identity'}</span>
            <span className="text-[var(--lg-text-2)]">{evidenceCopy.identity[peptide.identity.status]}</span>
          </span>
        </div>

        {/* Name */}
        <h2 className="text-[17px] font-medium leading-tight text-[var(--lg-text)]">
          <Link to={detailPath} className="rounded-sm after:absolute after:inset-0 after:rounded-[inherit] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--lg-accent)]">{peptide.name}</Link>
        </h2>

        {peptide.blend && <span className="lg-tag mt-2" data-tone="accent">Blend · {peptide.blend.components.length} {locale === 'de' ? 'Bestandteile' : 'components'}</span>}
        {peptide.fullName && (
          <p className="mt-1 text-[13px] leading-tight text-[var(--lg-text-3)]">
            {peptide.fullName}
          </p>
        )}

        {/* TLDR */}
        <p className="mt-2 mb-3 line-clamp-2 text-[15px] leading-snug text-[var(--lg-text-2)]">
          {peptide.tldr}
        </p>

        {/* Kurze Evidenz-Angabe, ohne Gesamturteil */}
        <div className="mb-3 flex items-baseline justify-between gap-3 border-y border-[var(--lg-separator)] py-2 text-[13px]" style={{ borderWidth: '0.5px 0' }}>
          <span className="text-[var(--lg-text-3)]">{evidenceCopy.dimensions.human}</span>
          <span className="text-right text-[var(--lg-text-2)]">{evidenceCopy.human[peptide.evidenceMatrix.human]}</span>
        </div>

        {/* Bereiche */}
        {peptide.researchAreas && peptide.researchAreas.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {peptide.researchAreas.slice(0, 4).map((tag, i) => (
              <span key={i} className="lg-tag !min-h-6 !px-2 !text-[12px] !whitespace-normal !py-1 leading-snug">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Status und Weiter */}
        <div className="flex items-center justify-between gap-3">
          <span className="lg-tag" data-tone={STATUS_TONES[peptide.researchStatus]}>
            {t(STATUS_LABEL_KEYS[peptide.researchStatus])}{approvedRegions?.length ? ` · ${approvedRegions.join('/')}` : ''}
          </span>
          <span className="flex shrink-0 items-center gap-1 text-[13px] font-medium text-[var(--lg-accent-text)]">
            {t('plib_profile')}
            <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
          </span>
        </div>
      </div>
    </article>
  )
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────

export function PeptideCardSkeleton() {
  return (
    <div className="lg-surface lg-flat p-4 animate-pulse motion-reduce:animate-none">
      <div className="flex justify-between mb-3">
        <div className="h-2.5 w-24 bg-[var(--lg-fill)] rounded" />
        <div className="h-2.5 w-8 bg-[var(--lg-fill)] rounded" />
      </div>
      <div className="h-6 w-20 bg-[var(--lg-fill)] rounded mb-1" />
      <div className="h-2 w-32 bg-[var(--lg-fill)] rounded mb-3" />
      <div className="space-y-1.5 mb-3">
        <div className="h-2 bg-[var(--lg-fill)] rounded" />
        <div className="h-2 w-5/6 bg-[var(--lg-fill)] rounded" />
      </div>
      <div className="space-y-1.5 mb-4">
        {[0, 1, 2].map(i => (
          <div key={i} className="flex gap-2 items-center">
            <div className="w-10 h-1.5 bg-[var(--lg-fill)] rounded" />
            <div className="flex-1 h-[2px] bg-[var(--lg-fill)] rounded" />
            <div className="w-14 h-1.5 bg-[var(--lg-fill)] rounded" />
          </div>
        ))}
      </div>
      <div className="flex justify-between">
        <div className="h-4 w-16 bg-[var(--lg-fill)] rounded" />
        <div className="h-4 w-12 bg-[var(--lg-fill)] rounded" />
      </div>
    </div>
  )
}
