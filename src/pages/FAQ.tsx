import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ChevronDown, ChevronUp, Search,
  CalendarDays, FlaskConical, BookHeart, Star, User,
  TrendingUp, Bell, HelpCircle, Shield, Calculator, Package,
  Syringe, Archive, FileText,
} from 'lucide-react'
import { loadFaqBundle } from '../i18n/faq'
import type { FaqBundle, FaqCategory, FaqItem } from '../i18n/faq/types'

interface QA { q: string; a: string | string[] }
interface Category extends FaqCategory {
  icon: React.ReactNode
  color: string
}

// Farbiges Symbol-Quadrat wie in den iOS-Einstellungen (Systemfarben)
const CAT_META: Record<string, { icon: React.ReactNode; color: string }> = {
  start: { icon: <HelpCircle size={17} />, color: '#0a84ff' },
  kalender: { icon: <CalendarDays size={17} />, color: '#5e5ce6' },
  peptide: { icon: <FlaskConical size={17} />, color: '#0a84ff' },
  rechner: { icon: <Calculator size={17} />, color: '#30d158' },
  zyklen: { icon: <CalendarDays size={17} />, color: '#5e5ce6' },
  escalation: { icon: <TrendingUp size={17} />, color: '#ff9f0a' },
  tagebuch: { icon: <BookHeart size={17} />, color: '#30d158' },
  bewertungen: { icon: <Star size={17} />, color: '#ff9f0a' },
  profil: { icon: <User size={17} />, color: '#8e8e93' },
  erinnerung: { icon: <Bell size={17} />, color: '#ff375f' },
  injections: { icon: <Syringe size={17} />, color: '#30d158' },
  inventory: { icon: <Archive size={17} />, color: '#32ade6' },
  reports: { icon: <FileText size={17} />, color: '#0a84ff' },
  technik: { icon: <Shield size={17} />, color: '#8e8e93' },
}

function toDisplayCategories(cats: FaqCategory[]): Category[] {
  return cats.map(cat => {
    const meta = CAT_META[cat.id] ?? { icon: <Package size={17} />, color: '#8e8e93' }
    return { ...cat, ...meta }
  })
}

function AccordionItem({ item }: { item: QA }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        className="w-full min-h-[48px] text-start flex items-start justify-between gap-3 py-3 pl-[60px] pr-4 transition-colors active:bg-white/[0.06]"
        onClick={() => setOpen(o => !o)}
      >
        <span className={`text-[16px] leading-snug ${open ? 'font-semibold text-[var(--lg-text)]' : 'text-[var(--lg-text)]'}`}>
          {item.q}
        </span>
        {open
          ? <ChevronUp size={16} className="text-[var(--lg-accent-text)] shrink-0 mt-1" />
          : <ChevronDown size={16} className="text-[var(--lg-text-3)] shrink-0 mt-1" />}
      </button>
      {open && (
        <div className="pb-4 pl-[60px] pr-4">
          {Array.isArray(item.a) ? (
            <ul className="space-y-1.5">
              {item.a.map((line, i) => (
                <li key={i} className={`text-[15px] leading-relaxed ${
                  i === 0 && item.a.length > 1 ? 'text-[var(--lg-text)] font-medium' : 'text-[var(--lg-text-2)]'
                }`}>
                  {line}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[var(--lg-text-2)] text-[15px] leading-relaxed">{item.a}</p>
          )}
        </div>
      )}
    </div>
  )
}

function itemMatchesQuery(item: FaqItem, q: string): boolean {
  const hay = (
    item.q.toLowerCase() +
    (Array.isArray(item.a) ? item.a.join(' ') : item.a).toLowerCase()
  )
  return hay.includes(q)
}

export function FAQ() {
  const { i18n } = useTranslation()
  const [search, setSearch] = useState('')
  const [openCats, setOpenCats] = useState<Set<string>>(new Set(['start']))

  const [bundle, setBundle] = useState<FaqBundle | null>(null)
  useEffect(() => {
    let alive = true
    loadFaqBundle(i18n.language).then(b => { if (alive) setBundle(b) })
    return () => { alive = false }
  }, [i18n.language])

  const CATEGORIES = useMemo(
    () => (bundle ? toDisplayCategories(bundle.categories) : []),
    [bundle],
  )

  const toggleCat = (id: string) =>
    setOpenCats(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const q = search.toLowerCase().trim()

  const visible = q
    ? CATEGORIES.map(cat => ({
        ...cat,
        items: cat.items.filter(item => itemMatchesQuery(item, q)),
      })).filter(cat => cat.items.length > 0)
    : CATEGORIES

  const totalQ = CATEGORIES.reduce((s, c) => s + c.items.length, 0)

  if (!bundle) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-[var(--lg-text-3)]">
        …
      </div>
    )
  }
  const { ui } = bundle

  return (
    <div>
      <h1 className="lg-large-title">{ui.pageTitle}</h1>
      <p className="mt-0.5 mb-4 text-[15px] leading-snug text-[var(--lg-text-2)]">
        {ui.subtitle.replace(/\{\{\s*count\s*\}\}/gi, String(totalQ))}
      </p>

      <div className="relative mb-5">
        <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--lg-text-3)] pointer-events-none" />
        <input
          type="search"
          aria-label={ui.searchPlaceholder}
          className="min-h-11 w-full rounded-full border-0 bg-[var(--lg-fill)] py-2.5 pl-10 pr-4 text-[16px] text-[var(--lg-text)] outline-none placeholder:text-[var(--lg-text-3)] focus-visible:ring-2 focus-visible:ring-[var(--lg-accent)]"
          placeholder={ui.searchPlaceholder}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {q && visible.length === 0 && (
        <div className="lg-surface lg-flat text-center px-5 py-10 text-[var(--lg-text-2)]">
          <HelpCircle size={28} className="mx-auto mb-2 text-[var(--lg-text-3)]" />
          <p>{ui.emptySearch.replace(/\{\{\s*query\s*\}\}/gi, search)}</p>
        </div>
      )}

      <div className="space-y-3">
        {visible.map(cat => (
          <div key={cat.id} className="lg-group lg-rows">
            <button
              type="button"
              aria-expanded={q ? undefined : openCats.has(cat.id)}
              className="w-full min-h-[56px] flex items-center justify-between gap-3 px-4 py-2.5 text-start transition-colors active:bg-white/[0.06]"
              onClick={() => !q && toggleCat(cat.id)}
            >
              <span className="flex min-w-0 items-center gap-3.5">
                <span className="lg-icon-tile" style={{ background: cat.color }} aria-hidden="true">{cat.icon}</span>
                <span className="min-w-0 text-[16px] font-semibold text-[var(--lg-text)]">{cat.title}</span>
                <span className="lg-tag !min-h-[22px] !px-2 !text-[12px] shrink-0">{cat.items.length}</span>
              </span>
              {!q && (
                openCats.has(cat.id)
                  ? <ChevronUp size={16} className="text-[var(--lg-text-3)] shrink-0" />
                  : <ChevronDown size={16} className="text-[var(--lg-text-3)] shrink-0" />
              )}
            </button>

            {(q || openCats.has(cat.id)) && cat.items.map(item => (
              <AccordionItem key={item.q} item={item} />
            ))}
          </div>
        ))}
      </div>

      <p className="text-center text-[var(--lg-text-3)] text-xs mt-8 pb-2">
        {ui.footer}
      </p>
    </div>
  )
}
