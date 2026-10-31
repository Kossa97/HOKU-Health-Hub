import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { Ban, Trash2 } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../context/AuthContext'
import { loescheKonto, type AccountClient } from '../services/account'
import { LegalLinks } from './LegalLinks'
import { Sheet } from './Sheet'

/**
 * Unten im Profil: blockierte Profile, Rechtstexte und „Konto loeschen".
 * Das Loeschen verlangt das Eintippen eines Worts — ein versehentlicher
 * Tipp loescht nichts.
 */
export function AccountSection() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [blockiert, setBlockiert] = useState<{ username: string }[] | null>(null)
  const [neuLaden, setNeuLaden] = useState(0)
  const [loeschen, setLoeschen] = useState(false)
  const [eingabe, setEingabe] = useState('')
  const [busy, setBusy] = useState(false)
  const wort = t('account_delete_word')

  useEffect(() => {
    if (!user) return
    let aktuell = true
    void supabase.rpc('my_blocked_profiles').then(({ data, error }) => {
      if (aktuell) setBlockiert(error ? [] : (data as { username: string }[] | null) ?? [])
    })
    return () => { aktuell = false }
  }, [user, neuLaden])

  const entblocken = async (username: string) => {
    const { error } = await supabase.rpc('set_profile_block', { p_username: username, p_blocked: false })
    if (error) return toast.error(t('error'))
    toast.success(t('unblock_done'))
    setNeuLaden(n => n + 1)
  }

  const kontoLoeschen = async () => {
    if (!user || eingabe.trim().toUpperCase() !== wort.toUpperCase()) return
    setBusy(true)
    try {
      await loescheKonto(supabase as unknown as AccountClient, user.id)
      toast.success(t('account_deleted'))
    } catch {
      setBusy(false)
      toast.error(t('account_delete_error'))
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-4" data-account-section>
      <div className="card space-y-2">
        <h2 className="flex items-center gap-2 text-[17px] font-medium text-[var(--lg-text)]">
          <Ban size={16} className="text-[var(--lg-text-3)]" aria-hidden="true" /> {t('blocked_list_title')}
        </h2>
        {blockiert === null ? null : blockiert.length === 0 ? (
          <p className="text-[15px] text-[var(--lg-text-2)]">{t('blocked_list_empty')}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--lg-separator)]" data-blocked-list>
            {blockiert.map(eintrag => (
              <li key={eintrag.username} className="flex min-h-11 items-center justify-between gap-3">
                <span className="min-w-0 truncate text-[16px] text-[var(--lg-text)]">@{eintrag.username}</span>
                <button type="button" data-unblock={eintrag.username} onClick={() => void entblocken(eintrag.username)} className="min-h-11 shrink-0 px-2 text-[15px] font-semibold text-[var(--lg-accent-text)]">
                  {t('unblock_action')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        data-account-delete-open
        onClick={() => { setEingabe(''); setLoeschen(true) }}
        data-tone="bad"
        className="lg-gray-btn w-full !min-h-12"
      >
        <Trash2 size={15} aria-hidden="true" /> {t('account_delete_title')}
      </button>

      <LegalLinks className="pb-2" />

      {loeschen && (
        <Sheet labelledBy="account-delete-title" busy={busy} onClose={() => setLoeschen(false)} role="alertdialog" data-account-delete-sheet>
          <form onSubmit={event => { event.preventDefault(); void kontoLoeschen() }}>
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--lg-bad)_18%,transparent)] text-[var(--lg-bad-text)]">
                <Trash2 size={18} aria-hidden="true" />
              </span>
              <h2 id="account-delete-title" className="lg-title2 pt-2">{t('account_delete_title')}</h2>
            </div>
            <p className="mt-3 text-[15px] leading-snug text-[var(--lg-text-2)]">{t('account_delete_desc')}</p>
            <label htmlFor="account-delete-confirm" className="mt-4 block text-[13px] font-medium text-[var(--lg-text-2)]">
              {t('account_delete_confirm_label', { word: wort })}
            </label>
            <input
              id="account-delete-confirm"
              data-account-delete-input
              value={eingabe}
              onChange={event => setEingabe(event.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              className="input mt-1 w-full"
            />
            <div className="mt-5 flex gap-2">
              <button type="button" autoFocus data-app-back-close disabled={busy} onClick={() => setLoeschen(false)} data-quiet className="lg-gray-btn flex-1 !min-h-12 !text-[17px]">
                {t('cancel')}
              </button>
              <button
                type="submit"
                data-account-delete-confirm
                disabled={busy || eingabe.trim().toUpperCase() !== wort.toUpperCase()}
                data-tone="bad"
                className="lg-gray-btn flex-1 !min-h-12 !text-[17px]"
              >
                {busy ? t('account_deleting') : t('account_delete_action')}
              </button>
            </div>
          </form>
        </Sheet>
      )}
    </div>
  )
}
