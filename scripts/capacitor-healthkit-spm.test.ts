import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { bridgeSwift, packageSwift, parseCapPlugin, SPM_PACKAGE_NAME } from './capacitor-healthkit-spm.mjs'
import { fixName } from '@capacitor/cli/dist/plugin.js'

const root = join(__dirname, '..')
const objcFile = join(root, 'node_modules/@perfood/capacitor-healthkit/ios/Plugin/CapacitorHealthkitPlugin.m')
const healthTs = readFileSync(join(root, 'src/lib/health.ts'), 'utf8')

describe('capacitor-healthkit SPM-Hülle', () => {
  it('liest den CAP_PLUGIN-Block des installierten Plugins', () => {
    expect(existsSync(objcFile)).toBe(true)
    const parsed = parseCapPlugin(readFileSync(objcFile, 'utf8'))
    expect(parsed).toMatchObject({ className: 'CapacitorHealthkitPlugin', jsName: 'CapacitorHealthkit' })
  })

  it('registriert jede Methode, die src/lib/health.ts aufruft', () => {
    const parsed = parseCapPlugin(readFileSync(objcFile, 'utf8'))
    const registered = parsed.methods.map((m: { name: string }) => m.name)
    const used = [...healthTs.matchAll(/CapacitorHealthkit\.([A-Za-z]+)\(/g)].map(m => m[1])
    expect(used.length).toBeGreaterThan(0)
    for (const name of used) expect(registered).toContain(name)
  })

  it('erzeugt eine CAPBridgedPlugin-Erweiterung ohne @objc( (sonst zählt die CLI eine zweite Klasse)', () => {
    const swift = bridgeSwift(parseCapPlugin(readFileSync(objcFile, 'utf8')))
    expect(swift).toContain('extension CapacitorHealthkitPlugin: CAPBridgedPlugin')
    expect(swift).toContain('public var jsName: String { "CapacitorHealthkit" }')
    expect(swift).toContain('CAPPluginMethod(name: "queryHKitSampleType", returnType: CAPPluginReturnPromise)')
    expect(swift).not.toContain('@objc(')
  })

  it('Package.swift heißt so, wie cap sync das Produkt einträgt, und pinnt die installierte Capacitor-Version', () => {
    expect(fixName('@perfood/capacitor-healthkit')).toBe(SPM_PACKAGE_NAME)
    const template = readFileSync(join(root, 'ios/spm-plugins/capacitor-healthkit/Package.swift'), 'utf8')
    const version = JSON.parse(readFileSync(join(root, 'node_modules/@capacitor/ios/package.json'), 'utf8')).version
    const swift = packageSwift(template, version)
    expect(swift).toContain(`name: "${SPM_PACKAGE_NAME}"`)
    expect(swift).toMatch(new RegExp(`\\.library\\(\\s*name: "${SPM_PACKAGE_NAME}"`))
    expect(swift).toContain(`capacitor-swift-pm.git", exact: "${version}"`)
    expect(swift).not.toContain('__CAPACITOR_IOS_VERSION__')
  })

  it('lehnt eine .m ohne CAP_PLUGIN-Block ab', () => {
    expect(parseCapPlugin('#import <Foundation/Foundation.h>')).toBeNull()
  })
})
