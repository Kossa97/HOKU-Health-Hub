// src/pages/lab/ArticleCards.tsx
import { useState } from 'react'
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import type { PubMedArticle } from './pubmed'

// ── Peptide style map ──────────────────────────────────────────────────────────

const KNOWN_PEPTIDES = [
  'BPC-157', 'TB-500', 'Ipamorelin', 'CJC-1295', 'Selank', 'Epithalon',
  'Semaglutide', 'Tirzepatide', 'GLP-1',
]

// Neutral: die Peptid-Marke ist ein ruhiges Etikett, keine Farbkodierung
const DEFAULT_STYLE = {
  tag: 'bg-[var(--lg-fill)] text-[var(--lg-text-2)]',
  accent: 'border-l-[var(--lg-hair)]',
  bar: 'bg-[var(--lg-hair)]',
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function detectPeptide(title: string): string | null {
  const upper = title.toUpperCase()
  return KNOWN_PEPTIDES.find(p => upper.includes(p.toUpperCase())) ?? null
}

function formatAuthors(authors: string[]): string {
  if (authors.length === 0) return ''
  if (authors.length === 1) return authors[0]
  return `${authors[0]} et al.`
}

function isRecent(pubdate: string): boolean {
  return /202[4-9]/.test(pubdate)
}

function getPeptideStyle(title: string) {
  return { peptide: detectPeptide(title), style: DEFAULT_STYLE }
}

// ── Shared sub-components ──────────────────────────────────────────────────────

function PeptideTag({ peptide, style }: { peptide: string | null; style: typeof DEFAULT_STYLE }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs ${style.tag}`}>
      {peptide ?? 'Peptid'}
    </span>
  )
}

function NewBadge() {
  return (
    <span className="text-xs text-[var(--lg-text-3)]">Neu</span>
  )
}

// ── ArticleHero ────────────────────────────────────────────────────────────────

export function ArticleHero({ article }: { article: PubMedArticle }) {
  const [expanded, setExpanded] = useState(false)
  const { peptide, style } = getPeptideStyle(article.title)
  const recent = isRecent(article.pubdate)
  const shouldCollapse = article.abstract.length > 320
  const visibleAbstract = article.abstract
    ? (expanded || !shouldCollapse ? article.abstract : `${article.abstract.slice(0, 320).trim()}…`)
    : 'Kein Abstract verfügbar.'

  return (
    <article className={`card border-l-[5px] ${style.accent} border-[var(--lg-hair)] mb-3`}>
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <PeptideTag peptide={peptide} style={style} />
        {recent && <NewBadge />}
        {article.pubdate && (
          <span className="ml-auto text-xs text-[var(--lg-text-3)] font-mono tabular-nums">{article.pubdate}</span>
        )}
      </div>

      <h2 className="text-base font-medium text-[var(--lg-text)] leading-snug mb-2">{article.title}</h2>

      {(article.authors.length > 0 || article.journal) && (
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 mb-3 text-xs text-[var(--lg-text-2)]">
          {article.authors.length > 0 && <span>{formatAuthors(article.authors)}</span>}
          {article.journal && <span className="text-[var(--lg-text-3)]">{article.journal}</span>}
        </div>
      )}

      <div className="rounded-xl bg-[var(--lg-fill)] p-3 mb-3">
        <p className="text-[13px] text-[var(--lg-text-3)] mb-2">Abstract</p>
        <p className="text-sm text-[var(--lg-text-2)] leading-relaxed">{visibleAbstract}</p>
        {shouldCollapse && (
          <button
            type="button"
            onClick={() => setExpanded(e => !e)}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[var(--lg-accent-text)] transition-colors"
          >
            {expanded ? <ChevronUp size={16} strokeWidth={1.5} /> : <ChevronDown size={16} strokeWidth={1.5} />}
            {expanded ? 'Weniger' : 'Mehr lesen'}
          </button>
        )}
      </div>

      {article.link && (
        <a className="btn-primary w-full text-xs" href={article.link} target="_blank" rel="noreferrer">
          Auf PubMed öffnen <ExternalLink size={16} strokeWidth={1.5} />
        </a>
      )}
    </article>
  )
}

// ── ArticleGridCard ────────────────────────────────────────────────────────────

export function ArticleGridCard({ article }: { article: PubMedArticle }) {
  const { peptide, style } = getPeptideStyle(article.title)
  const recent = isRecent(article.pubdate)
  const snippet = article.abstract.length > 110
    ? `${article.abstract.slice(0, 110).trim()}…`
    : article.abstract

  return (
    <article className={`card border-l-4 ${style.accent} border-[var(--lg-hair)] flex flex-col`}>
      <div className="flex flex-wrap gap-1 mb-2">
        <PeptideTag peptide={peptide} style={style} />
        {recent && <NewBadge />}
      </div>

      <h2 className="text-[13px] font-medium text-[var(--lg-text)] leading-snug line-clamp-3 flex-1 mb-2">
        {article.title}
      </h2>

      {snippet && (
        <p className="text-[12px] text-[var(--lg-text-2)] leading-relaxed line-clamp-3 mb-2">{snippet}</p>
      )}

      <div className="flex items-center justify-between mt-auto pt-1">
        <span className="text-xs text-[var(--lg-text-3)] font-mono tabular-nums">{article.pubdate}</span>
        {article.link && (
          <a
            href={article.link}
            target="_blank"
            rel="noreferrer"
            className="text-[var(--lg-text-3)] hover:text-[var(--lg-accent-text)] transition-colors"
          >
            <ExternalLink size={16} strokeWidth={1.5} />
          </a>
        )}
      </div>
    </article>
  )
}

// ── ArticleMiniItem ────────────────────────────────────────────────────────────

export function ArticleMiniItem({ article }: { article: PubMedArticle }) {
  const { peptide, style } = getPeptideStyle(article.title)
  const recent = isRecent(article.pubdate)

  return (
    <div className="flex items-start gap-3 py-3 border-b border-[var(--lg-hair)] last:border-b-0">
      <div className={`w-[3px] self-stretch rounded-full shrink-0 ${style.bar}`} />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 mb-1">
          <PeptideTag peptide={peptide} style={style} />
          {recent && <NewBadge />}
          <span className="ml-auto text-xs text-[var(--lg-text-3)] font-mono tabular-nums">{article.pubdate}</span>
        </div>
        <p className="text-[13px] font-medium text-[var(--lg-text)] leading-snug line-clamp-2">{article.title}</p>
        {article.authors.length > 0 && (
          <p className="text-[12px] text-[var(--lg-text-3)] mt-0.5">{formatAuthors(article.authors)}</p>
        )}
      </div>
      {article.link && (
        <a
          href={article.link}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 text-[var(--lg-text-3)] hover:text-[var(--lg-accent-text)] transition-colors mt-0.5"
        >
          <ExternalLink size={16} strokeWidth={1.5} />
        </a>
      )}
    </div>
  )
}
