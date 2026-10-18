// src/components/injection3d/InjectionGlassLight.tsx
import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { INJECTION_GLASS_LIGHTS } from '../../lib/injectionGlassLook'

function RoomReflections({ intensity }: { intensity: number }) {
  const get = useThree(state => state.get)

  useEffect(() => {
    // Die Szene gehoert react-three-fiber; per get() geholt statt als Hook-Wert,
    // weil die Umgebung genau dort eingetragen werden muss.
    const { gl, scene, invalidate } = get()
    const pmrem = new THREE.PMREMGenerator(gl)
    const room = new RoomEnvironment()
    const environment = pmrem.fromScene(room, 0.04).texture
    room.dispose()
    scene.environment = environment
    scene.environmentIntensity = intensity
    invalidate()
    return () => {
      if (scene.environment === environment) scene.environment = null
      environment.dispose()
      pmrem.dispose()
    }
  }, [get, intensity])

  return null
}

export function InjectionGlassLight() {
  const { environmentIntensity, front, rimLeft, rimRight } = INJECTION_GLASS_LIGHTS
  return (
    <>
      <RoomReflections intensity={environmentIntensity} />
      <directionalLight position={front.position} intensity={front.intensity} color={front.color} />
      <directionalLight position={rimLeft.position} intensity={rimLeft.intensity} color={rimLeft.color} />
      <directionalLight position={rimRight.position} intensity={rimRight.intensity} color={rimRight.color} />
    </>
  )
}
