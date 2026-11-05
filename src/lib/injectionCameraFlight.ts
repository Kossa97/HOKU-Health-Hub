// src/lib/injectionCameraFlight.ts
import * as THREE from 'three'

/**
 * Kamerafahrt um den Torso herum statt geradeaus hindurch.
 *
 * Eine gerade Linie zwischen zwei Kamerastandorten fuehrt von vorn (Bauch)
 * nach hinten (Gesaess) mitten durch den Koerper: die Kamera taucht ein, das
 * Bild springt. Hier wandert stattdessen die Blickrichtung auf dem kuerzesten
 * Bogen (Kugel um das Ziel), der Abstand und das Ziel gleiten linear.
 */
export interface CameraFlight {
  fromTarget: THREE.Vector3
  toTarget: THREE.Vector3
  fromDir: THREE.Vector3
  fromLength: number
  toLength: number
  /** Drehung von der alten zur neuen Blickrichtung. */
  turn: THREE.Quaternion
}

const UP = new THREE.Vector3(0, 1, 0)

export function planCameraFlight(
  fromPosition: THREE.Vector3,
  fromTarget: THREE.Vector3,
  toPosition: THREE.Vector3,
  toTarget: THREE.Vector3,
): CameraFlight {
  const fromOffset = fromPosition.clone().sub(fromTarget)
  const toOffset = toPosition.clone().sub(toTarget)
  const fromLength = fromOffset.length()
  const toLength = toOffset.length()
  const fromDir = fromLength > 1e-6 ? fromOffset.divideScalar(fromLength) : new THREE.Vector3(0, 0, 1)
  const toDir = toLength > 1e-6 ? toOffset.divideScalar(toLength) : fromDir.clone()
  const turn = new THREE.Quaternion()
  // Genau gegenueber: jeder Bogen ist gleich kurz, also um die Hochachse
  // (um den Koerper herum, nicht ueber den Kopf).
  if (fromDir.dot(toDir) < -0.9999) turn.setFromAxisAngle(UP, Math.PI)
  else turn.setFromUnitVectors(fromDir, toDir)
  return { fromTarget: fromTarget.clone(), toTarget: toTarget.clone(), fromDir, fromLength, toLength, turn }
}

const IDENTITY = new THREE.Quaternion()
const step = new THREE.Quaternion()

/** Lage bei Fortschritt `t` (0..1, schon geglaettet) in `outPosition`/`outTarget`. */
export function cameraFlightPose(flight: CameraFlight, t: number, outPosition: THREE.Vector3, outTarget: THREE.Vector3) {
  outTarget.lerpVectors(flight.fromTarget, flight.toTarget, t)
  step.slerpQuaternions(IDENTITY, flight.turn, t)
  const length = flight.fromLength + (flight.toLength - flight.fromLength) * t
  outPosition.copy(flight.fromDir).applyQuaternion(step).multiplyScalar(length).add(outTarget)
}
