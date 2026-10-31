import type { CSSProperties } from 'react'
import { fieldLabel } from '../styles'

export const WELLNESS_SLIDER_CSS = `
  input.tyd-wellness-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 6px;
    border-radius: 99px;
    outline: none;
    cursor: pointer;
    margin: 0;
    background: transparent;
  }
  input.tyd-wellness-slider::-webkit-slider-runnable-track {
    height: 6px;
    border-radius: 99px;
    background: rgba(255,255,255,0.1);
    border: 0;
  }
  input.tyd-wellness-slider.is-set::-webkit-slider-runnable-track {
    background: linear-gradient(
      to right,
      var(--accent) 0%,
      var(--accent) var(--fill-pct, 0%),
      rgba(255,255,255,0.1) var(--fill-pct, 0%),
      rgba(255,255,255,0.1) 100%
    );
  }
  input.tyd-wellness-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 22px;
    height: 22px;
    margin-top: -8px;
    border-radius: 50%;
    background: #eceef2;
    border: 0;
    box-shadow: 0 1px 4px rgba(0,0,0,0.35);
    cursor: grab;
    transition: box-shadow 0.15s cubic-bezier(0.22, 1, 0.36, 1), transform 0.15s cubic-bezier(0.22, 1, 0.36, 1);
  }
  input.tyd-wellness-slider.is-set::-webkit-slider-thumb {
    box-shadow: 0 0 0 2px var(--accent), 0 1px 4px rgba(0,0,0,0.35);
  }
  input.tyd-wellness-slider:active::-webkit-slider-thumb {
    cursor: grabbing;
    transform: scale(1.05);
  }
  input.tyd-wellness-slider::-moz-range-track {
    height: 6px;
    border-radius: 99px;
    background: rgba(255,255,255,0.1);
    border: 0;
  }
  input.tyd-wellness-slider.is-set::-moz-range-progress {
    height: 6px;
    border-radius: 99px;
    background: var(--accent);
  }
  input.tyd-wellness-slider::-moz-range-thumb {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: #eceef2;
    border: 0;
    box-shadow: 0 1px 4px rgba(0,0,0,0.35);
    cursor: grab;
    transition: box-shadow 0.15s cubic-bezier(0.22, 1, 0.36, 1);
  }
  input.tyd-wellness-slider.is-set::-moz-range-thumb {
    box-shadow: 0 0 0 2px var(--accent), 0 1px 4px rgba(0,0,0,0.35);
  }
`

export const DEFAULT_WELLNESS = 0

export function wellnessFillPercent(value: number): string {
  return `${(value / 10) * 100}%`
}

export const dateFieldStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: 0,
  border: 'none',
  background: 'transparent',
  color: 'var(--text)',
  fontSize: '0.92rem',
  fontWeight: 500,
  fontFamily: 'inherit',
  textAlign: 'right',
  colorScheme: 'dark',
}

export const compactInputStyle: CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: 10,
  background: 'var(--surface-input)',
  border: '1px solid var(--border)',
  color: 'var(--text-dim)',
  fontSize: '0.84rem',
  fontWeight: 500,
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}

interface Props {
  label: string
  value: number | null
  onChange: (value: number | null) => void
}

export function WellnessSliderRow({ label, value, onChange }: Props) {
  const isSet = value != null
  const position = value ?? DEFAULT_WELLNESS
  const display = position

  return (
    <div style={{
      marginBottom: 8,
      padding: '8px 12px',
      borderRadius: 12,
      background: 'var(--surface-input)',
      border: '1px solid var(--border)',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
        gap: 8,
      }}>
        <label style={{ ...fieldLabel, marginBottom: 0 }}>
          {label}
        </label>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.82rem',
          fontWeight: 500,
          color: isSet ? 'var(--lg-accent-text, var(--accent))' : 'var(--text-muted)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {display}<span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)' }}>/10</span>
        </span>
      </div>

      <input
        className={`tyd-wellness-slider${isSet ? ' is-set' : ''}`}
        type="range"
        min={0}
        max={10}
        step={1}
        value={position}
        onChange={e => {
          const next = Number(e.target.value)
          onChange(next === 0 ? null : next)
        }}
        aria-valuemin={0}
        aria-valuemax={10}
        aria-valuenow={position}
        aria-label={label}
        style={{ '--fill-pct': wellnessFillPercent(position) } as CSSProperties}
      />
    </div>
  )
}
