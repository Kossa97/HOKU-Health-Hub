import * as THREE from 'three'

// Fuer Handys verkleinerte Fassung (scripts/optimize-torso-model.mjs). Gleiche
// Geometrie wie die Quelle, daher bleibt MODEL_VERSION 'placeholder-v1' gueltig.
export const INJECTION_TORSO_MODEL_URL = '/models/torso_hybrid_v1.web.glb'

const FALLBACK_TORSO_COLOR = new THREE.Color('#d9b8a8')

function prepareMaterial(material: THREE.Material): THREE.Material {
  const next = material.clone()

  if (next instanceof THREE.MeshStandardMaterial || next instanceof THREE.MeshPhysicalMaterial) {
    if (!next.map && next.color.getHSL({ h: 0, s: 0, l: 0 }).l < 0.08) {
      next.color.copy(FALLBACK_TORSO_COLOR)
    }
    next.metalness = Math.min(next.metalness, 0.06)
    next.roughness = Math.min(next.roughness, 0.78)
    next.emissiveIntensity = 0
    next.needsUpdate = true
  }

  return next
}

export function prepareInjectionTorsoModel(root: THREE.Object3D): void {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return

    child.material = Array.isArray(child.material)
      ? child.material.map(prepareMaterial)
      : prepareMaterial(child.material)
  })
}
