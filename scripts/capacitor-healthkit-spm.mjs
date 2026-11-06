// Macht @perfood/capacitor-healthkit für Swift Package Manager nutzbar.
//
// Das Plugin bringt nur eine Podspec mit. Das iOS-Projekt nutzt aber SPM
// (ios/App/CapApp-SPM), und `npx cap sync` nimmt nur Plugins mit eigener
// Package.swift auf ("does not have a Package.swift"). Ohne diesen Schritt
// fehlt das Plugin im iOS-Build, jeder Aufruf aus src/lib/health.ts endet mit
// "not implemented on ios".
//
// Läuft als postinstall und legt in node_modules/@perfood/capacitor-healthkit:
//   - Package.swift (Vorlage aus ios/spm-plugins/capacitor-healthkit/)
//   - ios/Plugin/CapacitorHealthkitPlugin+SPM.swift: die CAPBridgedPlugin-
//     Konformität, erzeugt aus dem CAP_PLUGIN-Block der .m-Datei. Die .m selbst
//     schließt die Package.swift aus (SPM mischt kein Swift mit Objective-C).
//
// Schlägt nie fehl (sonst bräche jedes npm install, auch auf Vercel). Fehlt
// etwas, meldet es sich und `cap sync` warnt wieder wie vorher.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const BRIDGE_FILE = 'CapacitorHealthkitPlugin+SPM.swift'

/** Liest Klassenname, JS-Name und Methoden aus dem CAP_PLUGIN-Makro der .m-Datei. */
export function parseCapPlugin(objcSource) {
  const head = /CAP_PLUGIN\(\s*([A-Za-z0-9_]+)\s*,\s*"([^"]+)"/.exec(objcSource)
  if (!head) return null
  const methods = [...objcSource.matchAll(/CAP_PLUGIN_METHOD\(\s*([A-Za-z0-9_]+)\s*,\s*(CAPPluginReturn[A-Za-z]+)\s*\)/g)]
    .map(([, name, returnType]) => ({ name, returnType }))
  if (methods.length === 0) return null
  return { className: head[1], jsName: head[2], methods }
}

/** Swift-Erweiterung, die in Capacitor 6+ die Registrierung aus der .m ersetzt. */
export function bridgeSwift({ className, jsName, methods }) {
  const lines = methods.map(m => `            CAPPluginMethod(name: "${m.name}", returnType: ${m.returnType}),`)
  // Kein "@objc(" im Text: die Capacitor-CLI sucht danach Plugin-Klassen.
  return `// Erzeugt von scripts/capacitor-healthkit-spm.mjs — nicht von Hand ändern.
import Capacitor

extension ${className}: CAPBridgedPlugin {
    public var identifier: String { "${className}" }
    public var jsName: String { "${jsName}" }
    public var pluginMethods: [CAPPluginMethod] {
        [
${lines.join('\n')}
        ]
    }
}
`
}

function writeIfChanged(path, content) {
  if (existsSync(path) && readFileSync(path, 'utf8') === content) return
  writeFileSync(path, content)
}

/** Paketname, wie ihn die Capacitor-CLI (fixName in @capacitor/cli/dist/plugin.js) bildet. */
export const SPM_PACKAGE_NAME = 'PerfoodCapacitorHealthkit'

/** Vorlage mit der installierten @capacitor/ios-Version (wie CapApp-SPM: exact). */
export function packageSwift(template, capacitorIosVersion) {
  return template.replaceAll('__CAPACITOR_IOS_VERSION__', capacitorIosVersion)
}

export function patchHealthkitPlugin(repoRoot) {
  const pluginRoot = join(repoRoot, 'node_modules', '@perfood', 'capacitor-healthkit')
  const objcFile = join(pluginRoot, 'ios', 'Plugin', 'CapacitorHealthkitPlugin.m')
  const template = join(repoRoot, 'ios', 'spm-plugins', 'capacitor-healthkit', 'Package.swift')

  if (!existsSync(objcFile) || !existsSync(template)) {
    return { ok: false, reason: 'Plugin oder Vorlage nicht gefunden' }
  }
  const capIosPkg = join(repoRoot, 'node_modules', '@capacitor', 'ios', 'package.json')
  if (!existsSync(capIosPkg)) return { ok: false, reason: '@capacitor/ios nicht installiert' }
  const capIosVersion = JSON.parse(readFileSync(capIosPkg, 'utf8')).version
  const parsed = parseCapPlugin(readFileSync(objcFile, 'utf8'))
  if (!parsed) {
    return { ok: false, reason: 'CAP_PLUGIN-Block in CapacitorHealthkitPlugin.m nicht lesbar' }
  }

  writeIfChanged(join(pluginRoot, 'ios', 'Plugin', BRIDGE_FILE), bridgeSwift(parsed))
  writeIfChanged(join(pluginRoot, 'Package.swift'), packageSwift(readFileSync(template, 'utf8'), capIosVersion))
  return { ok: true, methods: parsed.methods.length }
}

// Nicht über Pfadvergleich mit argv[1] prüfen (Symlinks, Laufwerksbuchstaben):
// das Skript wird direkt gestartet, der Test importiert es nur.
if (!process.env.VITEST) {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const result = patchHealthkitPlugin(repoRoot)
  if (result.ok) {
    console.log(`[healthkit-spm] Package.swift + ${BRIDGE_FILE} geschrieben (${result.methods} Methoden).`)
  } else {
    console.warn(`[healthkit-spm] übersprungen: ${result.reason}. Apple Health fehlt dann im iOS-Build.`)
  }
}
