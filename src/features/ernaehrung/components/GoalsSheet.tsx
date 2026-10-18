import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Sheet } from '../../compliance/components/Sheet'
import { alterAm } from '../../blutwerte/lib/referenzbereiche'
import { type Activity, GOAL_LIMITS, type GoalKind, type Goals, parseAmount, suggestGoals } from '../lib/nutrition'
import { type BodyData, loadBodyData } from '../services/nutritionStore'
import { PRESSABLE, chip, dim, input, label, muted } from '../styles'

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
  onSave: (g: Goals) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [v, setV] = useState<Record<Key, string>>(() => Object.fromEntries(KEYS.map(k => [k, String(current[k])])) as Record<Key, string>)
  const [hideKcal, setHideKcal] = useState(current.hideKcal)
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
      <div className="flex items-center justify-between">
        <h2 id="nutr-goals-title" className="text-lg font-extrabold" style={{ color: 'var(--text)' }}>{t('nutr_goals_title')}</h2>
        <button type="button" data-app-back-close aria-label={t('close')} onClick={onClose} disabled={busy}
          className={`grid h-11 w-11 place-items-center rounded-xl ${PRESSABLE}`} style={dim}><X size={20} /></button>
      </div>

      <section aria-labelledby="nutr-suggest" className="mt-2 rounded-2xl p-3.5" style={{ background: 'var(--surface-input)', border: '1px solid var(--border)' }}>
        <h3 id="nutr-suggest" className="text-[0.88rem] font-extrabold" style={{ color: 'var(--text)' }}>{t('nutr_suggest_title')}</h3>
        {body === null && <p className="mt-1 text-[0.78rem]" style={muted}>…</p>}
        {body === 'error' && <p className="mt-1 text-[0.78rem]" style={muted}>{t('nutr_body_error')}</p>}
        {missing && (
          <p className="mt-1 text-[0.78rem]" style={dim}>
            {t('nutr_suggest_missing', { fields: missing })}{' '}
            <Link to="/health" className="font-bold underline" style={{ color: 'var(--accent)' }}>{t('nutr_suggest_open_profile')}</Link>
          </p>
        )}
        {complete && (
          <>
            <p className="mt-1 text-[0.76rem]" style={muted}>
              {t('nutr_suggest_basis', { weight: complete.weightKg, height: complete.heightCm, age })}
            </p>
            <p className="mt-3" style={label} id="nutr-activity-label">{t('nutr_activity')}</p>
            <div role="radiogroup" aria-labelledby="nutr-activity-label" className="mt-1.5 grid grid-cols-2 gap-1.5">
              {(['sedentary', 'light', 'moderate', 'high'] as const).map(a => (
                <button key={a} type="button" role="radio" aria-checked={activity === a} onClick={() => setActivity(a)}
                  className={PRESSABLE} style={chip(activity === a)}>{t(`nutr_act_${a}`)}</button>
              ))}
            </div>
            <p className="mt-3" style={label} id="nutr-goalkind-label">{t('nutr_goal')}</p>
            <div role="radiogroup" aria-labelledby="nutr-goalkind-label" className="mt-1.5 grid grid-cols-3 gap-1.5">
              {(['lose', 'maintain', 'gain'] as const).map(g => (
                <button key={g} type="button" role="radio" aria-checked={goal === g} onClick={() => setGoal(g)}
                  className={PRESSABLE} style={chip(goal === g)}>{t(`nutr_goal_${g}`)}</button>
              ))}
            </div>
            <button type="button" onClick={applySuggestion} className={`btn-secondary mt-3 w-full ${PRESSABLE}`}>{t('nutr_suggest_apply')}</button>
          </>
        )}
        <p className="mt-2.5 text-[0.72rem] leading-relaxed" style={muted}>{t('nutr_suggest_note')}</p>
      </section>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {KEYS.map(k => (
          <div key={k} className={k === 'kcal' ? 'col-span-2' : ''}>
            <label htmlFor={`nutr-g-${k}`} style={label}>{t(LABEL[k])}</label>
            <input id={`nutr-g-${k}`} inputMode="numeric" enterKeyHint="next" value={v[k]} onChange={e => setV({ ...v, [k]: e.target.value })}
              aria-invalid={!ok(k)} className="mt-1"
              style={{ ...input, border: ok(k) ? input.border : '1px solid var(--cat-rose)' }} />
          </div>
        ))}
      </div>
      {!valid && (
        <p role="alert" className="mt-2 text-[0.76rem]" style={{ color: 'var(--cat-rose)' }}>
          {t('nutr_goals_invalid', { min: GOAL_LIMITS.kcal[0], max: GOAL_LIMITS.kcal[1] })}
        </p>
      )}

      <label className="mt-4 flex min-h-11 cursor-pointer items-start gap-3 rounded-xl p-2" style={{ border: '1px solid var(--border)' }}>
        <input type="checkbox" checked={hideKcal} onChange={e => setHideKcal(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[var(--accent)]" />
        <span>
          <span className="block text-[0.88rem] font-bold" style={{ color: 'var(--text)' }}>{t('nutr_hide_kcal')}</span>
          <span className="block text-[0.74rem]" style={muted}>{t('nutr_hide_kcal_hint')}</span>
        </span>
      </label>

      <div className="mt-5 flex gap-2">
        <button type="button" className="btn-secondary flex-1" disabled={busy} onClick={onClose}>{t('cancel')}</button>
        <button type="button" className="btn-primary flex-1" disabled={!valid || busy}
          onClick={() => onSave({ ...nums, hideKcal })}>{t('nutr_save')}</button>
      </div>
    </Sheet>
  )
}
