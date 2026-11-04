import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader'
import { expect, test } from './support/fixtures'
import { TEST_USER, type MockSupabase } from './support/mockSupabase'

/**
 * Profil 2c, Sheet „Profil teilen“ (Spec 4.4/4.5): Sheet, Vollbild, der Code im
 * Bildschirmfoto wird mit ZXing gelesen (derselbe Leser wie im Lesetest
 * `hokuCode.read.test.ts`), Schalter „Web-Link einschalten“.
 */

const ADRESSE = 'https://hokuhealth.app/u/e2e'

let bereit: Promise<unknown> | null = null
function zxing() {
  bereit ??= (async () => {
    const wasm = readFileSync(createRequire(import.meta.url).resolve('zxing-wasm/reader/zxing_reader.wasm'))
    await prepareZXingModule({ overrides: { wasmBinary: wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength) }, fireImmediately: true })
  })()
  return bereit
}

async function lies(png: Buffer): Promise<string[]> {
  await zxing()
  const results = await readBarcodes(new Uint8Array(png), { formats: ['QRCode'], tryHarder: false, maxNumberOfSymbols: 1 })
  return results.filter(r => r.isValid).map(r => r.text)
}

function profil(mock: MockSupabase, werte: Record<string, unknown> = {}) {
  const zeile = mock.table('profiles').find(row => row.id === TEST_USER.id)!
  Object.assign(zeile, { display_name: 'Mara K.', ...werte })
  return zeile
}

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
})

test('Sheet: Code, Vollbild zum Vorzeigen, beide Codes lesbar', async ({ page, mock }) => {
  profil(mock, { web_link_enabled: true })
  await page.goto('/profil')
  await page.locator('[data-profile-share]').click()

  const sheet = page.locator('[data-share-sheet]')
  await expect(sheet).toBeVisible()
  await expect(sheet.locator('[data-share-address]')).toHaveText('hokuhealth.app/u/e2e')
  await expect(sheet.locator('[data-share-status="an"]')).toContainText('Web-Link an · Karte mit Bild und Name')
  await expect(sheet.locator('[data-share-messenger]')).toContainText('Messenger speichern die Vorschau.')
  await expect(sheet.getByRole('img', { name: 'Hoku-Code für hokuhealth.app/u/e2e' })).toBeVisible()
  await page.waitForTimeout(400) // Sheet ist eingefahren
  await page.screenshot({ path: 'test-results/profil-2c-teilen-sheet.png' })

  // Der kleine Code im dunklen Sheet: 124 px
  const klein = sheet.locator('[data-hoku-code]')
  expect((await klein.boundingBox())!.width).toBeCloseTo(124, 0)
  expect(await lies(await klein.screenshot())).toEqual([ADRESSE])

  await sheet.locator('[data-share-code-open]').click()
  const voll = page.locator('[data-share-fullscreen]')
  await expect(voll).toBeVisible()
  await expect(voll.getByRole('heading', { name: 'Mara K.' })).toBeVisible()
  await expect(voll).toContainText('@e2e')
  await expect(voll.locator('[data-share-fullscreen-close]')).toBeFocused()
  await page.waitForTimeout(300) // Einblenden vorbei
  await page.screenshot({ path: 'test-results/profil-2c-teilen-vollbild.png' })

  // Bildschirmfoto des ganzen Vollbilds: die Kamera sieht dasselbe
  const gross = voll.locator('[data-hoku-code]')
  // 300 px, auf schmalen Geräten (320 px, iPhone SE) höchstens 78 % der Breite
  const breite = page.viewportSize()!.width
  expect((await gross.boundingBox())!.width).toBeGreaterThanOrEqual(Math.min(280, breite * 0.78 - 1))
  expect(await lies(await page.screenshot())).toEqual([ADRESSE])

  // Schließen: Vollbild weg, Sheet bleibt, Fokus zurück auf den Code
  await voll.locator('[data-share-fullscreen-close]').click()
  await expect(voll).toHaveCount(0)
  await expect(sheet).toBeVisible()
  await expect(sheet.locator('[data-share-code-open]')).toBeFocused()

  // Escape schließt ebenfalls nur das Vollbild
  await sheet.locator('[data-share-code-open]').click()
  await expect(voll).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(voll).toHaveCount(0)
  await expect(sheet).toBeVisible()
  await expect(sheet.locator('[data-share-code-open]')).toBeFocused()

  // Noch einmal Escape schließt das Sheet; der Fokus geht zurück auf „Profil teilen“
  await page.keyboard.press('Escape')
  await expect(sheet).toHaveCount(0)
  await expect(page.locator('[data-profile-share]')).toBeFocused()
})

test('Link kopieren und Teilen vergeben „Profil geteilt“', async ({ page, mock }) => {
  profil(mock, { web_link_enabled: true })
  await page.goto('/profil')
  await page.locator('[data-profile-share]').click()
  const sheet = page.locator('[data-share-sheet]')

  await sheet.locator('[data-share-copy]').click()
  await expect(sheet.locator('[data-share-copy]')).toHaveText('Kopiert')
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(ADRESSE)
  await expect.poll(() => {
    const zeile = mock.table('progress_settings').find(row => row.user_id === TEST_USER.id)
    return (zeile?.earned_badges as Record<string, string> | undefined)?.profile_shared
  }).toBeTruthy()

  // „Teilen …“ ohne Systemdialog (Chromium unter Linux) kopiert
  await page.evaluate(() => navigator.clipboard.writeText(''))
  await sheet.locator('[data-share-native]').click()
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(ADRESSE)
})

test('Web-Link aus: Hinweis, Schalter schaltet ein, Ergebnis sofort im Sheet', async ({ page, mock }) => {
  const zeile = profil(mock)
  await page.goto('/profil')
  await page.locator('[data-profile-share]').click()
  const sheet = page.locator('[data-share-sheet]')

  const aus = sheet.locator('[data-share-status="aus"]')
  await expect(aus).toContainText('Web-Link aus · Neutrale Karte')
  await expect(aus.locator('[data-share-hint]')).toHaveText('Dein Web-Link ist aus. Nur angemeldete Hoku-Nutzer sehen dein Profil; im Browser erscheint „Seite nicht gefunden“.')
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'test-results/profil-2c-teilen-weblink-aus.png' })

  const schalter = sheet.getByRole('switch', { name: 'Web-Link einschalten' })
  await expect(schalter).toHaveAttribute('aria-checked', 'false')
  await schalter.click()
  await expect.poll(() => zeile.web_link_enabled).toBe(true)
  await expect(sheet.locator('[data-share-status="an"]')).toContainText('Web-Link an · Karte mit Bild und Name')
  await expect(aus).toHaveCount(0)
  await expect(sheet.locator('[data-share-change]')).toBeFocused()

  // „Ändern ›“ führt zu den Einstellungen; dort steht der Web-Link an
  await sheet.locator('[data-share-change]').click()
  await expect(page).toHaveURL(/\/profil\/einstellungen$/)
  await expect(page.locator('[data-setting-weblink]')).toHaveAttribute('aria-checked', 'true')
})

test('Web-Link aus: Speichern scheitert → Schalter zurück, Hinweis bleibt', async ({ page, mock }) => {
  const zeile = profil(mock)
  await page.goto('/profil')
  await page.locator('[data-profile-share]').click()
  const sheet = page.locator('[data-share-sheet]')
  await expect(sheet.locator('[data-share-status="aus"]')).toBeVisible()

  await page.route('**/rest/v1/profiles?**', route => route.request().method() === 'PATCH'
    ? route.fulfill({ status: 500, headers: { 'access-control-allow-origin': '*' }, json: { message: 'kaputt' } })
    : route.fallback())
  await sheet.getByRole('switch', { name: 'Web-Link einschalten' }).click()
  await expect(page.getByText('Fehler beim Speichern')).toBeVisible()
  await expect(sheet.locator('[data-share-status="aus"]')).toBeVisible()
  expect(zeile.web_link_enabled).toBe(false)
})

test('Privates Profil: eigener Hinweis statt Statuszeile, kein Schalter', async ({ page, mock }) => {
  profil(mock, { web_link_enabled: true, profile_private: true })
  await page.goto('/profil')
  await page.locator('[data-profile-share]').click()
  const sheet = page.locator('[data-share-sheet]')
  const privat = sheet.locator('[data-share-status="privat"]')
  await expect(privat).toContainText('Profil privat · Neutrale Karte')
  await expect(privat.locator('[data-share-hint]')).toContainText('Dein Profil ist privat.')
  await expect(sheet.getByRole('switch')).toHaveCount(0)
  // Teilen geht trotzdem: der Code ist da
  await expect(sheet.locator('[data-hoku-code]')).toBeVisible()
})

test('Kopieren scheitert im Vollbild: Meldung im Vollbild, nicht verdeckt darunter', async ({ page, mock }) => {
  profil(mock, { web_link_enabled: true })
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new DOMException('nein', 'NotAllowedError')) } })
    document.execCommand = () => false
  })
  await page.goto('/profil')
  await page.locator('[data-profile-share]').click()
  await page.locator('[data-share-code-open]').click()
  const voll = page.locator('[data-share-fullscreen]')
  await voll.locator('[data-share-fullscreen-copy]').click()
  await expect(voll.locator('[data-share-fullscreen-error]')).toHaveText(/Kopieren hat nicht geklappt/)
  await voll.locator('[data-share-fullscreen-close]').click()
  await expect(page.locator('[data-share-error]')).toBeVisible()
})
