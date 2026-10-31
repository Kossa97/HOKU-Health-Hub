import { ChefHat, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { type LogEntry, type Meal, per100FromEntry, showDecimal, sumNutrients } from '../lib/nutrition'
import { type Piece, countFor, servingNoun } from '../lib/pieces'
import { FoodOrb } from './FoodOrb'
import { type LiftStart, SwipeRow } from './SwipeRow'
import { ScoreBadge } from './ScoreBadge'
import { CARD, DIM, MUTED } from '../styles'

/** Inhalt einer Eintragszeile — in der Liste und als Kopie beim Verschieben. */
export function EntryRowContent({ entry: e, hideKcal, goalKcal, pieceOf }: {
  entry: LogEntry
  hideKcal: boolean
  goalKcal: number
  pieceOf: (entry: LogEntry) => Piece | null
}) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language ?? 'de'
  /** „2 Stück · “ für Gezähltes (Eier, Scheiben Brot), sonst „110 g · “. */
  const amountText = () => {
    if (e.amount == null) return ''
    const piece = pieceOf(e)
    const n = piece && countFor(e.amount, piece.grams)
    if (!n) return `${Math.round(e.amount)} ${e.unit} · `
    if (piece.label) return `${n === 1 ? piece.label : `${showDecimal(n, lang)} × ${servingNoun(piece.label)}`} · `
    return `${t(`nutr_piece_${piece.kind}`, { count: n, n: showDecimal(n, lang) })} · `
  }
  return (
    <>
      <FoodOrb values={e.nutrients} goalKcal={goalKcal} size={44} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[17px] text-[var(--lg-text)]">{e.name}</span>
        <span className={`block truncate font-mono text-[12px] tabular-nums ${MUTED}`}>
          {amountText()}
          {Math.round(e.nutrients.protein)} {t('nutr_p')} · {Math.round(e.nutrients.carbs)} {t('nutr_c')} · {Math.round(e.nutrients.fat)} {t('nutr_f')}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-3">
        <ScoreBadge per100={per100FromEntry(e)} unit={e.unit} />
        {!hideKcal && <span className={`text-[15px] tabular-nums ${DIM}`}>{Math.round(e.nutrients.kcal)}</span>}
      </span>
    </>
  )
}

export function MealSection({ meal, entries, hideKcal, goalKcal, busy, pieceOf, onAdd, onOpen, onDelete, onSaveAsDish, drag, onLift, ready = true }: {
  meal: Meal
  entries: LogEntry[]
  hideKcal: boolean
  /** Tagesziel: Größe der Essens-Kugeln im Verhältnis zur Tageskugel. */
  goalKcal: number
  busy: boolean
  /** Zählbar wie im Mengenblatt (gleiche Quelle), für „2 Stück“ statt „110 g“. */
  pieceOf: (entry: LogEntry) => Piece | null
  onAdd: () => void
  onOpen: (entry: LogEntry) => void
  /** Wischen → Löschen; false, wenn es scheiterte. */
  onDelete: (entry: LogEntry) => Promise<boolean>
  /** Diese Mahlzeit als Gericht speichern (Einträge mit Menge). */
  onSaveAsDish: () => void
  /** Verschieben läuft: dieser Eintrag ist angehoben; `index` = hier geht die Lücke auf. */
  drag?: { id: string; index: number | null; height: number } | null
  /** Halten löst eine Zeile (mit ihrem Platz in dieser Mahlzeit). */
  onLift?: (entry: LogEntry, index: number, at: LiftStart) => void
  /** Daten des Tages geladen — vorher nimmt die Mahlzeit nichts auf (sonst landete ein Eintrag im alten Stand). */
  ready?: boolean
}) {
  const { t } = useTranslation()
  const sum = sumNutrients(entries.map(e => e.nutrients))
  const headingId = `nutr-meal-${meal}`
  // Erst ab zwei Zutaten ist es ein Gericht.
  const canSaveAsDish = entries.filter(e => e.source !== 'quick' && e.amount).length >= 2
  // Beim Verschieben: der angehobene Eintrag fehlt hier, an der Zielstelle steht eine Lücke.
  const shown = drag ? entries.filter(e => e.id !== drag.id) : entries
  const gap = drag && drag.index != null ? Math.min(drag.index, shown.length) : null
  const gapItem = gap != null && drag && (
    <li key="drop-gap" aria-hidden="true" data-drop-placeholder className="px-2 py-1">
      <div className="animate-[nutr-gap_180ms_ease-out] rounded-[14px] bg-[var(--lg-fill)] motion-reduce:animate-none" style={{ height: drag.height - 8 }} />
    </li>
  )

  return (
    <section aria-labelledby={headingId} className={CARD} data-meal={meal} data-drop-ready={ready ? 'true' : undefined}>
      {/* Titel · Summe · Hinzufügen in einer Zeile. */}
      <div className="flex items-center gap-2 pl-4 pr-2 pt-2">
        <h2 id={headingId} className="min-w-0 flex-1 truncate text-[17px] font-medium text-[var(--lg-text)]">{t(`nutr_meal_${meal}`)}</h2>
        {entries.length > 0 && (
          <span className={`shrink-0 font-mono text-[13px] tabular-nums ${MUTED}`}>
            {hideKcal ? `${Math.round(sum.protein)} g ${t('nutr_protein_short')}` : `${Math.round(sum.kcal)} kcal`}
          </span>
        )}
        <button type="button" onClick={onAdd} disabled={busy}
          className="flex min-h-11 shrink-0 touch-manipulation select-none items-center gap-1 rounded-[10px] px-3 text-[15px] font-medium text-[var(--lg-accent-text)] transition-opacity active:opacity-60 disabled:opacity-40">
          <Plus size={18} strokeWidth={2} aria-hidden="true" />{t('nutr_add')}
        </button>
      </div>

      {(entries.length > 0 || gapItem) && (
        <ul className="lg-rows mt-1">
          {entries.flatMap(e => {
            // Der angehobene Eintrag bleibt (unsichtbar) im Baum: an ihm hängen die Touch-Ereignisse der Geste.
            const lifted = drag?.id === e.id
            const i = shown.indexOf(e)
            const row = (
              <li key={e.id} className={lifted ? 'h-0 overflow-hidden opacity-0' : undefined}>
                <SwipeRow id={e.id} label={t('nutr_entry_open', { name: e.name })} editLabel={t('nutr_edit')} deleteLabel={t('nutr_delete')}
                  disabled={busy} onTap={() => onOpen(e)} onEdit={() => onOpen(e)} onDelete={() => onDelete(e)}
                  onLift={onLift && !busy ? at => onLift(e, i, at) : undefined}>
                  <EntryRowContent entry={e} hideKcal={hideKcal} goalKcal={goalKcal} pieceOf={pieceOf} />
                </SwipeRow>
              </li>
            )
            return !lifted && gap === i ? [gapItem, row] : [row]
          })}
          {gap === shown.length && gapItem}
        </ul>
      )}

      {canSaveAsDish ? (
        <div className="flex px-3 pb-3 pt-2">
          <button type="button" onClick={onSaveAsDish} disabled={busy} data-quiet
            aria-label={t('nutr_save_as_dish_aria', { meal: t(`nutr_meal_${meal}`) })}
            className="lg-gray-btn !px-3 !text-[13px]">
            <ChefHat size={16} strokeWidth={1.5} aria-hidden="true" />{t('nutr_save_as_dish')}
          </button>
        </div>
      ) : <div className="h-2" />}
    </section>
  )
}
