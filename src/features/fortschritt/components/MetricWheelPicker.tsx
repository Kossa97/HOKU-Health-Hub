import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import type { CSSProperties, RefObject } from 'react'
import { fieldLabel } from '../styles'
import { formatNumber } from '../lib/dates'

const ITEM_H = 30
const WHEEL_H = ITEM_H * 3
const PAD = 1

export const METRIC_WHEEL_CSS = `
  .tyd-metric-wheel-scroll {
    height: ${WHEEL_H}px;
    overflow-y: auto;
    overflow-x: hidden;
    scroll-snap-type: y mandatory;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    touch-action: pan-y;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  .tyd-metric-wheel-scroll::-webkit-scrollbar {
    display: none;
  }
  .tyd-metric-wheel-item {
    height: ${ITEM_H}px;
    scroll-snap-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    color: var(--text-muted);
    user-select: none;
    -webkit-user-select: none;
  }
  .tyd-metric-wheel-item.is-active {
    color: var(--text);
  }
`

function buildDecimalRange(min: number, max: number, step = 0.1) {
  const out: number[] = []
  for (let v = min; v <= max + step / 2; v += step) {
    out.push(Math.round(v * 10) / 10)
  }
  return out
}

function indexForValue(options: number[], value: number) {
  const rounded = Math.round(value * 10) / 10
  const idx = options.findIndex(v => Math.abs(v - rounded) < 0.01)
  return idx >= 0 ? idx : 0
}

function formatDecimal(value: number, wheelSuffix?: string) {
  const base = formatNumber(value, 1)
  return wheelSuffix ? `${base} ${wheelSuffix}` : base
}

interface Props {
  label: string
  unit: string
  value: number | null
  onChange: (value: number) => void
  min: number
  max: number
  placeholder: string
  defaultValue: number
  wheelSuffix?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MetricWheelPicker({
  label,
  unit,
  value,
  onChange,
  min,
  max,
  placeholder,
  defaultValue,
  wheelSuffix,
  open,
  onOpenChange,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const options = useMemo(() => buildDecimalRange(min, max), [min, max])
  const suppressEmitRef = useRef(false)
  const touchedRef = useRef(value != null)

  const activeValue = value ?? defaultValue

  const scrollToIndex = useCallback((el: HTMLDivElement | null, index: number) => {
    if (!el) return
    suppressEmitRef.current = true
    el.scrollTop = index * ITEM_H
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        suppressEmitRef.current = false
      })
    })
  }, [])

  useEffect(() => {
    touchedRef.current = value != null
  }, [value])

  useLayoutEffect(() => {
    if (!open) return
    scrollToIndex(scrollRef.current, indexForValue(options, activeValue))
  }, [open, activeValue, options, scrollToIndex])

  const emitValue = useCallback(() => {
    if (suppressEmitRef.current) return
    const el = scrollRef.current
    if (!el) return

    const idx = Math.round(el.scrollTop / ITEM_H)
    const next = options[Math.min(Math.max(idx, 0), options.length - 1)]
    if (value != null || touchedRef.current) {
      onChange(next)
    }
  }, [onChange, options, value])

  useEffect(() => {
    if (!open) return
    const el = scrollRef.current
    if (!el) return

    const onScroll = () => emitValue()
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [open, emitValue])

  const display = value != null
    ? unit === '%'
      ? formatDecimal(value, '%')
      : `${formatDecimal(value)} ${unit}`
    : placeholder

  const triggerStyle: CSSProperties = {
    width: '100%',
    padding: '9px 11px',
    borderRadius: 12,
    background: 'var(--surface-input)',
    border: `1px solid ${open ? 'var(--accent)' : 'var(--border)'}`,
    color: value != null ? 'var(--text)' : 'var(--text-dim)',
    fontSize: '0.84rem',
    fontWeight: 700,
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    textAlign: 'center',
    fontVariantNumeric: 'tabular-nums',
    cursor: 'pointer',
    touchAction: 'manipulation',
    boxShadow: open ? '0 0 0 1px rgba(0,204,245,0.2)' : undefined,
  }

  const wheelFrame: CSSProperties = {
    position: 'relative',
    marginTop: 6,
    borderRadius: 12,
    background: 'var(--surface-input)',
    border: '1px solid var(--border)',
    overflow: 'hidden',
  }

  const highlight: CSSProperties = {
    position: 'absolute',
    top: '50%',
    left: 4,
    right: 4,
    height: ITEM_H,
    transform: 'translateY(-50%)',
    borderTop: '1px solid var(--border)',
    borderBottom: '1px solid var(--border)',
    background: 'rgba(0,204,245,0.06)',
    borderRadius: 8,
    pointerEvents: 'none',
    zIndex: 1,
  }

  const fade: CSSProperties = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    background: 'linear-gradient(to bottom, var(--surface-input) 0%, transparent 28%, transparent 72%, var(--surface-input) 100%)',
    zIndex: 2,
  }

  const renderWheel = (ref: RefObject<HTMLDivElement | null>) => (
    <div
      className="tyd-metric-wheel-scroll"
      ref={ref}
      onTouchStart={() => { touchedRef.current = true }}
      onWheel={() => { touchedRef.current = true }}
    >
      {Array.from({ length: PAD }, (_, i) => (
        <div key={`pad-top-${i}`} className="tyd-metric-wheel-item" aria-hidden>&nbsp;</div>
      ))}
      {options.map(n => (
        <div
          key={n}
          className={`tyd-metric-wheel-item${Math.abs(n - activeValue) < 0.01 ? ' is-active' : ''}`}
        >
          {formatDecimal(n, wheelSuffix)}
        </div>
      ))}
      {Array.from({ length: PAD }, (_, i) => (
        <div key={`pad-bot-${i}`} className="tyd-metric-wheel-item" aria-hidden>&nbsp;</div>
      ))}
    </div>
  )

  return (
    <div>
      <label style={{ ...fieldLabel, fontSize: '0.56rem', marginBottom: 5, display: 'block' }}>
        {label}
      </label>

      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        style={triggerStyle}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {display}
      </button>

      {open && (
        <div style={wheelFrame}>
          {renderWheel(scrollRef)}
          <div style={highlight} aria-hidden />
          <div style={fade} aria-hidden />
        </div>
      )}
    </div>
  )
}
