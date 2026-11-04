import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkAppLinkFiles, readAppLinkFiles } from './applinks-check.mjs'

type Files = Record<string, string>
type Result = { errors: string[]; placeholders: string[] }
const check = checkAppLinkFiles as (files: Files, options?: { allowPlaceholders?: boolean }) => Result

const root = join(__dirname, '..')
const files = (readAppLinkFiles as (root: string) => Files)(root)
const guide = readFileSync(join(root, 'docs/applinks/EINRICHTEN.md'), 'utf8')

const SHA = Array.from({ length: 32 }, (_, i) => (i * 7 % 256).toString(16).padStart(2, '0').toUpperCase()).join(':')

function filled(): Files {
  const aasa = JSON.parse(files.aasa)
  aasa.applinks.details[0].appIDs = ['ABCDE12345.com.kossa97.tyd']
  const links = JSON.parse(files.assetlinks)
  links[0].target.sha256_cert_fingerprints = [SHA]
  return { ...files, aasa: JSON.stringify(aasa), assetlinks: JSON.stringify(links) }
}

describe('App Links / Universal Links (Spec 5)', () => {
  it('Dateien sind im Aufbau stimmig (Platzhalter erlaubt)', () => {
    expect(check(files, { allowPlaceholders: true }).errors).toEqual([])
  })

  it('jeder Platzhalter ist in docs/applinks/EINRICHTEN.md beschrieben', () => {
    const { placeholders } = check(files, { allowPlaceholders: true })
    for (const p of placeholders) expect(guide).toContain(p)
  })

  it('ohne Erlaubnis meldet die Prüfung jeden verbliebenen Platzhalter (npm run applinks:check)', () => {
    const { placeholders, errors } = check(files)
    expect(errors).toHaveLength(placeholders.length)
    if (placeholders.length) expect(errors.join('\n')).toContain('noch nicht ersetzt')
  })

  it('mit echten Werten ist alles grün', () => {
    expect(check(filled())).toEqual({ errors: [], placeholders: [] })
  })

  it.each([
    ['fremde Bundle-ID', (f: Files) => ({ ...f, aasa: f.aasa.replace('com.kossa97.tyd', 'com.example.app') })],
    ['Team-ID im falschen Format', (f: Files) => ({ ...f, aasa: f.aasa.replace('ABCDE12345', 'abc') })],
    ['zu weiter Pfad', (f: Files) => ({ ...f, aasa: f.aasa.replace('/u/*', '*') })],
    ['kein JSON', (f: Files) => ({ ...f, aasa: '<!doctype html>' })],
    ['falsches Paket', (f: Files) => ({ ...f, assetlinks: f.assetlinks.replace('com.trackyourdose.app', 'com.example') })],
    ['SHA-256 klein geschrieben', (f: Files) => ({ ...f, assetlinks: f.assetlinks.replace(SHA, SHA.toLowerCase()) })],
    ['ohne autoVerify', (f: Files) => ({ ...f, manifest: f.manifest.replace('android:autoVerify="true"', '') })],
    ['ohne pathPrefix', (f: Files) => ({ ...f, manifest: f.manifest.replace('android:pathPrefix="/u/"', '') })],
    ['ohne Entitlement', (f: Files) => ({ ...f, entitlements: f.entitlements.replace('applinks:hokuhealth.app', 'applinks:example.com') })],
    ['Entitlement nicht im Xcode-Projekt', (f: Files) => ({ ...f, pbxproj: f.pbxproj.replaceAll('CODE_SIGN_ENTITLEMENTS', 'X') })],
    ['Host im Code geändert', (f: Files) => ({ ...f, appLinksTs: f.appLinksTs.replace("'hokuhealth.app'", "'example.com'") })],
  ])('scheitert bei: %s', (_case, change) => {
    expect(check(change(filled())).errors.length).toBeGreaterThan(0)
  })
})
