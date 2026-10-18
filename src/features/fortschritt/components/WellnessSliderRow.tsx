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
    border: 1px solid rgba(255,255,255,0.06);
    box-shadow: inset 0 1px 2px rgba(0,0,0,0.3);
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
    margin-top: -9px;
    border-radius: 50%;
    background: radial-gradient(circle at 32% 28%, #ffffff 0%, #ececec 45%, #c8c8c8 100%);
    border: 2.5px solid rgba(255,255,255,0.95);
    box-shadow: 0 2px 8px rgba(0,0,0,0.35);
    cursor: grab;
    transition: background 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
  }
  input.tyd-wellness-slider.is-set::-webkit-slider-thumb {
    background: radial-gradient(circle at 32% 28%, #7ef0ff 0%, #00ccf5 42%, #008fbd 100%);
    border: 2.5px solid rgba(255,255,255,0.92);
    box-shadow:
      0 0 0 3px rgba(0,204,245,0.16),
      0 3px 10px rgba(0,0,0,0.4),
      0 0 14px rgba(0,204,245,0.3);
  }
  input.tyd-wellness-slider:active::-webkit-slider-thumb {
    cursor: grabbing;
    transform: scale(1.05);
  }
  input.tyd-wellness-slider::-moz-range-track {
    height: 6px;
    border-radius: 99px;
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.06);
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
    background: radial-gradient(circle at 32% 28%, #ffffff 0%, #ececec 45%, #c8c8c8 100%);
    border: 2.5px solid rgba(255,255,255,0.95);
    box-shadow: 0 2px 8px rgba(0,0,0,0.35);
    cursor: grab;
    transition: background 0.15s ease, box-shadow 0.15s ease;
  }
  input.tyd-wellness-slider.is-set::-moz-range-thumb {
    background: radial-gradient(circle at 32% 28%, #7ef0ff 0%, #00ccf5 42%, #008fbd 100%);
    border: 2.5px solid rgba(255,255,255,0.92);
    box-shadow:
      0 0 0 3px rgba(0,204,245,0.16),
      0 3px 10px rgba(0,0,0,0.4),
      0 0 14px rgba(0,204,245,0.3);
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
  fontWeight: 800,
  fontFamily: 'inherit',
  textAlign: 'right',
  colorScheme: 'dark',
}

export const compactInputStyle: CSSProperties = {
  width: '100%',
  padding: '9px 11px',
  borderRadius: 12,
  background: 'var(--surface-input)',
  border: '1px solid var(--border)',
  color: 'var(--text-dim)',
  fontSize: '0.84rem',
  fontWeight: 700,
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
      padding: '9px 11px 8px',
      borderRadius: 14,
      background: 'var(--surface-input)',
      border: '1px solid var(--border)',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 7,
        gap: 8,
      }}>
        <label style={{ ...fieldLabel, marginBottom: 0, fontSize: '0.68rem' }}>
          {label}
        </label>
        <span style={{
          fontSize: '0.82rem',
          fontWeight: 900,
          color: isSet ? 'var(--accent)' : 'var(--text-muted)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {display}<span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)' }}>/10</span>
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
