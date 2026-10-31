import { useEffect, useRef, useState } from 'react'
import { hapticTick } from '../../../../lib/haptics'
import { showPageNotification } from '../../../../lib/pushLocal'
import { useTrainingText } from '../../i18n'
import { formatClock } from '../../lib/format'
import { Button, TRAINING_ACCENT } from '../ui'
import { trainingTint } from '../accent'
import type { NextSetInfo } from './nextSet'

/**
 * Pausen-Timer am unteren Rand. Er rechnet vom Endzeitpunkt aus, nicht durch
 * Herunterzaehlen — so stimmt er auch, wenn das Handy zwischendurch gesperrt
 * war. Er zeigt, welcher Satz als Naechstes kommt („Pause · dann Satz 3",
 * „Bankdrücken · 82,5 × 8"). Am Ende: Vibration immer, Ton nur mit
 * `restSound`, und wenn die App im Hintergrund ist, mit `restNotify` eine
 * Systembenachrichtigung. Dann verschwindet er.
 */

/** Die Berechtigung wird nur einmal je Sitzung angefragt — und nie blockierend. */

export function RestTimer({ endsAt, totalS, next, sound, notify, onAdjust, onSkip }: {
  endsAt: number
  totalS: number
  next: NextSetInfo | null
  /** Ton am Ende (Einstellung `restSound`). */
  sound: boolean
  /** Systembenachrichtigung am Ende, wenn die App im Hintergrund ist (`restNotify`). */
  notify: boolean
  onAdjust: (deltaS: number) => void
  onSkip: () => void
}) {
  const { tt } = useTrainingText()
  const [now, setNow] = useState(() => Date.now())
  const firedRef = useRef<number | null>(null)
  // Der Elternteil reicht bei jedem Rendern neue Funktionen und Werte herein.
  // Stuenden sie in den Abhaengigkeiten unten, raeumte jedes Neurendern den
  // Zeitgeber fuers Ausblenden ab, und der Timer bliebe auf 0:00 stehen.
  const latest = useRef({ onSkip, next, sound, notify, tt })
  useEffect(() => { latest.current = { onSkip, next, sound, notify, tt } })

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [])

  const remainingS = Math.max(0, Math.ceil((endsAt - now) / 1000))

  useEffect(() => {
    if (remainingS > 0 || firedRef.current === endsAt) return
    firedRef.current = endsAt
    const current = latest.current
    void hapticTick()
    try { navigator.vibrate?.([120, 60, 120]) } catch { /* nicht unterstuetzt */ }
    if (current.sound) beep()
    // iOS-Safari ohne Home-Bildschirm hat kein Notification-API — der Effekt darf daran nie scheitern.
    try {
      if (current.notify && document.hidden && typeof Notification !== 'undefined') {
        const n = current.next
        showPageNotification(
          current.tt('rest_notify_title'),
          n ? current.tt('rest_notify_body', { exercise: n.exercise, set: n.set, target: n.target }) : current.tt('rest_done'),
          '/training',
          'tyd-rest',
        )
      }
    } catch {
      // ohne Benachrichtigung
    }
    const id = window.setTimeout(() => latest.current.onSkip(), 1200)
    return () => window.clearTimeout(id)
  }, [remainingS, endsAt])

  const progress = totalS > 0 ? Math.min(1, Math.max(0, remainingS / totalS)) : 0
  const title = remainingS === 0
    ? tt('rest_done')
    : next ? tt('rest_then_set', { set: next.set }) : tt('rest_timer')
  const targetLine = next ? [next.exercise, next.target].filter(Boolean).join(' · ') : ''

  return (
    <div
      role="timer"
      aria-live="off"
      aria-label={`${tt('rest_timer')} ${formatClock(remainingS)}`}
      style={{
        position: 'relative', overflow: 'hidden', borderRadius: 16,
        background: 'var(--lg-surface-2)', border: '1px solid var(--lg-hair)',
        padding: '12px 12px 12px 16px', display: 'flex', alignItems: 'center',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0, transformOrigin: 'left',
          transform: `scaleX(${progress})`, background: trainingTint(16),
          transition: 'transform 250ms linear',
        }}
      />
      <div style={{ position: 'relative', flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0, fontSize: 13, fontWeight: 500 }}>
          <span style={{ flexShrink: 0, color: 'var(--lg-text-2)' }}>{title}</span>
          {targetLine && (
            <span style={{ flex: 1, minWidth: 0, color: TRAINING_ACCENT, fontVariantNumeric: 'tabular-nums', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {targetLine}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ flex: 1, minWidth: 72, fontSize: 28, lineHeight: '36px', fontWeight: 400, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: 'var(--lg-text)' }}>
            {formatClock(remainingS)}
          </span>
          <Button tone="ghost" onClick={() => onAdjust(-15)} aria-label="−15 s" style={{ minWidth: 48, minHeight: 40, padding: '0 8px', borderRadius: 10, fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>−15</Button>
          <Button tone="ghost" onClick={() => onAdjust(15)} aria-label="+15 s" style={{ minWidth: 48, minHeight: 40, padding: '0 8px', borderRadius: 10, fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>+15</Button>
          <Button onClick={onSkip} style={{ minHeight: 40, padding: '0 16px', borderRadius: 10 }}>{tt('rest_continue')}</Button>
        </div>
      </div>
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
