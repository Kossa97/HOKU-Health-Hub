// src/components/injection3d/InjectionMapCanvas.tsx
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { ContactShadows, OrbitControls, useGLTF } from '@react-three/drei'
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import * as THREE from 'three'
import { inferBodyRegion } from '../../lib/injectionGeometry'
import { INJECTION_TORSO_MODEL_URL, prepareInjectionTorsoModel } from '../../lib/injectionModelMaterial'
import { getInjectionPinAgeColor } from '../../lib/injectionPinPresentation'
import type { InjectionLog3D, InjectionPinDraft } from '../../lib/injectionLogTypes'
import { InjectionPin } from './InjectionPin'

// Coordinate space pins are placed in (the fitted visible model). Kept stable so
// region inference + proximity stay comparable across saved pins.
const MODEL_VERSION = 'placeholder-v1'
const MODEL_URL = INJECTION_TORSO_MODEL_URL
const LONG_PRESS_MS = 420
// Wie weit der Finger waehrend des Long-Press wandern darf (CSS-Pixel).
const LONG_PRESS_SLOP_PX = 8

// Fit params: scale/position the model into the region-inference coordinate space
// so inferBodyRegion thresholds stay valid while the torso fills the mobile canvas.
const FIT_HEIGHT = 2.85
const FIT_Y_OFFSET = 0.12

// Camera framing so the body fills the (portrait) canvas. Lower distance = fuller.
const CAMERA_DISTANCE = 4.85
const CAMERA_FOV = 48
const DEFAULT_CAMERA_TARGET_Y = FIT_Y_OFFSET
const SHEET_AWARE_FOCUS_Y_OFFSET = -0.22

type LightPosition = [number, number, number]

// Local lights keep the model readable from front and back without remote HDR assets.
const INJECTION_MAP_LIGHTS = {
  ambient: 1.02,
  key: { position: [2.5, 3.1, 3] as LightPosition, intensity: 2.05 },
  rearFill: { position: [-2.6, 2.4, -3.2] as LightPosition, intensity: 1.5, color: '#dff7ff' },
  rim: { position: [0, 1.4, -4.5] as LightPosition, intensity: 1.15, color: '#7dd3fc' },
  lowerFill: { position: [0, -0.55, 2.4] as LightPosition, intensity: 0.5, color: '#ffe4c7' },
}

export interface InjectionFocusRequest {
  log: InjectionLog3D
  requestId: number
  sheetOpen?: boolean
}

type OrbitControlsApi = { target: THREE.Vector3; update: () => void }

useGLTF.preload(MODEL_URL)

function toJson(v: THREE.Vector3) {
  return { x: Number(v.x.toFixed(5)), y: Number(v.y.toFixed(5)), z: Number(v.z.toFixed(5)) }
}

// Visible textured torso. Raycast directly on long-press (a one-shot pick, not
// per-frame) so pins land exactly on the surface. A decimated simplified hit
// mesh remains a worthwhile later asset-pipeline optimization.
function Torso({ onLongPress }: { onLongPress: (event: ThreeEvent<PointerEvent>) => void }) {
  const { scene } = useGLTF(MODEL_URL)
  const cancelActivePress = useRef<(() => void) | null>(null)

  const model = useMemo(() => {
    const root = scene.clone(true)
    const box = new THREE.Box3().setFromObject(root)
    const size = new THREE.Vector3()
    const center = new THREE.Vector3()
    box.getSize(size)
    box.getCenter(center)
    const s = FIT_HEIGHT / size.y
    root.scale.setScalar(s)
    root.position.set(-center.x * s, -center.y * s + FIT_Y_OFFSET, -center.z * s)
    prepareInjectionTorsoModel(root)
    return root
  }, [scene])

  useEffect(() => () => cancelActivePress.current?.(), [])

  // Nur pointerdown geht durch react-three-fiber. Bewegung und Loslassen
  // werden am window beobachtet: Haette der Torso onPointerMove/Leave,
  // wuerde r3f bei jeder Fingerbewegung -- auch beim Drehen -- alle
  // Dreiecke des Modells raycasten.
  const startPress = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    cancelActivePress.current?.()
    const { pointerId, clientX, clientY } = event.nativeEvent
    const timer = window.setTimeout(() => {
      cancel()
      onLongPress(event)
    }, LONG_PRESS_MS)
    const onMove = (move: PointerEvent) => {
      if (move.pointerId !== pointerId) return
      if (Math.hypot(move.clientX - clientX, move.clientY - clientY) > LONG_PRESS_SLOP_PX) cancel()
    }
    const onEnd = (end: PointerEvent) => {
      if (end.pointerId === pointerId) cancel()
    }
    function cancel() {
      window.clearTimeout(timer)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onEnd)
      window.removeEventListener('pointercancel', onEnd)
      if (cancelActivePress.current === cancel) cancelActivePress.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onEnd)
    window.addEventListener('pointercancel', onEnd)
    cancelActivePress.current = cancel
  }

  return (
    <group onPointerDown={startPress}>
      <primitive object={model} />
    </group>
  )
}

// Frames the body to fill the canvas by driving the active camera + controls
// imperatively (declarative camera props don't take effect in this setup).
function resetCameraFrame(
  camera: THREE.Camera,
  controls: OrbitControlsApi | null,
) {
  const cam = camera as THREE.PerspectiveCamera
  cam.position.set(0, DEFAULT_CAMERA_TARGET_Y, CAMERA_DISTANCE)
  cam.fov = CAMERA_FOV
  cam.zoom = 1
  cam.near = 0.05
  cam.far = 50
  cam.updateProjectionMatrix()

  if (controls) {
    controls.target.set(0, DEFAULT_CAMERA_TARGET_Y, 0)
    controls.update()
  }
}

function focusTargetForRequest(point: THREE.Vector3, sheetOpen = false) {
  const target = point.clone()
  if (sheetOpen) target.y += SHEET_AWARE_FOCUS_Y_OFFSET
  return target
}

function CameraRig({ focusRequest, resetRequestId }: { focusRequest: InjectionFocusRequest | null; resetRequestId: number }) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as OrbitControlsApi | null
  const warmupFrames = useRef(0)
  const animation = useRef<{
    fromPosition: THREE.Vector3
    toPosition: THREE.Vector3
    fromTarget: THREE.Vector3
    toTarget: THREE.Vector3
    progress: number
  } | null>(null)

  useLayoutEffect(() => {
    resetCameraFrame(camera, controls)
    warmupFrames.current = 0
  }, [camera, controls])

  useEffect(() => {
    animation.current = null
    resetCameraFrame(camera, controls)
    warmupFrames.current = 0
  }, [camera, controls, resetRequestId])

  useEffect(() => {
    if (!focusRequest || !controls) return

    const point = new THREE.Vector3(
      focusRequest.log.position.x,
      focusRequest.log.position.y,
      focusRequest.log.position.z,
    )
    const normal = new THREE.Vector3(
      focusRequest.log.normal.x,
      focusRequest.log.normal.y,
      focusRequest.log.normal.z,
    )
    if (normal.lengthSq() < 0.001) normal.set(0, 0, 1)
    normal.normalize()

    const target = focusTargetForRequest(point, focusRequest.sheetOpen)

    animation.current = {
      fromPosition: camera.position.clone(),
      toPosition: target.clone().addScaledVector(normal, 0.82),
      fromTarget: controls.target.clone(),
      toTarget: target,
      progress: 0,
    }
  }, [camera, controls, focusRequest])

  useFrame((_, delta) => {
    const active = animation.current
    if (active) {
      active.progress = Math.min(1, active.progress + delta / 0.55)
      const t = active.progress * active.progress * (3 - 2 * active.progress)
      camera.position.lerpVectors(active.fromPosition, active.toPosition, t)
      controls?.target.lerpVectors(active.fromTarget, active.toTarget, t)
      controls?.update()
      if (active.progress >= 1) animation.current = null
      return
    }

    if (warmupFrames.current >= 6) return
    resetCameraFrame(camera, controls)
    warmupFrames.current += 1
  })

  return null
}

function Scene({
  draftPin,
  logs,
  visibleLogIds,
  focusRequest,
  activeLogId,
  onDraftPinChange,
  onLogFocus,
  resetRequestId,
}: {
  draftPin: InjectionPinDraft | null
  logs: InjectionLog3D[]
  visibleLogIds: Set<string>
  focusRequest: InjectionFocusRequest | null
  activeLogId?: string | null
  onDraftPinChange: (pin: InjectionPinDraft) => void
  onLogFocus: (log: InjectionLog3D) => void
  resetRequestId: number
}) {
  const handleLongPress = (event: ThreeEvent<PointerEvent>) => {
    const point = event.point
    const normal = event.face?.normal.clone() ?? new THREE.Vector3(0, 0, 1)
    normal.transformDirection(event.object.matrixWorld).normalize()
    const positionJson = toJson(point)
    const normalJson = toJson(normal)
    const inferred = inferBodyRegion(positionJson, normalJson)
    onDraftPinChange({
      model_version: MODEL_VERSION,
      position: positionJson,
      normal: normalJson,
      body_region: inferred.body_region,
      body_side: inferred.body_side,
      uv: event.uv ? { x: Number(event.uv.x.toFixed(5)), y: Number(event.uv.y.toFixed(5)) } : null,
      camera_state: null,
    })
  }

  return (
    <>
      <CameraRig focusRequest={focusRequest} resetRequestId={resetRequestId} />
      <ambientLight intensity={INJECTION_MAP_LIGHTS.ambient} />
      <directionalLight
        position={INJECTION_MAP_LIGHTS.key.position}
        intensity={INJECTION_MAP_LIGHTS.key.intensity}
      />
      <directionalLight
        position={INJECTION_MAP_LIGHTS.rearFill.position}
        intensity={INJECTION_MAP_LIGHTS.rearFill.intensity}
        color={INJECTION_MAP_LIGHTS.rearFill.color}
      />
      <directionalLight
        position={INJECTION_MAP_LIGHTS.rim.position}
        intensity={INJECTION_MAP_LIGHTS.rim.intensity}
        color={INJECTION_MAP_LIGHTS.rim.color}
      />
      <pointLight
        position={INJECTION_MAP_LIGHTS.lowerFill.position}
        intensity={INJECTION_MAP_LIGHTS.lowerFill.intensity}
        color={INJECTION_MAP_LIGHTS.lowerFill.color}
        distance={4}
      />
      <Suspense fallback={null}>
        <Torso onLongPress={handleLongPress} />
      </Suspense>
      {logs.filter(log => visibleLogIds.has(log.id)).map(log => (
        <InjectionPin
          key={log.id}
          position={log.position}
          normal={log.normal}
          reference
          active={log.id === activeLogId}
          color={getInjectionPinAgeColor(log.logged_at)}
          onClick={() => onLogFocus(log)}
        />
      ))}
      {draftPin && <InjectionPin position={draftPin.position} normal={draftPin.normal} active />}
      <ContactShadows opacity={0.22} scale={4} blur={2.5} far={3} frames={1} position={[0, -1.22, 0]} />
      <OrbitControls makeDefault enablePan enableZoom enableRotate screenSpacePanning touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }} minDistance={0.65} maxDistance={7} target={[0, DEFAULT_CAMERA_TARGET_Y, 0]} />
    </>
  )
}

export function InjectionMapCanvas({
  height = 'min(62vh, 540px)',
  minHeight = 360,
  resetRequestId = 0,
  ...props
}: {
  draftPin: InjectionPinDraft | null
  logs: InjectionLog3D[]
  visibleLogIds: Set<string>
  focusRequest: InjectionFocusRequest | null
  activeLogId?: string | null
  onDraftPinChange: (pin: InjectionPinDraft) => void
  onLogFocus: (log: InjectionLog3D) => void
  height?: CSSProperties['height']
  minHeight?: CSSProperties['minHeight']
  resetRequestId?: number
}) {
  const huelle = useRef<HTMLDivElement | null>(null)
  const renderer = useRef<THREE.WebGLRenderer | null>(null)
  // `always` ist der Standard: 60 Bilder je Sekunde, auch wenn nichts
  // passiert und auch, wenn niemand hinsieht. Die Szene animiert ueber
  // `useFrame`, also kann sie nicht auf `demand` -- sie darf nur ruhen,
  // solange sie nicht zu sehen ist.
  const [sichtbar, setSichtbar] = useState(true)

  useEffect(() => {
    const element = huelle.current
    if (!element || typeof IntersectionObserver === 'undefined') return
    const beobachter = new IntersectionObserver(
      ([eintrag]) => setSichtbar(eintrag.isIntersecting),
      { rootMargin: '64px' },
    )
    beobachter.observe(element)
    const beiTabwechsel = () => setSichtbar(
      document.visibilityState === 'visible' && Boolean(element.getBoundingClientRect().height),
    )
    document.addEventListener('visibilitychange', beiTabwechsel)
    return () => {
      beobachter.disconnect()
      document.removeEventListener('visibilitychange', beiTabwechsel)
    }
  }, [])

  /**
   * Den WebGL-Kontext beim Ausbauen wirklich hergeben.
   *
   * react-three-fiber raeumt seine Objekte auf, ruft aber kein
   * `forceContextLoss()`. Der Kontext haengt dann bis zur Garbage Collection
   * am Leben -- und Browser erlauben nur rund sechzehn gleichzeitig. Wer
   * zwischen Startseite und Kalender hin und her geht, sammelt sie also an,
   * bis der Browser die aeltesten entzieht: in der Konsole stand reihenweise
   * „THREE.WebGLRenderer: Context Lost." auf Seiten, die selbst kein 3D
   * zeigen.
   */
  useEffect(() => () => {
    const gl = renderer.current
    if (!gl) return
    renderer.current = null
    try {
      gl.forceContextLoss()
    } catch {
      // Ein bereits verlorener Kontext ist genau das, was wir wollten.
    }
    gl.dispose()
  }, [])

  return (
    <div ref={huelle} style={{ position: 'relative', height, minHeight, borderRadius: 24, overflow: 'hidden', touchAction: 'none', overscrollBehavior: 'none', userSelect: 'none', background: 'radial-gradient(circle at 50% 20%, rgba(0,204,245,0.16), transparent 42%), #07111d' }}>
      <Canvas
        camera={{ position: [0, DEFAULT_CAMERA_TARGET_Y, CAMERA_DISTANCE], fov: CAMERA_FOV, near: 0.05, far: 50 }}
        dpr={[1, 1.35]}
        frameloop={sichtbar ? 'always' : 'never'}
        onCreated={({ camera, gl }) => { renderer.current = gl; resetCameraFrame(camera, null) }}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      >
        <Scene {...props} resetRequestId={resetRequestId} />
      </Canvas>
    </div>
  )
}



