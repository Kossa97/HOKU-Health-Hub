import { useMemo, useRef, useState } from 'react'
import { PenLine, ScanBarcode, Search, Star, Zap } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Sheet } from '../../compliance/components/Sheet'
import { type FrequentFood, mergeResults } from '../lib/foodSearch'
import { type Food, type Meal, parseAmount } from '../lib/nutrition'
import { searchBrands } from '../services/foodLookup'
import { DIM, MUTED } from '../styles'
import { SheetClose } from '../../../components/ui/SheetClose'
import { SourceBadge } from './SourceBadge'

type Tab = 'frequent' | 'mine'
type Remote = { query: string; state: 'loading' | 'done' | 'error'; results: Food[] }

function FoodRow({ food, hint, hideKcal, onPick }: { food: Food; hint?: string; hideKcal: boolean; onPick: () => void }) {
  return (
    <li>
      <button type="button" onClick={onPick}
        className="flex min-h-[56px] w-full items-center justify-between gap-3 px-4 py-2 text-left transition-colors active:bg-[var(--lg-fill)]">
        <span className="min-w-0">
          <span className="flex items-center gap-1.5">
            {food.favorite && <Star size={13} aria-hidden="true" className="shrink-0 fill-[#ffd60a] text-[#ffd60a]" />}
            <span className="truncate text-[17px] text-[var(--lg-text)]">{food.name}</span>
          </span>
          <span className={`mt-0.5 flex items-center gap-1.5 text-[13px] ${MUTED}`}>
            <SourceBadge source={food.source} own={food.itemId !== null} />
            <span className="truncate">{[food.brand, hint].filter(Boolean).join(' · ')}</span>
          </span>
        </span>
        <span className={`shrink-0 text-right text-[15px] tabular-nums ${DIM}`}>
          {hideKcal ? `${Math.round(food.per100.protein)} g P` : `${Math.round(food.per100.kcal)} kcal`}
          <span className={`block text-[12px] ${MUTED}`}>/ 100 {food.unit}</span>
        </span>
      </button>
    </li>
  )
}

export function AddFoodSheet({ meal, frequent, myFoods, hideKcal, onPick, onScan, onCreate, onQuick, onClose }: {
  meal: Meal
  frequent: FrequentFood[]
  myFoods: Food[]
  hideKcal: boolean
  /** `amount` = vorgeschlagene Menge (bei „Häufig" die zuletzt gegessene). */
  onPick: (food: Food, amount?: number) => void
  onScan: () => void
  onCreate: (name: string) => void
  onQuick: (kcal: number, protein: number) => Promise<void>
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const [tab, setTab] = useState<Tab>(frequent.length ? 'frequent' : 'mine')
  const [query, setQuery] = useState('')
  const [remote, setRemote] = useState<Remote | null>(null)
  const [quick, setQuick] = useState<{ kcal: string; protein: string } | null>(null)
  const [quickBusy, setQuickBusy] = useState(false)
  const searchSeq = useRef(0)
  const q = query.trim()
  const lang = i18n.language?.startsWith('en') ? 'en' : 'de'

  // Lokal sofort beim Tippen: Häufig + Meine Lebensmittel.
  const local = useMemo(() => {
    if (!q) return []
    const own = [...myFoods, ...frequent.map(f => f.food).filter(f => !f.itemId)]
    return mergeResults(q, { own, bls: [], off: [] })
  }, [q, myFoods, frequent])
  const lastAmount = (f: Food) => frequent.find(x => x.food === f || (x.food.itemId && x.food.itemId === f.itemId))?.lastAmount

  const remoteForQuery = remote && remote.query === q ? remote : null
  const merged = useMemo(
    () => (remoteForQuery?.state === 'done' ? mergeResults(q, { own: local, bls: [], off: remoteForQuery.results }) : local),
    [q, local, remoteForQuery],
  )

  const runSearch = async () => {
    if (q.length < 2) return
    const seq = ++searchSeq.current
    setRemote({ query: q, state: 'loading', results: [] })
    try {
      const results = await searchBrands(q, lang)
      if (seq === searchSeq.current) setRemote({ query: q, state: 'done', results })
    } catch {
      if (seq === searchSeq.current) setRemote({ query: q, state: 'error', results: [] })
    }
  }

  const submitQuick = async () => {
    if (!quick) return
    const kcal = parseAmount(quick.kcal)
    const protein = quick.protein.trim() ? parseAmount(quick.protein) : 0
    if (!(kcal >= 0 && kcal <= 10000) || !(protein >= 0 && protein <= 1000) || (kcal === 0 && protein === 0)) return
    setQuickBusy(true)
    try { await onQuick(kcal, protein) } finally { setQuickBusy(false) }
  }

  const sorted = (list: Food[]) => [...list].sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name))

  return (
    <Sheet labelledBy="nutr-add-title" onClose={onClose} tall>
      <div className="flex items-center justify-between gap-2">
        <h2 id="nutr-add-title" className="lg-title2 min-w-0 truncate">
          {t('nutr_add_to', { meal: t(`nutr_meal_${meal}`) })}
        </h2>
        <SheetClose onClick={onClose} />
      </div>

      <form className="mt-2 flex gap-2" role="search" onSubmit={e => { e.preventDefault(); runSearch() }}>
        <div className="relative flex-1">
          <Search size={16} aria-hidden="true" className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 ${MUTED}`} />
          <input type="search" value={query} onChange={e => setQuery(e.target.value)} enterKeyHint="search"
            autoComplete="off" autoCorrect="off" spellCheck={false}
            aria-label={t('nutr_search_label')} placeholder={t('nutr_search_placeholder')}
            className="min-h-11 w-full rounded-full border-0 bg-[var(--lg-fill)] py-2.5 pl-10 pr-4 text-[16px] text-[var(--lg-text)] outline-none placeholder:text-[var(--lg-text-3)] focus-visible:ring-2 focus-visible:ring-[var(--lg-accent)]" />
        </div>
        <button type="button" onClick={onScan} aria-label={t('nutr_scan')} className="lg-gray-btn !w-11 shrink-0 !px-0">
          <ScanBarcode size={20} />
        </button>
      </form>

      {!q && (
        <div role="tablist" aria-label={t('nutr_lists')} className="mt-3 grid grid-cols-2 rounded-full bg-[var(--lg-fill)] p-0.5">
          {(['frequent', 'mine'] as const).map(id => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
              className={`min-h-9 rounded-full text-[15px] font-semibold transition-colors ${tab === id
                ? 'bg-[var(--lg-fill-selected)] text-[var(--lg-text)] shadow-[0_3px_8px_rgba(0,0,0,0.25)]'
                : 'text-[var(--lg-text-2)]'}`}>{t(id === 'frequent' ? 'nutr_tab_frequent' : 'nutr_tab_mine')}</button>
          ))}
        </div>
      )}

      <div className="-mx-5 mt-2 min-h-[180px]" aria-live="polite">
        {!q && tab === 'frequent' && (frequent.length
          ? <ul className="lg-rows">{frequent.map(f => (
              <FoodRow key={`${f.food.itemId ?? f.food.sourceRef ?? f.food.name}`} food={f.food} hideKcal={hideKcal}
                hint={`${Math.round(f.lastAmount)} ${f.food.unit}`} onPick={() => onPick(f.food, f.lastAmount)} />
            ))}</ul>
          : <p className={`px-6 py-8 text-center text-[15px] ${MUTED}`}>{t('nutr_frequent_empty')}</p>)}

        {!q && tab === 'mine' && (myFoods.length
          ? <ul className="lg-rows">{sorted(myFoods).map(f => <FoodRow key={f.itemId!} food={f} hideKcal={hideKcal} onPick={() => onPick(f)} />)}</ul>
          : <p className={`px-6 py-8 text-center text-[15px] ${MUTED}`}>{t('nutr_mine_empty')}</p>)}

        {q && (
          <>
            {merged.length > 0 && (
              <ul className="lg-rows">{merged.map((f, i) => (
                <FoodRow key={`${f.source}:${f.itemId ?? f.sourceRef ?? f.name}:${i}`} food={f} hideKcal={hideKcal}
                  onPick={() => onPick(f, lastAmount(f))} />
              ))}</ul>
            )}
            {!remoteForQuery && q.length >= 2 && (
              <button type="button" onClick={runSearch} className="lg-gray-btn mx-5 mt-2 !w-[calc(100%-2.5rem)]">
                <Search size={15} aria-hidden="true" />{t('nutr_search_brands', { query: q })}
              </button>
            )}
            {remoteForQuery?.state === 'loading' && <p className={`px-5 py-3 text-center text-[15px] ${MUTED}`}>{t('nutr_searching')}</p>}
            {remoteForQuery?.state === 'error' && (
              <p role="alert" className="px-5 py-3 text-center text-[15px] text-[var(--lg-warn-text)]">{t('nutr_search_unavailable')}</p>
            )}
            {remoteForQuery?.state === 'done' && merged.length === 0 && (
              <p className={`px-5 py-3 text-center text-[15px] ${MUTED}`}>{t('nutr_no_results')}</p>
            )}
            {q.length < 2 && merged.length === 0 && <p className={`px-5 py-6 text-center text-[15px] ${MUTED}`}>{t('nutr_search_hint')}</p>}
          </>
        )}
      </div>

      <div className="mt-3 border-t border-[var(--lg-separator)] pt-3">
        {quick ? (
          <div>
            <p className="label">{t('nutr_quick')}</p>
            <div className="flex gap-2">
              <input inputMode="decimal" enterKeyHint="done" autoFocus value={quick.kcal} placeholder="kcal" aria-label={t('nutr_quick_kcal')}
                onChange={e => setQuick({ ...quick, kcal: e.target.value })} className="input min-w-0" />
              <input inputMode="decimal" enterKeyHint="done" value={quick.protein} placeholder={t('nutr_quick_protein_ph')} aria-label={t('nutr_quick_protein')}
                onChange={e => setQuick({ ...quick, protein: e.target.value })} className="input min-w-0" />
              <button type="button" className="lg-btn lg-btn-primary lg-btn-compact shrink-0 !px-4" disabled={quickBusy} onClick={submitQuick}>{t('nutr_add')}</button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button type="button" onClick={() => onCreate(q)} className="lg-gray-btn flex-1">
              <PenLine size={15} aria-hidden="true" />{t('nutr_create')}
            </button>
            <button type="button" onClick={() => setQuick({ kcal: '', protein: '' })} className="lg-gray-btn flex-1">
              <Zap size={15} aria-hidden="true" />{t('nutr_quick')}
            </button>
          </div>
        )}
      </div>
    </Sheet>
  )
}

