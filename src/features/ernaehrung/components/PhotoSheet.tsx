import { useEffect, useRef, useState } from 'react'
import { Camera, ChevronRight, ImageUp, Info, Plus, RotateCcw, Sparkles, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { Sheet } from '../../compliance/components/Sheet'
import { SheetClose } from '../../../components/ui/SheetClose'
import { useFoodAiConsent } from '../hooks/useFoodAiConsent'
import { MEALS, type Food, type Meal, nutrientsFor, sumNutrients } from '../lib/nutrition'
import { type PhotoRow, chosenRows, rowsFromItems } from '../lib/photoRows'
import { PhotoError, analyzePhoto } from '../services/foodPhoto'
import { DIM, MUTED, chip } from '../styles'
import { MacroCells } from './MacroCells'

type Step = { kind: 'pick' } | { kind: 'analyzing' } | { kind: 'error'; code: PhotoError['code']; resetsAt: string | null }

/**
 * Essen per Foto — die KI erkennt nur, WAS auf dem Teller liegt. Zu jeder
 * erkannten Zutat wählt der Nutzer Lebensmittel und Menge über die gewohnte
 * Suche; die Nährwerte kommen aus „Meine", Open Food Facts oder dem Barcode,
 * nie aus einer KI-Schätzung (Entscheidung Nutzer, 18.10.2026).
 *
 * `rows` liegt bei der Seite (überlebt das Suchen eines Lebensmittels);
 * null = noch kein Foto ausgewertet.
 */
export function PhotoSheet({ userId, meal, rows, hint, hideKcal, busy, onRows, onHint, onMeal, onPickRow, onLog, onClose }: {
  userId: string
  meal: Meal
  rows: PhotoRow[] | null
  /** Notiz zum Foto — liegt bei der Seite, damit sie für ein neues Foto erhalten bleibt. */
  hint: string
  hideKcal: boolean
  busy: boolean
  onRows: (rows: PhotoRow[] | null) => void
  onHint: (hint: string) => void
  onMeal: (meal: Meal) => void
  /** Lebensmittel für Zeile `index` wählen; null = weitere Zutat. */
  onPickRow: (index: number | null) => void
  onLog: (meal: Meal, list: { food: Food; amount: number }[]) => void
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language?.startsWith('en') ? 'en' : 'de'
  const { consent, error: consentError, set: setConsent, forget, reload } = useFoodAiConsent(userId)
  const [agreed, setAgreed] = useState(false)
  const [consentBusy, setConsentBusy] = useState(false)
  const [step, setStep] = useState<Step>({ kind: 'pick' })
  const [preview, setPreview] = useState<string | null>(null)
  const camera = useRef<HTMLInputElement>(null)
  const gallery = useRef<HTMLInputElement>(null)
  const seq = useRef(0)

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const analyze = async (file: File) => {
    const mine = ++seq.current
    setPreview(URL.createObjectURL(file))
    setStep({ kind: 'analyzing' })
    try {
      const items = await analyzePhoto(file, hint, lang)
      if (mine !== seq.current) return
      setStep({ kind: 'pick' })
      onRows(rowsFromItems(items))
    } catch (error) {
      if (mine !== seq.current) return
      const e = error instanceof PhotoError ? error : new PhotoError('unavailable')
      if (e.code === 'consent_required') { forget(); setStep({ kind: 'pick' }); return }
      setStep({ kind: 'error', code: e.code, resetsAt: e.resetsAt })
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

  const chosen = rows ? chosenRows(rows) : []
  const open = rows ? rows.length - chosen.length : 0
  const total = sumNutrients(chosen.map(c => nutrientsFor(c.food.per100, c.amount)))
  // Prüfliste unabhängig vom Laden der Einwilligung: Sie wurde fürs Foto schon geprüft,
  // und nach jeder Lebensmittelwahl wird dieses Sheet neu aufgebaut.
  const reviewing = rows !== null

  const errorText = (s: Extract<Step, { kind: 'error' }>) =>
    s.code === 'rate_limit'
      ? (s.resetsAt ? t('nutr_photo_err_limit_until', { time: new Date(s.resetsAt).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' }) }) : t('nutr_photo_err_limit'))
      : t(`nutr_photo_err_${s.code}`)

  return (
    // In der Prüfliste schließt nur das X — ein Tipp daneben soll die Zuordnungen nicht verwerfen.
    <Sheet labelledBy="nutr-photo-title" busy={busy || step.kind === 'analyzing'} onClose={reviewing ? () => {} : onClose} tall>
      <div className="flex items-center justify-between gap-2">
        <h2 id="nutr-photo-title" className="lg-title2 min-w-0 truncate">{t(reviewing ? 'nutr_photo_review_title' : 'nutr_photo_title')}</h2>
        <SheetClose onClick={onClose} disabled={busy || step.kind === 'analyzing'} />
      </div>

      {!reviewing && consentError && (
        <div role="alert" className="mt-3 flex items-center justify-between gap-3 text-[15px] text-[var(--lg-text)]">
          {t('nutr_photo_consent_load_error')}
          <button type="button" data-quiet className="lg-gray-btn shrink-0" onClick={reload}>{t('lab_retry')}</button>
        </div>
      )}

      {!reviewing && consent === null && (
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

      {consent && rows === null && (
        <>
          <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" aria-hidden="true" tabIndex={-1}
            data-photo-camera onChange={e => onFile(e.currentTarget)} />
          <input ref={gallery} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-hidden="true" tabIndex={-1}
            data-photo-gallery onChange={e => onFile(e.currentTarget)} />
        </>
      )}

      {consent && rows === null && step.kind === 'pick' && (
        <div className="mt-3">
          <label htmlFor="nutr-photo-hint" className="label">{t('nutr_photo_hint_label')}</label>
          <input id="nutr-photo-hint" value={hint} maxLength={200} onChange={e => onHint(e.target.value)}
            placeholder={t('nutr_photo_hint_ph')} className="input" />
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" className="lg-btn lg-btn-primary !px-3" onClick={() => camera.current?.click()}>
              <Camera size={18} aria-hidden="true" />{t('nutr_photo_take')}
            </button>
            <button type="button" className="lg-gray-btn !min-h-12" onClick={() => gallery.current?.click()}>
              <ImageUp size={18} aria-hidden="true" />{t('nutr_photo_pick')}
            </button>
          </div>
          <p className={`mt-3 px-1 text-[13px] leading-snug ${MUTED}`}>{t('nutr_photo_note')}</p>
        </div>
      )}

      {consent && rows === null && step.kind === 'analyzing' && (
        <div className="mt-4 flex flex-col items-center gap-3 py-6" aria-live="polite">
          {preview && <img src={preview} alt="" className="h-40 w-40 rounded-[18px] object-cover opacity-80" />}
          <p className={`flex items-center gap-2 text-[15px] ${DIM}`}><Sparkles size={16} aria-hidden="true" className="animate-pulse" />{t('nutr_photo_analyzing')}</p>
        </div>
      )}

      {consent && rows === null && step.kind === 'error' && (
        <div className="mt-4 flex flex-col items-center gap-4 py-4 text-center">
          <p role="alert" className="text-[15px] leading-snug text-[var(--lg-text)]">{errorText(step)}</p>
          {step.code !== 'rate_limit' && (
            <button type="button" className="lg-gray-btn" onClick={() => setStep({ kind: 'pick' })}>
              <RotateCcw size={16} aria-hidden="true" />{t('nutr_photo_retry')}
            </button>
          )}
        </div>
      )}

      {reviewing && (
        <div className="mt-2">
          <div className="flex gap-2 rounded-[14px] bg-[var(--lg-surface-2)] p-3 text-[13px] leading-snug text-[var(--lg-text-2)]">
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
                      <span className={`flex items-center gap-1.5 text-[13px] tabular-nums ${r.food ? MUTED : 'text-[var(--lg-accent-text)]'}`}>
                        <span className="truncate">
                          {nu && r.amount
                            ? `${Math.round(r.amount)} ${r.food!.unit} · ${hideKcal ? `${Math.round(nu.protein)} g ${t('nutr_protein_short')}` : `${Math.round(nu.kcal)} kcal`}`
                            : t('nutr_photo_choose')}
                        </span>
                        {!r.food && r.unsure && (
                          <span className="shrink-0 rounded-[5px] bg-[color-mix(in_srgb,var(--lg-warn)_18%,transparent)] px-1.5 text-[11px] font-semibold text-[var(--lg-warn-text)]">{t('nutr_photo_unsure')}</span>
                        )}
                      </span>
                    </span>
                    <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-[var(--lg-text-3)]" />
                  </button>
                  <button type="button" onClick={() => onRows(rows.filter((_, j) => j !== k))} disabled={busy}
                    aria-label={t('nutr_dish_remove_ingredient', { name: r.food?.name ?? r.name })}
                    className="lg-icon-btn mr-2 shrink-0 !text-[var(--lg-text-3)]">
                    <X size={18} />
                  </button>
                </li>
              )
            })}
          </ul>
          <button type="button" onClick={() => onPickRow(null)} disabled={busy} className="lg-gray-btn mt-2 w-full">
            <Plus size={16} aria-hidden="true" />{t('nutr_dish_add_ingredient')}
          </button>

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
            <button type="button" data-quiet aria-label={t('nutr_photo_again')} className="lg-gray-btn !min-h-12 !w-12 shrink-0 !px-0" disabled={busy}
              onClick={() => { setStep({ kind: 'pick' }); onRows(null) }}>
              <RotateCcw size={18} />
            </button>
            <button type="button" className="lg-btn lg-btn-primary min-w-0 flex-1 !px-4" disabled={!chosen.length || busy} onClick={() => onLog(meal, chosen)}>
              {chosen.length ? t('nutr_photo_log', { count: chosen.length }) : t('nutr_photo_log_none')}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
