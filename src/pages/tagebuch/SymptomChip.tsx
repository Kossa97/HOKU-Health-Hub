import type { CSSProperties, ReactNode } from 'react'
import { Tag } from 'lucide-react'
import { SYMPTOM_ICONS } from './symptomIcons.data'
import { kindColor, type SymptomKind } from './chips'

/**
 * Deckende Mischung aus Art-Farbe und Untergrund. Der Rahmen liegt über
 * Symbol und Ausbuchtungen und muss deshalb deckend sein; den Untergrund
 * gibt der umgebende Block als `--tb-base` vor.
 */
const mixed = (color: string, percent: number) => `color-mix(in srgb, ${color} ${percent}%, var(--tb-base, var(--lg-sheet-solid)))`

/** Symbol eines Chips; eigene Chips zeigen ein Etikett. */
export function SymptomIcon({ iconKey, size }: { iconKey: string | null; size: number }) {
  const icon = iconKey ? SYMPTOM_ICONS[iconKey] : undefined
  if (!icon) return <Tag size={size} strokeWidth={1.9} aria-hidden="true" />
  const px = Math.round(size * icon.scale * 10) / 10
  return (
    <svg width={px} height={px} viewBox={icon.vb} aria-hidden="true"
      fill={icon.fill ? 'currentColor' : 'none'} stroke={icon.fill ? 'none' : 'currentColor'}
      strokeWidth={icon.sw || undefined} strokeLinecap="round" strokeLinejoin="round">
      {icon.d3 && <path stroke="none" d={icon.d3} fill={icon.c3 === 'currentColor' ? 'currentColor' : icon.c3} fillOpacity={icon.o3} />}
      {icon.d4 && <path d={icon.d4} fill={icon.c4} stroke="var(--lg-sheet-solid)" strokeWidth={0.9} />}
      {icon.d1 && <path fillRule="evenodd" d={icon.d1} />}
      {icon.d2 && <path d={icon.d2} />}
    </svg>
  )
}

/**
 * Ein Chip nach der Skizze vom 2026-10-19: Symbol oben links über dem Rahmen,
 * Intensität oben rechts als geschlossener Kreis auf der Linie, unten links
 * eine Ausbuchtung mit ＋ (Wirkung) oder − (Nebenwirkung). Ohne Auswahl nur
 * das Symbol auf grauer Pille.
 */
export function SymptomChip({ kind, label, iconKey, selected, severity, duration, small = false, onClick, ariaLabel, accent }: {
  kind: SymptomKind
  label: string
  iconKey: string | null
  selected: boolean
  severity?: number
  duration?: string
  small?: boolean
  onClick?: () => void
  ariaLabel?: string
  /** Abweichende Farbe, z. B. für „+ Eigene …“ */
  accent?: string
}) {
  const color = accent ?? kindColor(kind)
  const h = small ? 32 : 40
  const disc = small ? 30 : 38
  const knob = { cx: small ? 11 : 13, cy: h + 1, r: small ? 9 : 11 }
  const inner = knob.r - 3.5
  const half = inner * 0.5
  const sign = `M${knob.cx - half} ${knob.cy}H${knob.cx + half}` + (kind === 'effect' ? `M${knob.cx} ${knob.cy - half}V${knob.cy + half}` : '')
  const fill = mixed(color, 15)
  const ring = mixed(color, 70)
  const style: CSSProperties = {
    height: h,
    paddingLeft: disc + 2,
    paddingRight: selected ? (small ? 16 : 20) : 14,
    // Unten Platz für den ＋/−-Kreis, damit er die Scheibe eines Chips darunter nicht berührt.
    margin: small ? '8px 10px 14px 6px' : '10px 12px 16px 8px',
    color: accent && !selected ? accent : undefined,
  }
  const content: ReactNode = (
    <>
      {selected && (
        <svg aria-hidden="true" className="pointer-events-none absolute left-0 top-0 h-full w-full overflow-visible">
          <g fill="none" style={{ stroke: ring }} strokeWidth={3.2}>
            <rect width="100%" height="100%" rx={h / 2} />
            <circle cx={knob.cx} cy={knob.cy} r={knob.r} />
          </g>
          <g style={{ fill }}>
            <rect width="100%" height="100%" rx={h / 2} />
            <circle cx={knob.cx} cy={knob.cy} r={knob.r} />
          </g>
          <circle cx={knob.cx} cy={knob.cy} r={inner} fill="none" style={{ stroke: color }} strokeWidth={1.4} />
          <path d={sign} fill="none" style={{ stroke: color }} strokeWidth={1.6} strokeLinecap="round" />
        </svg>
      )}
      <span aria-hidden="true" className="absolute z-[1] flex items-center justify-center rounded-full"
        style={{
          left: small ? -5 : -6, top: small ? -8 : -10, width: disc, height: disc, color,
          background: mixed(color, selected ? 30 : 16),
          boxShadow: selected
            ? `0 0 0 1.6px ${ring}, 0 0 0 4px var(--tb-base, var(--lg-sheet-solid))`
            : '0 0 0 3px var(--tb-base, var(--lg-sheet-solid))',
        }}>
        <SymptomIcon iconKey={iconKey} size={small ? 15 : 17} />
      </span>
      <span className="relative whitespace-nowrap">{label}</span>
      {duration && <span className={`relative whitespace-nowrap font-normal text-[rgba(235,240,255,.62)] ${small ? 'text-[12px]' : 'text-[13px]'}`}>· {duration}</span>}
      {selected && severity != null && (
        <span aria-hidden="true" className="absolute z-[1] box-border rounded-full px-[5px] text-center text-[11px] font-bold tabular-nums"
          style={{
            top: small ? -8 : -9, right: small ? -7 : -8, minWidth: small ? 18 : 20, height: small ? 18 : 20,
            lineHeight: `${small ? 18 : 20}px`, background: fill, boxShadow: `0 0 0 1.6px ${ring}`, color,
          }}>
          {severity}
        </span>
      )}
    </>
  )
  const className = `relative inline-flex items-center gap-1.5 rounded-full font-medium text-[var(--lg-text)] ${
    small ? 'text-[14px]' : 'text-[15px]'} ${selected ? '' : 'bg-[var(--lg-fill)]'}`
  // aria-label gilt auf einem span ohne Rolle nicht — der Wortlaut steht deshalb als verborgener Text da.
  if (!onClick) {
    return (
      <span className={className} style={style}>
        {ariaLabel ? <><span className="sr-only">{ariaLabel}</span><span aria-hidden="true" className="contents">{content}</span></> : content}
      </span>
    )
  }
  return (
    <button type="button" onClick={onClick} aria-label={ariaLabel} aria-pressed={selected} aria-haspopup="dialog"
      className={`${className} cursor-pointer transition-transform active:scale-[0.96] motion-reduce:active:scale-100
        after:absolute after:inset-x-0 after:top-[calc(50%-22px)] after:bottom-[calc(50%-22px)] after:content-['']
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lg-accent)]`}
      style={style}>
      {content}
    </button>
  )
}
