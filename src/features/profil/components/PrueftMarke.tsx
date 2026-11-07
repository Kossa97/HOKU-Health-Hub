import { useTranslation } from 'react-i18next'
import type { MediaKind } from '../services/profileMedia'

/** Kleine Marke „wird geprüft“ am eigenen Bild (Bild-Check läuft oder steht aus). */
export function PrueftMarke({ kind, className = '' }: { kind: MediaKind; className?: string }) {
  const { t } = useTranslation()
  return (
    <span
      className={`whitespace-nowrap rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white ${className}`}
      data-media-pending={kind}
    >
      {t('profil_bild_wird_geprueft')}
    </span>
  )
}
