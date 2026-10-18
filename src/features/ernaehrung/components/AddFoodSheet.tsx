import { useMemo, useRef, useState } from 'react'
import { PenLine, ScanBarcode, Search, Star, X, Zap } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Sheet } from '../../compliance/components/Sheet'
import { type FrequentFood, mergeResults } from '../lib/foodSearch'
import { type Food, type Meal, parseAmount } from '../lib/nutrition'
import { searchBrands } from '../services/foodLookup'
import { PRESSABLE, chip, dim, input, label, muted } from '../styles'
import { SourceBadge } from './SourceBadge'

type Tab = 'frequent' | 'mine'
type Remote = { query: string; state: 'loading' | 'done' | 'error'; results: Food[] }

function FoodRow({ food, hint, hideKcal, onPick }: { food: Food; hint?: string; hideKcal: boolean; onPick: () => void }) {
  return (
    <li>
      <button type="button" onClick={onPick}
        className={`flex min-h-[54px] w-full items-center justify-between gap-3 rounded-xl px-2.5 py-1.5 text-left ${PRESSABLE}`}>
        <span className="min-w-0">
          <span className="flex items-center gap-1.5">
            {food.favorite && <Star size={12} aria-hidden="true" style={{ color: 'var(--cat-amber)', fill: 'var(--cat-amber)' }} />}
            <span className="truncate text-[0.88rem] font-semibold" style={{ color: 'var(--text)' }}>{food.name}</span>
          </span>
          <span className="flex items-center gap-1.5 text-[0.74rem]" style={muted}>
            <SourceBadge source={food.source} own={food.itemId !== null} />
            <span className="truncate">{[food.brand, hint].filter(Boolean).join(' · ')}</span>
          </span>
        </span>
        <span className="shrink-0 text-right text-[0.76rem] font-semibold tabular-nums" style={dim}>
          {hideKcal ? `${Math.round(food.per100.protein)} g P` : `${Math.round(food.per100.kcal)} kcal`}
          <span className="block text-[0.66rem] font-medium" style={muted}>/ 100 {food.unit}</span>
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
      <div className="flex items-center justify-between">
        <h2 id="nutr-add-title" className="text-lg font-extrabold" style={{ color: 'var(--text)' }}>
          {t('nutr_add_to', { meal: t(`nutr_meal_${meal}`) })}
        </h2>
        <button type="button" data-app-back-close aria-label={t('close')} onClick={onClose}
          className={`grid h-11 w-11 place-items-center rounded-xl ${PRESSABLE}`} style={dim}><X size={20} /></button>
      </div>

      <form className="mt-2 flex gap-2" role="search" onSubmit={e => { e.preventDefault(); runSearch() }}>
        <div className="relative flex-1">
          <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={muted} />
          <input type="search" value={query} onChange={e => setQuery(e.target.value)} enterKeyHint="search"
            autoComplete="off" autoCorrect="off" spellCheck={false}
            aria-label={t('nutr_search_label')} placeholder={t('nutr_search_placeholder')}
            style={{ ...input, paddingLeft: 36 }} />
        </div>
        <button type="button" onClick={onScan} aria-label={t('nutr_scan')}
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${PRESSABLE}`}
          style={{ border: '1px solid var(--accent-border)', color: 'var(--accent)', background: 'var(--accent-weak)' }}>
          <ScanBarcode size={20} />
        </button>
      </form>

      {!q && (
        <div role="tablist" aria-label={t('nutr_lists')} className="mt-3 flex gap-2">
          {(['frequent', 'mine'] as const).map(id => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
              className={PRESSABLE} style={chip(tab === id)}>{t(id === 'frequent' ? 'nutr_tab_frequent' : 'nutr_tab_mine')}</button>
          ))}
        </div>
      )}

      <div className="mt-2 min-h-[180px]" aria-live="polite">
        {!q && tab === 'frequent' && (frequent.length
          ? <ul>{frequent.map(f => (
              <FoodRow key={`${f.food.itemId ?? f.food.sourceRef ?? f.food.name}`} food={f.food} hideKcal={hideKcal}
                hint={`${Math.round(f.lastAmount)} ${f.food.unit}`} onPick={() => onPick(f.food, f.lastAmount)} />
            ))}</ul>
          : <p className="px-2 py-8 text-center text-[0.86rem]" style={muted}>{t('nutr_frequent_empty')}</p>)}

        {!q && tab === 'mine' && (myFoods.length
          ? <ul>{sorted(myFoods).map(f => <FoodRow key={f.itemId!} food={f} hideKcal={hideKcal} onPick={() => onPick(f)} />)}</ul>
          : <p className="px-2 py-8 text-center text-[0.86rem]" style={muted}>{t('nutr_mine_empty')}</p>)}

        {q && (
          <>
            {merged.length > 0 && (
              <ul>{merged.map((f, i) => (
                <FoodRow key={`${f.source}:${f.itemId ?? f.sourceRef ?? f.name}:${i}`} food={f} hideKcal={hideKcal}
                  onPick={() => onPick(f, lastAmount(f))} />
              ))}</ul>
            )}
            {!remoteForQuery && q.length >= 2 && (
              <button type="button" onClick={runSearch} className={`btn-secondary mt-2 flex w-full items-center justify-center gap-2 ${PRESSABLE}`}>
                <Search size={15} aria-hidden="true" />{t('nutr_search_brands', { query: q })}
              </button>
            )}
            {remoteForQuery?.state === 'loading' && <p className="py-3 text-center text-[0.84rem]" style={muted}>{t('nutr_searching')}</p>}
            {remoteForQuery?.state === 'error' && (
              <p role="alert" className="py-3 text-center text-[0.84rem]" style={{ color: 'var(--cat-amber)' }}>{t('nutr_search_unavailable')}</p>
            )}
            {remoteForQuery?.state === 'done' && merged.length === 0 && (
              <p className="py-3 text-center text-[0.84rem]" style={muted}>{t('nutr_no_results')}</p>
            )}
            {q.length < 2 && merged.length === 0 && <p className="py-6 text-center text-[0.84rem]" style={muted}>{t('nutr_search_hint')}</p>}
          </>
        )}
      </div>

      <div className="mt-3 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
        {quick ? (
          <div>
            <p style={label}>{t('nutr_quick')}</p>
            <div className="mt-1.5 flex gap-2">
              <input inputMode="decimal" enterKeyHint="done" autoFocus value={quick.kcal} placeholder="kcal" aria-label={t('nutr_quick_kcal')}
                onChange={e => setQuick({ ...quick, kcal: e.target.value })} style={input} />
              <input inputMode="decimal" enterKeyHint="done" value={quick.protein} placeholder={t('nutr_quick_protein_ph')} aria-label={t('nutr_quick_protein')}
                onChange={e => setQuick({ ...quick, protein: e.target.value })} style={input} />
              <button type="button" className="btn-primary shrink-0" disabled={quickBusy} onClick={submitQuick}>{t('nutr_add')}</button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button type="button" onClick={() => onCreate(q)} className={`btn-secondary flex flex-1 items-center justify-center gap-1.5 ${PRESSABLE}`}>
              <PenLine size={15} aria-hidden="true" />{t('nutr_create')}
            </button>
            <button type="button" onClick={() => setQuick({ kcal: '', protein: '' })} className={`btn-secondary flex flex-1 items-center justify-center gap-1.5 ${PRESSABLE}`}>
              <Zap size={15} aria-hidden="true" />{t('nutr_quick')}
            </button>
          </div>
        )}
      </div>
    </Sheet>
  )
}

