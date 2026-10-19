// src/pages/StudyDetail.tsx
import { useNavigate, useLocation } from 'react-router-dom'
import { ChevronLeft, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { PubMedArticle } from './lab/pubmed'
import {
  getEvidenceScore,
  getStudyType,
  getStudyTypeLabel,
  getEvidenceLabel,
  getEvidenceContext,
  getKeyFindings,
  getLimitationsAndRisks,
  getDefaultLimitationKey,
} from './lab/labUtils'
import { ResearchDisclaimer } from '../components/ui/DesignSystem'

const STUDY_TYPE_STYLES: Record<string, string> = {
  clinical: 'bg-violet-500/15 text-violet-400',
  meta:     'bg-blue-500/15 text-blue-400',
  human:    'bg-emerald-500/15 text-emerald-400',
  animal:   'bg-orange-500/15 text-orange-400',
  study:    'bg-slate-700/40 text-[var(--lg-text-2)]',
}

const EVIDENCE_STYLES: Record<string, string> = {
  strong:      'bg-emerald-500/15 text-emerald-400',
  moderate:    'bg-yellow-500/15 text-yellow-400',
  preclinical: 'bg-red-500/15 text-red-400',
  unknown:     'bg-slate-700/40 text-[var(--lg-text-2)]',
}

function SectionCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="lg-surface lg-flat p-5">
      <p
        className="text-[13px] font-semibold uppercase tracking-[0.04em] text-[var(--lg-text-3)] mb-3"
      >
        {label}
      </p>
      {children}
    </div>
  )
}

export function StudyDetail() {
  const { t }     = useTranslation()
  const navigate  = useNavigate()
  const location  = useLocation()
  const article   = (location.state as { article?: PubMedArticle } | null)?.article
  const [abstractOpen, setAbstractOpen] = useState(false)

  if (!article) {
    return (
      <div className="text-center py-16">
        <p className="text-[var(--lg-text-2)] text-sm mb-4">{t('lab_study_not_found')}</p>
        <button type="button" onClick={() => navigate('/lab')} className="btn-secondary text-sm">
          ← {t('lab_back_to_research')}
        </button>
      </div>
    )
  }

  const studyType     = getStudyType(article.title, article.abstract)
  const evidenceScore = getEvidenceScore(article.title, article.abstract)
  const keyFindings   = getKeyFindings(article.abstract)
  const limitations   = getLimitationsAndRisks(article.abstract)
  const fallbackLimitationKey = getDefaultLimitationKey(studyType, evidenceScore)

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-10">
      <ResearchDisclaimer
        compact
        title={t('lab_disclaimer_title')}
        body={t('lab_disclaimer_body')}
      />
      {/* Back */}
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="lg-glass lg-btn lg-btn-glass lg-btn-compact w-fit !pl-2.5 !pr-4 !gap-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
      >
        <ChevronLeft size={22} strokeWidth={2.4} aria-hidden="true" />
        {t('lab_back_to_research')}
      </button>

      {/* Header */}
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span
            className={`text-[11px] font-semibold px-2.5 py-1 rounded-md ${STUDY_TYPE_STYLES[studyType]}`}
          >
            {t(getStudyTypeLabel(studyType))}
          </span>
          <span
            className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${EVIDENCE_STYLES[evidenceScore]}`}
          >
            {t(getEvidenceLabel(evidenceScore))}
          </span>
          {article.pubdate && (
            <span
              className="text-[11px] text-[var(--lg-text-3)]"
            >
              {article.pubdate}
            </span>
          )}
        </div>

        <h1
          className="text-[26px] font-bold leading-tight tracking-[0.01em] text-[var(--lg-text)] mb-2"
        >
          {article.title}
        </h1>

        {(article.authors.length > 0 || article.journal) && (
          <p className="text-sm text-[var(--lg-text-2)]">
            {article.authors.length > 0 && (
              <span>
                {article.authors.length === 1 ? article.authors[0] : `${article.authors[0]} et al.`}
              </span>
            )}
            {article.journal && (
              <span className="text-[var(--lg-accent-text)]"> · {article.journal}</span>
            )}
          </p>
        )}
      </div>

      {/* Summary */}
      <SectionCard label={t('lab_summary_label')}>
        <p className="text-sm text-[var(--lg-text)] leading-relaxed">
          {article.abstract || t('lab_no_abstract')}
        </p>
      </SectionCard>

      {/* Key Findings */}
      {keyFindings.length > 0 && (
        <SectionCard label={t('lab_key_findings')}>
          <ul className="space-y-2">
            {keyFindings.map((finding, i) => (
              <li key={i} className="flex gap-3 text-sm text-[var(--lg-text)]">
                <span className="text-sky-400/60 shrink-0 mt-0.5">•</span>
                <span>{finding.endsWith('.') ? finding : `${finding}.`}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* Risks & limitations */}
      <SectionCard label={t('lab_risks_limitations')}>
        {limitations.length > 0 ? (
          <ul className="space-y-2">
            {limitations.map((line, i) => (
              <li key={i} className="flex gap-3 text-sm text-amber-200/80">
                <span className="text-amber-400/60 shrink-0 mt-0.5">!</span>
                <span>{line.endsWith('.') ? line : `${line}.`}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--lg-text-2)] leading-relaxed">{t(fallbackLimitationKey)}</p>
        )}
      </SectionCard>

      {/* Evidence Analysis */}
      <SectionCard label={t('lab_evidence_analysis')}>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--lg-text-2)]">{t('lab_study_type_label')}</span>
            <span
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-md ${STUDY_TYPE_STYLES[studyType]}`}
            >
              {t(getStudyTypeLabel(studyType))}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--lg-text-2)]">{t('lab_evidence_level')}</span>
            <span
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${EVIDENCE_STYLES[evidenceScore]}`}
            >
              {t(getEvidenceLabel(evidenceScore))}
            </span>
          </div>
          <div className="border-t-[0.5px] border-[var(--lg-separator)] pt-3">
            <p className="text-xs text-[var(--lg-text-2)] leading-relaxed">
              {t(getEvidenceContext(evidenceScore))}
            </p>
          </div>
        </div>
      </SectionCard>

      {/* Abstract Accordion */}
      <div className="lg-group">
        <button
          type="button"
          onClick={() => setAbstractOpen(o => !o)}
          className="flex items-center justify-between w-full min-h-[52px] px-5 text-left"
        >
          <span className="text-[16px] font-semibold text-[var(--lg-text)]">
            {t('lab_original_abstract')}
          </span>
          {abstractOpen
            ? <ChevronUp size={14} className="text-[var(--lg-text-2)]" />
            : <ChevronDown size={14} className="text-[var(--lg-text-2)]" />
          }
        </button>
        {abstractOpen && (
          <div className="px-5 pb-5">
            <p className="text-[15px] text-[var(--lg-text-2)] leading-relaxed">
              {article.abstract || t('lab_no_abstract')}
            </p>
          </div>
        )}
      </div>

      {/* PubMed Button */}
      {article.link && (
        <a
          href={article.link}
          target="_blank"
          rel="noreferrer"
          className="lg-btn lg-btn-primary w-full"
        >
          {t('lab_open_pubmed')} <ExternalLink size={14} />
        </a>
      )}
    </div>
  )
}
