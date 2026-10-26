// src/lib/injectionGeometry.ts
import { differenceInCalendarDays, parseISO } from 'date-fns'
import type {
  BodyRegion,
  BodySide,
  InjectionLog3D,
  InjectionPinDraft,
  InjectionProximityWarning,
  Vector3Json,
} from './injectionLogTypes'

const CAUTION_DISTANCE = 0.09
const STRONG_DISTANCE = 0.04

function distance(a: Vector3Json, b: Vector3Json): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = a.z - b.z
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

function sideFromX(x: number): BodySide {
  if (x > 0.06) return 'right'
  if (x < -0.06) return 'left'
  return 'center'
}

// Merkmale des Modells (placeholder-v1) im eingepassten Koordinatenraum,
// am Modell gemessen (scripts/compute-injection-site-presets.mjs) und am
// eingefaerbten Modell geprueft. Die frueheren Schwellen lagen rund 0.3-0.4
// zu tief: ein Pin oben am Oberschenkel hiess „Bauch“, der Unterbauch
// „Brust“, und Gesaess kam praktisch nicht vor.
//
// Achtung: supabase-injection-regions-v2.sql rechnet dieselben Regeln in SQL
// nach (fuer gespeicherte Pins). Aenderungen hier nur zusammen mit dort.
export const BODY_LANDMARKS = {
  neckY: 1.32,        // darueber und schmal: Hals
  neckHalfWidth: 0.15,
  armpitY: 0.94,      // Achsel: darueber Brust/Schulter
  ribY: 0.86,         // Rippenbogen: vorn darueber Brust, nicht Bauch
  chestHalfWidth: 0.31, // weiter aussen ueber der Achsel: Schulter
  armHalfWidth: 0.38, // unter der Achsel weiter aussen: Arm
  elbowY: 0.62,
  wristY: 0.36,       // darunter am Arm: Hand
  hipY: 0.56,         // Hosenbund
  crotchY: 0.2,
  groinHalfWidth: 0.12,
  groinY: 0.32,
  gluteFoldY: 0.05,   // Unterkante Gesaess hinten
  kneeY: -0.47,
  ankleY: -1.12,
  backNormalZ: -0.35, // Normale zeigt nach hinten: Rueckseite
} as const

function regionFromPoint(point: Vector3Json, normal?: Vector3Json): BodyRegion {
  const L = BODY_LANDMARKS
  const back = (normal?.z ?? 0) < L.backNormalZ
  const ax = Math.abs(point.x)
  const y = point.y

  if (y > L.neckY && ax < L.neckHalfWidth) return 'outside_typical'
  if (y > L.armpitY) {
    if (ax > L.chestHalfWidth) return 'deltoid'
    return back ? 'torso' : 'chest'
  }
  if (ax > L.armHalfWidth) {
    if (y > L.elbowY) return 'upper_arm'
    return y > L.wristY ? 'forearm' : 'outside_typical'
  }
  if (y > L.ribY) return back ? 'torso' : 'chest'
  if (y > L.hipY) return back ? 'torso' : 'abdomen'
  if (y > L.crotchY) {
    if (back) return 'glute'
    if (ax < L.groinHalfWidth && y < L.groinY) return 'outside_typical'
    return 'abdomen'
  }
  if (back && y > L.gluteFoldY) return 'glute'
  if (y > L.kneeY) return 'thigh'
  if (y > L.ankleY) return 'lower_leg'
  return 'outside_typical'
}

export function inferBodyRegion(
  point: Vector3Json,
  normal?: Vector3Json,
): { body_region: BodyRegion; body_side: BodySide } {
  return {
    body_region: regionFromPoint(point, normal),
    body_side: sideFromX(point.x),
  }
}

export function filterRecentInjectionLogs(
  logs: InjectionLog3D[],
  now: Date,
  days: number,
): InjectionLog3D[] {
  return logs.filter(log => {
    const age = differenceInCalendarDays(now, parseISO(log.logged_at))
    return age >= 0 && age <= days
  })
}

export function proximityWarning(
  draft: InjectionPinDraft,
  logs: InjectionLog3D[],
  now: Date,
): InjectionProximityWarning {
  const recent = filterRecentInjectionLogs(logs, now, 7)
  let nearest: { log: InjectionLog3D; distance: number } | null = null

  for (const log of recent) {
    if (log.model_version !== draft.model_version) continue
    const d = distance(draft.position, log.position)
    if (!nearest || d < nearest.distance) nearest = { log, distance: d }
  }

  if (!nearest || nearest.distance > CAUTION_DISTANCE) {
    return { level: 'none', nearestLogId: null, distance: null }
  }

  const age = differenceInCalendarDays(now, parseISO(nearest.log.logged_at))
  return {
    level: nearest.distance <= STRONG_DISTANCE && age <= 3 ? 'strong' : 'caution',
    nearestLogId: nearest.log.id,
    distance: nearest.distance,
  }
}
