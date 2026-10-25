import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { SlidersHorizontal } from 'lucide-react'
import { DoseUnitControl } from '../components/DoseUnitControl'
import { type Cycle, type EscalationForm, UNITS, withEffectiveEscalationUnit } from './model'

/**
 * Dosisanpassung anlegen oder bearbeiten (Titrationsschritt oder neue Standarddosis).
 */
export function EscalationFormSheet({
  showEscForm,
  eForm,
  setShowEscForm,
  editingEscId,
  escForCycle,
  setEForm,
  saveEsc,
  savingEsc,
}: {
  showEscForm: boolean
  eForm: EscalationForm | null
  setShowEscForm: Dispatch<SetStateAction<boolean>>
  editingEscId: string | null
  escForCycle: Cycle | null
  setEForm: Dispatch<SetStateAction<EscalationForm | null>>
  saveEsc: () => Promise<string | undefined>
  savingEsc: boolean
}) {
  const { t } = useTranslation()
  return (
    <>
      {showEscForm && eForm && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center" data-app-modal data-app-back-dirty-on-interaction
          onClick={() => setShowEscForm(false)}>
          <div className="bg-slate-900 rounded-t-2xl w-full max-w-lg p-6 pb-8 space-y-4 overflow-y-auto max-h-[90vh]"
            onClick={e => e.stopPropagation()}>

            <div>
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={18} className="text-orange-400" />
                <h2 className="text-lg font-bold">
                  {editingEscId ? t('esc_bearbeiten') : t('dose_plan_add_titration', { defaultValue: 'Titrationsschritt hinzufügen' })}
                </h2>
              </div>
              {escForCycle && <p className="text-slate-400 text-sm mt-0.5 ml-6">{escForCycle.name}</p>}
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                {t('dose_plan_titration_disclaimer', {
                  defaultValue: 'Die App dokumentiert deinen Titrationsplan; sie empfiehlt weder eine Dosis noch eine Titration.',
                })}
              </p>
            </div>

            <div className="space-y-4">
            <div>
              <label className="label">Absolute Zieldosis</label>
              <div className="flex gap-2">
                <input className="input flex-1" type="number"
                  value={eForm.increase_amount}
                  onChange={e => setEForm(f => f ? { ...f, increase_amount: e.target.value } : f)} />
                <DoseUnitControl
                  label={t('einheit_label')}
                  unit={eForm.unit}
                  units={UNITS}
                  locked
                  className="w-28"
                  onChange={() => undefined}
                />
              </div>
            </div>

            <div>
              <label className="label">{t('ab_wann_label')}</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: 'date',        labelKey: 'festes_datum' },
                  { value: 'after_days',  labelKey: 'nach_x_tagen' },
                  { value: 'after_weeks', labelKey: 'nach_x_wochen' },
                ] as const).map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => setEForm(f => {
                      if (!f || !escForCycle) return f
                      return withEffectiveEscalationUnit(escForCycle, { ...f, start_type: opt.value })
                    })}
                    className={`py-2.5 rounded-xl text-xs font-medium transition-colors ${
                      eForm.start_type === opt.value ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}>
                    {t(opt.labelKey)}
                  </button>
                ))}
              </div>
            </div>

            {eForm.start_type === 'date' && (
              <div>
                <label className="label">{t('datum_label')}</label>
                <input className="input" type="date" value={eForm.start_date}
                  onChange={e => setEForm(f => {
                    if (!f || !escForCycle) return f
                    return withEffectiveEscalationUnit(escForCycle, { ...f, start_date: e.target.value })
                  })} />
              </div>
            )}
            {eForm.start_type === 'after_days' && (
              <div>
                <label className="label">{t('tage_nach_start')}</label>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 text-sm shrink-0">{t('nach_prefix')}</span>
                  <input className="input w-24" type="number" min="1"
                    value={eForm.start_after_days}
                    onChange={e => setEForm(f => {
                      if (!f || !escForCycle) return f
                      return withEffectiveEscalationUnit(escForCycle, { ...f, start_after_days: e.target.value })
                    })} />
                  <span className="text-slate-400 text-sm shrink-0">{t('tagen_suffix')}</span>
                </div>
              </div>
            )}
            {eForm.start_type === 'after_weeks' && (
              <div>
                <label className="label">{t('wochen_nach_start')}</label>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 text-sm shrink-0">{t('nach_prefix')}</span>
                  <input className="input w-24" type="number" min="1"
                    value={eForm.start_after_days}
                    onChange={e => setEForm(f => {
                      if (!f || !escForCycle) return f
                      return withEffectiveEscalationUnit(escForCycle, { ...f, start_after_days: e.target.value })
                    })} />
                  <span className="text-slate-400 text-sm shrink-0">{t('wochen_suffix')}</span>
                </div>
              </div>
            )}

            <div>
              <label className="label">{t('notizen_optional')}</label>
              <textarea className="input resize-none" rows={2}
                placeholder={t('esc_notes_placeholder')}
                value={eForm.notes}
                onChange={e => setEForm(f => f ? { ...f, notes: e.target.value } : f)} />
            </div>

            </div>{/* /esc-core */}

            <div className="flex gap-3 pt-2">
              <button className="btn-secondary flex-1" data-app-back-close onClick={() => setShowEscForm(false)}>{t('cancel')}</button>
              <button className="btn-primary flex-1" onClick={saveEsc} disabled={savingEsc}>
                {savingEsc ? t('loading') : t('save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
