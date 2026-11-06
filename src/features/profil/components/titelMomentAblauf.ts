/**
 * Ablauf und Regeln des Titel-Moments (TitelMoment.tsx), getrennt von der
 * Komponente: Bewegung per Web Animations API (nur transform/opacity, Zeiten
 * wie im Mockup Abschnitt 4), welche Leiste unter dem Namen steht und ob man
 * den neuen Titel schon trägt.
 */
import type { BadgeId } from '../lib/badgeIds'
import type { TitleMoment } from '../lib/titleMoment'
import { ladderOf, RANKS, TITLE_LADDERS, type TitleBadgeId } from '../lib/titles'

const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)'
const EASE_IN_OUT = 'cubic-bezier(0.77, 0, 0.175, 1)'

export type Animierbar = HTMLElement & { animate?: HTMLElement['animate'] }

export const prefersReducedMotion = () => {
  try { return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true } catch { return false }
}

/** Ablauf wie im Mockup (Abschnitt 4 „Ablauf“); bricht laufende Animationen ab. */
export function spieleMoment(root: HTMLElement, reduce: boolean) {
  if (typeof root.getAnimations === 'function') root.getAnimations({ subtree: true }).forEach(a => a.cancel())
  const q = (s: string) => root.querySelector<Animierbar>(s)
  const a = (el: Animierbar | null, kf: Keyframe[], duration: number, delay: number, easing = EASE_OUT) =>
    el?.animate?.(kf, { duration, delay, easing, fill: 'backwards' })
  if (reduce) {
    const fade = (el: Animierbar | null, delay: number) => a(el, [{ opacity: 0 }, { opacity: 1 }], 240, delay, 'ease-out')
    fade(q('.tm-scrim'), 0); fade(q('.tm-light'), 0); fade(q('.tm-body'), 60); fade(q('.tm-btns'), 160)
    return
  }
  const up = (px: number) => [{ opacity: 0, transform: `translateY(${px}px)` }, { opacity: 1, transform: 'none' }]
  a(q('.tm-scrim'), [{ opacity: 0 }, { opacity: 1 }], 320, 0)
  a(q('.tm-light'), [{ opacity: 0, transform: 'translateY(22%) scale(0.9)' }, { opacity: 1, transform: 'none' }], 1400, 100)
  a(q('.tm-eye'), up(6), 420, 250)
  a(q('.tm-chip'), [{ opacity: 0, transform: 'scale(0.92)' }, { opacity: 1, transform: 'none' }], 520, 380)
  a(q('.tm-shine'), [{ transform: 'translateX(-130%)' }, { transform: 'translateX(130%)' }], 950, 820, EASE_IN_OUT)
  a(q('.tm-name'), up(10), 520, 480)
  a(q('.tm-line'), up(8), 460, 640)
  a(q('.tm-sub'), up(8), 460, 720)
  a(q('.tm-steps'), [{ opacity: 0 }, { opacity: 1 }], 360, 820)
  a(q('.tm-steps [data-step="new"]'), [{ opacity: 0, transform: 'scaleX(0.3)' }, { opacity: 1, transform: 'none' }], 520, 960)
  a(q('.tm-ask'), up(8), 460, 1000)
  a(q('.tm-btns'), up(10), 460, 1080)
}

/** Leiste unter dem Namen: Ränge (6) oder die Stufen einer Leiter (3); ohne Leiter keine. */
export function stufen(moment: TitleMoment): { count: number; at: number } | null {
  if (moment.kind === 'rank') return { count: RANKS.length, at: RANKS.findIndex(r => r.id === moment.id) }
  const ladder = ladderOf(moment.id)
  if (!ladder) return null
  const ids = TITLE_LADDERS[ladder] as readonly BadgeId[]
  return { count: ids.length, at: ids.indexOf(moment.id) }
}

/** Trägt man den neuen Titel schon (er steigt dann von selbst mit)? */
export function traegtSchon(moment: TitleMoment, choice: TitleBadgeId | null): boolean {
  if (moment.kind === 'rank') return choice === null
  if (choice === null) return false
  const ladder = ladderOf(choice)
  return choice === moment.id || (ladder !== null && ladder === ladderOf(moment.id))
}

