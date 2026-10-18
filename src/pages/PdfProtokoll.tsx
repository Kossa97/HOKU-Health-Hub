import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format, subDays } from 'date-fns'
import { useAuth } from '../context/AuthContext'
import { ProtocolPdfModal } from '../components/ProtocolPdfModal'

function defaultRange() {
  const to = new Date()
  const from = subDays(to, 29)
  return {
    from: format(from, 'yyyy-MM-dd'),
    to: format(to, 'yyyy-MM-dd'),
  }
}

/** Vollseitiger PDF-Generator (Arzt / Coach / Forum) — ersetzt das alte Protokoll-Dashboard als Ziel von /protokoll. */
export function PdfProtokoll() {
  const { user } = useAuth()
  const { i18n } = useTranslation()
  const navigate = useNavigate()
  const range = useMemo(() => defaultRange(), [])

  if (!user) {
    return (
      <div className="lg-surface lg-flat px-5 py-10 text-center text-[15px] text-[var(--lg-text-2)]">
        Bitte anmelden, um ein PDF zu erstellen.
      </div>
    )
  }

  return (
    <ProtocolPdfModal
      userId={user.id}
      initialRange={range}
      uiLang={i18n.language}
      variant="page"
      onClose={() => navigate(-1)}
    />
  )
}
