import { useEffect, useRef, useState } from 'react'
import { hapticTick } from '../../../../lib/haptics'
import { useTrainingText } from '../../i18n'
import { formatClock } from '../../lib/format'
import { Button, TRAINING_ACCENT } from '../ui'

/**
 * Pausen-Timer am unteren Rand. Er rechnet vom Endzeitpunkt aus, nicht durch
 * Herunterzaehlen — so stimmt er auch, wenn das Handy zwischendurch gesperrt
 * war. Am Ende: Vibration und ein kurzer Ton, dann verschwindet er.
 */
export function RestTimer({ endsAt, totalS, onAdjust, onSkip }: {
  endsAt: number
  totalS: number
  onAdjust: (deltaS: number) => void
  onSkip: () => void
}) {
  const { tt } = useTrainingText()
  const [now, setNow] = useState(() => Date.now())
  const firedRef = useRef<number | null>(null)
  // Der Elternteil reicht bei jedem Rendern eine neue Funktion herein. Stuende
  // sie in den Abhaengigkeiten unten, raeumte jedes Neurendern den Zeitgeber
  // fuers Ausblenden ab, und der Timer bliebe auf 0:00 stehen.
  const onSkipRef = useRef(onSkip)
  useEffect(() => { onSkipRef.current = onSkip })

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [])

  const remainingS = Math.max(0, Math.ceil((endsAt - now) / 1000))

  useEffect(() => {
    if (remainingS > 0 || firedRef.current === endsAt) return
    firedRef.current = endsAt
    void hapticTick()
    try { navigator.vibrate?.([120, 60, 120]) } catch { /* nicht unterstuetzt */ }
    beep()
    const id = window.setTimeout(() => onSkipRef.current(), 1200)
    return () => window.clearTimeout(id)
  }, [remainingS, endsAt])

  const progress = totalS > 0 ? Math.min(1, Math.max(0, remainingS / totalS)) : 0

  return (
    <div
      role="timer"
      aria-live="off"
      aria-label={`${tt('rest_timer')} ${formatClock(remainingS)}`}
      style={{
        position: 'relative', overflow: 'hidden', borderRadius: 22,
        background: 'var(--lg-surface-2)',
        padding: '10px 12px 10px 16px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0, transformOrigin: 'left',
          transform: `scaleX(${progress})`, background: `${TRAINING_ACCENT}2e`,
          transition: 'transform 250ms linear',
        }}
      />
      <div style={{ position: 'relative', flex: 1, minWidth: 96 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--lg-text-2)' }}>
          {remainingS === 0 ? tt('rest_done') : tt('rest_timer')}
        </div>
        <div style={{ fontSize: 28, lineHeight: '34px', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--lg-text)' }}>
          {formatClock(remainingS)}
        </div>
      </div>
      <Button tone="ghost" onClick={() => onAdjust(-15)} style={{ position: 'relative', minWidth: 52, padding: '0 10px' }}>−15</Button>
      <Button tone="ghost" onClick={() => onAdjust(15)} style={{ position: 'relative', minWidth: 52, padding: '0 10px' }}>+15</Button>
      <Button onClick={onSkip} style={{ position: 'relative', padding: '0 14px' }}>{tt('rest_skip')}</Button>
    </div>
  )
}

/** Kurzer Ton ueber Web Audio — ohne Audiodatei, stumm, wenn der Browser es nicht erlaubt. */
function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.4)
    osc.onended = () => { void ctx.close() }
  } catch {
    // ohne Ton
  }
}
