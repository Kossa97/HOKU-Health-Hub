import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronLeft } from 'lucide-react'

/** Kopfzeile der Profil-Unterseiten (Fortschritt, Abzeichen): Zurück + großer Titel. */
export function Leiste({ titel, zurueck = '/profil' }: { titel: string; zurueck?: string }) {
  const { t } = useTranslation()
  return (
    <div className="mb-4">
      <Link
        to={zurueck}
        className="lg-glass lg-btn lg-btn-glass lg-btn-compact mb-3 w-fit !gap-0.5 !pl-2.5 !pr-4"
        data-progress-back
      >
        <ChevronLeft size={22} strokeWidth={2.4} aria-hidden="true" />
        {t('back')}
      </Link>
      <h1 className="lg-large-title">{titel}</h1>
    </div>
  )
}
