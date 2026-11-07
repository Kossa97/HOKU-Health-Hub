import { useTranslation } from 'react-i18next'
import { useAuth } from '../../../context/AuthContext'
import { useBlockiert } from '../hooks/useBlockiert'

/** Blockierte Profile mit „Blockierung aufheben“ (zog aus AccountSection hierher). */
export function BlockiertListe() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { liste, entsperren } = useBlockiert(user?.id)

  return (
    <div className="card space-y-2" data-blocked-card>
      {liste === null ? (
        <div className="h-11 animate-pulse rounded-[12px] bg-[var(--lg-surface-2)]" aria-busy="true" />
      ) : liste.length === 0 ? (
        <p className="text-[15px] text-[var(--lg-text-2)]">{t('blocked_list_empty')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--lg-separator)]" data-blocked-list>
          {liste.map(eintrag => (
            <li key={eintrag.username} className="flex min-h-11 items-center justify-between gap-3">
              <span className="min-w-0 truncate text-[16px] text-[var(--lg-text)]">@{eintrag.username}</span>
              <button type="button" data-unblock={eintrag.username} onClick={() => void entsperren(eintrag.username)} className="min-h-11 shrink-0 px-2 text-[15px] font-semibold text-[var(--lg-accent-text)]">
                {t('unblock_action')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
