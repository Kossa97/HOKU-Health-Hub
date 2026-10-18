import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { prepareInjectionTorsoModel } from './injectionModelMaterial'

describe('prepareInjectionTorsoModel', () => {
  it('gives every torso mesh the shared dark glass material', () => {
    const group = new THREE.Group()
    const sourceMaterial = new THREE.MeshStandardMaterial({
      color: '#000000',
      metalness: 1,
      roughness: 1,
      emissive: '#ffffff',
      emissiveIntensity: 1,
    })
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), sourceMaterial)
    const second = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), sourceMaterial)
    group.add(mesh, second)

    prepareInjectionTorsoModel(group)

    const material = mesh.material as THREE.MeshPhysicalMaterial
    expect(material).not.toBe(sourceMaterial)
    expect(material).toBeInstanceOf(THREE.MeshPhysicalMaterial)
    expect(second.material).toBe(material)
    // Dunkel, aber nicht schwarz: die Form bleibt über Spiegelungen lesbar.
    const { l } = material.color.getHSL({ h: 0, s: 0, l: 0 })
    expect(l).toBeGreaterThan(0.01)
    expect(l).toBeLessThan(0.1)
    expect(material.metalness).toBe(0)
    expect(material.clearcoat).toBe(1)
    expect(material.emissiveIntensity).toBe(1)
    expect(material.emissive.getHexString()).toBe('000000')
  })

  it('keeps the normal map and side of the source, drops color textures', () => {
    const normalMap = new THREE.Texture()
    const colorMap = new THREE.Texture()
    const source = new THREE.MeshStandardMaterial({ map: colorMap, normalMap, side: THREE.DoubleSide })
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), source)
    const group = new THREE.Group()
    group.add(mesh)

    prepareInjectionTorsoModel(group)

    const material = mesh.material as THREE.MeshPhysicalMaterial
    expect(material.normalMap).toBe(normalMap)
    expect(material.map).toBeNull()
    expect(material.side).toBe(THREE.DoubleSide)
  })
})
