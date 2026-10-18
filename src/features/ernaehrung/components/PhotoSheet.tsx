import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Camera, ImageUp, RotateCcw, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { Sheet } from '../../compliance/components/Sheet'
import { SheetClose } from '../../../components/ui/SheetClose'
import { useFoodAiConsent } from '../hooks/useFoodAiConsent'
import { MEALS, type Food, type Meal, amountValid, nutrientsFor, parseAmount, sumNutrients } from '../lib/nutrition'
import { PhotoError, type PhotoItem, analyzePhoto, photoItemToFood } from '../services/foodPhoto'
import { DIM, ERROR_TEXT, MUTED, WARN_BOX, chip } from '../styles'
import { MacroCells } from './MacroCells'

type Row = { item: PhotoItem; name: string; grams: string; on: boolean }
type Step =
  | { kind: 'pick' }
  | { kind: 'analyzing' }
  | { kind: 'review'; rows: Row[] }
  | { kind: 'error'; code: PhotoError['code']; resetsAt: string | null }

/**
 * Essen per Foto (wie Cal AI) — aber als Vorschlag: Die KI schätzt Lebensmittel
 * und Mengen, der Nutzer prüft jede Position, bevor etwas eingetragen wird.
 * Fotos unterschätzen typisch (versteckte Fette, Soßen), darum der Hinweis.
 */
export function PhotoSheet({ userId, meal: startMeal, hideKcal, busy, onLog, onClose }: {
  userId: string
  meal: Meal
  hideKcal: boolean
  busy: boolean
  onLog: (meal: Meal, list: { food: Food; amount: number }[]) => void
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language?.startsWith('en') ? 'en' : 'de'
  const { consent, error: consentError, set: setConsent, forget, reload } = useFoodAiConsent(userId)
  const [agreed, setAgreed] = useState(false)
  const [consentBusy, setConsentBusy] = useState(false)
  const [step, setStep] = useState<Step>({ kind: 'pick' })
  const [hint, setHint] = useState('')
  const [meal, setMeal] = useState<Meal>(startMeal)
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
      setStep({ kind: 'review', rows: items.map(item => ({ item, name: item.name, grams: String(item.grams), on: true })) })
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

  const rows = step.kind === 'review' ? step.rows : []
  const chosen = rows.filter(r => r.on)
  const valid = chosen.length > 0 && chosen.every(r => r.name.trim() && amountValid(parseAmount(r.grams)))
  const total = sumNutrients(chosen.filter(r => amountValid(parseAmount(r.grams)))
    .map(r => nutrientsFor(photoItemToFood(r.item).per100, parseAmount(r.grams))))
  const setRow = (k: number, patch: Partial<Row>) => step.kind === 'review' && setStep({ ...step, rows: step.rows.map((r, j) => (j === k ? { ...r, ...patch } : r)) })

  const accept = async () => {
    setConsentBusy(true)
    try { await setConsent(true); toast.success(t('nutr_photo_consent_saved')) } catch { toast.error(t('nutr_error')) } finally { setConsentBusy(false) }
  }

  const log = () => {
    if (!valid) return
    onLog(meal, chosen.map(r => ({ food: photoItemToFood({ ...r.item, name: r.name }), amount: parseAmount(r.grams) })))
  }

  const errorText = (s: Extract<Step, { kind: 'error' }>) =>
    s.code === 'rate_limit'
      ? (s.resetsAt ? t('nutr_photo_err_limit_until', { time: new Date(s.resetsAt).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' }) }) : t('nutr_photo_err_limit'))
      : t(`nutr_photo_err_${s.code}`)

  const fileInputs = (
    <>
      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" aria-hidden="true" tabIndex={-1}
        data-photo-camera onChange={e => onFile(e.currentTarget)} />
      <input ref={gallery} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-hidden="true" tabIndex={-1}
        data-photo-gallery onChange={e => onFile(e.currentTarget)} />
    </>
  )

  return (
    <Sheet labelledBy="nutr-photo-title" busy={busy || step.kind === 'analyzing'} onClose={step.kind === 'review' ? () => {} : onClose} tall>
      <div className="flex items-center justify-between gap-2">
        <h2 id="nutr-photo-title" className="lg-title2 min-w-0 truncate">{t('nutr_photo_title')}</h2>
        <SheetClose onClick={onClose} disabled={busy || step.kind === 'analyzing'} />
      </div>

      {consentError && (
        <div role="alert" className="mt-3 flex items-center justify-between gap-3 text-[15px] text-[var(--lg-text)]">
          {t('nutr_photo_consent_load_error')}
          <button type="button" data-quiet className="lg-gray-btn shrink-0" onClick={reload}>{t('lab_retry')}</button>
        </div>
      )}

      {consent === null && (
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

      {consent && step.kind === 'pick' && (
        <div className="mt-3">
          {fileInputs}
          <label htmlFor="nutr-photo-hint" className="label">{t('nutr_photo_hint_label')}</label>
          <input id="nutr-photo-hint" value={hint} maxLength={200} onChange={e => setHint(e.target.value)}
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

      {consent && step.kind === 'analyzing' && (
        <div className="mt-4 flex flex-col items-center gap-3 py-6" aria-live="polite">
          {preview && <img src={preview} alt="" className="h-40 w-40 rounded-[18px] object-cover opacity-80" />}
          <p className={`flex items-center gap-2 text-[15px] ${DIM}`}><Sparkles size={16} aria-hidden="true" className="animate-pulse" />{t('nutr_photo_analyzing')}</p>
        </div>
      )}

      {consent && step.kind === 'error' && (
        <div className="mt-4 flex flex-col items-center gap-4 py-4 text-center">
          {fileInputs}
          <p role="alert" className="text-[15px] leading-snug text-[var(--lg-text)]">{errorText(step)}</p>
          {step.code !== 'rate_limit' && (
            <button type="button" className="lg-gray-btn" onClick={() => setStep({ kind: 'pick' })}>
              <RotateCcw size={16} aria-hidden="true" />{t('nutr_photo_retry')}
            </button>
          )}
        </div>
      )}

      {consent && step.kind === 'review' && (
        <div className="mt-2">
          <div className={WARN_BOX}>
            <AlertTriangle size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--lg-warn-text)]" />
            <span>{t('nutr_photo_check')}</span>
          </div>
          <ul className="lg-rows -mx-5 mt-2" aria-label={t('nutr_photo_items')}>
            {rows.map((r, k) => {
              const grams = parseAmount(r.grams)
              const ok = amountValid(grams)
              const nu = ok ? nutrientsFor(photoItemToFood(r.item).per100, grams) : null
              return (
                <li key={k} className={`flex items-center gap-2 py-2 pl-5 pr-3 ${r.on ? '' : 'opacity-50'}`}>
                  <input type="checkbox" checked={r.on} onChange={e => setRow(k, { on: e.target.checked })}
                    aria-label={t('nutr_photo_include', { name: r.name })} className="h-5 w-5 shrink-0 accent-sky-500" />
                  <span className="min-w-0 flex-1">
                    <input value={r.name} maxLength={120} onChange={e => setRow(k, { name: e.target.value })}
                      aria-label={t('nutr_photo_item_name')} aria-invalid={r.on && !r.name.trim()}
                      className="w-full truncate bg-transparent text-[17px] text-[var(--lg-text)] outline-none focus-visible:underline" />
                    <span className={`flex items-center gap-1.5 text-[13px] tabular-nums ${MUTED}`}>
                      {nu ? (hideKcal ? `${Math.round(nu.protein)} g ${t('nutr_protein_short')}` : `${Math.round(nu.kcal)} kcal · ${Math.round(nu.protein)} ${t('nutr_p')}`) : '–'}
                      {r.item.confidence === 'low' && <span className="rounded-[5px] bg-[color-mix(in_srgb,var(--lg-warn)_18%,transparent)] px-1.5 text-[11px] font-semibold text-[var(--lg-warn-text)]">{t('nutr_photo_unsure')}</span>}
                    </span>
                  </span>
                  <input inputMode="decimal" value={r.grams} onChange={e => setRow(k, { grams: e.target.value })} onFocus={e => e.currentTarget.select()}
                    aria-label={t('nutr_dish_ingredient_amount', { name: r.name, unit: 'g' })} aria-invalid={r.on && !ok}
                    className="input !min-h-10 !w-[4.5rem] shrink-0 !px-2.5 text-right tabular-nums" />
                  <span className={`w-4 shrink-0 text-[15px] ${DIM}`}>g</span>
                </li>
              )
            })}
          </ul>

          <p className="label mt-3">{t('nutr_photo_total')}</p>
          <MacroCells nutrients={chosen.length ? total : null} hideKcal={hideKcal} />

          <p className="label mt-4" id="nutr-photo-meal">{t('nutr_meal')}</p>
          <div role="radiogroup" aria-labelledby="nutr-photo-meal" className="flex flex-wrap gap-1.5">
            {MEALS.map(m => (
              <button key={m} type="button" role="radio" aria-checked={meal === m} onClick={() => setMeal(m)} className={chip(meal === m)}>
                {t(`nutr_meal_${m}`)}
              </button>
            ))}
          </div>

          {!valid && chosen.length > 0 && <p role="alert" className={`mt-3 px-1 ${ERROR_TEXT}`}>{t('nutr_photo_invalid')}</p>}

          <div className="mt-5 flex gap-2">
            <button type="button" data-quiet aria-label={t('nutr_photo_again')} className="lg-gray-btn !min-h-12 !w-12 shrink-0 !px-0" disabled={busy} onClick={() => setStep({ kind: 'pick' })}>
              <RotateCcw size={18} />
            </button>
            <button type="button" className="lg-btn lg-btn-primary min-w-0 flex-1 !px-4" disabled={!valid || busy} onClick={log}>
              {t('nutr_photo_log', { count: chosen.length })}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
