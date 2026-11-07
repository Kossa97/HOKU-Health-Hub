import { useEffect, useState } from 'react'
import { HeartPulse } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../../context/AuthContext'
import { useHealthStoreConsent } from '../hooks/useHealthStoreConsent'
import { countHealthDaily, deleteHealthDaily } from '../services/healthStore'

/**
 * Im Profil: Stand der Einwilligung in die Speicherung von Daten aus Apple
 * Health / Health Connect, Widerruf und Loeschen der gespeicherten Tageswerte.
 * Ohne Einwilligung und ohne gespeicherte Werte nichts.
 */
export function HealthStoreProfile() {
  const { user } = useAuth()
  return user ? <HealthStoreRow userId={user.id} /> : null
}

function HealthStoreRow({ userId }: { userId: string }) {
  const { t, i18n } = useTranslation()
  const { consent, error, set, reload } = useHealthStoreConsent(userId)
  // Auch nach einem Widerruf auf einem anderen Geraet sollen gespeicherte Werte loeschbar bleiben.
  const [stored, setStored] = useState<number | null>(null)
  const [countRound, setCountRound] = useState(0)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let current = true
    countHealthDaily(userId).then(n => { if (current) setStored(n) }).catch(() => {})
    return () => { current = false }
  }, [userId, countRound])

  if (error) {
    return (
      <div role="alert" className="card mt-3 flex items-center justify-between gap-3 text-[15px] text-[var(--lg-text)]" data-health-store-profile>
        {t('health_consent_load_error')}
        <button type="button" data-quiet className="lg-gray-btn shrink-0" onClick={reload}>{t('lab_retry')}</button>
      </div>
    )
  }
  if (consent === undefined || (!consent && !stored)) return null

  const revoke = async () => {
    setBusy(true)
    try {
      await set(false)
      setCountRound(n => n + 1)
      toast.success(t('health_profile_revoked'))
    } catch {
      toast.error(t('health_error'))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      // Erst widerrufen (immer, der lokale Stand kann veraltet sein): ab dann weist
      // die Datenbank jeden Schreibversuch eines laufenden Abgleichs ab.
      await set(false)
      await deleteHealthDaily(userId)
      setStored(0)
      setConfirming(false)
      toast.success(t('health_profile_deleted'))
    } catch {
      toast.error(t('health_error'))
    } finally {
      setBusy(false)
    }
  }

  const date = consent
    ? new Intl.DateTimeFormat(i18n.resolvedLanguage ?? i18n.language, { dateStyle: 'medium' }).format(new Date(consent))
    : null
  return (
    <div className="card mt-3 space-y-2" data-health-store-profile>
      <h2 className="flex items-center gap-2 text-[17px] font-semibold text-[var(--lg-text)]">
        <HeartPulse size={16} className="text-[var(--lg-text-3)]" aria-hidden="true" /> {t('health_profile_title')}
      </h2>
      <p className="text-[15px] leading-snug text-[var(--lg-text-2)]">
        {date ? t('health_profile_on', { date }) : t('health_profile_off')}
      </p>
      {confirming ? (
        <div role="alertdialog" aria-labelledby="health-delete-confirm" className="space-y-2">
          <p id="health-delete-confirm" className="text-[15px] leading-snug text-[var(--lg-text)]">{t('health_profile_delete_confirm')}</p>
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => void remove()} className="lg-gray-btn flex-1 !text-[var(--lg-bad-text)] disabled:opacity-50">
              {t('health_profile_delete_yes')}
            </button>
            <button type="button" disabled={busy} onClick={() => setConfirming(false)} className="lg-gray-btn flex-1 disabled:opacity-50">
              {t('cancel')}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-start">
          {consent && (
            <button type="button" disabled={busy} onClick={() => void revoke()} className="min-h-11 text-[15px] font-semibold text-[var(--lg-bad-text)] disabled:opacity-50">
              {t('health_profile_revoke')}
            </button>
          )}
          <button type="button" disabled={busy} onClick={() => setConfirming(true)} className="min-h-11 text-[15px] font-semibold text-[var(--lg-bad-text)] disabled:opacity-50">
            {t('health_profile_delete')}
          </button>
        </div>
      )}
    </div>
  )
}
