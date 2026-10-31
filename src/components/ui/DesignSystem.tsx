import type { CSSProperties, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

// Shared dashboard primitives used to keep refreshed screens visually consistent.
// Farben laufen über Tokens (`var(--accent)` …), damit jeder Look passt;
// ein übergebener Hex-Wert funktioniert genauso.
const tint = (accent: string, percent: number) => `color-mix(in srgb, ${accent} ${percent}%, transparent)`
const DEFAULT_ACCENT = 'var(--accent)'

type PaddingSize = 'sm' | 'md' | 'lg'

const paddingMap: Record<PaddingSize, string> = {
  sm: '12px',
  md: '16px',
  lg: '20px',
}

function combineClassNames(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(' ')
}

export function PageShell({
  children,
  className,
  style,
}: {
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        paddingBottom: 8,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export function GlassPanel({
  children,
  className,
  style,
  accent = DEFAULT_ACCENT,
  padding = 'md',
  asButton = false,
  onClick,
}: {
  children: ReactNode
  className?: string
  style?: CSSProperties
  accent?: string
  padding?: PaddingSize
  asButton?: boolean
  onClick?: () => void
}) {
  const Component = asButton ? 'button' : 'div'

  return (
    <Component
      className={className}
      onClick={onClick}
      style={{
        width: asButton ? '100%' : undefined,
        textAlign: asButton ? 'left' : undefined,
        cursor: asButton ? 'pointer' : undefined,
        transition: asButton ? 'transform 0.16s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.16s cubic-bezier(0.22, 1, 0.36, 1)' : undefined,
        padding: paddingMap[padding],
        borderRadius: 18,
        border: accent === DEFAULT_ACCENT ? '1px solid var(--border)' : `1px solid ${tint(accent, 10)}`,
        background: 'var(--surface)',
        boxShadow: 'var(--shadow-card)',
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
    >
      <div style={{ position: 'relative' }}>{children}</div>
    </Component>
  )
}

export function IconBadge({
  icon: Icon,
  accent = DEFAULT_ACCENT,
  size = 40,
}: {
  icon: LucideIcon
  accent?: string
  size?: number
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size >= 40 ? 10 : 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // Ruhige Kachel: Fläche und Icon in der Textrolle, die Akzentfarbe
        // bleibt als feiner Rand stehen
        background: 'var(--lg-fill)',
        border: accent === DEFAULT_ACCENT ? '1px solid var(--border)' : `1px solid ${tint(accent, 24)}`,
        color: 'var(--lg-text-2)',
        flexShrink: 0,
      }}
    >
      <Icon size={size >= 40 ? 18 : 16} strokeWidth={1.5} />
    </div>
  )
}

export function PageHero({
  kicker,
  title,
  subtitle,
  icon,
  accent = DEFAULT_ACCENT,
  action,
  children,
}: {
  kicker?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  icon?: LucideIcon
  accent?: string
  action?: ReactNode
  children?: ReactNode
}) {
  const compact = !kicker && !subtitle

  return (
    <GlassPanel padding="lg" accent={accent}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: compact ? 'center' : 'flex-start' }}>
        <div style={{ display: 'flex', gap: 12, minWidth: 0, alignItems: compact ? 'center' : 'flex-start' }}>
          {icon && <IconBadge icon={icon} accent={accent} size={44} />}
          <div style={{ minWidth: 0 }}>
            {kicker && (
              <p
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--lg-text-3)',
                  marginBottom: 4,
                }}
              >
                {kicker}
              </p>
            )}
            <h1
              style={{
                fontSize: 28,
                fontWeight: 500,
                letterSpacing: '-0.02em',
                color: 'var(--text)',
                lineHeight: 1.05,
                margin: 0,
              }}
            >
              {title}
            </h1>
            {subtitle && (
              <p style={{ fontSize: 14, color: 'var(--text-dim)', lineHeight: 1.5, marginTop: 8 }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {action && <div style={{ flexShrink: 0 }}>{action}</div>}
      </div>
      {children && <div style={{ marginTop: 16 }}>{children}</div>}
    </GlassPanel>
  )
}

export function SectionHeader({
  kicker,
  title,
  subtitle,
  action,
  icon,
  accent = DEFAULT_ACCENT,
}: {
  kicker?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  icon?: LucideIcon
  accent?: string
}) {
  const Icon = icon

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <div style={{ minWidth: 0 }}>
        {kicker && (
          <p
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--text-muted)',
            }}
          >
            {kicker}
          </p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: kicker ? 2 : 0 }}>
          {Icon && <Icon size={18} strokeWidth={1.5} color={accent === DEFAULT_ACCENT ? 'var(--lg-text-2)' : accent} />}
          <h2 style={{ fontSize: 17, fontWeight: 500, color: 'var(--text)', lineHeight: 1.25 }}>{title}</h2>
        </div>
        {subtitle && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.45 }}>
            {subtitle}
          </p>
        )}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  )
}

export function MetricCard({
  icon,
  label,
  value,
  hint,
  accent = DEFAULT_ACCENT,
  onClick,
}: {
  icon: LucideIcon
  label: ReactNode
  value: ReactNode
  hint?: ReactNode
  accent?: string
  onClick?: () => void
}) {
  return (
    <GlassPanel asButton={!!onClick} onClick={onClick} padding="sm" accent={accent} style={{ minHeight: 112 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <IconBadge icon={icon} accent={accent} size={32} />
      </div>
      <p className="tabular-nums" style={{ fontSize: 24, fontWeight: 500, color: 'var(--text)', letterSpacing: '-0.01em', lineHeight: 1, marginTop: 12 }}>
        {value}
      </p>
      <p style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 400, marginTop: 4 }}>
        {label}
      </p>
      {hint && <p className="font-mono" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{hint}</p>}
    </GlassPanel>
  )
}

export function ResearchDisclaimer({
  compact = false,
  title,
  body,
  accent = '#f59e0b',
}: {
  compact?: boolean
  title: ReactNode
  body: ReactNode
  accent?: string
}) {
  return (
    <div
      // Ruhige Fußnoten-Fläche wie der Medizin-Hinweis; der Titel trägt die Farbe
      style={{
        padding: compact ? '12px 16px' : '16px',
        borderRadius: 16,
        background: 'var(--lg-surface-2)',
      }}
    >
      <p
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: accent === '#f59e0b' ? 'var(--lg-warn-text)' : accent === '#00ccf5' || accent === DEFAULT_ACCENT ? 'var(--lg-accent-text)' : accent,
          marginBottom: 2,
        }}
      >
        {title}
      </p>
      <p style={{ fontSize: 13, color: 'var(--lg-text-2)', lineHeight: 1.45 }}>
        {body}
      </p>
    </div>
  )
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  className,
  type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
  type?: 'button' | 'submit'
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={combineClassNames('btn-primary', className)}
      style={{ opacity: disabled ? 0.55 : 1 }}
    >
      {children}
    </button>
  )
}

export function SecondaryButton({
  children,
  onClick,
  disabled,
  className,
  type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
  type?: 'button' | 'submit'
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={combineClassNames('btn-secondary', className)}
      style={{ opacity: disabled ? 0.55 : 1 }}
    >
      {children}
    </button>
  )
}

export function ActionTile({
  icon,
  label,
  description,
  accent = DEFAULT_ACCENT,
  onClick,
  className,
}: {
  icon: LucideIcon
  label: ReactNode
  description?: ReactNode
  accent?: string
  onClick?: () => void
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      className={combineClassNames('transition-transform active:scale-[0.99]', className)}
      style={{
        minHeight: 104,
        width: '100%',
        padding: '12px',
        borderRadius: 16,
        border: accent === DEFAULT_ACCENT ? '1px solid var(--border)' : `1px solid ${tint(accent, 20)}`,
        background: 'var(--surface)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 8,
        textAlign: 'left',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <IconBadge icon={icon} accent={accent} size={34} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', lineHeight: 1.2 }}>{label}</p>
        {description && (
          <p style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.35, marginTop: 4 }}>
            {description}
          </p>
        )}
      </div>
    </button>
  )
}
