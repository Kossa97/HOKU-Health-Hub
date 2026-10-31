// src/components/injection3d/InjectionSitePickerSheet.tsx
//
// „Stelle aus Liste waehlen“: derselbe Pin wie per Long-Press, nur ueber
// Knoepfe -- bedienbar mit Tastatur, Screenreader und ohne Feinmotorik.
import { useEffect } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { INJECTION_SITE_PRESETS, injectionSitePresetKey, type InjectionSitePreset } from '../../lib/injectionSitePresets'
import { SheetGriff } from '../ui/SheetGriff'

const REGION_ORDER = ['abdomen', 'thigh', 'glute', 'deltoid', 'upper_arm'] as const

export function InjectionSitePickerSheet({
  onSelect,
  onClose,
}: {
  onSelect: (preset: InjectionSitePreset) => void
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
    <>
      <div className="fixed inset-0 z-50 bg-black/70" onClick={onClose} />
      <div
        data-app-modal
        role="dialog"
        aria-modal="true"
        aria-labelledby="injection-site-picker-title"
        aria-describedby="injection-site-picker-hint"
        className="lg-sheet fixed inset-x-2 bottom-2 z-[60] max-h-[85dvh] overflow-y-auto overscroll-contain px-4 pt-2"
        style={{
          paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <SheetGriff className="mb-3" onClose={onClose} />
        <div className="mb-2 flex items-start justify-between gap-3">
          <h2 id="injection-site-picker-title" className="lg-title2">
            {t('injection_pick_site_title', { defaultValue: 'Injektionsstelle wählen' })}
          </h2>
          <button
            type="button"
            autoFocus
            aria-label={String(t('close', { defaultValue: 'Schließen' }))}
            onClick={onClose}
            data-app-back-close
            className="lg-icon-btn lg-press shrink-0 bg-[var(--lg-fill)] !text-[var(--lg-text-2)]"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <p id="injection-site-picker-hint" className="mb-4 text-[15px] leading-5 text-[var(--lg-text-2)]">
          {t('injection_pick_site_hint', { defaultValue: 'Ohne 3D-Modell: Stelle wählen, sie wird auf der Karte markiert. Danach „Position übernehmen“.' })}
        </p>
        <div className="space-y-3">
          {REGION_ORDER.map(region => {
            const presets = INJECTION_SITE_PRESETS.filter(preset => preset.region === region)
            if (presets.length === 0) return null
            return (
              <fieldset key={region} className="min-w-0">
                <legend className="mb-2 px-1 text-[13px] font-medium text-[var(--lg-text-3)]">
                  {regionLabel(region)}
                </legend>
                <div className="grid grid-cols-2 gap-2">
                  {presets.map(preset => (
                    <button
                      key={injectionSitePresetKey(preset)}
                      type="button"
                      onClick={() => onSelect(preset)}
                      className="lg-gray-btn !min-h-11 !rounded-xl !px-3 !text-[15px]" data-quiet
                    >
                      {t('injection_site_option', {
                        region: regionLabel(region),
                        side: sideLabel(preset.side),
                        defaultValue: '{{region}} {{side}}',
                      })}
                    </button>
                  ))}
                </div>
              </fieldset>
            )
          })}
        </div>
      </div>
    </>
  )
}
