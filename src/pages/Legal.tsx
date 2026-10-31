import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import { LegalDocument } from '../features/compliance/components/LegalDocument'
import { LegalLinks } from '../features/compliance/components/LegalLinks'
import { LEGAL_PATHS, type LegalPageKey } from '../features/compliance/legal/texts'

/**
 * /datenschutz, /impressum, /nutzungsbedingungen — oeffentlich, ohne
 * Anmeldung erreichbar: die Stores verlangen eine Datenschutz-URL, die
 * jeder oeffnen kann.
 */
export function Legal() {
  const { pathname, hash } = useLocation()
  const page = (Object.keys(LEGAL_PATHS) as LegalPageKey[]).find(key => LEGAL_PATHS[key] === pathname) ?? 'datenschutz'
  const { t } = useTranslation()
  const navigate = useNavigate()
  // Sprungmarke wie /datenschutz#gesundheitsdaten (Android: Health-Connect-Erklaerung)
  useEffect(() => {
    if (!hash) return
    let id = hash.slice(1)
    try { id = decodeURIComponent(id) } catch { /* kaputte Kodierung wie #%: Rohwert nehmen */ }
    document.getElementById(id)?.scrollIntoView()
  }, [hash])
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-2xl px-4 pb-12 pt-[calc(1rem+env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
          className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm text-slate-400"
        >
          <ArrowLeft size={16} aria-hidden="true" /> {t('back')}
        </button>
        <LegalDocument page={page} />
        <LegalLinks className="mt-10" />
      </div>
    </div>
  )
}
