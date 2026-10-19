// src/pages/lab/ArticleCards.tsx
import { useState } from 'react'
import { ChevronDown, ChevronUp, ExternalLink, Sparkles } from 'lucide-react'
import type { PubMedArticle } from './pubmed'

// ── Peptide style map ──────────────────────────────────────────────────────────

const KNOWN_PEPTIDES = [
  'BPC-157', 'TB-500', 'Ipamorelin', 'CJC-1295', 'Selank', 'Epithalon',
  'Semaglutide', 'Tirzepatide', 'GLP-1',
]

const PEPTIDE_STYLES: Record<string, { tag: string; accent: string; bar: string }> = {
  'BPC-157':     { tag: 'bg-sky-500/20 text-sky-400',         accent: 'border-l-sky-500',     bar: 'bg-sky-500' },
  'TB-500':      { tag: 'bg-violet-500/20 text-violet-400', accent: 'border-l-violet-500',  bar: 'bg-violet-500' },
  'Ipamorelin':  { tag: 'bg-emerald-500/20 text-emerald-400', accent: 'border-l-emerald-500', bar: 'bg-emerald-500' },
  'CJC-1295':    { tag: 'bg-orange-500/20 text-orange-400', accent: 'border-l-orange-500',  bar: 'bg-orange-500' },
  'Selank':      { tag: 'bg-pink-500/20 text-pink-400',       accent: 'border-l-pink-500',    bar: 'bg-pink-500' },
  'Epithalon':   { tag: 'bg-amber-500/20 text-amber-400',    accent: 'border-l-amber-500',   bar: 'bg-amber-500' },
  'Semaglutide': { tag: 'bg-teal-500/20 text-teal-400',       accent: 'border-l-teal-500',    bar: 'bg-teal-500' },
  'Tirzepatide': { tag: 'bg-indigo-500/20 text-indigo-400', accent: 'border-l-indigo-500',  bar: 'bg-indigo-500' },
  'GLP-1':       { tag: 'bg-cyan-500/20 text-cyan-400',       accent: 'border-l-cyan-500',    bar: 'bg-cyan-500' },
}
const DEFAULT_STYLE = {
  tag: 'bg-slate-700/40 text-[var(--lg-text-2)]',
  accent: 'border-l-slate-600',
  bar: 'bg-slate-600',
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
  const peptide = detectPeptide(title)
  return { peptide, style: peptide ? (PEPTIDE_STYLES[peptide] ?? DEFAULT_STYLE) : DEFAULT_STYLE }
}

// ── Shared sub-components ──────────────────────────────────────────────────────

function PeptideTag({ peptide, style }: { peptide: string | null; style: typeof DEFAULT_STYLE }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold uppercase tracking-[0.04em] ${style.tag}`}>
      {peptide ?? 'PEPTIDE'}
    </span>
  )
}

function NewBadge() {
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-semibold uppercase tracking-[0.04em] bg-orange-500/15 text-orange-400">
      <Sparkles size={12} /> NEU
    </span>
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
    <article className={`card border-l-[5px] ${style.accent} border-slate-800/60 mb-3`}>
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <PeptideTag peptide={peptide} style={style} />
        {recent && <NewBadge />}
        {article.pubdate && (
          <span className="ml-auto text-[11px] text-[var(--lg-text-3)] font-mono">{article.pubdate}</span>
        )}
      </div>

      <h2 className="text-base font-black text-white leading-snug mb-2">{article.title}</h2>

      {(article.authors.length > 0 || article.journal) && (
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 mb-3 text-xs text-[var(--lg-text-2)]">
          {article.authors.length > 0 && <span>{formatAuthors(article.authors)}</span>}
          {article.journal && <span className="text-sky-400/60">{article.journal}</span>}
        </div>
      )}

      <div className="rounded-xl border border-slate-800 bg-black/25 p-3 mb-3">
        <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--lg-text-3)] mb-1.5">Abstract</p>
        <p className="text-sm text-[var(--lg-text-2)] leading-relaxed">{visibleAbstract}</p>
        {shouldCollapse && (
          <button
            type="button"
            onClick={() => setExpanded(e => !e)}
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-sky-400/70 hover:text-sky-400 transition-colors"
          >
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {expanded ? 'Weniger' : 'Mehr lesen'}
          </button>
        )}
      </div>

      {article.link && (
        <a className="btn-primary w-full text-xs" href={article.link} target="_blank" rel="noreferrer">
          Auf PubMed öffnen <ExternalLink size={12} />
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
    <article className={`card border-l-4 ${style.accent} border-slate-800/60 flex flex-col`}>
      <div className="flex flex-wrap gap-1 mb-2">
        <PeptideTag peptide={peptide} style={style} />
        {recent && <NewBadge />}
      </div>

      <h2 className="text-xs font-bold text-white leading-snug line-clamp-3 flex-1 mb-1.5">
        {article.title}
      </h2>

      {snippet && (
        <p className="text-[12px] text-[var(--lg-text-2)] leading-relaxed line-clamp-3 mb-2">{snippet}</p>
      )}

      <div className="flex items-center justify-between mt-auto pt-1">
        <span className="text-[11px] text-[var(--lg-text-3)] font-mono">{article.pubdate}</span>
        {article.link && (
          <a
            href={article.link}
            target="_blank"
            rel="noreferrer"
            className="text-[var(--lg-text-3)] hover:text-sky-400 transition-colors"
          >
            <ExternalLink size={12} />
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
    <div className="flex items-start gap-3 py-3 border-b border-slate-800/60 last:border-b-0">
      <div className={`w-[3px] self-stretch rounded-full shrink-0 ${style.bar}`} />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 mb-1">
          <PeptideTag peptide={peptide} style={style} />
          {recent && <NewBadge />}
          <span className="ml-auto text-[11px] text-[var(--lg-text-3)] font-mono">{article.pubdate}</span>
        </div>
        <p className="text-xs font-semibold text-white leading-snug line-clamp-2">{article.title}</p>
        {article.authors.length > 0 && (
          <p className="text-[12px] text-[var(--lg-text-3)] mt-0.5">{formatAuthors(article.authors)}</p>
        )}
      </div>
      {article.link && (
        <a
          href={article.link}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 text-[var(--lg-text-3)] hover:text-sky-400 transition-colors mt-0.5"
        >
          <ExternalLink size={13} />
        </a>
      )}
    </div>
  )
}
