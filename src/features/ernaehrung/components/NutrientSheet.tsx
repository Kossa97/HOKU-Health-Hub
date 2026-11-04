import { useEffect, useState } from 'react'
import { ChevronLeft, Minus, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Sheet } from './Panel'
import { SheetClose } from '../../../components/ui/SheetClose'
import { NutrientBar } from './NutrientList'
import { type NutrientId, type NutrientStatus, type OwnGoals, formatAmount, referenceValue, type TargetContext } from '../lib/nutrientTargets'
import type { LogEntry } from '../lib/nutrition'
import { topSources } from '../services/foodCatalog'
import type { StackPart } from '../lib/stackMicros'
import { DIM, MUTED } from '../styles'

/** Wert eines Nährstoffs in einem Eintrag (Makro-Spalte oder Mikronährstoff). */
function entryValue(e: LogEntry, id: NutrientId): number | null {
  const n = e.nutrients
  if (id === 'fiber' || id === 'sugar' || id === 'salt' || id === 'satFat') return n[id]
  return n.micros?.[id] ?? null
}

/** Schritt fürs eigene Ziel: rund 5 % des Richtwerts, auf eine runde Zahl. */
function stepFor(ref: number): number {
  const raw = ref * 0.05
  const pow = 10 ** Math.floor(Math.log10(raw))
  const m = raw / pow
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * pow
}

/**
 * Ein Nährstoff im Detail: heute, woher, gute Quellen, Richtwert, Obergrenze, eigenes Ziel.
 * Das eigene Ziel wird mit „Speichern“ zu den Zielen gelegt; „Auf Richtwert“ entfernt es.
 */
export function NutrientSheet({ status, ctx, own, entries, stackParts, busy, onSaveOwn, onBack, onClose }: {
  status: NutrientStatus
  ctx: TargetContext
  own: OwnGoals
  entries: readonly LogEntry[]
  /** Supplements aus My Stack, die heute genommen wurden. */
  stackParts: readonly StackPart[]
  busy: boolean
  onSaveOwn: (goals: OwnGoals) => Promise<boolean> | void
  onBack: () => void
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language?.startsWith('en') ? 'en' : 'de'
  const { def } = status
  const id = def.id
  const unit = def.unit
  const ref = referenceValue(id, ctx)
  const [goal, setGoal] = useState(status.target)
  const step = stepFor(ref)
  const [sources, setSources] = useState<{ name: string; per100: number }[] | null>(null)
  useEffect(() => {
    if (def.kind !== 'min') return
    let off = false
    topSources(id, lang).then(s => { if (!off) setSources(s) }).catch(() => { if (!off) setSources([]) })
    return () => { off = true }
  }, [id, lang, def.kind])

  const from = entries
    .map(e => ({ e, v: entryValue(e, id) }))
    .filter((x): x is { e: LogEntry; v: number } => x.v != null && x.v > 0)
    .sort((a, b) => b.v - a.v)
    .slice(0, 6)
  const fromStack = stackParts.filter(p => p.key === id && p.amount > 0)
  const fmt = (v: number) => formatAmount(v, i18n.language)
  const changed = Math.abs(goal - status.target) > 1e-9
  const isOwn = own[id] != null

  const save = (next: number | null) => {
    const rest = { ...own }
    if (next === null || Math.abs(next - ref) < 1e-9) delete rest[id]
    else rest[id] = Math.round(next * 1000) / 1000
    void onSaveOwn(rest)
  }

  return (
    <Sheet labelledBy="nutr-nut-sheet-title" busy={busy} onClose={onClose} data-nutr-nutrient>
      <div className="flex items-center gap-1">
        <button type="button" onClick={onBack} aria-label={t('nutr_nut_back')} className="-ml-2 grid h-11 w-11 shrink-0 place-items-center text-[var(--lg-accent-text)]">
          <ChevronLeft size={22} aria-hidden="true" />
        </button>
        <h2 id="nutr-nut-sheet-title" className="lg-title2 min-w-0 flex-1 truncate">{t(`nutr_n_${id}`)}</h2>
        <SheetClose onClick={onClose} disabled={busy} />
      </div>

      <section className="mt-3 rounded-[18px] bg-[var(--lg-surface-2)] p-4">
        <p className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="text-[32px] font-bold leading-none tabular-nums text-[var(--lg-text)]">{fmt(status.value)}</span>
          <span className={`text-[15px] ${MUTED}`}>
            {t(def.kind === 'max' ? 'nutr_nut_of_max' : 'nutr_nut_of', { target: fmt(status.target), unit })}
          </span>
        </p>
        <div className="mt-3"><NutrientBar s={status} big /></div>
        {status.lowData && status.entries > 0 && (
          <p className={`mt-2 text-[12px] ${MUTED}`}>{t('nutr_nut_low_data_long', { known: status.known, count: status.entries })}</p>
        )}
      </section>

      <section aria-labelledby="nutr-nut-from" className="mt-4">
        <h3 id="nutr-nut-from" className="px-1 pb-1.5 text-[13px] font-semibold text-[var(--lg-text-2)]">{t('nutr_nut_from')}</h3>
        {from.length || fromStack.length ? (
          <ul className="rounded-[18px] bg-[var(--lg-surface-2)] px-4">
            {fromStack.map((p, i) => (
              <li key={`stack-${i}-${p.item}`} className="flex min-h-12 items-center gap-3 border-b border-[var(--lg-separator)] py-2 last:border-0">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] text-[var(--lg-text)]">{p.item}</span>
                  <span className="block text-[12px] text-[var(--lg-accent-text)]">{t('nutr_nut_stack_row')}</span>
                </span>
                <span className="shrink-0 text-[15px] font-semibold tabular-nums text-[var(--lg-text)]">{fmt(p.amount)} {unit}</span>
              </li>
            ))}
            {from.map(({ e, v }) => (
              <li key={e.id} className="flex min-h-12 items-center gap-3 border-b border-[var(--lg-separator)] py-2 last:border-0">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] text-[var(--lg-text)]">{e.name}</span>
                  {e.amount != null && <span className={`block text-[12px] ${MUTED}`}>{Math.round(e.amount)} {e.unit}</span>}
                </span>
                <span className="shrink-0 text-[15px] font-semibold tabular-nums text-[var(--lg-text)]">{fmt(v)} {unit}</span>
              </li>
            ))}
          </ul>
        ) : <p className={`px-1 text-[13px] ${MUTED}`}>{t('nutr_nut_from_none')}</p>}
      </section>

      {def.kind === 'min' && sources && sources.length > 0 && (
        <section aria-labelledby="nutr-nut-good" className="mt-4">
          <h3 id="nutr-nut-good" className="px-1 pb-1.5 text-[13px] font-semibold text-[var(--lg-text-2)]">{t('nutr_nut_good')}</h3>
          <ul className="flex flex-wrap gap-2">
            {sources.map(s => (
              <li key={s.name} className="flex min-h-9 items-center gap-1.5 rounded-full bg-[var(--lg-surface-2)] px-3 text-[14px] text-[var(--lg-text)]">
                {s.name}<b className="font-semibold tabular-nums text-[var(--lg-accent-text)]">{fmt(s.per100)} {unit}</b>
              </li>
            ))}
          </ul>
          <p className={`mt-1.5 px-1 text-[12px] ${MUTED}`}>{t('nutr_nut_good_note')}</p>
        </section>
      )}

      <section aria-labelledby="nutr-nut-goal" className="mt-4">
        <h3 id="nutr-nut-goal" className="px-1 pb-1.5 text-[13px] font-semibold text-[var(--lg-text-2)]">{t('nutr_nut_goal')}</h3>
        <div className="rounded-[18px] bg-[var(--lg-surface-2)] p-4">
          <div className="flex items-center gap-3">
            <span className="min-w-0 flex-1">
              <span className="block text-[17px] font-semibold tabular-nums text-[var(--lg-text)]">
                {t(def.kind === 'max' ? 'nutr_nut_goal_max' : 'nutr_nut_goal_min', { value: fmt(goal), unit })}
              </span>
              <span className={`mt-0.5 block text-[12px] ${isOwn && !changed ? 'text-[var(--lg-accent-text)]' : MUTED}`}>
                {isOwn && !changed ? t('nutr_nut_own') : t('nutr_nut_reference', { value: fmt(ref), unit })}
              </span>
            </span>
            <div role="group" aria-label={t('nutr_nut_goal_change')} className="flex shrink-0 overflow-hidden rounded-[10px] bg-[var(--lg-fill)]">
              <button type="button" aria-label={t('nutr_nut_less')} disabled={busy || goal - step <= 0}
                onClick={() => setGoal(g => Math.max(step, Math.round((g - step) / step) * step))}
                className="grid h-10 w-12 place-items-center text-[var(--lg-text)] disabled:opacity-40"><Minus size={16} aria-hidden="true" /></button>
              <span aria-hidden="true" className="my-2.5 w-px bg-[var(--lg-separator)]" />
              <button type="button" aria-label={t('nutr_nut_more')} disabled={busy}
                onClick={() => setGoal(g => Math.round((g + step) / step) * step)}
                className="grid h-10 w-12 place-items-center text-[var(--lg-text)]"><Plus size={16} aria-hidden="true" /></button>
            </div>
          </div>
          {(changed || isOwn) && (
            <div className="mt-3 flex gap-2">
              {isOwn && (
                <button type="button" data-quiet className="lg-gray-btn flex-1" disabled={busy}
                  onClick={() => { setGoal(ref); save(null) }}>{t('nutr_nut_reset')}</button>
              )}
              {changed && (
                <button type="button" className="lg-btn lg-btn-primary flex-1 !px-4" disabled={busy} onClick={() => save(goal)}>{t('nutr_save')}</button>
              )}
            </div>
          )}
          <p className={`mt-3 text-[12px] leading-relaxed ${DIM}`}>
            {t(`nutr_nut_basis_${id === 'sugar' || id === 'satFat' || id === 'trans' || id === 'omega3' ? 'energy' : id === 'chol' ? 'orientation' : 'dge'}`)}
            {def.ul ? ` ${t('nutr_nut_ul', { value: fmt(def.ul), unit })}` : ''}
            {id === 'sugar' ? ` ${t('nutr_nut_sugar_note')}` : ''}
          </p>
        </div>
      </section>
    </Sheet>
  )
}
