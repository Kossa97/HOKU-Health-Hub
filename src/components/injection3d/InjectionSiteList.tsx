// src/components/injection3d/InjectionSiteList.tsx
//
// Listenansicht der Injektionskarte (Schalter oben rechts): dieselben Stellen
// wie per Long-Press, als Knoepfe im Vollbild -- bedienbar mit Tastatur,
// Screenreader und ohne Feinmotorik. Rechts bleibt eine Spur frei fuer den
// Schalter, der ueber der Liste stehen bleibt.
import { useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { INJECTION_SITE_PRESETS, injectionSitePresetKey, type InjectionSitePreset } from '../../lib/injectionSitePresets'

const REGION_ORDER = ['abdomen', 'thigh', 'glute', 'deltoid', 'upper_arm'] as const

const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1)

export function InjectionSiteList({
  onSelect,
  onClose,
}: {
  onSelect: (preset: InjectionSitePreset) => void
  /** Zurueck zum Torso (Pfeil, Escape, Zurueck-Wischen). */
  onClose: () => void
}) {
  const { t } = useTranslation()

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const regionLabel = (region: string) => String(t(`injection_region_${region}`))
  const sideLabel = (side: string) => String(t(`injection_side_${side}`))

  return (
    <section
      data-app-modal
      aria-labelledby="injection-site-list-title"
      aria-describedby="injection-site-list-hint"
      className="injection-site-list lg-backdrop absolute inset-0 z-[26] overflow-y-auto overscroll-contain"
      style={{
        paddingTop: 'calc(16px + env(safe-area-inset-top))',
        paddingBottom: 'calc(24px + env(safe-area-inset-bottom))',
      }}
    >
      {/* Kopf an derselben Stelle wie der Kopf der Karte */}
      <div className="flex items-center gap-3 px-[14px]">
        <button
          type="button"
          onClick={onClose}
          data-app-back-close
          aria-label={String(t('injection_view_torso', { defaultValue: 'Torso-Ansicht' }))}
          className="lg-glass lg-icon-btn lg-press shrink-0"
        >
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-[var(--lg-text-2)]">
            {t('injection_pro_title', { defaultValue: 'Injektionstracker Pro' })}
          </p>
          <h2 id="injection-site-list-title" className="text-balance text-[28px] font-bold leading-[32px] tracking-[0.013em] text-[var(--lg-text)]">
            {t('injection_pick_site_title', { defaultValue: 'Injektionsstelle wählen' })}
          </h2>
        </div>
      </div>

      <div className="pl-4 pr-[76px] pt-4">
        <p id="injection-site-list-hint" className="mb-5 text-[15px] leading-5 text-[var(--lg-text-2)]">
          {t('injection_pick_site_hint', { defaultValue: 'Ohne 3D-Modell: Stelle wählen, sie wird auf der Karte markiert. Danach „Position übernehmen“.' })}
        </p>
        <div className="space-y-4">
          {REGION_ORDER.map(region => {
            const presets = INJECTION_SITE_PRESETS.filter(preset => preset.region === region)
            if (presets.length === 0) return null
            return (
              <fieldset key={region} className="min-w-0">
                <legend className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-[0.02em] text-[var(--lg-text-3)]">
                  {regionLabel(region)}
                </legend>
                <div className="grid grid-cols-2 gap-2">
                  {presets.map(preset => (
                    <button
                      key={injectionSitePresetKey(preset)}
                      type="button"
                      onClick={() => onSelect(preset)}
                      aria-label={String(t('injection_site_option', {
                        region: regionLabel(region),
                        side: sideLabel(preset.side),
                        defaultValue: '{{region}} {{side}}',
                      }))}
                      className="lg-gray-btn !min-h-12 !rounded-2xl !px-3 !text-[16px]" data-quiet
                    >
                      {capitalize(sideLabel(preset.side))}
                    </button>
                  ))}
                </div>
              </fieldset>
            )
          })}
        </div>
      </div>
    </section>
  )
}
