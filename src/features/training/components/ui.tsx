import { useEffect, useId, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  Activity, Bike, Dumbbell, Flame, Footprints, Mountain, PersonStanding, Sparkles,
  Timer, Trophy, Waves, type LucideIcon,
} from 'lucide-react'
import { X } from 'lucide-react'
import type { SessionKind } from '../types'
import { useTrainingText } from '../i18n'

/**
 * Bausteine des Workout-Trackers. Farben kommen aus den App-Variablen
 * (`--surface`, `--text` …), damit helles und dunkles Thema stimmen.
 */

export const TRAINING_ACCENT = '#f97316'

export const KIND_STYLE: Record<SessionKind, { icon: LucideIcon; color: string }> = {
  strength: { icon: Dumbbell, color: '#f97316' },
  run: { icon: Footprints, color: '#10b981' },
  cycle: { icon: Bike, color: '#06b6d4' },
  swim: { icon: Waves, color: '#3b82f6' },
  row: { icon: Waves, color: '#0ea5e9' },
  walk: { icon: Footprints, color: '#84cc16' },
  hike: { icon: Mountain, color: '#65a30d' },
  hiit: { icon: Flame, color: '#ef4444' },
  hyrox: { icon: Timer, color: '#eab308' },
  yoga: { icon: PersonStanding, color: '#a855f7' },
  mobility: { icon: Sparkles, color: '#8b5cf6' },
  sport: { icon: Trophy, color: '#f43f5e' },
  other: { icon: Activity, color: '#94a3b8' },
}

export function KindBadge({ kind, size = 38 }: { kind: SessionKind; size?: number }) {
  const { icon: Icon, color } = KIND_STYLE[kind]
  return (
    <span
      aria-hidden="true"
      style={{
        width: size, height: size, borderRadius: Math.round(size * 0.32), flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: `${color}1f`, border: `1px solid ${color}38`, color,
      }}
    >
      <Icon size={Math.round(size * 0.48)} />
    </span>
  )
}

export function Card({ children, style, accent, onClick, as = 'div', ariaLabel }: {
  children: ReactNode
  style?: CSSProperties
  accent?: string
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
      className={onClick ? 'tyd-train-press' : undefined}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: 16, borderRadius: 20,
        background: 'var(--surface)',
        border: `1px solid ${accent ? `${accent}30` : 'var(--border)'}`,
        boxShadow: 'var(--shadow-card)',
        color: 'var(--text)',
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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, margin: '6px 2px 8px' }}>
      <h2 style={{ fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-dim)' }}>
        {children}
      </h2>
      {action}
    </div>
  )
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'primary' | 'ghost' | 'danger'; block?: boolean }

export function Button({ tone = 'primary', block, style, className, children, ...rest }: ButtonProps) {
  const tones: Record<NonNullable<ButtonProps['tone']>, CSSProperties> = {
    primary: { background: TRAINING_ACCENT, color: '#140800', border: '1px solid transparent' },
    ghost: { background: 'var(--surface-raised)', color: 'var(--text)', border: '1px solid var(--border-strong)' },
    danger: { background: 'rgba(244,63,94,0.12)', color: '#f43f5e', border: '1px solid rgba(244,63,94,0.3)' },
  }
  return (
    <button
      type="button"
      className={`tyd-train-press${className ? ` ${className}` : ''}`}
      style={{
        minHeight: 44, padding: '10px 16px', borderRadius: 14,
        fontWeight: 750, fontSize: '0.92rem',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        width: block ? '100%' : undefined,
        cursor: rest.disabled ? 'default' : 'pointer',
        opacity: rest.disabled ? 0.5 : 1,
        ...tones[tone],
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  )
}

export function Chip({ active, children, onClick, color = TRAINING_ACCENT, ariaLabel }: {
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
        minHeight: 36, padding: '6px 12px', borderRadius: 999, flexShrink: 0,
        fontSize: '0.82rem', fontWeight: 700, whiteSpace: 'nowrap',
        background: active ? `${color}22` : 'var(--surface-raised)',
        border: `1px solid ${active ? `${color}66` : 'var(--border)'}`,
        color: active ? color : 'var(--text-dim)',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 650 }}>{label}</div>
      <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
      {sub && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-dim)' }}>{label}</span>
      {children}
      {hint && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{hint}</span>}
    </label>
  )
}

export const inputStyle: CSSProperties = {
  width: '100%', minHeight: 44, padding: '10px 12px', borderRadius: 12,
  background: 'var(--surface-input)', border: '1px solid var(--border-strong)',
  color: 'var(--text)', fontSize: 16,
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
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={event => event.stopPropagation()}
        className="tyd-train-sheet"
        style={{
          width: '100%', maxWidth: 560,
          height: tall ? 'calc(100dvh - max(24px, env(safe-area-inset-top)))' : undefined,
          maxHeight: 'calc(100dvh - max(24px, env(safe-area-inset-top)))',
          display: 'flex', flexDirection: 'column',
          background: 'var(--app-bg)', color: 'var(--text)',
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          border: '1px solid var(--border-strong)', borderBottom: 'none',
          boxShadow: '0 -12px 48px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px 10px' }}>
          <h2 id={titleId} style={{ flex: 1, fontSize: '1.05rem', fontWeight: 800, minWidth: 0 }}>{title}</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label={closeLabel}
            className="tyd-train-press"
            style={{ width: 36, height: 36, borderRadius: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-raised)', color: 'var(--text-dim)' }}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', padding: '4px 16px 16px' }}>
          {children}
        </div>
        {footer && (
          <div style={{ padding: '10px 16px calc(12px + env(safe-area-inset-bottom, 0px))', borderTop: '1px solid var(--border)' }}>
            {footer}
          </div>
        )}
        {!footer && <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />}
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
.tyd-train-input::-webkit-outer-spin-button, .tyd-train-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
`
