import { Suspense, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { useTranslation } from 'react-i18next'
import * as THREE from 'three'
import { ArrowUpRight, Rotate3D } from 'lucide-react'
import type { Vector3Json } from '../../lib/injectionLogTypes'
import { INJECTION_TORSO_MODEL_URL, prepareInjectionTorsoModel } from '../../lib/injectionModelMaterial'

const MODEL_URL = INJECTION_TORSO_MODEL_URL
const HERO_MODEL_HEIGHT = 2.85
const HERO_MODEL_Y_OFFSET = 0.12
const HERO_PIN_COLORS = ['#22d3ee', '#34d399', '#a78bfa', '#fb7185']

export interface InjectionHeroPin {
  id: string
  position: Vector3Json
  normal: Vector3Json
}

function HeroTorsoModel() {
  const { scene } = useGLTF(MODEL_URL)

  const model = useMemo(() => {
    const root = scene.clone(true)
    const box = new THREE.Box3().setFromObject(root)
    const size = new THREE.Vector3()
    const center = new THREE.Vector3()
    box.getSize(size)
    box.getCenter(center)
    const scale = HERO_MODEL_HEIGHT / size.y
    root.scale.setScalar(scale)
    root.position.set(-center.x * scale, -center.y * scale + HERO_MODEL_Y_OFFSET, -center.z * scale)
    prepareInjectionTorsoModel(root)
    root.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = false
        child.receiveShadow = false
      }
    })
    return root
  }, [scene])

  return <primitive object={model} />
}

function HeroPin({ pin, color }: { pin: InjectionHeroPin; color: string }) {
  const { position, quaternion } = useMemo(() => {
    const normal = new THREE.Vector3(pin.normal.x, pin.normal.y, pin.normal.z)
    if (normal.lengthSq() < 0.001) normal.set(0, 0, 1)
    normal.normalize()

    const surface = new THREE.Vector3(pin.position.x, pin.position.y, pin.position.z)
    const position = surface.clone().addScaledVector(normal, 0.035)
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal)

    return { position, quaternion }
  }, [pin])

  return (
    <group position={position} quaternion={quaternion}>
      <mesh renderOrder={20}>
        <sphereGeometry args={[0.035, 24, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.65} roughness={0.18} metalness={0.05} />
      </mesh>
      <mesh renderOrder={19}>
        <torusGeometry args={[0.052, 0.006, 10, 32]} />
        <meshBasicMaterial color="#ecfeff" transparent opacity={0.72} />
      </mesh>
    </group>
  )
}

useGLTF.preload(MODEL_URL)

function TorsoPreview({ pins }: { pins: InjectionHeroPin[] }) {
  return (
    <div className="relative min-h-[208px] overflow-hidden rounded-[20px] border border-cyan-300/20 bg-[#06111b] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" aria-hidden="true">
      <div className="absolute inset-0 opacity-[0.13] [background-image:linear-gradient(rgba(125,211,252,0.42)_1px,transparent_1px),linear-gradient(90deg,rgba(125,211,252,0.34)_1px,transparent_1px)] [background-size:24px_24px]" />
      <div className="injection-map-glow absolute inset-x-7 top-2 h-24 rounded-full bg-cyan-300/10 blur-2xl" />
      <div className="injection-map-glow absolute bottom-0 left-1/2 h-20 w-56 -translate-x-1/2 rounded-[50%] bg-cyan-950/60 blur-xl" />

      <div className="absolute inset-0">
        <Canvas
          camera={{ position: [0, 0.22, 3.15], fov: 42, near: 0.05, far: 50 }}
          dpr={[1, 1.5]}
          frameloop="demand"
          gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
        >
          <ambientLight intensity={1.55} />
          <directionalLight position={[2.5, 3.2, 3.5]} intensity={2.2} />
          <directionalLight position={[-2.5, 1.2, 2.4]} intensity={0.85} color="#22d3ee" />
          <Suspense fallback={null}>
            <HeroTorsoModel />
            {pins.map((pin, index) => (
              <HeroPin key={pin.id} pin={pin} color={HERO_PIN_COLORS[index % HERO_PIN_COLORS.length]} />
            ))}
          </Suspense>
        </Canvas>
      </div>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,transparent_0,transparent_34%,rgba(6,17,27,0.18)_58%,rgba(6,17,27,0.58)_100%)]" />

      <div className="absolute left-3 top-3 grid h-11 w-11 place-items-center rounded-full border border-cyan-200/15 bg-black/24 text-cyan-200">
        <Rotate3D size={15} />
      </div>
    </div>
  )
}

export function InjectionTrackerHero({
  pins,
  onOpen,
}: {
  pins: InjectionHeroPin[]
  onOpen: () => void
}) {
  const { t } = useTranslation()

  return (
    <section
      aria-label={String(t('injection_pro_title', { defaultValue: '3D-Injektionstracker Pro' }))}
      // Inhalt auf durchscheinendem Glas wie jede Karte; der Torso trägt das Bild
      className="lg-surface overflow-hidden p-4"
    >

      <div className="relative grid gap-4 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
        <TorsoPreview pins={pins} />

        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold text-cyan-300">
            <Rotate3D size={14} aria-hidden="true" /> {t('injection_hero_kicker', { defaultValue: 'Pro Feature' })}
          </div>
          <h2 className="text-[20px] font-bold tracking-[0.019em] text-white">{t('injection_pro_title', { defaultValue: '3D-Injektionstracker Pro' })}</h2>
          <p className="mt-1 text-[15px] leading-snug" style={{ color: 'var(--lg-text-2)' }}>{t('injection_pro_subtitle', { defaultValue: 'Tracke deine Injektionen präzise und einfach auf einem 3D-Torso' })}</p>
        </div>
      </div>

      <div className="relative mt-4">
        <button
          type="button"
          onClick={onOpen}
          aria-label={String(t('injection_hero_open', { defaultValue: '3D Tracker öffnen' }))}
          className="btn-primary flex min-h-11 w-full items-center justify-center gap-2"
        >
          {t('injection_hero_open', { defaultValue: '3D Tracker öffnen' })} <ArrowUpRight size={14} aria-hidden="true" />
        </button>
      </div>
    </section>
  )
}
