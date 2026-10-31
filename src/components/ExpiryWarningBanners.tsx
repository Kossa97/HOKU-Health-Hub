import { useMemo, useState } from 'react'
import { AlertTriangle, X, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import type { PeptideExpiryAlert } from '../lib/peptideExpiry'

function alertMessage(alert: PeptideExpiryAlert, t: (key: string, opts?: Record<string, unknown>) => string) {
  if (alert.status === 'expired') {
    return t('expiry_banner_expired', { name: alert.name, defaultValue: `${alert.name} ist abgelaufen – bitte neu rekonstitutieren` })
  }
  if (alert.daysLeft === 0) {
    return t('expiry_banner_today', { name: alert.name, defaultValue: `${alert.name} läuft heute ab – jetzt neu rekonstitutieren` })
  }
  return t('expiry_banner_soon', {
    name: alert.name,
    days: alert.daysLeft,
    defaultValue: `${alert.name} läuft in ${alert.daysLeft} Tagen ab – jetzt neu rekonstitutieren`,
  })
}

function AlertIcon({ status }: { status: PeptideExpiryAlert['status'] }) {
  if (status === 'expired') return <XCircle size={16} strokeWidth={1.5} />
  return <AlertTriangle size={16} strokeWidth={1.5} />
}

export function ExpiryWarningBanners({ alerts }: { alerts: PeptideExpiryAlert[] }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set())

  const visible = useMemo(
    () => alerts.filter(alert => !dismissed.has(alert.id)),
    [alerts, dismissed],
  )

  if (visible.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {visible.map(alert => (
        <div
          key={alert.id}
          role="alert"
          className={`expiry-banner expiry-banner--${alert.status}`}
        >
          <span className="expiry-banner__icon">
            <AlertIcon status={alert.status} />
          </span>
          <button
            type="button"
            className="expiry-banner__message"
            onClick={() => navigate('/my-stack')}
          >
            {alertMessage(alert, t)}
          </button>
          <button
            type="button"
            className="expiry-banner__dismiss"
            onClick={() => setDismissed(prev => new Set(prev).add(alert.id))}
            aria-label={String(t('close'))}
          >
            <X size={14} strokeWidth={1.5} />
          </button>
        </div>
      ))}
    </div>
  )
}
