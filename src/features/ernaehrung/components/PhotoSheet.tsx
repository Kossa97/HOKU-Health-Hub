import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Camera, ChefHat, ChevronRight, ImageUp, Info, Lightbulb, Plus, RotateCcw, Sparkles, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { Sheet } from '../../compliance/components/Sheet'
import { SheetClose } from '../../../components/ui/SheetClose'
import { useFoodAiConsent } from '../hooks/useFoodAiConsent'
import { matchScore } from '../lib/foodSearch'
import { MEALS, type Food, type Meal, nutrientsFor, sumNutrients } from '../lib/nutrition'
import { type Candidate, type PhotoFlow, candidatesFrom, chosenRows, groupCandidates, rowsFromSelection } from '../lib/photoRows'
import { PhotoError, analyzeMeal } from '../services/foodPhoto'
import { DIM, MUTED, chip } from '../styles'
import { MacroCells } from './MacroCells'

type Step = { kind: 'idle' } | { kind: 'analyzing' } | { kind: 'error'; code: PhotoError['code']; resetsAt: string | null }

/** Alle Wörter (ab 3 Zeichen) von `a` kommen als ganze Wörter in `b` vor. */
function wholeWordsIn(a: string, b: string): boolean {
  const words = (s: string) => s.toLowerCase().split(/[\s,()/-]+/).filter(w => w.length >= 3)
  const wa = words(a)
  const wb = new Set(words(b))
  return wa.length > 0 && wa.every(w => wb.has(w))
}

const INFO_BOX = 'flex gap-2 rounded-[14px] bg-[var(--lg-surface-2)] p-3 text-[13px] leading-snug text-[var(--lg-text-2)]'

/**
 * Essen per Foto (Entscheidungen Nutzer, 18.10.2026): Die KI erkennt das
 * Gericht und listet, was drin sein kann — bei Suppen & Co. samt Alternativen
 * („Sahne oder Kokosmilch"). Der Nutzer tippt an, was er wirklich genommen
 * hat, und wählt zu jeder Zutat Lebensmittel und Menge über die gewohnte
 * Suche. Nährwerte kommen nie aus der KI. Eine Notiz (Name des Gerichts) macht
 * die Zutaten genauer und wird empfohlen; diktieren geht über die Tastatur.
 *
 * Der Stand (`flow`) liegt bei der Seite und übersteht das Suchen.
 */
export function PhotoSheet({ userId, meal, flow, myDishes, hideKcal, busy, onFlow, onMeal, onPickRow, onLog, onLogDish, onSaveAsDish, onClose }: {
  userId: string
  meal: Meal
  flow: PhotoFlow
  /** Eigene Gerichte — passt eins zum erkannten, kommt es zuerst. */
  myDishes: Food[]
  hideKcal: boolean
  busy: boolean
  onFlow: (patch: Partial<PhotoFlow>) => void
  onMeal: (meal: Meal) => void
  /** Lebensmittel für Zeile `index` wählen; null = weitere Zutat. */
  onPickRow: (index: number | null) => void
  onLog: (meal: Meal, list: { food: Food; amount: number }[]) => void
  onLogDish: (dish: Food) => void
  onSaveAsDish: (name: string, list: { food: Food; amount: number }[]) => void
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language?.startsWith('en') ? 'en' : 'de'
  const { consent, error: consentError, set: setConsent, forget, reload } = useFoodAiConsent(userId)
  const [agreed, setAgreed] = useState(false)
  const [consentBusy, setConsentBusy] = useState(false)
  const [step, setStep] = useState<Step>({ kind: 'idle' })
  const camera = useRef<HTMLInputElement>(null)
  const gallery = useRef<HTMLInputElement>(null)
  const seq = useRef(0)

  // Vorschau zeigt das Foto, das gerade erkannt wird; in den Stand kommt es erst bei Erfolg.
  const [pending, setPending] = useState<File | null>(null)
  const previewFile = pending ?? flow.file
  const preview = useMemo(() => (previewFile ? URL.createObjectURL(previewFile) : null), [previewFile])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const analyze = async (file: File | null) => {
    const mine = ++seq.current
    setStep({ kind: 'analyzing' })
    setPending(file)
    try {
      const r = await analyzeMeal(file, flow.hint, lang)
      if (mine !== seq.current) return
      setStep({ kind: 'idle' })
      onFlow({ file, result: { dish: r.dish, needsNote: r.needsNote, candidates: candidatesFrom(r.ingredients) }, rows: null, step: 'select' })
    } catch (error) {
      if (mine !== seq.current) return
      const e = error instanceof PhotoError ? error : new PhotoError('unavailable')
      if (e.code === 'consent_required') { forget(); onFlow({ result: null, rows: null, step: 'select' }); setStep({ kind: 'idle' }); return }
      // Neu erkennen aus der Auswahl: Fehler melden, die bisherige Auswahl bleibt.
      if (flow.result) { toast.error(errorText({ kind: 'error', code: e.code, resetsAt: e.resetsAt })); setStep({ kind: 'idle' }); return }
      setStep({ kind: 'error', code: e.code, resetsAt: e.resetsAt })
    } finally {
      if (mine === seq.current) setPending(null)
    }
  }

  const onFile = (input: HTMLInputElement) => {
    const file = input.files?.[0]
    input.value = '' // dasselbe Foto noch einmal wählen können
    if (file) analyze(file)
  }

  const accept = async () => {
    setConsentBusy(true)
    try { await setConsent(true); toast.success(t('nutr_photo_consent_saved')) } catch { toast.error(t('nutr_error')) } finally { setConsentBusy(false) }
  }

  const { result, rows } = flow
  const stage = !result ? 'capture' : flow.step === 'assign' && rows ? 'assign' : 'select'
  // Auswahl/Zuordnung unabhängig vom Laden der Einwilligung: Sie wurde fürs Erkennen schon geprüft,
  // und nach jeder Lebensmittelwahl wird dieses Sheet neu aufgebaut.
  const showConsentGate = stage === 'capture'
  const ownMatches = useMemo(() => {
    const name = result?.dish || flow.hint
    if (!name.trim()) return []
    // Alle Wörter des Erkannten im eigenen Gericht — oder alle (ganzen) Wörter des eigenen im Erkannten
    // („Kürbissuppe" ⊂ „Kürbissuppe mit Ingwer"), aber nicht „Reis" in „Milchreis".
    return myDishes.filter(d => matchScore(name, d) > 0 || wholeWordsIn(d.name, name)).slice(0, 2)
  }, [result?.dish, flow.hint, myDishes])

  const errorText = (s: Extract<Step, { kind: 'error' }>) =>
    s.code === 'rate_limit'
      ? (s.resetsAt ? t('nutr_photo_err_limit_until', { time: new Date(s.resetsAt).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' }) }) : t('nutr_photo_err_limit'))
      : t(`nutr_photo_err_${s.code}`)

  const noteField = (id: string, autoFocus = false) => (
    <>
      <label htmlFor={id} className="label">{t('nutr_photo_hint_label')}</label>
      <textarea id={id} value={flow.hint} maxLength={200} rows={2} autoFocus={autoFocus} onChange={e => onFlow({ hint: e.target.value })}
        placeholder={t('nutr_photo_hint_ph')} className="input resize-none !py-2.5 leading-snug" />
    </>
  )

  const toggle = (c: Candidate) => result && onFlow({ result: { ...result, candidates: result.candidates.map(x => (x.id === c.id ? { ...x, selected: !x.selected } : x)) } })
  const candidateRow = (c: Candidate) => (
    <li key={c.id}>
      <label className="flex min-h-[48px] cursor-pointer items-center gap-3 px-5 py-1.5">
        <input type="checkbox" checked={c.selected} onChange={() => toggle(c)} className="h-5 w-5 shrink-0 accent-sky-500" />
        <span className="min-w-0 flex-1 truncate text-[17px] text-[var(--lg-text)]">{c.name}</span>
      </label>
    </li>
  )

  const chosen = rows ? chosenRows(rows) : []
  const open = rows ? rows.length - chosen.length : 0
  const total = sumNutrients(chosen.map(c => nutrientsFor(c.food.per100, c.amount)))
  const selectedCount = result?.candidates.filter(c => c.selected).length ?? 0
  const title = stage === 'capture' ? t('nutr_photo_title') : result?.dish || t('nutr_photo_review_title')

  return (
    // Nach dem Erkennen schließt nur das X — ein Tipp daneben soll Auswahl und Zuordnungen nicht verwerfen.
    <Sheet labelledBy="nutr-photo-title" busy={busy || step.kind === 'analyzing'} onClose={stage === 'capture' ? onClose : () => {}} tall>
      <div className="flex items-center justify-between gap-2">
        <h2 id="nutr-photo-title" className="lg-title2 min-w-0 truncate">{title}</h2>
        <SheetClose onClick={onClose} disabled={busy || step.kind === 'analyzing'} />
      </div>

      {showConsentGate && consentError && (
        <div role="alert" className="mt-3 flex items-center justify-between gap-3 text-[15px] text-[var(--lg-text)]">
          {t('nutr_photo_consent_load_error')}
          <button type="button" data-quiet className="lg-gray-btn shrink-0" onClick={reload}>{t('lab_retry')}</button>
        </div>
      )}

      {showConsentGate && consent === null && (
        <div className="mt-3 flex flex-col gap-3" data-photo-consent>
          <p className={`text-[15px] leading-snug ${DIM}`}>{t('nutr_photo_consent_intro')}</p>
          <ul className={`flex list-disc flex-col gap-1.5 pl-5 text-[15px] leading-snug ${DIM}`}>
            {['nutr_photo_consent_point_store', 'nutr_photo_consent_point_check', 'nutr_photo_consent_point_alt'].map(k => <li key={k}>{t(k)}</li>)}
          </ul>
          <label className="flex cursor-pointer items-start gap-3 rounded-[18px] bg-[var(--lg-surface-2)] p-3.5 text-[15px] leading-snug text-[var(--lg-text)]">
            <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-sky-500" />
            <span>{t('nutr_photo_consent_checkbox')}</span>
          </label>
          <button type="button" className="lg-btn lg-btn-primary w-full" disabled={!agreed || consentBusy} onClick={accept}>
            {t('nutr_photo_consent_accept')}
          </button>
        </div>
      )}

      {/* Dateiauswahl erst mit Einwilligung */}
      {consent && stage === 'capture' && (
        <>
          <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" aria-hidden="true" tabIndex={-1}
            data-photo-camera onChange={e => onFile(e.currentTarget)} />
          <input ref={gallery} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-hidden="true" tabIndex={-1}
            data-photo-gallery onChange={e => onFile(e.currentTarget)} />
        </>
      )}

      {step.kind === 'analyzing' && (
        <div className="mt-4 flex flex-col items-center gap-3 py-6" aria-live="polite">
          {preview && <img src={preview} alt="" className="h-40 w-40 rounded-[18px] object-cover opacity-80" />}
          <p className={`flex items-center gap-2 text-[15px] ${DIM}`}><Sparkles size={16} aria-hidden="true" className="animate-pulse" />{t('nutr_photo_analyzing')}</p>
        </div>
      )}

      {step.kind === 'error' && (
        <div className="mt-4 flex flex-col items-center gap-4 py-4 text-center">
          <p role="alert" className="text-[15px] leading-snug text-[var(--lg-text)]">{errorText(step)}</p>
          {step.code !== 'rate_limit' && (
            <button type="button" className="lg-gray-btn" onClick={() => setStep({ kind: 'idle' })}>
              <RotateCcw size={16} aria-hidden="true" />{t('nutr_photo_retry')}
            </button>
          )}
        </div>
      )}

      {/* ── 1. Aufnahme ─────────────────────────────────────────────── */}
      {stage === 'capture' && consent && step.kind === 'idle' && (
        <div className="mt-3">
          <div className={INFO_BOX}>
            <Lightbulb size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-[#ffd60a]" />
            <span>{t('nutr_photo_note_tip')}</span>
          </div>
          <div className="mt-3">{noteField('nutr-photo-hint')}</div>
          <p className={`mt-1.5 px-1 text-[13px] leading-snug ${MUTED}`}>{t('nutr_photo_dictate')}</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" className="lg-btn lg-btn-primary min-w-0 !px-3" onClick={() => camera.current?.click()}>
              <Camera size={18} aria-hidden="true" />{t('nutr_photo_take')}
            </button>
            <button type="button" className="lg-gray-btn !min-h-12" onClick={() => gallery.current?.click()}>
              <ImageUp size={18} aria-hidden="true" />{t('nutr_photo_pick')}
            </button>
          </div>
          <button type="button" data-quiet className="lg-gray-btn mt-2 w-full" disabled={!flow.hint.trim()} onClick={() => analyze(null)}>
            {t('nutr_photo_text_only')}
          </button>
        </div>
      )}

      {/* ── 2. Auswahl: was hast du wirklich genommen? ─────────────── */}
      {stage === 'select' && result && step.kind === 'idle' && (
        <div className="mt-2">
          {ownMatches.map(d => (
            <button key={d.itemId} type="button" onClick={() => onLogDish(d)} disabled={busy}
              className="mb-2 flex w-full items-center gap-3 rounded-[14px] bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] p-3 text-left">
              <ChefHat size={18} aria-hidden="true" className="shrink-0 text-[var(--lg-accent-text)]" />
              <span className="min-w-0 flex-1 text-[15px] leading-snug text-[var(--lg-text)]">{t('nutr_photo_own_dish', { name: d.name })}</span>
              <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-[var(--lg-text-3)]" />
            </button>
          ))}

          {result.needsNote && (
            <div className="mb-3 rounded-[14px] bg-[color-mix(in_srgb,var(--lg-warn)_14%,transparent)] p-3" data-photo-needs-note>
              <p className="text-[13px] leading-snug text-[var(--lg-text-2)]">{t('nutr_photo_needs_note')}</p>
              <div className="mt-2">{noteField('nutr-photo-hint-again', !flow.hint)}</div>
              <button type="button" className="lg-gray-btn mt-2 w-full" disabled={!flow.hint.trim() || busy} onClick={() => analyze(flow.file)}>
                <Sparkles size={15} aria-hidden="true" />{t('nutr_photo_reanalyze')}
              </button>
            </div>
          )}

          <p className={`px-1 text-[13px] leading-snug ${DIM}`}>{t('nutr_photo_select_hint')}</p>
          {(() => {
            const g = groupCandidates(result.candidates)
            return (
              <>
                {g.core.length > 0 && (
                  <>
                    <p className="label mt-3">{t('nutr_photo_core')}</p>
                    <ul className="lg-rows -mx-5">{g.core.map(candidateRow)}</ul>
                  </>
                )}
                {g.groups.map(gr => (
                  <div key={gr.label}>
                    <p className="label mt-3">{t('nutr_photo_alt_group', { group: gr.label })}</p>
                    <ul className="lg-rows -mx-5">{gr.items.map(candidateRow)}</ul>
                  </div>
                ))}
                {g.optional.length > 0 && (
                  <>
                    <p className="label mt-3">{t('nutr_photo_optional')}</p>
                    <ul className="lg-rows -mx-5">{g.optional.map(candidateRow)}</ul>
                  </>
                )}
              </>
            )
          })()}

          <div className="mt-5 flex gap-2">
            <button type="button" data-quiet aria-label={t('nutr_photo_again')} className="lg-gray-btn !min-h-12 !w-12 shrink-0 !px-0" disabled={busy}
              onClick={() => onFlow({ result: null, rows: null, step: 'select' })}>
              <RotateCcw size={18} />
            </button>
            <button type="button" className="lg-btn lg-btn-primary min-w-0 flex-1 !px-4" disabled={!selectedCount || busy}
              onClick={() => onFlow({ rows: rowsFromSelection(result.candidates, rows), step: 'assign' })}>
              {t('nutr_photo_continue', { count: selectedCount })}
            </button>
          </div>
        </div>
      )}

      {/* ── 3. Zuordnung: Lebensmittel und Menge ───────────────────── */}
      {stage === 'assign' && rows && step.kind === 'idle' && (
        <div className="mt-2">
          <div className={INFO_BOX}>
            <Info size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--lg-accent-text)]" />
            <span>{t('nutr_photo_review_hint')}</span>
          </div>

          <ul className="lg-rows -mx-5 mt-2" aria-label={t('nutr_photo_items')}>
            {rows.map((r, k) => {
              const nu = r.food && r.amount ? nutrientsFor(r.food.per100, r.amount) : null
              return (
                <li key={r.id} className="flex items-center">
                  <button type="button" onClick={() => onPickRow(k)} disabled={busy}
                    aria-label={r.food ? t('nutr_photo_change', { name: r.food.name }) : t('nutr_photo_choose_for', { name: r.name })}
                    className="flex min-h-[60px] min-w-0 flex-1 items-center gap-2 py-2 pl-5 pr-1 text-left transition-colors active:bg-[var(--lg-fill)]">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[17px] text-[var(--lg-text)]">{r.food ? r.food.name : r.name}</span>
                      <span className={`block truncate text-[13px] tabular-nums ${r.food ? MUTED : 'text-[var(--lg-accent-text)]'}`}>
                        {nu && r.amount
                          ? `${Math.round(r.amount)} ${r.food!.unit} · ${hideKcal ? `${Math.round(nu.protein)} g ${t('nutr_protein_short')}` : `${Math.round(nu.kcal)} kcal`}`
                          : t('nutr_photo_choose')}
                      </span>
                    </span>
                    <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-[var(--lg-text-3)]" />
                  </button>
                  <button type="button" disabled={busy}
                    // Auch in der Auswahl abwählen, sonst käme die Zeile beim nächsten „Weiter" wieder.
                    onClick={() => onFlow({
                      rows: rows.filter((_, j) => j !== k),
                      ...(result ? { result: { ...result, candidates: result.candidates.map(c => (c.id === r.id ? { ...c, selected: false } : c)) } } : {}),
                    })}
                    aria-label={t('nutr_dish_remove_ingredient', { name: r.food?.name ?? r.name })}
                    className="lg-icon-btn mr-2 shrink-0 !text-[var(--lg-text-3)]">
                    <X size={18} />
                  </button>
                </li>
              )
            })}
          </ul>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => onFlow({ step: 'select' })} disabled={busy}
              data-quiet className="lg-gray-btn !px-3.5">
              <ArrowLeft size={16} aria-hidden="true" />{t('nutr_photo_back_to_select')}
            </button>
            <button type="button" onClick={() => onPickRow(null)} disabled={busy} className="lg-gray-btn flex-1">
              <Plus size={16} aria-hidden="true" />{t('nutr_dish_add_ingredient')}
            </button>
          </div>

          {chosen.length > 0 && (
            <>
              <p className="label mt-4">{t('nutr_photo_total')}</p>
              <MacroCells nutrients={total} hideKcal={hideKcal} />
            </>
          )}

          <p className="label mt-4" id="nutr-photo-meal">{t('nutr_meal')}</p>
          <div role="radiogroup" aria-labelledby="nutr-photo-meal" className="flex flex-wrap gap-1.5">
            {MEALS.map(m => (
              <button key={m} type="button" role="radio" aria-checked={meal === m} onClick={() => onMeal(m)} className={chip(meal === m)}>
                {t(`nutr_meal_${m}`)}
              </button>
            ))}
          </div>

          {open > 0 && chosen.length > 0 && <p className={`mt-3 px-1 text-[13px] ${MUTED}`}>{t('nutr_photo_open', { count: open })}</p>}

          <div className="mt-5 flex gap-2">
            {chosen.length >= 2 && (
              <button type="button" data-quiet className="lg-gray-btn !min-h-12 shrink-0 !px-3.5" disabled={busy}
                onClick={() => onSaveAsDish(result?.dish || flow.hint.trim(), chosen)}>
                <ChefHat size={16} aria-hidden="true" />{t('nutr_photo_as_dish')}
              </button>
            )}
            <button type="button" className="lg-btn lg-btn-primary min-w-0 flex-1 !px-4" disabled={!chosen.length || busy} onClick={() => onLog(meal, chosen)}>
              {chosen.length ? t('nutr_photo_log', { count: chosen.length }) : t('nutr_photo_log_none')}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
