// Berechnet die festen Injektionsstellen fuer „Stelle aus Liste waehlen“
// (src/lib/injectionSitePresets.ts) auf dem echten Modell: dieselbe
// Einpassung wie InjectionMapCanvas (Hoehe 2.85, y +0.12), Raycast von vorn
// bzw. hinten auf die Haut. Nur neu laufen lassen, wenn sich Modell
// oder Einpassung aendern -- dann auch MODEL_VERSION anheben.
//
//   npm i --no-save @gltf-transform/core@4 @gltf-transform/extensions@4 meshoptimizer
//   node scripts/compute-injection-site-presets.mjs
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'
import * as THREE from 'three'
await MeshoptDecoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
const doc = await io.read(new URL('../public/models/torso_hybrid_v1.web.glb', import.meta.url).pathname)
const root = new THREE.Group()
for (const node of doc.getRoot().listNodes()) {
  const mesh = node.getMesh(); if (!mesh) continue
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION'); const idx = prim.getIndices()
    const n = pos.getCount(); const arr = new Float32Array(n * 3); const el = []
    for (let i = 0; i < n; i++) { pos.getElement(i, el); arr.set(el, i * 3) }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(arr, 3))
    g.setIndex(new THREE.BufferAttribute(Uint32Array.from(idx.getArray()), 1))
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }))
    m.matrixAutoUpdate = false; m.matrix.fromArray(node.getWorldMatrix()); root.add(m)
  }
}
root.updateMatrixWorld(true)
const box = new THREE.Box3().setFromObject(root); const size = new THREE.Vector3(); const center = new THREE.Vector3()
box.getSize(size); box.getCenter(center)
const s = 2.85 / size.y
root.scale.setScalar(s); root.position.set(-center.x * s, -center.y * s + 0.12, -center.z * s); root.updateMatrixWorld(true)
globalThis.__root = root
const { inferBodyRegion } = await import('../src/lib/injectionGeometry.ts')
const rc = new THREE.Raycaster()
// Nach den Merkmalen des Modells gewaehlt, abgelesen am gerenderten Modell:
// Schritt y≈0.20, Hosenbund y≈0.56, Achsel y≈0.94, Schulter y≈1.1-1.3,
// Knie y≈-0.47. Nicht nach den Schwellen von inferBodyRegion -- die liegen
// fuer dieses Modell rund 0.3-0.4 zu tief (Bauch reicht dort bis -0.2,
// Brust beginnt bei 0.58).
const targets = [
  // Region, Richtung, Kandidaten (|x|, y) in Reihenfolge
  ['abdomen', 'front', [[0.12, 0.68], [0.13, 0.66], [0.11, 0.7]]],      // seitlich neben dem Nabel
  ['thigh', 'front', [[0.2, -0.1], [0.19, -0.08], [0.21, -0.12]]],      // Oberschenkel vorn-aussen, Mitte
  ['glute', 'back', [[0.17, 0.42], [0.16, 0.44], [0.18, 0.4]]],         // oberer aeusserer Quadrant
  ['deltoid', 'front', [[0.42, 1.1], [0.44, 1.08], [0.4, 1.12], [0.45, 1.05]]], // seitliche Schulter
  ['upper_arm', 'front', [[0.55, 0.87], [0.53, 0.9], [0.57, 0.85]]],    // Oberarm-Mitte
]
const out = []
for (const [region, from, cands] of targets) {
  for (const side of ['left', 'right']) {
    let found = null
    for (const [ax, y] of cands) {
      const x = side === 'right' ? ax : -ax
      const origin = new THREE.Vector3(x, y, from === 'front' ? 5 : -5)
      rc.set(origin, new THREE.Vector3(0, 0, from === 'front' ? -1 : 1))
      const hit = rc.intersectObject(globalThis.__root, true)[0]
      if (!hit) continue
      const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize()
      const r = (v) => ({ x: +v.x.toFixed(5), y: +v.y.toFixed(5), z: +v.z.toFixed(5) })
      const p = r(hit.point), nn = r(normal)
      // Getroffen werden muss die Vorder- bzw. Rueckseite, und der Treffer
      // muss auf der richtigen Koerperhaelfte liegen (Seite wie inferBodyRegion).
      const facing = from === 'front' ? nn.z > 0.35 : nn.z < -0.35
      if (facing && inferBodyRegion(p, nn).body_side === side) { found = { region, side, position: p, normal: nn }; break }
    }
    if (!found) throw new Error(`Kein Punkt fuer ${region} ${side}`)
    out.push(found)
  }
}
console.log(JSON.stringify(out, null, 2))
