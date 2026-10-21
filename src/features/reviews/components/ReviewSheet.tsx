import { Fragment, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronsUpDown, Globe, Lock, Star, X } from 'lucide-react'
import type { CycleTimeline } from '../../../lib/planTimeline'
import { denyProps } from '../../../lib/denyFeedback'
import { Schalter } from '../../../components/ui/Schalter'
import { SheetGriff } from '../../../components/ui/SheetGriff'
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
import { ReviewDiscardSheet } from './ReviewDiscardSheet'

export interface ReviewSubstanz {
  id: string
  display_name: string
  archived?: boolean | null
}

/**
 * Bewerten — im Stil der My-Stack-Sheets. Oben Substanz und Zyklus als
 * Auswahl (der Zeitraum, die Dosis, der Rhythmus stehen dann von selbst da),
 * dann das Freiwillige, ganz unten das Fazit in Sternen. Nichts ist
 * vorbelegt: das Urteil kommt vom Nutzer, nicht vom Formular. Pflicht sind
 * Substanz und Fazit.
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
  const geaendert = JSON.stringify(draft) !== JSON.stringify(start)
  // Der Griff fragt beim Ziehen nach — dann gilt der Stand dieses Augenblicks.
  const geaendertJetzt = useRef(geaendert)
  useEffect(() => { geaendertJetzt.current = geaendert })
  const sheetRef = useRef<HTMLFormElement>(null)
  const kreuzRef = useRef<HTMLButtonElement>(null)
  const [tab, setTab] = useState<'pos' | 'neg'>(start.cons && !start.pros ? 'neg' : 'pos')
  // Nach einem Tipp auf das gesperrte Speichern: fehlende Pflichtfelder rot.
  const [erinnert, setErinnert] = useState(false)
  const [frage, setFrage] = useState(false)
  const fehlversuche = useRef(0)
  const tabId = useId()
  const publicHinweisId = useId()

  // Archivierte Substanzen nur, wenn die Bewertung schon zu einer gehoert.
  const wahl = substanzen.filter(s => !s.archived || s.id === start.stack_item_id)
  const substanz = wahl.find(s => s.id === draft.stack_item_id) ?? null
  const zyklen = useMemo(() => zyklenVon(timelines, draft.stack_item_id), [timelines, draft.stack_item_id])
  const gewaehlt = zyklen.find(z => z.cycle.id === draft.cycle_id) ?? null
  const kontext = gewaehlt ? zyklusKontext(gewaehlt, now, timeZone, language, tr) : null

  // Dieselbe Regel wie entwurfGueltig: gezaehlt wird die gewaehlte id.
  const fehltSubstanz = !draft.stack_item_id
  const fehltSterne = draft.rating == null
  const fehlt = fehltSubstanz && fehltSterne ? t('review_needs_both')
    : fehltSubstanz ? t('review_needs_substance')
      : fehltSterne ? t('review_needs_stars') : null

  const waehleSubstanz = (id: string) => {
    if (id === draft.stack_item_id) return
    setze({ stack_item_id: id, cycle_id: vorgeschlagenerZyklus(timelines, id, bewertet, now) })
  }

  const wippen = () => {
    const sheet = sheetRef.current
    if (!sheet?.animate) return
    // Weniger Bewegung: kurz abdunkeln statt wippen — eine Antwort gibt es trotzdem.
    const ruhig = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    sheet.animate(
      ruhig
        ? [{ opacity: 1 }, { opacity: 0.7 }, { opacity: 1 }]
        : [{ transform: 'translateY(0)' }, { transform: 'translateY(12px)' }, { transform: 'translateY(0)' }],
      { duration: 320, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' },
    )
  }

  /**
   * Daneben tippen, Escape oder nach unten ziehen, waehrend Eingaben da sind:
   * beim ersten Mal antwortet nur das Sheet (wippen bzw. zurueckfedern) — ein
   * verirrter Tipp soll nichts verwerfen. Ab dem zweiten Mal kommt die
   * Rueckfrage. Das Kreuz fragt sofort.
   */
  const versehentlich = (antwort?: () => void) => {
    if (fehlversuche.current >= 1) return setFrage(true)
    fehlversuche.current += 1
    antwort?.()
  }
  // Waehrend gespeichert wird, bleibt das Sheet stehen: schlaegt das Speichern
  // fehl, sind die Eingaben noch da.
  const tippDaneben = () => {
    if (busy) return
    if (geaendert) versehentlich(wippen)
    else onClose()
  }
  const kreuz = () => {
    if (busy) return
    if (geaendert) setFrage(true)
    else onClose()
  }

  const erinnern = () => { if (!gueltig) setErinnert(true) }

  return (
    <>
      {/* Liegt ueber der Seite. Die Zurueck-Geste tippt aufs Kreuz, das selbst
          nachfragt — deshalb kein zweites Browser-Fenster (data-app-back-self-confirm). */}
      <div data-app-modal data-app-back-self-confirm className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-[var(--tyd-popup-top)]" onClick={event => { event.stopPropagation(); tippDaneben() }}>
        <form
          ref={sheetRef}
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
            tippDaneben()
          }}
          onSubmit={event => {
            event.preventDefault()
            if (gueltig && !busy) onSave(draft)
          }}
        >
          <SheetGriff
            className="pt-2"
            onClose={onClose}
            disabled={busy}
            festhalten={() => geaendertJetzt.current}
            beiFesthalten={() => versehentlich()}
          />
          <div className="flex items-center justify-between pl-5 pr-2 pt-1 pb-1">
            <h3 className="lg-title2">{titel}</h3>
            <button ref={kreuzRef} type="button" onClick={kreuz} data-app-back-close aria-label={String(t('review_close'))} className="lg-icon-btn !text-[var(--lg-text-2)]">
              <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-[var(--lg-fill)]"><X size={17} aria-hidden="true" /></span>
            </button>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 pt-3 pb-5">
            <section>
              <div
                data-review-pick
                className={`overflow-hidden rounded-[14px] bg-[var(--lg-surface-2)] transition-shadow ${erinnert && fehltSubstanz ? 'shadow-[inset_0_0_0_1.5px_var(--lg-bad)]' : ''}`}
              >
                <AuswahlZeile
                  label={String(t('review_substance'))}
                  wert={substanz?.display_name ?? String(t('review_select'))}
                  leer={fehltSubstanz}
                  fehlt={erinnert && fehltSubstanz}
                >
                  <select
                    aria-label={String(t('review_substance'))}
                    aria-required="true"
                    value={draft.stack_item_id}
                    onChange={e => waehleSubstanz(e.target.value)}
                  >
                    <option value="" disabled>{t('review_select')}</option>
                    {wahl.map(s => <option key={s.id} value={s.id}>{s.display_name}</option>)}
                  </select>
                </AuswahlZeile>
                <div className="ml-4 h-[0.5px] bg-[var(--lg-separator)]" />
                <AuswahlZeile
                  label={String(t('review_cycle'))}
                  wert={fehltSubstanz
                    ? String(t('review_cycle_pick_substance'))
                    : gewaehlt ? zyklusKurz(gewaehlt, now, timeZone, language, tr) : String(t('review_cycle_none'))}
                  gesperrt={fehltSubstanz}
                >
                  <select
                    aria-label={String(t('review_cycle'))}
                    disabled={fehltSubstanz}
                    value={draft.cycle_id ?? ''}
                    onChange={e => setze({ cycle_id: e.target.value || null })}
                  >
                    {zyklen.map(z => (
                      <option key={z.cycle.id} value={z.cycle.id} disabled={bewertet.has(z.cycle.id)}>
                        {zyklusKurz(z, now, timeZone, language, tr)}
                        {bewertet.has(z.cycle.id) ? ` – ${t('review_cycle_rated')}` : ''}
                      </option>
                    ))}
                    <option value="">{t('review_cycle_none')}</option>
                  </select>
                </AuswahlZeile>
              </div>
              {kontext && (
                <p data-review-context className="mt-3 rounded-[14px] bg-[var(--lg-surface-2)] px-3.5 py-2.5 text-[15px] text-[var(--lg-text)]">
                  {[kontext.zeitraum, kontext.dauer, kontext.dosis, kontext.rhythmus].filter(Boolean).map((teil, index) => (
                    // Jede Angabe am Stueck: „250 mcg" bricht nicht zwischen Zahl und Einheit,
                    // umbrochen wird nur zwischen den Angaben.
                    <Fragment key={index}>{index > 0 && ' · '}<span className="whitespace-nowrap">{teil}</span></Fragment>
                  ))}
                </p>
              )}
              {substanz && !draft.cycle_id && (
                <p data-review-general className="mt-2 text-[13px] text-[var(--lg-text-2)]">
                  {zyklen.length === 0 ? t('review_cycle_none_hint') : t('review_cycle_general_hint')}
                </p>
              )}
            </section>

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
              />
            </Abschnitt>

            <Abschnitt titel={String(t('review_notes'))} zusatz={String(t('review_optional'))}>
              <div className="space-y-3">
                <Feld label={String(t('review_title'))}>
                  {id => <input id={id} className="input" value={draft.title} placeholder={String(t('titel_placeholder'))} onChange={e => setze({ title: e.target.value })} />}
                </Feld>
                <Feld label={String(t('review_body'))}>
                  {id => <textarea id={id} className={`input ${MITWACHSEN} min-h-[96px]`} rows={3} value={draft.body} placeholder={String(t('review_body_placeholder'))} onChange={e => setze({ body: e.target.value })} />}
                </Feld>
                {/* Positiv und Negativ teilen sich ein Feld; der Punkt am Tab sagt, wo schon Text steht. */}
                <div className="space-y-2">
                  <div role="tablist" aria-label={`${t('review_positive')} / ${t('review_negative')}`} className="grid grid-cols-2 gap-0.5 rounded-full bg-[var(--lg-fill)] p-0.5">
                    {(['pos', 'neg'] as const).map(key => {
                      const an = tab === key
                      const text = key === 'pos' ? draft.pros : draft.cons
                      return (
                        <button
                          key={key}
                          type="button"
                          role="tab"
                          id={`${tabId}-${key}`}
                          aria-selected={an}
                          aria-controls={`${tabId}-feld`}
                          onClick={() => setTab(key)}
                          className={`flex h-9 items-center justify-center gap-1.5 rounded-full text-[15px] font-semibold transition-colors ${an
                            ? 'bg-[var(--lg-fill-selected)] text-[var(--lg-text)] shadow-[0_3px_8px_rgba(0,0,0,0.25)]'
                            : 'text-[var(--lg-text-2)]'}`}
                        >
                          <span aria-hidden="true" className={`font-bold ${key === 'pos' ? 'text-[var(--lg-good-text)]' : 'text-[var(--lg-bad-text)]'}`}>{key === 'pos' ? '+' : '−'}</span>
                          {key === 'pos' ? t('review_positive') : t('review_negative')}
                          {text.trim() && <span aria-hidden="true" data-review-tab-filled className={`h-1.5 w-1.5 rounded-full ${key === 'pos' ? 'bg-[var(--lg-good)]' : 'bg-[var(--lg-bad)]'}`} />}
                        </button>
                      )
                    })}
                  </div>
                  <div role="tabpanel" id={`${tabId}-feld`} aria-labelledby={`${tabId}-${tab}`}>
                    {tab === 'pos'
                      ? <textarea key="pos" aria-label={String(t('review_positive'))} className={`input ${MITWACHSEN} min-h-[72px]`} rows={2} value={draft.pros} placeholder={String(t('review_positive_placeholder'))} onChange={e => setze({ pros: e.target.value })} />
                      : <textarea key="neg" aria-label={String(t('review_negative'))} className={`input ${MITWACHSEN} min-h-[72px]`} rows={2} value={draft.cons} placeholder={String(t('review_negative_placeholder'))} onChange={e => setze({ cons: e.target.value })} />}
                  </div>
                </div>
              </div>
            </Abschnitt>

            {/* Ein echter Schalter, die ganze Zeile ist die Tippflaeche. */}
            <button
              type="button"
              role="switch"
              aria-checked={draft.is_public}
              aria-label={String(t('review_public'))}
              aria-describedby={publicHinweisId}
              data-review-public
              onClick={() => setze({ is_public: !draft.is_public })}
              className="flex w-full items-center gap-3 rounded-[16px] bg-[var(--lg-surface-2)] px-3.5 py-3 text-left transition-transform duration-100 ease-out active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lg-accent)]"
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-[16px] font-semibold text-[var(--lg-text)]">
                  {draft.is_public ? <Globe size={14} aria-hidden="true" /> : <Lock size={14} aria-hidden="true" />}
                  {t('review_public')}
                </span>
                <span id={publicHinweisId} className="mt-0.5 block text-[13px] text-[var(--lg-text-2)]">
                  {t('review_public_hint')}
                  {draft.is_public && <span data-review-public-rules className="mt-1 block text-[var(--lg-warn-text)]">{t('review_public_rules')}</span>}
                </span>
              </span>
              <Schalter an={draft.is_public} />
            </button>

            {/* Das Fazit zuletzt: erst erinnern, wie es war, dann urteilen. */}
            <section
              data-review-verdict
              className={`rounded-[16px] bg-[var(--lg-surface-2)] px-4 pb-2.5 pt-3.5 transition-shadow ${erinnert && fehltSterne ? 'shadow-[inset_0_0_0_1.5px_var(--lg-bad)]' : ''}`}
            >
              <h4 className={`mb-1 flex items-baseline gap-2 text-[13px] font-semibold uppercase tracking-[0.04em] ${erinnert && fehltSterne ? 'text-[var(--lg-bad-text)]' : 'text-[var(--lg-text-3)]'}`}>
                {t('review_overall')}
                <span className="font-medium normal-case tracking-normal text-[var(--lg-text-3)]">{t('review_verdict_hint')}</span>
              </h4>
              <Sterne wert={draft.rating} onChange={rating => setze({ rating })} />
              <p data-review-verdict-word className="mt-0.5 min-h-[18px] text-[13px] text-[var(--lg-text-2)]">
                {draft.rating ? t(`review_verdict_${draft.rating}`) : t('review_verdict_prompt')}
              </p>
            </section>
          </div>

          <div className="border-t-[0.5px] border-[var(--lg-separator)] px-4 pt-3 pb-4">
            <button
              type="submit"
              className="lg-btn lg-btn-primary w-full"
              disabled={busy}
              {...denyProps(!busy && !gueltig)}
              // Der gesperrte Knopf wackelt (denyFeedback) — und die fehlenden Felder werden rot.
              onPointerDown={erinnern}
              onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') erinnern() }}
            >
              {busy ? t('saving') : t('save')}
            </button>
            {fehlt && (
              <p role="status" data-review-missing className={`mt-2 text-center text-[13px] transition-colors ${erinnert ? 'text-[var(--lg-bad-text)]' : 'text-[var(--lg-text-2)]'}`}>
                {fehlt}
              </p>
            )}
          </div>
        </form>
      </div>

      {frage && (
        <ReviewDiscardSheet
          onKeep={() => {
            // Weiter bearbeiten zaehlt neu: der naechste Fehltipp wippt wieder nur.
            fehlversuche.current = 0
            setFrage(false)
            // Der Fokus gehoert zurueck ins Sheet, sonst laege er auf der Seite dahinter.
            requestAnimationFrame(() => kreuzRef.current?.focus())
          }}
          onDiscard={onClose}
        />
      )}
    </>
  )
}

/** Textfelder wachsen mit dem Text, statt darin zu scrollen (wo der Browser es kann). */
const MITWACHSEN = 'resize-none [field-sizing:content] max-h-[40vh]'

/**
 * Eine Zeile mit Auswahl wie in den iOS-Einstellungen: links der Name, rechts
 * der Wert. Darueber liegt unsichtbar das echte `<select>` — ein Tipp oeffnet
 * die Auswahl des Geraets (auf dem iPhone das Rad).
 */
function AuswahlZeile({ label, wert, leer = false, fehlt = false, gesperrt = false, children }: {
  label: string
  wert: string
  leer?: boolean
  fehlt?: boolean
  gesperrt?: boolean
  children: ReactNode
}) {
  return (
    <label
      className={`relative flex min-h-12 items-center justify-between gap-3 pl-4 pr-3.5 transition-colors focus-within:shadow-[inset_0_0_0_2px_var(--lg-accent)] ${gesperrt ? 'opacity-45' : 'cursor-pointer active:bg-white/[0.06]'}`}
    >
      <span className={`shrink-0 text-[16px] ${fehlt ? 'text-[var(--lg-bad-text)]' : 'text-[var(--lg-text)]'}`}>{label}</span>
      <span className={`flex min-w-0 items-center gap-1.5 text-[16px] ${leer ? 'text-[var(--lg-accent-text)]' : 'text-[var(--lg-text-2)]'}`}>
        <span className="truncate">{wert}</span>
        <ChevronsUpDown size={15} aria-hidden="true" className="shrink-0" />
      </span>
      <span className="absolute inset-0 [&>select]:h-full [&>select]:w-full [&>select]:cursor-pointer [&>select]:appearance-none [&>select]:opacity-0 [&>select]:text-[16px] [&>select:disabled]:cursor-not-allowed">
        {children}
      </span>
    </label>
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

/** Auswahl als Chips (Radiogruppe); ein zweiter Tipp nimmt die Wahl zurueck. */
function Chips({ name, optionen, wert, onChange }: {
  name: string
  optionen: { wert: string; label: string }[]
  wert: string
  onChange: (wert: string) => void
}) {
  return (
    <div role="radiogroup" aria-label={name} className="flex flex-wrap gap-2">
      {optionen.map(option => {
        const aktiv = option.wert === wert
        return (
          <button
            key={option.wert}
            type="button"
            role="radio"
            aria-checked={aktiv}
            onClick={() => onChange(option.wert)}
            className={`min-h-[40px] rounded-full px-3.5 text-[15px] font-semibold transition-colors ${aktiv
              ? 'bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] text-[var(--lg-accent-text)]'
              : 'bg-[var(--lg-fill)] text-[var(--lg-text)]'}`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Fuenf Sterne als Radiogruppe — mit Namen fuer Screenreader, ohne Vorauswahl.
 * Antippen setzt einen Wert; seitlich ueber die Sterne wischen setzt ihn
 * fortlaufend unter dem Finger. Erst ab einer klar seitlichen Bewegung —
 * senkrecht bleibt Scrollen.
 */
function Sterne({ wert, onChange }: { wert: number | null; onChange: (wert: number) => void }) {
  const { t } = useTranslation()
  const gruppeRef = useRef<HTMLDivElement>(null)
  const zug = useRef<{ id: number; x: number; y: number; aktiv: boolean } | null>(null)
  /** Ende des letzten Wischens: der Klick direkt danach gehoert noch dazu. */
  const gewischtUm = useRef(0)

  /** Der Stern, dessen Mitte am naechsten liegt — gilt auch von rechts nach links. */
  const sternUnter = (x: number) => {
    const knoepfe = [...(gruppeRef.current?.querySelectorAll<HTMLElement>('[role="radio"]') ?? [])]
    const abstand = (knopf: HTMLElement) => {
      const box = knopf.getBoundingClientRect()
      return Math.abs(x - (box.left + box.width / 2))
    }
    return knoepfe.reduce((best, knopf, index) => (abstand(knopf) < abstand(knoepfe[best]) ? index : best), 0) + 1
  }

  return (
    <div
      ref={gruppeRef}
      role="radiogroup"
      aria-label={String(t('review_overall'))}
      aria-required="true"
      data-review-stars
      className="-ml-2 flex w-fit touch-pan-y select-none gap-1.5"
      onPointerDown={event => {
        if (event.pointerType === 'mouse' && event.button !== 0) return
        // Ein neuer Tipp beginnt: was vom letzten Wischen uebrig ist, gilt nicht mehr.
        gewischtUm.current = 0
        zug.current = { id: event.pointerId, x: event.clientX, y: event.clientY, aktiv: false }
      }}
      onPointerMove={event => {
        const z = zug.current
        if (!z || z.id !== event.pointerId) return
        // Maus ausserhalb losgelassen: kein Ziehen mehr, sonst setzte Hover die Sterne.
        if (event.buttons === 0) { zug.current = null; return }
        if (!z.aktiv) {
          const dx = Math.abs(event.clientX - z.x)
          if (dx < 8 || dx < Math.abs(event.clientY - z.y)) return
          z.aktiv = true
          event.currentTarget.setPointerCapture?.(event.pointerId)
        }
        const stern = sternUnter(event.clientX)
        if (stern !== wert) onChange(stern)
      }}
      onPointerUp={event => {
        if (zug.current?.aktiv) gewischtUm.current = event.timeStamp
        if (zug.current?.id === event.pointerId) zug.current = null
      }}
      onPointerCancel={() => { zug.current = null }}
      onClickCapture={event => {
        // Nach dem Wischen kein zusaetzlicher Klick auf den Startstern.
        if (!gewischtUm.current || event.timeStamp - gewischtUm.current > 400) return
        gewischtUm.current = 0
        event.preventDefault()
        event.stopPropagation()
      }}
    >
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
            className="grid h-11 w-11 place-items-center rounded-xl transition-transform duration-100 ease-out active:scale-90"
          >
            <Star
              size={30}
              aria-hidden="true"
              className={`transition-colors duration-150 ${an ? 'text-amber-400' : 'text-[var(--lg-text-3)]'}`}
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
