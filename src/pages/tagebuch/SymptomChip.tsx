import type { CSSProperties, ReactNode } from 'react'
import { Tag } from 'lucide-react'
import { SYMPTOM_ICONS } from './symptomIcons.data'
import { kindColor, type SymptomKind } from './chips'

/** Getönte Fläche in der Art-Farbe, durchscheinend — passt auf jeden Untergrund. */
const tint = (color: string, percent: number) => `color-mix(in srgb, ${color} ${percent}%, transparent)`

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
 * Ein Chip (Variante A, 2026-10-19): eine ruhige Pille, nichts steht über den
 * Rand. Links das Symbol in einer Kachel — rund für eine Wirkung, eckig für
 * eine Nebenwirkung, damit die Art auch ohne Farbe erkennbar ist —, dann
 * Name und Dauer, am Ende die Intensität als fünf Punkte. Ohne Auswahl nur
 * Symbol und Name auf grauer Pille.
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
  const h = small ? 30 : 36
  const tile = small ? 22 : 26
  const dot = small ? 4 : 5
  const style: CSSProperties = {
    height: h,
    paddingLeft: (h - tile) / 2,
    paddingRight: small ? 10 : 12,
    background: selected ? tint(color, 16) : 'var(--lg-fill)',
    boxShadow: selected ? `inset 0 0 0 1px ${tint(color, 50)}` : undefined,
    color: accent && !selected ? accent : undefined,
  }
  const content: ReactNode = (
    <>
      <span aria-hidden="true"
        className={`flex shrink-0 items-center justify-center ${kind === 'effect' ? 'rounded-full' : small ? 'rounded-[6px]' : 'rounded-[7px]'}`}
        style={{
          width: tile, height: tile,
          color: selected || accent ? color : 'rgba(235,240,255,.72)',
          background: selected ? tint(color, 28) : 'rgba(255,255,255,.07)',
        }}>
        <SymptomIcon iconKey={iconKey} size={small ? 13 : 15} />
      </span>
      {/* Eine Zeile: passt die Dauer nicht mehr daneben, rutscht sie in die
          verborgene zweite Zeile; der Name wird erst gekürzt, wenn er allein nicht passt. */}
      <span className={`flex min-w-0 flex-wrap items-baseline gap-x-1.5 overflow-hidden ${small ? 'h-5 leading-5' : 'h-[22px] leading-[22px]'}`}>
        <span className="min-w-0 max-w-full truncate">{label}</span>
        {duration && <span className={`whitespace-nowrap font-normal text-[rgba(235,240,255,.6)] ${small ? 'text-[12px]' : 'text-[13px]'}`}>{duration}</span>}
      </span>
      {selected && severity != null && (
        <span aria-hidden="true" className="ml-0.5 flex shrink-0 items-center" style={{ gap: small ? 2 : 3 }}>
          {[1, 2, 3, 4, 5].map(level => (
            <span key={level} className="block rounded-full"
              style={{ width: dot, height: dot, background: level <= severity ? color : 'rgba(235,240,255,.22)' }} />
          ))}
        </span>
      )}
    </>
  )
  const className = `relative inline-flex max-w-full items-center rounded-full font-medium text-[var(--lg-text)] ${
    small ? 'gap-1.5 text-[14px]' : 'gap-2 text-[15px]'}`
  // aria-label gilt auf einem span ohne Rolle nicht — der Wortlaut steht deshalb als verborgener Text da.
  if (!onClick) {
    return (
      <span className={className} style={style} data-tagebuch-chip>
        {ariaLabel ? <><span className="sr-only">{ariaLabel}</span><span aria-hidden="true" className="contents">{content}</span></> : content}
      </span>
    )
  }
  return (
    <button type="button" onClick={onClick} aria-label={ariaLabel} aria-pressed={selected} aria-haspopup="dialog" data-tagebuch-chip
      className={`${className} cursor-pointer transition-transform duration-150 ease-out active:scale-[0.97] motion-reduce:active:scale-100
        after:absolute after:inset-x-0 after:top-[calc(50%-22px)] after:bottom-[calc(50%-22px)] after:content-['']
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lg-accent)]`}
      style={style}>
      {content}
    </button>
  )
}
