import * as THREE from 'three'

// Fuer Handys verkleinerte Fassung (scripts/optimize-torso-model.mjs). Gleiche
// Geometrie wie die Quelle, daher bleibt MODEL_VERSION 'placeholder-v1' gueltig.
export const INJECTION_TORSO_MODEL_URL = '/models/torso_hybrid_v1.web.glb'
// Koordinatenraum der Pins (eingepasstes Modell). Bleibt stabil, damit
// Regionserkennung und Abstand zwischen gespeicherten Pins vergleichbar bleiben.
export const INJECTION_MODEL_VERSION = 'placeholder-v1'

// „Dunkles Glas“: eine dunkle, klar lackierte Oberfläche. Form und Muskeln
// liest man an den Spiegelungen und Kantenlichtern (InjectionGlassLight), die
// farbigen Pins heben sich davon deutlich ab.
const GLASS_BODY = {
  color: '#2b2f36',
  roughness: 0.32,
  metalness: 0,
  clearcoat: 1,
  clearcoatRoughness: 0.18,
}

// Aus dem Originalmaterial bleiben nur Normal-Map (Hautrelief) und Seite;
// Farb- und Rauheitstexturen wuerden den Glas-Look wieder aufheben.
function glassMaterialFor(source: THREE.Material): THREE.MeshPhysicalMaterial {
  const material = new THREE.MeshPhysicalMaterial(GLASS_BODY)
  material.side = source.side
  if (source instanceof THREE.MeshStandardMaterial && source.normalMap) {
    material.normalMap = source.normalMap
    material.normalMapType = source.normalMapType
    material.normalScale.copy(source.normalScale)
  }
  return material
}

export function prepareInjectionTorsoModel(root: THREE.Object3D): void {
  const converted = new Map<THREE.Material, THREE.MeshPhysicalMaterial>()
  const convert = (source: THREE.Material) => {
    let material = converted.get(source)
    if (!material) {
      material = glassMaterialFor(source)
      converted.set(source, material)
    }
    return material
  }
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    child.material = Array.isArray(child.material) ? child.material.map(convert) : convert(child.material)
  })
}
