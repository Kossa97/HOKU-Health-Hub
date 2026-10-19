// src/components/injection3d/InjectionStudioLight.tsx
import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { INJECTION_STUDIO_LIGHTS } from '../../lib/injectionStudioLook'

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

export function InjectionStudioLight() {
  const { environmentIntensity, key, fill, rimLeft, rimRight } = INJECTION_STUDIO_LIGHTS
  return (
    <>
      <RoomReflections intensity={environmentIntensity} />
      <directionalLight position={key.position} intensity={key.intensity} color={key.color} />
      <directionalLight position={fill.position} intensity={fill.intensity} color={fill.color} />
      <directionalLight position={rimLeft.position} intensity={rimLeft.intensity} color={rimLeft.color} />
      <directionalLight position={rimRight.position} intensity={rimRight.intensity} color={rimRight.color} />
    </>
  )
}
