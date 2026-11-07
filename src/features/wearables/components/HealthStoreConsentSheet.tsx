import { useState } from 'react'
import { createPortal } from 'react-dom'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../../context/AuthContext'
import { requestPermissions } from '../../../lib/health'
import { Sheet } from '../../compliance/components/Sheet'
import { syncHealthDaily } from '../hooks/useHealthDailySync'
import { setHealthStoreConsent } from '../services/healthStore'

type Note = 'health_consent_unavailable' | 'health_consent_denied' | 'health_error'

const POINTS = ['health_consent_point_what', 'health_consent_point_who', 'health_consent_point_never', 'health_consent_point_delete'] as const

/**
 * Fragt die Einwilligung in die Speicherung von Daten aus Apple Health /
 * Health Connect. „Zustimmen" fragt erst das System nach den Leseberechtigungen
 * und speichert die Einwilligung nur, wenn das geklappt hat. `onDone(true)`
 * nach gespeicherter Einwilligung, `onDone(false)` bei „Nicht jetzt".
 */
export function HealthStoreConsentSheet({ open, onDone }: { open: boolean; onDone: (granted: boolean) => void }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<Note | null>(null)
  if (!open || !user) return null
  const userId = user.id
  const close = (granted: boolean) => { setNote(null); onDone(granted) }

  const accept = async () => {
    setBusy(true)
    setNote(null)
    try {
      const result = await requestPermissions()
      if (!result.available) { setNote('health_consent_unavailable'); return }
      if (!result.granted && !result.grantedPermissions?.length) { setNote('health_consent_denied'); return }
      await setHealthStoreConsent(userId, true)
      toast.success(t('health_consent_saved'))
      // Erster Abgleich gleich jetzt, nicht erst beim naechsten App-Start.
      syncHealthDaily(userId, { force: true }).catch(() => {})
      close(true)
    } catch {
      setNote('health_error')
    } finally {
      setBusy(false)
    }
  }

  // Ueber den Trainings-Sheets (z-index 90), daher eigene Ebene am Body.
  return createPortal(
    <div style={{ position: 'relative', zIndex: 100 }}>
      <Sheet labelledBy="health-consent-title" busy={busy} onClose={() => close(false)} tall data-health-consent>
        <h2 id="health-consent-title" className="lg-title2">{t('health_consent_title')}</h2>
        <p className="mt-3 text-[15px] leading-snug text-[var(--lg-text-2)]">{t('health_consent_intro')}</p>
        <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-[15px] leading-snug text-[var(--lg-text-2)]">
          {POINTS.map(key => <li key={key}>{t(key)}</li>)}
        </ul>
        {note && <p role="alert" className="mt-3 text-[15px] leading-snug text-[var(--lg-text)]">{t(note)}</p>}
        <div className="mt-4 flex flex-col gap-2">
          <button type="button" className="lg-btn lg-btn-primary w-full" disabled={busy} onClick={() => void accept()}>
            {t('health_consent_accept')}
          </button>
          <button type="button" className="lg-gray-btn w-full" disabled={busy} onClick={() => close(false)}>
            {t('health_consent_decline')}
          </button>
        </div>
      </Sheet>
    </div>,
    document.body,
  )
}
