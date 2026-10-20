import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Sheet } from './Panel'
import { alterAm } from '../../blutwerte/lib/referenzbereiche'
import { type Activity, DEFAULT_GOALS, GOAL_LIMITS, type GoalKind, type Goals, parseAmount, suggestGoals } from '../lib/nutrition'
import { orbLayout } from '../lib/orb'
import { type BodyData, loadBodyData } from '../services/nutritionStore'
import { setSoundsWanted, soundsWanted, unlockAudio } from '../lib/orbFeedback'
import { DIM, ERROR_TEXT, MUTED, chip } from '../styles'
import { SheetClose } from '../../../components/ui/SheetClose'

type Key = keyof typeof GOAL_LIMITS
const KEYS: Key[] = ['kcal', 'proteinG', 'carbsG', 'fatG', 'waterMl']
const LABEL: Record<Key, string> = {
  kcal: 'nutr_f_kcal', proteinG: 'nutr_goal_protein', carbsG: 'nutr_goal_carbs', fatG: 'nutr_goal_fat', waterMl: 'nutr_goal_water',
}

export function GoalsSheet({ userId, today, current, busy, onSave, onClose }: {
  userId: string
  today: string
  current: Goals
  busy: boolean
  /** Gibt false zurück, wenn das Speichern scheiterte. */
  onSave: (g: Goals) => Promise<boolean> | void
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const [v, setV] = useState<Record<Key, string>>(() => Object.fromEntries(KEYS.map(k => [k, String(current[k])])) as Record<Key, string>)
  const [hideKcal, setHideKcal] = useState(current.hideKcal)
  // Töne gelten für dieses Gerät (nicht in der Datenbank), gespeichert mit „Speichern“.
  const [sounds, setSounds] = useState(soundsWanted)
  const [body, setBody] = useState<BodyData | null | 'error'>(null)
  const [activity, setActivity] = useState<Activity>('light')
  const [goal, setGoal] = useState<GoalKind>('maintain')

  useEffect(() => {
    let cancelled = false
    loadBodyData(userId).then(b => { if (!cancelled) setBody(b) }).catch(() => { if (!cancelled) setBody('error') })
    return () => { cancelled = true }
  }, [userId])

  const nums = Object.fromEntries(KEYS.map(k => [k, parseAmount(v[k])])) as Record<Key, number>
  const ok = (k: Key) => Number.isInteger(nums[k]) && nums[k] >= GOAL_LIMITS[k][0] && nums[k] <= GOAL_LIMITS[k][1]
  const valid = KEYS.every(ok)

  const age = body && body !== 'error' ? alterAm(body.birthDate, today) : null
  const complete = body && body !== 'error' && body.weightKg && body.heightCm && age !== null && body.sex ? body : null
  const missing = body && body !== 'error' && !complete
    ? [!body.weightKg && t('nutr_body_weight'), !body.heightCm && t('nutr_body_height'), age === null && t('nutr_body_birth'), !body.sex && t('nutr_body_sex')].filter(Boolean).join(', ')
    : ''

  const applySuggestion = () => {
    if (!complete) return
    const g = suggestGoals({
      sex: complete.sex!, weightKg: complete.weightKg!, heightCm: complete.heightCm!,
      age: age!, activity, goal,
    })
    setV(Object.fromEntries(KEYS.map(k => [k, String(g[k])])) as Record<Key, string>)
  }

  return (
    <Sheet labelledBy="nutr-goals-title" busy={busy} onClose={onClose} tall>
      <div className="flex items-center justify-between gap-2">
        <h2 id="nutr-goals-title" className="lg-title2">{t('nutr_goals_title')}</h2>
        <SheetClose onClick={onClose} disabled={busy} />
      </div>

      <section aria-labelledby="nutr-suggest" className="mt-3 rounded-[18px] bg-[var(--lg-surface-2)] p-4">
        <h3 id="nutr-suggest" className="text-[17px] font-semibold text-[var(--lg-text)]">{t('nutr_suggest_title')}</h3>
        {body === null && <p className={`mt-1 text-[13px] ${MUTED}`}>…</p>}
        {body === 'error' && <p className={`mt-1 text-[13px] ${MUTED}`}>{t('nutr_body_error')}</p>}
        {missing && (
          <p className={`mt-1 text-[13px] leading-snug ${DIM}`}>
            {t('nutr_suggest_missing', { fields: missing })}{' '}
            <Link to="/health" className="font-semibold text-[var(--lg-accent-text)]">{t('nutr_suggest_open_profile')}</Link>
          </p>
        )}
        {complete && (
          <>
            <p className={`mt-1 text-[13px] ${MUTED}`}>
              {t('nutr_suggest_basis', { weight: complete.weightKg, height: complete.heightCm, age })}
            </p>
            <p className="label mt-3" id="nutr-activity-label">{t('nutr_activity')}</p>
            <div role="radiogroup" aria-labelledby="nutr-activity-label" className="grid grid-cols-2 gap-1.5">
              {(['sedentary', 'light', 'moderate', 'high'] as const).map(a => (
                <button key={a} type="button" role="radio" aria-checked={activity === a} onClick={() => setActivity(a)}
                  className={chip(activity === a)}>{t(`nutr_act_${a}`)}</button>
              ))}
            </div>
            <p className="label mt-3" id="nutr-goalkind-label">{t('nutr_goal')}</p>
            <div role="radiogroup" aria-labelledby="nutr-goalkind-label" className="grid grid-cols-3 gap-1.5">
              {(['lose', 'maintain', 'gain'] as const).map(g => (
                <button key={g} type="button" role="radio" aria-checked={goal === g} onClick={() => setGoal(g)}
                  className={chip(goal === g)}>{t(`nutr_goal_${g}`)}</button>
              ))}
            </div>
            <button type="button" onClick={applySuggestion} className="lg-gray-btn mt-3 w-full">{t('nutr_suggest_apply')}</button>
          </>
        )}
        <p className={`mt-2.5 text-[12px] leading-relaxed ${MUTED}`}>{t('nutr_suggest_note')}</p>
      </section>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {KEYS.map(k => (
          <div key={k} className={`min-w-0 ${k === 'kcal' ? 'col-span-2' : ''}`}>
            <label htmlFor={`nutr-g-${k}`} className="label truncate">{t(LABEL[k])}</label>
            <input id={`nutr-g-${k}`} inputMode="numeric" enterKeyHint="next" value={v[k]} onChange={e => setV({ ...v, [k]: e.target.value })}
              aria-invalid={!ok(k)} className="input" />
          </div>
        ))}
      </div>
      {!valid && (
        <p role="alert" className={`mt-2 px-1 ${ERROR_TEXT}`}>
          {t('nutr_goals_invalid', { min: GOAL_LIMITS.kcal[0], max: GOAL_LIMITS.kcal[1] })}
        </p>
      )}

      <SwitchRow label={t('nutr_hide_kcal')} hint={t('nutr_hide_kcal_hint')} checked={hideKcal} onChange={setHideKcal} />
      <SwitchRow label={t('nutr_orb_sounds')} hint={t('nutr_orb_sounds_hint')} checked={sounds} onChange={setSounds} />
      {/* Maßstab der Kugel: stand früher unter ihr, jetzt hier (oben ist nur Zahl und Makros). */}
      {!hideKcal && <p className={`mt-3 px-1 text-[12px] ${MUTED}`}>
        {t('nutr_orb_unit', { kcal: (valid && nums.kcal > 0 ? orbLayout({ kcal: 0, protein: 0, carbs: 0, fat: 0 }, { ...DEFAULT_GOALS, kcal: nums.kcal }).main.unit : 1)
          .toLocaleString(i18n.language, { maximumFractionDigits: 1 }) })}
      </p>}

      <div className="mt-5 flex gap-2">
        <button type="button" data-quiet className="lg-gray-btn flex-1 !min-h-12 !text-[17px]" disabled={busy} onClick={onClose}>{t('cancel')}</button>
        <button type="button" className="lg-btn lg-btn-primary flex-1 !px-4" disabled={!valid || busy}
          onClick={() => {
            // Ton jetzt freischalten (noch in der Geste), die Wahl erst nach erfolgreichem Speichern merken.
            if (sounds) unlockAudio()
            void Promise.resolve(onSave({ ...nums, hideKcal })).then(ok => { if (ok !== false) setSoundsWanted(sounds) })
          }}>{t('nutr_save')}</button>
      </div>
    </Sheet>
  )
}

/** iOS-Schalter; darunter bleibt ein echtes Kontrollkästchen (Tastatur, Screenreader). */
function SwitchRow({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="mt-4 flex min-h-[52px] cursor-pointer items-center gap-3 rounded-[18px] bg-[var(--lg-surface-2)] px-4 py-3">
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] text-[var(--lg-text)]">{label}</span>
        <span className={`mt-0.5 block text-[13px] leading-snug ${MUTED}`}>{hint}</span>
      </span>
      <span className="relative shrink-0">
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
          className="peer absolute inset-0 z-10 m-0 h-full w-full cursor-pointer opacity-0" />
        <span aria-hidden="true"
          className="relative block h-[31px] w-[51px] rounded-full bg-[var(--lg-fill)] transition-colors peer-checked:bg-[var(--lg-good)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--lg-accent)] after:absolute after:left-[2px] after:top-[2px] after:h-[27px] after:w-[27px] after:rounded-full after:bg-white after:shadow-[0_3px_8px_rgba(0,0,0,0.15)] after:transition-transform after:content-[''] peer-checked:after:translate-x-5" />
      </span>
    </label>
  )
}
