// src/components/injection3d/InjectionViewSwitch.tsx
//
// Senkrechter Schalter oben rechts auf der Injektionskarte: Torso oder Liste.
// Eine Linse liegt unter dem gewaehlten Platz und gleitet beim Wechsel.
import type { CSSProperties, KeyboardEvent } from 'react'
import { List } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export type InjectionView = 'torso' | 'liste'

const VIEWS: readonly InjectionView[] = ['torso', 'liste']

/** Kopfloser Torso im Strich der Lucide-Symbole (24er-Raster, 2 px). */
function TorsoIcon({ size = 19 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Hals, Schultern, Armansatz */}
      <path d="M9.5 3v1.2a2 2 0 0 1-1.3 1.9L5.3 7.2A2 2 0 0 0 4 9.1V13" />
      <path d="M14.5 3v1.2a2 2 0 0 0 1.3 1.9l2.9 1.1A2 2 0 0 1 20 9.1V13" />
      {/* Flanken zur Taille, dann Huefte */}
      <path d="M7.6 10.5c.5 1.9.9 3.3.9 4.6 0 1.6-1 2.7-1 4.4V21h9v-1.5c0-1.7-1-2.8-1-4.4 0-1.3.4-2.7.9-4.6" />
    </svg>
  )
}

export function InjectionViewSwitch({
  value,
  onChange,
  style,
}: {
  value: InjectionView
  onChange: (view: InjectionView) => void
  style?: CSSProperties
}) {
  const { t } = useTranslation()
  const label = (view: InjectionView) => view === 'torso'
    ? String(t('injection_view_torso', { defaultValue: 'Torso-Ansicht' }))
    : String(t('injection_view_list', { defaultValue: 'Listenansicht' }))

  // Pfeiltasten wechseln wie in jeder Radiogruppe
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return
    event.preventDefault()
    const next = value === 'torso' ? 'liste' : 'torso'
    onChange(next)
    event.currentTarget.querySelector<HTMLButtonElement>(`[data-view="${next}"]`)?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label={String(t('injection_view_label', { defaultValue: 'Ansicht' }))}
      onKeyDown={onKeyDown}
      className="injection-view-switch lg-glass !absolute right-4 z-30"
      style={style}
    >
      <span
        aria-hidden="true"
        className="injection-view-switch-lens"
        style={{ transform: `translateY(${value === 'liste' ? 44 : 0}px)` }}
      />
      {VIEWS.map(view => (
        <button
          key={view}
          type="button"
          role="radio"
          data-view={view}
          aria-checked={value === view}
          aria-label={label(view)}
          title={label(view)}
          tabIndex={value === view ? 0 : -1}
          onClick={() => onChange(view)}
          className="injection-view-switch-btn"
        >
          {view === 'torso' ? <TorsoIcon /> : <List size={19} aria-hidden="true" />}
        </button>
      ))}
    </div>
  )
}
