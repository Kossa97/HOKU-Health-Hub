// src/lib/injectionCameraFlight.test.ts
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { cameraFlightPose, planCameraFlight } from './injectionCameraFlight'

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

function poseAt(flight: ReturnType<typeof planCameraFlight>, t: number) {
  const position = new THREE.Vector3()
  const target = new THREE.Vector3()
  cameraFlightPose(flight, t, position, target)
  return { position, target }
}

describe('cameraFlightPose', () => {
  it('beginnt und endet genau an den Standorten', () => {
    const flight = planCameraFlight(v(0, 0.5, 2), v(0, 0.5, 0), v(1.2, 0.2, 0.3), v(0.3, 0.1, 0))
    const start = poseAt(flight, 0)
    const end = poseAt(flight, 1)
    expect(start.position.distanceTo(v(0, 0.5, 2))).toBeLessThan(1e-6)
    expect(start.target.distanceTo(v(0, 0.5, 0))).toBeLessThan(1e-6)
    expect(end.position.distanceTo(v(1.2, 0.2, 0.3))).toBeLessThan(1e-6)
    expect(end.target.distanceTo(v(0.3, 0.1, 0))).toBeLessThan(1e-6)
  })

  it('faehrt von vorn nach hinten um den Koerper herum, nicht hindurch', () => {
    const flight = planCameraFlight(v(0, 0.4, 1.5), v(0, 0.4, 0), v(0, 0.4, -1.5), v(0, 0.4, 0))
    for (const t of [0.25, 0.5, 0.75]) {
      const { position, target } = poseAt(flight, t)
      expect(position.distanceTo(target)).toBeCloseTo(1.5, 6)
      // auf Hoehe des Ziels, also seitlich herum statt ueber den Kopf
      expect(position.y).toBeCloseTo(0.4, 6)
    }
  })

  it('gleitet den Abstand linear', () => {
    const flight = planCameraFlight(v(0, 0, 4), v(0, 0, 0), v(0, 0, 1), v(0, 0, 0))
    expect(poseAt(flight, 0.5).position.z).toBeCloseTo(2.5, 6)
  })
})
