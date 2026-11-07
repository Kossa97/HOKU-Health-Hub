import { useTranslation } from 'react-i18next'
import { cycleVisibility, type ProfileField, type Visibility } from '../lib/profileVisibility'

/**
 * Stufe eines Profilwerts in der eigenen Ansicht: farbiger Punkt + Wort,
 * ganz klein in derselben Zeile wie die Beschriftung, ohne Kasten. Tippen
 * schaltet Nur ich → Freunde → Alle. „Freunde“ wird gespeichert, wirkt aber
 * erst mit der Freunde-Funktion — das sagen aria-label und title.
 */

const PUNKT: Record<Visibility, string> = {
  me: 'var(--lg-text-3)',
  friends: 'var(--lg-accent)',
  all: 'var(--lg-good)',
}

const WORT: Record<Visibility, string> = {
  me: 'var(--lg-text-3)',
  friends: 'var(--lg-accent-text)',
  all: 'var(--lg-good-text)',
}

export function SichtbarkeitsChip({ field, value, onChange, small = false, className = '' }: {
  field: ProfileField
  value: Visibility
  onChange: (field: ProfileField, next: Visibility) => void
  /** In schmalen Dreier-Kacheln eine Spur kleiner. */
  small?: boolean
  className?: string
}) {
  const { t } = useTranslation()
  const wort = t(`profil_stufe_${value}`)
  const hinweis = value === 'friends' ? ` — ${t('profil_stufe_freunde_hinweis')}` : ''
  const label = `${t('profil_sichtbarkeit_von', { feld: t(`profil_feld_${field}`) })}: ${wort}${hinweis}`
  return (
    <button
      type="button"
      data-vis-chip={field}
      data-vis={value}
      aria-label={label}
      title={label}
      onClick={event => { event.stopPropagation(); onChange(field, cycleVisibility(value)) }}
      // Unsichtbare Tippfläche um das kleine Wort: 44 px hoch, ohne die Zeile zu verschieben
      className={`relative inline-flex shrink-0 items-center gap-[3px] whitespace-nowrap align-middle font-medium leading-none before:absolute before:-inset-x-1.5 before:-inset-y-3 before:content-[''] ${small ? 'text-[9px]' : 'text-[11px]'} ${className}`}
      style={{ color: WORT[value] }}
    >
      <span aria-hidden="true" className="inline-block h-[5px] w-[5px] shrink-0 rounded-full" style={{ background: PUNKT[value] }} />
      {wort}
    </button>
  )
}
