import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { type Peptide } from './model'

/**
 * Rueckfrage vor dem erneuten Rekonstituieren (neues Vial anmischen).
 */
export function RekonstitutionDialog({
  rekonstitutionTarget,
  rekonstitutionDontAsk,
  setRekonstitutionDontAsk,
  setRekonstitutionTarget,
  confirmRekonstitution,
}: {
  rekonstitutionTarget: Peptide | null
  rekonstitutionDontAsk: boolean
  setRekonstitutionDontAsk: Dispatch<SetStateAction<boolean>>
  setRekonstitutionTarget: Dispatch<SetStateAction<Peptide | null>>
  confirmRekonstitution: () => void
}) {
  const { t } = useTranslation()
  return (
    <>
      {rekonstitutionTarget && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center px-4" data-app-modal>
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 max-w-sm w-full space-y-4">
            <h3 className="font-medium text-white text-lg">{t('rekonstitution_wdh_title')}</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              {t('rekonstitution_wdh_desc')}
            </p>
            <label className="flex items-center gap-2.5 text-sm text-slate-400 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded accent-sky-500"
                checked={rekonstitutionDontAsk}
                onChange={e => setRekonstitutionDontAsk(e.target.checked)} />
              {t('nicht_mehr_fragen')}
            </label>
            <div className="flex gap-3 pt-1">
              <button className="btn-secondary flex-1" data-app-back-close onClick={() => setRekonstitutionTarget(null)}>{t('no')}</button>
              <button onClick={confirmRekonstitution}
                className="flex-1 py-2.5 px-4 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-medium transition-colors text-sm">
                {t('yes')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
