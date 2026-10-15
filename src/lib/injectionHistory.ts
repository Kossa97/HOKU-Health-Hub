import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { InjectionLog3D } from './injectionLogTypes'
import { BODY_LANDMARKS as L } from './injectionGeometry'

export type InjectionHistoryDays = 7 | 14 | 30 | 60 | 90 | 'all'

export function filterInjectionHistory(
  logs: InjectionLog3D[],
  now: Date,
  days: InjectionHistoryDays = 7,
): InjectionLog3D[] {
  if (days === 'all') return logs

  return logs.filter(log => {
    const age = differenceInCalendarDays(now, parseISO(log.logged_at))
    return age >= 0 && age <= days
  })
}

export function hasExactInjectionPosition(log: InjectionLog3D): boolean {
  if (log.model_version === 'legacy-2d') return false
  const { x, y, z } = log.position
  return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)
    && Math.abs(x) + Math.abs(y) + Math.abs(z) > 0.001
}

function regionLabel(log: InjectionLog3D): string {
  switch (log.body_region) {
    case 'abdomen': return 'Bauch'
    case 'chest': return 'Brust'
    case 'thigh': return 'Oberschenkel'
    case 'lower_leg': return 'Unterschenkel'
    case 'deltoid': return 'Schulter'
    case 'upper_arm': return 'Oberarm'
    case 'forearm': return 'Unterarm'
    case 'glute': return 'Gesäß'
    case 'torso': return 'Rumpf'
    default: return 'Körperstelle'
  }
}

function sideLabel(log: InjectionLog3D): string {
  if (log.body_side === 'left') return 'links'
  if (log.body_side === 'right') return 'rechts'
  return 'mittig'
}

function thirds(y: number, bottom: number, top: number): string {
  const third = (top - bottom) / 3
  if (y > top - third) return 'oben'
  if (y < bottom + third) return 'unten'
  return 'mittig'
}

// Drittel bzw. Haelften der jeweiligen Region, aus BODY_LANDMARKS.
function verticalLabel(log: InjectionLog3D): string {
  const y = log.position.y
  if (log.body_region === 'abdomen') return thirds(y, L.crotchY, L.ribY)
  if (log.body_region === 'thigh') return thirds(y, L.kneeY, L.crotchY)
  if (log.body_region === 'glute') return y > (L.gluteFoldY + L.hipY) / 2 ? 'oben' : 'unten'
  return ''
}

function lateralLabel(log: InjectionLog3D): string {
  const distanceFromCenter = Math.abs(log.position.x)
  if (distanceFromCenter > 0.3) return 'außen'
  if (distanceFromCenter < 0.16) return 'innen'
  return 'mittig'
}

function surfaceLabel(log: InjectionLog3D): string {
  if (log.normal.z > 0.35) return 'Vorderseite'
  if (log.normal.z < -0.35) return 'Rückseite'
  return 'Außenseite'
}

export function formatInjectionSite(log: InjectionLog3D): string {
  if (!hasExactInjectionPosition(log)) return 'Alter Eintrag · keine genaue Position'

  const detail = [verticalLabel(log), lateralLabel(log)].filter(Boolean).join(' ')
  return `${regionLabel(log)} ${sideLabel(log)} · ${detail} · ${surfaceLabel(log)}`
}

export function isDoseConfirmationOpen(log: InjectionLog3D): boolean {
  return log.dose_log_id != null && log.dose_taken === null
}
