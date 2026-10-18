import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { prepareInjectionTorsoModel } from './injectionModelMaterial'

describe('prepareInjectionTorsoModel', () => {
  it('makes imported torso materials visible without environment reflections', () => {
    const group = new THREE.Group()
    const sourceMaterial = new THREE.MeshStandardMaterial({
      color: '#000000',
      metalness: 1,
      roughness: 1,
      emissive: '#ffffff',
      emissiveIntensity: 1,
    })
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), sourceMaterial)
    group.add(mesh)

    prepareInjectionTorsoModel(group)

    const material = mesh.material as THREE.MeshStandardMaterial
    expect(material).not.toBe(sourceMaterial)
    expect(material.color.getHexString()).not.toBe('000000')
    expect(material.metalness).toBeLessThan(0.2)
    expect(material.roughness).toBeLessThan(0.9)
    expect(material.emissiveIntensity).toBe(0)
  })
})
