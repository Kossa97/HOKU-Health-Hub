import { useId, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Globe, Lock, Star, X } from 'lucide-react'
import type { CycleTimeline } from '../../../lib/planTimeline'
import { denyProps } from '../../../lib/denyFeedback'
import type { Translate } from '../../my-stack/lib/planLabels'
import {
  entwurfGueltig,
  vorgeschlagenerZyklus,
  zyklenVon,
  zyklusKontext,
  zyklusKurz,
  type ReviewDraft,
  type WiederNehmen,
} from '../lib/reviewModel'

export interface ReviewSubstanz {
  id: string
  display_name: string
  archived?: boolean | null
}

/**
 * Bewerten — im Stil der My-Stack-Sheets. Erst Substanz und Zyklus (der
 * Zeitraum, die Dosis, der Rhythmus stehen dann von selbst da), dann die
 * Sterne. Nichts ist vorbelegt: das Urteil kommt vom Nutzer, nicht vom
 * Formular. Alles nach den Sternen ist freiwillig.
 */
export function ReviewSheet({
  titel,
  start,
  substanzen,
  timelines,
  bewertet,
  now,
  timeZone,
  busy,
  onClose,
  onSave,
}: {
  titel: string
  start: ReviewDraft
  substanzen: readonly ReviewSubstanz[]
  timelines: readonly CycleTimeline[]
  /** Zyklen, die schon eine Bewertung haben (ohne die gerade bearbeitete). */
  bewertet: ReadonlySet<string>
  now: Date
  timeZone: string
  busy: boolean
  onClose: () => void
  onSave: (draft: ReviewDraft) => void
}) {
  const { t, i18n } = useTranslation()
  const tr = t as Translate
  const language = i18n.resolvedLanguage ?? i18n.language
  const [draft, setDraft] = useState(start)
  const setze = (patch: Partial<ReviewDraft>) => setDraft(vorher => ({ ...vorher, ...patch }))
  const gueltig = entwurfGueltig(draft)

  // Archivierte Substanzen nur, wenn die Bewertung schon zu einer gehoert.
  const wahl = substanzen.filter(s => !s.archived || s.id === start.stack_item_id)
  const zyklen = useMemo(() => zyklenVon(timelines, draft.stack_item_id), [timelines, draft.stack_item_id])
  const gewaehlt = zyklen.find(z => z.cycle.id === draft.cycle_id) ?? null
  const kontext = gewaehlt ? zyklusKontext(gewaehlt, now, timeZone, language, tr) : null

  const waehleSubstanz = (id: string) => {
    if (id === draft.stack_item_id) return
    setze({ stack_item_id: id, cycle_id: vorgeschlagenerZyklus(timelines, id, bewertet, now) })
  }

  return (
    // Liegt ueber der Seite: Zurueck (Geste, Android) und Escape schliessen
    // nur dieses Fenster.
    <div data-app-modal data-app-back-dirty-on-interaction className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-[var(--tyd-popup-top)]" onClick={event => { event.stopPropagation(); onClose() }}>
      <form
        role="dialog"
        aria-modal="true"
        aria-label={titel}
        data-review-sheet
        // Form des Glas-Sheets, fest gefüllt: langer Inhalt scrollt darin, und
        // ein Weichzeichner am scrollenden Fenster stört das Scrollen in iOS Safari
        className="lg-sheet lg-sheet-solid flex max-h-full w-full flex-col overflow-hidden sm:max-w-lg"
        onClick={event => event.stopPropagation()}
        onKeyDown={event => {
          if (event.key !== 'Escape') return
          event.stopPropagation()
          onClose()
        }}
        onSubmit={event => {
          event.preventDefault()
          if (gueltig && !busy) onSave(draft)
        }}
      >
        <div className="pt-2">
          <span className="lg-grabber" aria-hidden="true" />
        </div>
        <div className="flex items-center justify-between pl-5 pr-2 pt-1 pb-1">
          <h3 className="lg-title2">{titel}</h3>
          <button type="button" onClick={onClose} data-app-back-close aria-label={String(t('review_close'))} className="lg-icon-btn !text-[var(--lg-text-2)]">
            <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-[var(--lg-fill)]"><X size={17} aria-hidden="true" /></span>
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 pt-3 pb-5">
          <Abschnitt titel={String(t('review_substance'))}>
            <Chips
              name={String(t('review_substance'))}
              optionen={wahl.map(s => ({ wert: s.id, label: s.display_name }))}
              wert={draft.stack_item_id}
              onChange={waehleSubstanz}
            />
          </Abschnitt>

          <Abschnitt titel={String(t('review_cycle'))}>
            <Chips
              name={String(t('review_cycle'))}
              optionen={[
                ...zyklen.map(z => ({
                  wert: z.cycle.id,
                  label: zyklusKurz(z, now, timeZone, language, tr),
                  hinweis: bewertet.has(z.cycle.id) ? String(t('review_cycle_rated')) : undefined,
                  gesperrt: bewertet.has(z.cycle.id),
                })),
                { wert: '', label: String(t('review_cycle_none')) },
              ]}
              wert={draft.cycle_id ?? ''}
              onChange={wert => setze({ cycle_id: wert || null })}
            />
            {kontext && (
              <p data-review-context className="mt-3 rounded-[14px] bg-[var(--lg-surface-2)] px-3.5 py-2.5 text-[15px] text-[var(--lg-text)]">
                {[kontext.zeitraum, kontext.dauer, kontext.dosis, kontext.rhythmus].filter(Boolean).map((teil, index) => (
                  // Jede Angabe am Stueck: „250 mcg" bricht nicht zwischen Zahl und Einheit.
                  <span key={index} className="whitespace-nowrap">{index > 0 && ' · '}{teil}</span>
                ))}
              </p>
            )}
            {!draft.cycle_id && (
              <p data-review-general className="mt-2 text-[13px] text-[var(--lg-text-2)]">
                {zyklen.length === 0 ? t('review_cycle_none_hint') : t('review_cycle_general_hint')}
              </p>
            )}
          </Abschnitt>

          <Abschnitt titel={String(t('review_overall'))}>
            <Sterne wert={draft.rating} onChange={rating => setze({ rating })} />
          </Abschnitt>

          <Abschnitt titel={String(t('review_effect'))} zusatz={String(t('review_optional'))}>
            <Stufen
              name={String(t('review_effect'))}
              wert={draft.wirkung}
              onChange={wirkung => setze({ wirkung })}
              links={String(t('review_effect_low'))}
              rechts={String(t('review_effect_high'))}
            />
          </Abschnitt>

          <Abschnitt titel={String(t('review_tolerability'))} zusatz={String(t('review_optional'))}>
            <Stufen
              name={String(t('review_tolerability'))}
              wert={draft.vertraeglichkeit}
              onChange={vertraeglichkeit => setze({ vertraeglichkeit })}
              links={String(t('review_tolerability_low'))}
              rechts={String(t('review_tolerability_high'))}
            />
          </Abschnitt>

          <Abschnitt titel={String(t('review_again'))} zusatz={String(t('review_optional'))}>
            <Chips
              name={String(t('review_again'))}
              optionen={(['ja', 'unsicher', 'nein'] as WiederNehmen[]).map(wert => ({ wert, label: String(t(`review_again_${wert}`)) }))}
              wert={draft.wieder_nehmen ?? ''}
              onChange={wert => setze({ wieder_nehmen: wert === draft.wieder_nehmen ? null : wert as WiederNehmen })}
              abwaehlbar
            />
          </Abschnitt>

          <Abschnitt titel={String(t('review_notes'))} zusatz={String(t('review_optional'))}>
            <div className="space-y-3">
              <Feld label={String(t('review_title'))}>
                {id => <input id={id} className="input" value={draft.title} placeholder={String(t('titel_placeholder'))} onChange={e => setze({ title: e.target.value })} />}
              </Feld>
              <Feld label={String(t('review_body'))}>
                {id => <textarea id={id} className="input resize-none" rows={3} value={draft.body} placeholder={String(t('bericht_placeholder'))} onChange={e => setze({ body: e.target.value })} />}
              </Feld>
              <Feld label={String(t('vorteile'))}>
                {id => <textarea id={id} className="input resize-none" rows={2} value={draft.pros} placeholder={String(t('pros_placeholder'))} onChange={e => setze({ pros: e.target.value })} />}
              </Feld>
              <Feld label={String(t('nachteile'))}>
                {id => <textarea id={id} className="input resize-none" rows={2} value={draft.cons} placeholder={String(t('cons_placeholder'))} onChange={e => setze({ cons: e.target.value })} />}
              </Feld>
            </div>
          </Abschnitt>

          <label className="flex cursor-pointer items-start gap-3 rounded-[16px] bg-[var(--lg-surface-2)] px-3.5 py-3">
            <input
              type="checkbox"
              role="switch"
              data-review-public
              checked={draft.is_public}
              onChange={e => setze({ is_public: e.target.checked })}
              className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]"
            />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-[16px] font-semibold text-[var(--lg-text)]">
                {draft.is_public ? <Globe size={14} aria-hidden="true" /> : <Lock size={14} aria-hidden="true" />}
                {t('review_public')}
              </span>
              <span className="mt-0.5 block text-[13px] text-[var(--lg-text-2)]">{t('review_public_hint')}</span>
              {draft.is_public && <span data-review-public-rules className="mt-1 block text-[13px] text-[var(--lg-warn-text)]">{t('review_public_rules')}</span>}
            </span>
          </label>
        </div>

        <div className="border-t-[0.5px] border-[var(--lg-separator)] px-4 pt-3 pb-4">
          <button type="submit" className="lg-btn lg-btn-primary w-full" disabled={busy} {...denyProps(!busy && !gueltig)}>
            {busy ? t('saving') : t('save')}
          </button>
          {!gueltig && <p className="mt-2 text-center text-[13px] text-[var(--lg-text-2)]">{t('review_needs_stars')}</p>}
        </div>
      </form>
    </div>
  )
}

function Abschnitt({ titel, zusatz, children }: { titel: string; zusatz?: string; children: ReactNode }) {
  return (
    <section>
      <h4 className="mb-2 flex items-baseline gap-2 text-[13px] font-semibold uppercase tracking-[0.04em] text-[var(--lg-text-3)]">
        {titel}
        {zusatz && <span className="font-medium normal-case tracking-normal text-[var(--lg-text-3)]">{zusatz}</span>}
      </h4>
      {children}
    </section>
  )
}

function Feld({ label, children }: { label: string; children: (id: string) => ReactNode }) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      {children(id)}
    </div>
  )
}

/** Auswahl als Chips (Radiogruppe). `abwaehlbar`: ein zweiter Tipp nimmt die Wahl zurueck. */
function Chips({ name, optionen, wert, onChange, abwaehlbar = false }: {
  name: string
  optionen: { wert: string; label: string; hinweis?: string; gesperrt?: boolean }[]
  wert: string
  onChange: (wert: string) => void
  abwaehlbar?: boolean
}) {
  return (
    <div role="radiogroup" aria-label={name} className="flex flex-wrap gap-2">
      {optionen.map(option => {
        const aktiv = option.wert === wert
        return (
          <button
            key={option.wert || '_leer'}
            type="button"
            role="radio"
            aria-checked={aktiv}
            disabled={option.gesperrt}
            onClick={() => (aktiv && !abwaehlbar ? undefined : onChange(option.wert))}
            className={`min-h-[40px] rounded-full px-3.5 text-[15px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${aktiv
              ? 'bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] text-[var(--lg-accent-text)]'
              : 'bg-[var(--lg-fill)] text-[var(--lg-text)]'}`}
          >
            {option.label}
            {option.hinweis && <span className="ml-1.5 text-[12px] font-medium text-[var(--lg-text-3)]">{option.hinweis}</span>}
          </button>
        )
      })}
    </div>
  )
}

/** Fuenf Sterne als Radiogruppe — mit Namen fuer Screenreader, ohne Vorauswahl. */
function Sterne({ wert, onChange }: { wert: number | null; onChange: (wert: number) => void }) {
  const { t } = useTranslation()
  return (
    <div role="radiogroup" aria-label={String(t('review_overall'))} data-review-stars className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map(stern => {
        const an = wert !== null && stern <= wert
        return (
          <button
            key={stern}
            type="button"
            role="radio"
            aria-checked={wert === stern}
            aria-label={String(t(stern === 1 ? 'review_star_one' : 'review_star_many', { n: stern }))}
            onClick={() => onChange(stern)}
            className="grid h-11 w-11 place-items-center rounded-xl transition-transform active:scale-90"
          >
            <Star
              size={28}
              aria-hidden="true"
              className={an ? 'text-amber-400' : 'text-[var(--lg-text-3)]'}
              fill={an ? 'currentColor' : 'transparent'}
            />
          </button>
        )
      })}
    </div>
  )
}

/** Eine Skala 1–5 mit Beschriftung an beiden Enden. Ein zweiter Tipp auf denselben Wert nimmt ihn zurueck. */
function Stufen({ name, wert, onChange, links, rechts }: {
  name: string
  wert: number | null
  onChange: (wert: number | null) => void
  links: string
  rechts: string
}) {
  return (
    <div>
      <div role="radiogroup" aria-label={name} className="grid grid-cols-5 gap-0.5 rounded-full bg-[var(--lg-fill)] p-0.5">
        {[1, 2, 3, 4, 5].map(stufe => {
          const aktiv = wert === stufe
          return (
            <button
              key={stufe}
              type="button"
              role="radio"
              aria-checked={aktiv}
              aria-label={`${name}: ${stufe} / 5`}
              data-stufe-darunter={(wert !== null && stufe < wert) || undefined}
              onClick={() => onChange(aktiv ? null : stufe)}
              className={`h-10 rounded-full text-[15px] font-semibold tabular-nums transition-colors ${aktiv
                ? 'bg-[var(--lg-fill-selected)] text-[var(--lg-text)] shadow-[0_3px_8px_rgba(0,0,0,0.25)]'
                : wert !== null && stufe < wert
                  ? 'text-[var(--lg-accent-text)]'
                  : 'text-[var(--lg-text-2)]'}`}
            >
              {stufe}
            </button>
          )
        })}
      </div>
      <div className="mt-1.5 flex justify-between px-1 text-[12px] text-[var(--lg-text-3)]">
        <span>{links}</span>
        <span>{rechts}</span>
      </div>
    </div>
  )
}
