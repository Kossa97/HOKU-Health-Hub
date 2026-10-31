import { useState } from 'react'
import { Camera } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../../context/AuthContext'
import { useFoodAiConsent } from '../hooks/useFoodAiConsent'

/** Im Profil: Stand der Einwilligung in die Foto-Erkennung und Widerruf. Ohne Einwilligung nichts. */
export function PhotoConsentProfile() {
  const { user } = useAuth()
  return user ? <PhotoConsentRow userId={user.id} /> : null
}

function PhotoConsentRow({ userId }: { userId: string }) {
  const { t, i18n } = useTranslation()
  const { consent, error, set, reload } = useFoodAiConsent(userId)
  const [busy, setBusy] = useState(false)
  // Ohne Ladefehler und ohne Einwilligung gibt es nichts zu widerrufen.
  if (error) {
    return (
      <div role="alert" className="card mt-3 flex items-center justify-between gap-3 text-[15px] text-[var(--lg-text)]" data-photo-consent-profile>
        {t('nutr_photo_consent_load_error')}
        <button type="button" data-quiet className="lg-gray-btn shrink-0" onClick={reload}>{t('lab_retry')}</button>
      </div>
    )
  }
  if (!consent) return null

  const revoke = async () => {
    setBusy(true)
    try { await set(false); toast.success(t('nutr_photo_consent_revoked')) } catch { toast.error(t('nutr_error')) } finally { setBusy(false) }
  }

  const date = new Intl.DateTimeFormat(i18n.resolvedLanguage ?? i18n.language, { dateStyle: 'medium' }).format(new Date(consent))
  return (
    <div className="card mt-3 space-y-2" data-photo-consent-profile>
      <h2 className="flex items-center gap-2 text-[17px] font-medium text-[var(--lg-text)]">
        <Camera size={16} strokeWidth={1.5} className="text-[var(--lg-text-3)]" aria-hidden="true" /> {t('nutr_photo_consent_profile_title')}
      </h2>
      <p className="text-[15px] leading-snug text-[var(--lg-text-2)]">{t('nutr_photo_consent_profile_on', { date })}</p>
      <button type="button" disabled={busy} onClick={() => void revoke()} className="min-h-11 text-[15px] font-medium text-[var(--lg-bad-text)] disabled:opacity-50">
        {t('nutr_photo_consent_revoke')}
      </button>
    </div>
  )
}
