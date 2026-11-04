#!/usr/bin/env node
/**
 * Prüft „In Hoku öffnen“ (Profil 2c, Spec 5): AASA-Datei, assetlinks.json,
 * iOS-Entitlement, Android-Intent-Filter und die IDs in den nativen Projekten.
 *
 *   npm run applinks:check          Dateien prüfen; scheitert, solange Platzhalter drin sind
 *   npm run applinks:check -- --live  zusätzlich die ausgelieferten Dateien auf hokuhealth.app
 *
 * Der normale Testlauf (scripts/applinks.test.ts) prüft nur den Aufbau und lässt
 * Platzhalter zu. Was einzutragen ist: docs/applinks/EINRICHTEN.md.
 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export const FILES = {
  aasa: 'public/.well-known/apple-app-site-association',
  assetlinks: 'public/.well-known/assetlinks.json',
  entitlements: 'ios/App/App/App.entitlements',
  pbxproj: 'ios/App/App.xcodeproj/project.pbxproj',
  capacitorConfig: 'capacitor.config.ts',
  manifest: 'android/app/src/main/AndroidManifest.xml',
  gradle: 'android/app/build.gradle',
  appLinksTs: 'src/features/applinks/lib/appLinks.ts',
}

export const TEAM_ID_PLACEHOLDER = 'TEAMID_PLATZHALTER'
export const SHA256_PLACEHOLDER_PREFIX = 'SHA256_PLATZHALTER'
const TEAM_ID = /^[A-Z0-9]{10}$/
const SHA256 = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/
const HANDLE_ALL_URLS = 'delegate_permission/common.handle_all_urls'

export function readAppLinkFiles(root) {
  return Object.fromEntries(Object.entries(FILES).map(([key, path]) => [key, readFileSync(join(root, path), 'utf8')]))
}

function constant(source, name) {
  return new RegExp(`export const ${name} = '([^']+)'`).exec(source)?.[1] ?? null
}

function json(text, label, errors) {
  try {
    return JSON.parse(text)
  } catch (error) {
    errors.push(`${label}: kein gültiges JSON (${error.message})`)
    return null
  }
}

/**
 * Prüft die Dateiinhalte. `allowPlaceholders`: Platzhalter sind erlaubt (Testlauf),
 * sonst je Platzhalter ein Fehler (vor dem Store-Update).
 * @returns {{ errors: string[], placeholders: string[] }}
 */
export function checkAppLinkFiles(files, { allowPlaceholders = false } = {}) {
  const errors = []
  const placeholders = []

  const host = constant(files.appLinksTs, 'APP_LINK_HOST')
  const iosBundle = constant(files.appLinksTs, 'IOS_BUNDLE_ID')
  const androidPackage = constant(files.appLinksTs, 'ANDROID_PACKAGE')
  if (!host || !iosBundle || !androidPackage) errors.push(`${FILES.appLinksTs}: APP_LINK_HOST, IOS_BUNDLE_ID oder ANDROID_PACKAGE fehlt`)

  // iOS: Bundle-ID im Xcode-Projekt und in capacitor.config.ts
  const bundleIds = [...files.pbxproj.matchAll(/PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/g)].map(m => m[1].trim())
  if (!bundleIds.length || bundleIds.some(id => id !== iosBundle)) {
    errors.push(`${FILES.pbxproj}: PRODUCT_BUNDLE_IDENTIFIER ${JSON.stringify(bundleIds)} passt nicht zu ${iosBundle}`)
  }
  const capAppId = /appId:\s*'([^']+)'/.exec(files.capacitorConfig)?.[1]
  if (capAppId !== iosBundle) errors.push(`${FILES.capacitorConfig}: appId ${capAppId} passt nicht zu ${iosBundle}`)

  const entitlementRefs = [...files.pbxproj.matchAll(/CODE_SIGN_ENTITLEMENTS = ([^;]+);/g)].map(m => m[1].trim())
  if (entitlementRefs.length < 2 || entitlementRefs.some(ref => ref !== 'App/App.entitlements')) {
    errors.push(`${FILES.pbxproj}: CODE_SIGN_ENTITLEMENTS = App/App.entitlements fehlt in Debug oder Release`)
  }
  if (!/<key>com\.apple\.developer\.associated-domains<\/key>\s*<array>[\s\S]*?<\/array>/.test(files.entitlements)
    || !files.entitlements.includes(`<string>applinks:${host}</string>`)) {
    errors.push(`${FILES.entitlements}: Associated Domains mit applinks:${host} fehlt`)
  }

  // iOS: apple-app-site-association
  const aasa = json(files.aasa, FILES.aasa, errors)
  const details = aasa?.applinks?.details
  if (aasa && (!Array.isArray(details) || details.length === 0)) errors.push(`${FILES.aasa}: applinks.details fehlt`)
  for (const detail of Array.isArray(details) ? details : []) {
    const appIds = Array.isArray(detail.appIDs) ? detail.appIDs : []
    if (!appIds.length) errors.push(`${FILES.aasa}: appIDs fehlt`)
    for (const appId of appIds) {
      const [team, ...rest] = String(appId).split('.')
      if (rest.join('.') !== iosBundle) errors.push(`${FILES.aasa}: ${appId} passt nicht zur Bundle-ID ${iosBundle}`)
      if (team === TEAM_ID_PLACEHOLDER) placeholders.push(TEAM_ID_PLACEHOLDER)
      else if (!TEAM_ID.test(team)) errors.push(`${FILES.aasa}: Team-ID ${team} hat nicht 10 Zeichen A–Z/0–9`)
    }
    const components = Array.isArray(detail.components) ? detail.components : []
    if (!components.some(c => c?.['/'] === '/u/*' && !c.exclude)) errors.push(`${FILES.aasa}: Komponente {"/": "/u/*"} fehlt`)
    if (components.some(c => c?.['/'] === '*' || c?.['/'] === '/*')) errors.push(`${FILES.aasa}: zu weite Komponente, nur /u/*`)
  }

  // Android: assetlinks.json
  const links = json(files.assetlinks, FILES.assetlinks, errors)
  const statements = Array.isArray(links) ? links : []
  if (links && !statements.length) errors.push(`${FILES.assetlinks}: keine Einträge`)
  for (const statement of statements) {
    if (!statement?.relation?.includes?.(HANDLE_ALL_URLS)) errors.push(`${FILES.assetlinks}: relation ${HANDLE_ALL_URLS} fehlt`)
    const target = statement?.target ?? {}
    if (target.namespace !== 'android_app') errors.push(`${FILES.assetlinks}: namespace muss android_app sein`)
    if (target.package_name !== androidPackage) errors.push(`${FILES.assetlinks}: package_name ${target.package_name} passt nicht zu ${androidPackage}`)
    const prints = Array.isArray(target.sha256_cert_fingerprints) ? target.sha256_cert_fingerprints : []
    if (!prints.length) errors.push(`${FILES.assetlinks}: sha256_cert_fingerprints fehlt`)
    for (const print of prints) {
      if (String(print).startsWith(SHA256_PLACEHOLDER_PREFIX)) placeholders.push(print)
      else if (!SHA256.test(print)) errors.push(`${FILES.assetlinks}: ${print} ist kein SHA-256 im Format AA:BB:… (32 Paare, Großbuchstaben)`)
    }
  }

  // Android: applicationId und Intent-Filter
  const applicationId = /applicationId\s+"([^"]+)"/.exec(files.gradle)?.[1]
  if (applicationId !== androidPackage) errors.push(`${FILES.gradle}: applicationId ${applicationId} passt nicht zu ${androidPackage}`)
  const filters = [...files.manifest.matchAll(/<intent-filter\b([^>]*)>([\s\S]*?)<\/intent-filter>/g)]
  const appLinkFilter = filters.find(([, , body]) => body.includes(`android:host="${host}"`))
  if (!appLinkFilter) {
    errors.push(`${FILES.manifest}: intent-filter für ${host} fehlt`)
  } else {
    const [, attrs, body] = appLinkFilter
    const needs = [
      ['android:autoVerify="true"', attrs],
      ['android.intent.action.VIEW', body],
      ['android.intent.category.DEFAULT', body],
      ['android.intent.category.BROWSABLE', body],
      ['android:scheme="https"', body],
      ['android:pathPrefix="/u/"', body],
    ]
    for (const [needle, where] of needs) if (!where.includes(needle)) errors.push(`${FILES.manifest}: ${needle} fehlt im App-Link-Filter`)
    if (/android:scheme="http"/.test(body)) errors.push(`${FILES.manifest}: App-Link-Filter nur mit https`)
  }

  const unique = [...new Set(placeholders)]
  if (!allowPlaceholders) for (const p of unique) errors.push(`Platzhalter ${p} noch nicht ersetzt (docs/applinks/EINRICHTEN.md)`)
  return { errors, placeholders: unique }
}

async function checkLive(host, files) {
  const errors = []
  for (const [key, path] of [['aasa', '/.well-known/apple-app-site-association'], ['assetlinks', '/.well-known/assetlinks.json']]) {
    const url = `https://${host}${path}`
    try {
      const res = await fetch(url, { redirect: 'manual' })
      if (res.status !== 200) { errors.push(`${url}: Status ${res.status} (ohne Weiterleitung erwartet: 200)`); continue }
      const type = res.headers.get('content-type') ?? ''
      if (!type.startsWith('application/json')) errors.push(`${url}: Content-Type ${type || '(leer)'} statt application/json`)
      const body = await res.text()
      let same = false
      try { same = JSON.stringify(JSON.parse(body)) === JSON.stringify(JSON.parse(files[key])) } catch { same = false }
      if (!same) errors.push(`${url}: Inhalt weicht von ${FILES[key]} ab (oder ist kein JSON, z. B. index.html)`)
    } catch (error) {
      errors.push(`${url}: nicht erreichbar (${error.message})`)
    }
  }
  return errors
}

async function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..')
  const files = readAppLinkFiles(root)
  const { errors } = checkAppLinkFiles(files)
  if (process.argv.includes('--live')) {
    const host = constant(files.appLinksTs, 'APP_LINK_HOST')
    errors.push(...await checkLive(host, files))
  }
  if (errors.length) {
    console.error(`applinks:check: ${errors.length} Problem(e)\n- ${errors.join('\n- ')}`)
    process.exit(1)
  }
  console.log('applinks:check: alles eingetragen und stimmig.')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main()
