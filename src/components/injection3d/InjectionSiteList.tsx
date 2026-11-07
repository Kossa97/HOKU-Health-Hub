// src/components/injection3d/InjectionSiteList.tsx
//
// Listenansicht des Injektionstrackers (Schalter oben rechts) -- fuer alle,
// die keinen Torso wollen. Jede Stelle zeigt in den Farben der Pins, wie lange
// sie her ist; Antippen oeffnet das Speicher-Sheet direkt, der Eintrag landet
// ohne Pin im gemeinsamen Verlauf. Darunter der Verlauf beider Ansichten.
// Rechts bleibt eine Spur frei fuer den Schalter, der ueber der Liste steht.
import { useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { INJECTION_SITE_PRESETS, injectionSitePresetKey, type InjectionSitePreset } from '../../lib/injectionSitePresets'
import { lastInjectionAtSite } from '../../lib/injectionListEntry'
import { getInjectionPinAgeColor, getInjectionPinAgeDays } from '../../lib/injectionPinPresentation'
import type { InjectionHistoryDays } from '../../lib/injectionHistory'
import type { InjectionLog3D } from '../../lib/injectionLogTypes'
import { HistoryDaysSelect, InjectionHistorySheet } from './InjectionHistorySheet'

const REGION_ORDER = ['abdomen', 'thigh', 'glute', 'deltoid', 'upper_arm'] as const
const NIE_FARBE = 'var(--lg-text-3)'
const KEINE_PINS = new Set<string>()

const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1)

export function InjectionSiteList({
  logs,
  historyDays,
  onHistoryDaysChange,
  onSelect,
  onEditLog,
  onClose,
}: {
  logs: InjectionLog3D[]
  historyDays: InjectionHistoryDays
  onHistoryDaysChange: (days: InjectionHistoryDays) => void
  /** Stelle angetippt: Speicher-Sheet oeffnen. */
  onSelect: (preset: InjectionSitePreset) => void
  onEditLog: (log: InjectionLog3D) => void
  /** Zurueck zum Torso (Pfeil, Escape, Zurueck-Wischen). */
  onClose: () => void
}) {
  const { t } = useTranslation()

  useEffect(() => {
    // Liegt ein Fenster darueber (Speichern, Bearbeiten), schliesst Escape erst das
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || document.querySelector('[role="dialog"][aria-modal="true"]:not([aria-hidden="true"]):not([hidden])')) return
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const regionLabel = (region: string) => String(t(`injection_region_${region}`))
  const sideLabel = (side: string) => String(t(`injection_side_${side}`))
  const ageLabel = (log: InjectionLog3D | null) => {
    if (!log) return String(t('injection_list_never', { defaultValue: 'Noch nie' }))
    const days = getInjectionPinAgeDays(log.logged_at)
    if (days === 0) return String(t('injection_list_age_today', { defaultValue: 'Heute' }))
    if (days === 1) return String(t('injection_list_age_one', { defaultValue: 'Vor 1 Tag' }))
    return String(t('injection_list_age_days', { count: days, defaultValue: 'Vor {{count}} Tagen' }))
  }

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
            {t('injection_list_title', { defaultValue: 'Injektionsliste' })}
          </h2>
        </div>
      </div>

      <div className="pl-4 pr-[76px] pt-4">
        <p id="injection-site-list-hint" className="mb-5 text-[15px] leading-5 text-[var(--lg-text-2)]">
          {t('injection_list_hint', { defaultValue: 'Stelle antippen und Injektion eintragen. Die Farbe zeigt, wie lange sie her ist.' })}
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
                  {presets.map(preset => {
                    const last = lastInjectionAtSite(logs, preset)
                    const color = last ? getInjectionPinAgeColor(last.logged_at) : NIE_FARBE
                    const age = ageLabel(last)
                    const site = String(t('injection_site_option', {
                      region: regionLabel(region),
                      side: sideLabel(preset.side),
                      defaultValue: '{{region}} {{side}}',
                    }))
                    return (
                      <button
                        key={injectionSitePresetKey(preset)}
                        type="button"
                        onClick={() => onSelect(preset)}
                        aria-label={`${site}, ${age}`}
                        className="lg-gray-btn !min-h-[60px] !flex-col !items-start !justify-center !gap-0.5 !rounded-2xl !px-3 !text-left" data-quiet
                      >
                        <span className="text-[16px] font-semibold">{capitalize(sideLabel(preset.side))}</span>
                        <span className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--lg-text-2)]">
                          <span
                            aria-hidden="true"
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ background: color, boxShadow: last ? `0 0 8px ${color}` : undefined }}
                          />
                          {age}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </fieldset>
            )
          })}
        </div>
      </div>

      {/* Verlauf beider Ansichten; Torso-Eintraege ohne Karten-Knoepfe */}
      <div className="pl-4 pr-[76px] pt-7">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-[20px] font-bold text-[var(--lg-text)]">
            {t('injection_list_history', { defaultValue: 'Verlauf' })}
          </h3>
          <HistoryDaysSelect historyDays={historyDays} onHistoryDaysChange={onHistoryDaysChange} />
        </div>
        <InjectionHistorySheet
          embedded
          ohneKarte
          logs={logs}
          historyDays={historyDays}
          visibleLogIds={KEINE_PINS}
          onHistoryDaysChange={onHistoryDaysChange}
          onToggleLog={() => {}}
          onFocusLog={() => {}}
          onEditLog={onEditLog}
        />
      </div>
    </section>
  )
}
