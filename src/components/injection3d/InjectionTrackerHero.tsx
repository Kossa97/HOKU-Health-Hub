import { useTranslation } from 'react-i18next'
import { ArrowUpRight, Rotate3D } from 'lucide-react'

// Karte auf der Startseite: führt in den 3D-Tracker. Das 3D-Modell selbst lädt erst der Tracker;
// auf der Startseite baute es sich beim Übergang nach der Anmeldung auf und ließ ihn stocken.
export function InjectionTrackerHero({ onOpen }: { onOpen: () => void }) {
  const { t } = useTranslation()

  return (
    <section
      aria-label={String(t('injection_pro_title', { defaultValue: '3D-Injektionstracker Pro' }))}
      // Inhalt auf durchscheinendem Glas wie jede Karte
      className="lg-surface overflow-hidden p-4"
    >

      <div className="min-w-0">
        <div className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: 'var(--lg-text-2)' }}>
          <Rotate3D size={14} aria-hidden="true" /> {t('injection_hero_kicker', { defaultValue: 'Pro Feature' })}
        </div>
        <h2 className="text-[20px] font-bold tracking-[0.019em] text-white">{t('injection_pro_title', { defaultValue: '3D-Injektionstracker Pro' })}</h2>
        <p className="mt-1 text-[15px] leading-snug" style={{ color: 'var(--lg-text-2)' }}>{t('injection_pro_subtitle', { defaultValue: 'Tracke deine Injektionen präzise und einfach auf einem 3D-Torso' })}</p>
      </div>

      <div className="relative mt-4">
        <button
          type="button"
          onClick={onOpen}
          aria-label={String(t('injection_hero_open', { defaultValue: '3D Tracker öffnen' }))}
          className="btn-primary flex min-h-11 w-full items-center justify-center gap-2"
        >
          {t('injection_hero_open', { defaultValue: '3D Tracker öffnen' })} <ArrowUpRight size={14} aria-hidden="true" />
        </button>
      </div>
    </section>
  )
}
