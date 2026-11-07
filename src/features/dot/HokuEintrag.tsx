/** Profil: Zeile zur Seite „Hoku“ (Farbe, Bewegung, Hinweise; Nutzer 03.11.2026). */
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { DotZeichen } from './DotZeichen'
import { useDotText } from './texte'

export function HokuEintrag() {
  const { dt } = useDotText()
  return (
    <div className="mt-6">
      <Link to="/profil/hoku" data-profil-hoku className="flex min-h-[52px] items-center gap-3 rounded-[var(--r-xl)] bg-[var(--lg-surface-2)] px-4 py-2 transition-colors active:bg-white/[0.1]">
        <span className="lg-icon-tile" style={{ background: 'rgba(0, 204, 245, 0.16)' }}><DotZeichen groesse={20} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-medium text-[var(--lg-text)]">{dt('einst_titel')}</span>
          <span className="block text-[13px] text-[var(--lg-text-3)]">{dt('einst_zeile')}</span>
        </span>
        <ChevronRight size={18} aria-hidden="true" className="text-[var(--lg-text-3)]" />
      </Link>
    </div>
  )
}
