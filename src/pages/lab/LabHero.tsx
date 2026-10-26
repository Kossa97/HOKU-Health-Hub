// src/pages/lab/LabHero.tsx
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Search, FlaskConical, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const QUICK_TAGS = ['BPC-157', 'TB-500', 'GLP-1', 'Recovery', 'Healing', 'Longevity']

interface LabHeroProps {
  onSearch: (query: string) => void
  loading: boolean
}

export function LabHero({ onSearch, loading }: LabHeroProps) {
  const { t }      = useTranslation()
  const navigate   = useNavigate()
  const [query, setQuery] = useState('')
  const [activeTag, setActiveTag] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (q) {
      setActiveTag('')
      onSearch(q)
    }
  }

  const handleTag = (tag: string) => {
    setQuery(tag)
    setActiveTag(tag)
    onSearch(tag)
  }

  return (
    <div className="pb-2 pt-1">
      <p className="mb-0.5 text-[13px] font-semibold uppercase tracking-[0.04em] text-[var(--lg-text-3)]">
        {t('lab_kicker')}
      </p>
      <h1 className="lg-large-title">{t('lab_title')}</h1>
      <p className="mb-4 mt-0.5 text-[15px] leading-snug text-[var(--lg-text-2)]">
        {t('lab_subtitle')}
      </p>

      {/* Suche wie in iOS: eingelassene Füllung, Lupe links */}
      <form onSubmit={handleSubmit} className="mb-3 flex gap-2">
        <div className="relative flex-1">
          <Search
            size={17}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--lg-text-3)]"
          />
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); setActiveTag('') }}
            disabled={loading}
            placeholder={t('lab_search_placeholder')}
            className="min-h-11 w-full rounded-full border-0 bg-[var(--lg-fill)] py-2.5 pl-10 pr-4 text-[16px] text-[var(--lg-text)] outline-none placeholder:text-[var(--lg-text-3)] focus-visible:ring-2 focus-visible:ring-[var(--lg-accent)]"
          />
        </div>
        <button type="submit" disabled={loading} className="lg-btn lg-btn-primary lg-btn-compact shrink-0 !px-4">
          {loading ? '…' : t('lab_search_button')}
        </button>
      </form>

      {/* Schnellsuche + Peptipedia */}
      <div className="flex flex-wrap items-center gap-2">
        {QUICK_TAGS.map(tag => (
          <button
            key={tag}
            type="button"
            disabled={loading}
            aria-pressed={activeTag === tag}
            onClick={() => handleTag(tag)}
            className={`min-h-9 rounded-full px-3.5 text-[14px] font-medium transition-colors duration-150 ${
              activeTag === tag
                ? 'bg-[var(--lg-fill-selected)] text-[var(--lg-text)]'
                : 'bg-[var(--lg-fill)] text-[var(--lg-text-2)]'
            }`}
          >
            {tag}
          </button>
        ))}

        <button
          type="button"
          onClick={() => navigate('/lab/peptipedia')}
          className="flex min-h-9 items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] px-3.5 text-[14px] font-semibold text-[var(--lg-accent-text)] transition-colors duration-150"
        >
          <FlaskConical size={14} />
          Peptipedia
          <ArrowRight size={13} className="opacity-70" />
        </button>
      </div>
    </div>
  )
}
