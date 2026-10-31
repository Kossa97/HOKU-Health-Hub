// src/pages/lab/StudyCard.tsx
import { ExternalLink, Bookmark, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { PubMedArticle } from './pubmed'
import {
  getEvidenceScore,
  getStudyType,
  getStudyTypeLabel,
  getEvidenceLabel,
  getKeyFindings,
} from './labUtils'
import type { EvidenceScore, StudyType } from './labUtils'
import { denyProps } from '../../lib/denyFeedback'

// ─── Style Configs ────────────────────────────────────────────────────────────

// Evidenz ist eine Rangfolge: ein Punkt in Ampelfarbe, die Spur füllt sich
// in Stufen von 100/70/30/20 % — auf den Messstrichen (10 %) im Look HOKU. Alles andere bleibt neutral.
interface EvidenceConfig {
  dot:      string
  barWidth: string
}

const EVIDENCE_CONFIG: Record<EvidenceScore, EvidenceConfig> = {
  strong:      { dot: 'var(--lg-good)', barWidth: '100%' },
  moderate:    { dot: 'var(--lg-warn)', barWidth: '70%' },
  preclinical: { dot: 'var(--lg-bad)',  barWidth: '30%' },
  unknown:     { dot: 'var(--lg-text-3)', barWidth: '20%' },
}

const KNOWN_PEPTIDES = [
  'BPC-157', 'TB-500', 'Ipamorelin', 'CJC-1295',
  'Semaglutide', 'Tirzepatide', 'Selank', 'Epithalon',
]

const TAG = 'inline-flex items-center rounded-md bg-[var(--lg-fill)] px-2 py-0.5 text-xs text-[var(--lg-text-2)]'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function detectTags(title: string): string[] {
  return KNOWN_PEPTIDES.filter(p =>
    title.toUpperCase().includes(p.toUpperCase())
  )
}

function formatAuthors(authors: string[]): string {
  if (authors.length === 0) return ''
  return authors.length === 1 ? authors[0] : `${authors[0]} et al.`
}

// ─── Sub-Components ───────────────────────────────────────────────────────────

export function StudyTypeBadge({ type }: { type: StudyType }) {
  const { t } = useTranslation()
  return <span className={TAG}>{t(getStudyTypeLabel(type))}</span>
}

export function EvidencePill({ score }: { score: EvidenceScore }) {
  const { t } = useTranslation()
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-[var(--lg-text-2)]">
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: EVIDENCE_CONFIG[score].dot }}
      />
      {t(getEvidenceLabel(score))}
    </span>
  )
}

function EvidenceBar({ score }: { score: EvidenceScore }) {
  const { t } = useTranslation()
  const c = EVIDENCE_CONFIG[score]
  return (
    <div className="flex items-center gap-3">
      <span className="shrink-0 text-[13px] text-[var(--lg-text-3)]">
        {t('lab_evidence_bar_label')}
      </span>
      <div className="hk-scale h-1 flex-1 overflow-hidden rounded-full bg-[var(--lg-fill)]">
        <div className="h-full rounded-full" style={{ width: c.barWidth, background: c.dot }} />
      </div>
      <EvidencePill score={score} />
    </div>
  )
}

function PeptideTags({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map(tag => (
        <span key={tag} className={TAG}>{tag}</span>
      ))}
    </div>
  )
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0 text-[13px] text-[var(--lg-text-3)]">
        {label}
      </span>
      <div className="h-px flex-1 bg-[var(--lg-hair)]" />
    </div>
  )
}

// ─── Main Export ─────────────────────────────────────────────────────────────

interface StudyCardProps {
  article: PubMedArticle
  variant: 'featured' | 'compact'
}

export function StudyCard({ article, variant }: StudyCardProps) {
  const { t }         = useTranslation()
  const navigate      = useNavigate()
  const studyType     = getStudyType(article.title, article.abstract)
  const evidenceScore = getEvidenceScore(article.title, article.abstract)
  const keyFindings   = getKeyFindings(article.abstract)
  const tags          = detectTags(article.title)

  const openDetail = () => navigate(`/lab/study/${article.id}`, { state: { article } })

  // ── Featured Card ─────────────────────────────────────────────────────────
  if (variant === 'featured') {
    const snippet = article.abstract
      ? article.abstract.length > 400
        ? `${article.abstract.slice(0, 400).trim()}…`
        : article.abstract
      : t('lab_no_abstract')

    return (
      <article
        className="lg-surface lg-flat mb-4 cursor-pointer overflow-hidden transition-transform duration-200 active:scale-[0.98]"
        onClick={openDetail}
      >

        <div className="relative p-5 space-y-4">

          {/* ── Badges + Date ─────────────────────────────────────────────── */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <StudyTypeBadge type={studyType} />
              <EvidencePill score={evidenceScore} />
            </div>
            {article.pubdate && (
              <span className="mt-0.5 shrink-0 font-mono text-xs tabular-nums text-[var(--lg-text-3)]">
                {article.pubdate}
              </span>
            )}
          </div>

          {/* ── Title + Authors ───────────────────────────────────────────── */}
          <div>
            <h2
              className="mb-1 text-[19px] font-medium leading-snug text-[var(--lg-text)]"
            >
              {article.title}
            </h2>
            {(article.authors.length > 0 || article.journal) && (
              <p className="text-[13px] text-[var(--lg-text-2)]">
                {article.authors.length > 0 && formatAuthors(article.authors)}
                {article.journal && (
                  <span className="text-[var(--lg-text-3)]"> · {article.journal}</span>
                )}
              </p>
            )}
          </div>

          {/* ── Abstract-Auszug ───────────────────────────────────────────── */}
          <div>
            <SectionDivider label={t('lab_summary')} />
            <p className="text-sm text-[var(--lg-text)] leading-relaxed mt-2">{snippet}</p>
          </div>

          {/* ── Key Findings ─────────────────────────────────────────────── */}
          {keyFindings.length > 0 && (
            <div>
              <SectionDivider label={t('lab_key_findings')} />
              <ul className="space-y-2 mt-2">
                {keyFindings.slice(0, 3).map((f, i) => (
                  <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-[var(--lg-text-2)]">
                    <span aria-hidden="true" className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-[var(--lg-text-3)]" />
                    <span>{f.endsWith('.') ? f : `${f}.`}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Evidence Strength Bar ─────────────────────────────────────── */}
          <EvidenceBar score={evidenceScore} />

          {/* ── Peptide Tags ─────────────────────────────────────────────── */}
          {tags.length > 0 && <PeptideTags tags={tags} />}

          {/* ── Actions ──────────────────────────────────────────────────── */}
          <div className="flex gap-2 pt-1" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              onClick={openDetail}
              className="btn-primary text-sm flex-1 flex items-center justify-center gap-2"
            >
              {t('lab_read_summary')}
              <ArrowRight size={16} strokeWidth={1.5} />
            </button>
            {article.link && (
              <a
                href={article.link}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary flex items-center justify-center px-3 transition-colors hover:text-[var(--lg-accent-text)]"
                title="PubMed"
              >
                <ExternalLink size={16} strokeWidth={1.5} />
              </a>
            )}
          </div>
        </div>
      </article>
    )
  }

  // ── Compact Card ──────────────────────────────────────────────────────────
  return (
    <article
      className="lg-surface lg-flat !rounded-2xl p-4 cursor-pointer transition-transform duration-200 active:scale-[0.98]"
      onClick={openDetail}
    >
      {/* Badges + Date */}
      <div
        className="mb-3 flex items-start justify-between gap-2"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <StudyTypeBadge type={studyType} />
          <EvidencePill score={evidenceScore} />
        </div>
        {article.pubdate && (
          <span className="shrink-0 font-mono text-xs tabular-nums text-[var(--lg-text-3)]">
            {article.pubdate}
          </span>
        )}
      </div>

      {/* Title */}
      <h2
        className="mb-2 line-clamp-2 text-[16px] font-medium leading-snug text-[var(--lg-text)]"
      >
        {article.title}
      </h2>

      {/* Abstract snippet */}
      {article.abstract && (
        <p className="mb-3 line-clamp-2 text-[13px] leading-relaxed text-[var(--lg-text-2)]">
          {article.abstract.length > 130
            ? `${article.abstract.slice(0, 130).trim()}…`
            : article.abstract}
        </p>
      )}

      {/* Key findings */}
      {keyFindings.length > 0 && (
        <ul className="space-y-1 mb-3">
          {keyFindings.slice(0, 2).map((f, i) => (
            <li key={i} className="flex gap-2 text-xs leading-snug text-[var(--lg-text-3)]">
              <span aria-hidden="true" className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-[var(--lg-text-3)]" />
              <span className="line-clamp-1">{f}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Peptide tags */}
      {tags.length > 0 && (
        <div className="mb-3">
          <PeptideTags tags={tags} />
        </div>
      )}

      {/* Footer: Save + PubMed */}
      <div
        className="flex items-center justify-between border-t border-[var(--lg-separator)] pt-3"
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          className="flex min-h-8 items-center gap-1.5 text-[13px] text-[var(--lg-text-3)] transition-colors"
          {...denyProps(true, String(t('lab_save_soon', { defaultValue: 'Studien merken kommt bald.' })))}
        >
          <Bookmark size={16} strokeWidth={1.5} />
          {t('lab_save')}
        </button>
        {article.link && (
          <a
            href={article.link}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-8 items-center gap-1.5 text-[13px] text-[var(--lg-text-3)] transition-colors duration-150 hover:text-[var(--lg-accent-text)]"
          >
            PubMed
            <ExternalLink size={16} strokeWidth={1.5} />
          </a>
        )}
      </div>
    </article>
  )
}
