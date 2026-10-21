import { useEffect, useId, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  Activity, Bike, Dumbbell, Flame, Footprints, Mountain, PersonStanding, Sparkles,
  Timer, Trophy, Waves, type LucideIcon,
} from 'lucide-react'
import type { SessionKind } from '../types'
import { useTrainingText } from '../i18n'
import { SheetClose } from '../../../components/ui/SheetClose'
import { SheetGriff } from '../../../components/ui/SheetGriff'

/**
 * Bausteine des Workout-Trackers im Liquid-Glass-Schwarz der App: Flächen
 * `lg-surface`, Knöpfe `lg-btn`/`lg-gray-btn`, Farben aus den `--lg-*`-Tokens.
 * Orange ist der Akzent des Trainings — sparsam: Kacheln, Ringe, Linien.
 */

export const TRAINING_ACCENT = '#ff9f0a'

/** iOS-Systemfarben je Art; `ink` ist die Symbolfarbe auf der Kachel. */
export const KIND_STYLE: Record<SessionKind, { icon: LucideIcon; color: string; ink?: string }> = {
  strength: { icon: Dumbbell, color: '#ff9f0a' },
  run: { icon: Footprints, color: '#30d158' },
  cycle: { icon: Bike, color: '#5e5ce6' },
  swim: { icon: Waves, color: '#0a84ff' },
  row: { icon: Waves, color: '#64d2ff', ink: '#002a3a' },
  walk: { icon: Footprints, color: '#32ade6' },
  hike: { icon: Mountain, color: '#a2845e' },
  hiit: { icon: Flame, color: '#ff453a' },
  hyrox: { icon: Timer, color: '#ffd60a', ink: '#3a2c00' },
  yoga: { icon: PersonStanding, color: '#bf5af2' },
  mobility: { icon: Sparkles, color: '#af52de' },
  sport: { icon: Trophy, color: '#ff375f' },
  other: { icon: Activity, color: '#8e8e93' },
}

/** Art als Icon-Kachel wie in den iOS-Einstellungen: volle Farbe, Symbol hell. */
export function KindBadge({ kind, size = 38 }: { kind: SessionKind; size?: number }) {
  const { icon: Icon, color, ink } = KIND_STYLE[kind]
  return (
    <span
      aria-hidden="true"
      className="lg-icon-tile"
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.27), background: color, color: ink ?? '#fff' }}
    >
      <Icon size={Math.round(size * 0.52)} />
    </span>
  )
}

export function Card({ children, style, onClick, as = 'div', ariaLabel }: {
  children: ReactNode
  style?: CSSProperties
  onClick?: () => void
  as?: 'div' | 'button' | 'section'
  ariaLabel?: string
}) {
  const Tag = onClick ? 'button' : as
  return (
    <Tag
      type={Tag === 'button' ? 'button' : undefined}
      onClick={onClick}
      aria-label={ariaLabel}
      className={`lg-surface lg-flat${onClick ? ' tyd-train-press' : ''}`}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: 16,
        color: 'var(--lg-text)',
        cursor: onClick ? 'pointer' : undefined,
        ...style,
      }}
    >
      {children}
    </Tag>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, margin: '14px 0 7px', minHeight: 24 }}>
      <h2 className="lg-group-title" style={{ margin: '0 16px' }}>
        {children}
      </h2>
      {action}
    </div>
  )
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'primary' | 'ghost' | 'danger'; block?: boolean }

/** Primär: die Hauptaktion der App (Cyan); sonst graue iOS-Knöpfe. */
export function Button({ tone = 'primary', block, style, className, children, ...rest }: ButtonProps) {
  const base = tone === 'primary' ? 'lg-btn lg-btn-primary' : 'lg-gray-btn'
  return (
    <button
      type="button"
      className={`${base}${className ? ` ${className}` : ''}`}
      data-quiet={tone === 'ghost' ? '' : undefined}
      data-tone={tone === 'danger' ? 'bad' : undefined}
      style={{
        minHeight: 44, padding: '0 18px', gap: 8,
        fontSize: 16, fontWeight: 600,
        display: block ? 'flex' : 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: block ? '100%' : undefined,
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  )
}

/** An/aus-Kapsel. Mit `color` ein Farbpunkt davor (z. B. die Art). */
export function Chip({ active, children, onClick, color, ariaLabel }: {
  active: boolean
  children: ReactNode
  onClick: () => void
  color?: string
  ariaLabel?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={ariaLabel}
      onClick={onClick}
      className="tyd-train-press"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        minHeight: 36, padding: '0 14px', borderRadius: 999, flexShrink: 0,
        fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', border: 0,
        // Gewählt wie ein iOS-Segment: fester grauer Stein, Schrift hell
        background: active ? 'var(--lg-fill-selected)' : 'var(--lg-fill)',
        boxShadow: active ? '0 3px 8px rgba(0,0,0,0.25)' : undefined,
        color: active ? 'var(--lg-text)' : 'var(--lg-text-2)',
        cursor: 'pointer',
      }}
    >
      {color && <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: color }} />}
      {children}
    </button>
  )
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 13, color: 'var(--lg-text-3)', fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--lg-text)', fontVariantNumeric: 'tabular-nums', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
      {sub && <div style={{ fontSize: 13, color: 'var(--lg-text-3)' }}>{sub}</div>}
    </div>
  )
}

/**
 * Beschriftetes Feld. Mit `group` fuer eine Reihe von Chips: dann eine
 * benannte Gruppe statt eines `<label>` — ein Label wuerde sonst nur den
 * ersten Chip beschriften und dessen Namen fuer Screenreader ueberschreiben.
 */
export function Field({ label, children, hint, group = false }: { label: string; children: ReactNode; hint?: ReactNode; group?: boolean }) {
  const labelId = useId()
  const caption = <span id={labelId} className="label" style={{ marginBottom: 0 }}>{label}</span>
  const note = hint && <span style={{ fontSize: 13, lineHeight: 1.35, color: 'var(--lg-text-3)', paddingInline: 4 }}>{hint}</span>
  if (group) {
    return (
      <div role="group" aria-labelledby={labelId} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {caption}{children}{note}
      </div>
    )
  }
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {caption}{children}{note}
    </label>
  )
}

/** Eingelassenes Feld wie `.input` der App: dunkler als die Fläche, 16 px. */
export const inputStyle: CSSProperties = {
  width: '100%', minHeight: 44, padding: '10px 14px', borderRadius: 'var(--r-md)',
  background: 'var(--surface-input)', border: '1px solid transparent',
  boxShadow: 'var(--shadow-input)',
  color: 'var(--lg-text)', fontSize: 16,
}

/**
 * Unteres Sheet: ueber der Navigation, Escape und Hintergrund schliessen,
 * Inhalt scrollt fuer sich (`overscroll-behavior: contain`), Abstand zur
 * Home-Leiste ueber `safe-area-inset-bottom`.
 */
export function TrainingSheet({ title, onClose, children, footer, tall = false, busy = false, zIndex = 90, closeLabel }: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  tall?: boolean
  busy?: boolean
  zIndex?: number
  /** Beschriftung des X; Standard aus den Trainingstexten. */
  closeLabel?: string
}) {
  const titleId = useId()
  const { tt } = useTrainingText()
  closeLabel ??= tt('close')
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) { event.stopPropagation(); onClose() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  return createPortal(
    <div
      data-app-modal
      onClick={() => { if (!busy) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        padding: '0 8px calc(8px + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={event => event.stopPropagation()}
        // Schwebendes iOS-Sheet; feste Fläche, weil der Inhalt scrollt
        className="lg-sheet lg-sheet-solid tyd-train-sheet"
        style={{
          width: '100%', maxWidth: 560, overflow: 'hidden',
          height: tall ? 'calc(100dvh - max(32px, env(safe-area-inset-top)) - 8px - env(safe-area-inset-bottom, 0px))' : undefined,
          maxHeight: 'calc(100dvh - max(32px, env(safe-area-inset-top)) - 8px - env(safe-area-inset-bottom, 0px))',
          display: 'flex', flexDirection: 'column',
          color: 'var(--lg-text)',
        }}
      >
        <SheetGriff style={{ marginTop: 8 }} onClose={onClose} disabled={busy} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px 8px 20px' }}>
          <h2 id={titleId} className="lg-title2" style={{ flex: 1, minWidth: 0 }}>{title}</h2>
          <SheetClose onClick={onClose} disabled={busy} label={closeLabel} />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', padding: '4px 20px 20px' }}>
          {children}
        </div>
        {footer && (
          <div style={{ padding: '10px 20px 16px', borderTop: '0.5px solid var(--lg-separator)' }}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

/** Druck-Rueckmeldung beim Aufsetzen des Fingers, Hover nur mit Maus (mobile-native). */
export const TRAINING_CSS = `
.tyd-train-press { touch-action: manipulation; -webkit-user-select: none; user-select: none; transition: transform 120ms cubic-bezier(0.22,1,0.36,1), opacity 120ms; }
.tyd-train-press:active:not(:disabled) { transform: scale(0.97); }
.tyd-train-sheet { animation: tydTrainSheetIn 260ms cubic-bezier(0.32,0.72,0,1); }
@keyframes tydTrainSheetIn { from { transform: translateY(100%); } to { transform: translateY(0); } }
@media (prefers-reduced-motion: reduce) {
  .tyd-train-sheet { animation: none; }
  .tyd-train-press:active:not(:disabled) { transform: none; opacity: 0.7; }
}
/* Flächen im Sheet: eine Stufe heller als das Sheet, ohne Lichtkante — wie
   gruppierte Listen in iOS-Sheets */
.tyd-train-sheet .lg-surface { background: var(--lg-surface-2); box-shadow: none; }
.tyd-train-sheet .lg-surface::before, .tyd-train-sheet .lg-surface::after { display: none; }
.tyd-train-sheet .tyd-train-menu { background: var(--lg-surface-2); }
.tyd-train-menu { overflow: hidden; border-radius: var(--r-xl); background: var(--lg-surface-2); }
.tyd-train-menu > * { position: relative; }
.tyd-train-menu > * + *::before { content: ''; position: absolute; top: 0; inset-inline: 48px 0; height: 0.5px; background: var(--lg-separator); }
.tyd-train-menu > button:active { background: rgba(255,255,255,0.06); }
.tyd-train-input::-webkit-outer-spin-button, .tyd-train-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
/* Tastatur: sichtbarer Fokus statt keinem */
.tyd-train-input { outline: none; }
.tyd-train-input:focus-visible { outline: 2px solid var(--lg-accent); outline-offset: -2px; }
`
