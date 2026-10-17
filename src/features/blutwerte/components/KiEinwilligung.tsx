import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { ScanLine } from 'lucide-react'
import { useKiEinwilligung } from './useKiEinwilligung'

/**
 * Was beim Import passiert, und die ausdrueckliche Einwilligung dazu.
 * Steht im Import-Sheet an der Stelle der Datei-Knoepfe.
 */
export function KiEinwilligung({ onErteilt, onAbbrechen }: { onErteilt: () => Promise<void>; onAbbrechen: () => void }) {
  const { t } = useTranslation()
  const [haken, setHaken] = useState(false)
  const [busy, setBusy] = useState(false)

  const erteilen = async () => {
    if (!haken) return
    setBusy(true)
    try {
      await onErteilt()
      toast.success(t('ai_consent_saved'))
    } catch {
      toast.error(t('error'))
    } finally {
      setBusy(false)
    }
  }

  const punkte = ['ai_consent_point_purpose', 'ai_consent_point_redact', 'ai_consent_point_check', 'ai_consent_point_alternative']
  return (
    <div data-ai-consent className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="lg-icon-tile mt-0.5 !h-9 !w-9" style={{ background: '#0a84ff' }}>
          <ScanLine size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 id="ai-consent-title" className="text-[17px] font-semibold text-[var(--lg-text)]">{t('ai_consent_title')}</h3>
          <p className="mt-0.5 text-[15px] leading-snug text-[var(--lg-text-2)]">{t('ai_consent_intro')}</p>
        </div>
      </div>
      <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[15px] leading-snug text-[var(--lg-text-2)]">
        {punkte.map(key => <li key={key}>{t(key)}</li>)}
      </ul>
      <label className="flex cursor-pointer items-start gap-3 rounded-[18px] bg-[var(--lg-surface-2)] p-3.5 text-[15px] leading-snug text-[var(--lg-text)]">
        <input
          type="checkbox"
          data-ai-consent-check
          checked={haken}
          onChange={event => setHaken(event.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-sky-500"
        />
        <span>{t('ai_consent_checkbox')}</span>
      </label>
      <div className="flex gap-3">
        <button type="button" className="btn-secondary flex-1" data-app-back-close onClick={onAbbrechen} disabled={busy}>
          {t('cancel')}
        </button>
        <button type="button" className="btn-primary flex-1" data-ai-consent-accept onClick={() => void erteilen()} disabled={!haken || busy}>
          {busy ? t('loading') : t('ai_consent_accept')}
        </button>
      </div>
    </div>
  )
}

/** Im Profil: Stand der Einwilligung und Widerruf. */
export function KiEinwilligungProfil() {
  const { t, i18n } = useTranslation()
  const { einwilligung, setze } = useKiEinwilligung()
  const [busy, setBusy] = useState(false)
  if (einwilligung === undefined) return null

  const widerrufen = async () => {
    setBusy(true)
    try {
      await setze(false)
      toast.success(t('ai_consent_withdrawn'))
    } catch {
      toast.error(t('error'))
    } finally {
      setBusy(false)
    }
  }

  const datum = einwilligung
    ? new Intl.DateTimeFormat(i18n.resolvedLanguage ?? i18n.language, { dateStyle: 'medium' }).format(new Date(einwilligung))
    : null
  return (
    <div className="card space-y-2" data-ai-consent-profile>
      <h2 className="flex items-center gap-2 font-semibold text-slate-300">
        <ScanLine size={15} className="text-slate-500" aria-hidden="true" /> {t('ai_consent_profile_title')}
      </h2>
      <p className="text-sm text-slate-400">{datum ? t('ai_consent_profile_on', { date: datum }) : t('ai_consent_profile_off')}</p>
      {datum && (
        <button type="button" data-ai-consent-withdraw disabled={busy} onClick={() => void widerrufen()} className="min-h-11 text-sm font-semibold text-red-300 disabled:opacity-50">
          {t('ai_consent_withdraw')}
        </button>
      )}
    </div>
  )
}
