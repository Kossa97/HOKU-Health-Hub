import type { Locator, Page } from '@playwright/test'
import { expect, test } from './support/fixtures'
import { TEST_USER } from './support/mockSupabase'
import { expectStep, next, seedBpc157, stageObject } from './support/myStack'

/**
 * Substanz per Scan: Etikett fotografieren (bzw. Foto auswaehlen), per KI
 * auslesen, Vorschlag uebernehmen — der Assistent steht danach vorbelegt da.
 * Ohne Einwilligung geht kein Foto raus. Den Produkt-Barcode pruefen die
 * Unit-Tests (`substanzScan.test.ts`); fuer den Packungscode von Medikamenten
 * bildet `packungsKamera` Kamera und Leser nach.
 */

// 1×1-PNG — genug, damit Bild und Canvas im Browser laden.
const ETIKETT = {
  name: 'etikett.png',
  mimeType: 'image/png',
  buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64'),
}

// Nach dem Stichtag des Etikett-Textes: eine neue Einwilligung gilt fuer Etiketten.
test.use({ now: new Date('2026-10-20T10:00:00+02:00') })

async function scannerOeffnen(page: Page): Promise<{ wizard: Locator; scanner: Locator }> {
  await page.goto('/my-stack')
  await page.getByRole('button', { name: 'Neue Substanz' }).click()
  const wizard = page.getByRole('dialog', { name: 'Substanz hinzufügen' })
  await wizard.getByRole('button', { name: 'Scannen' }).click()
  const scanner = page.getByRole('dialog', { name: 'Scannen' })
  await expect(scanner).toBeVisible()
  return { wizard, scanner }
}

test('Etikett per Foto: erst Einwilligung, dann Vorschlag, dann vorbelegter Assistent', async ({ page, mock }) => {
  const { wizard, scanner } = await scannerOeffnen(page)

  await scanner.locator('[data-scan-file-input]').setInputFiles(ETIKETT)
  const einwilligung = scanner.locator('[data-ai-consent]')
  await expect(einwilligung).toContainText('Etiketten')
  expect(mock.labelExtract.calls).toHaveLength(0)
  await einwilligung.locator('[data-ai-consent-check]').check()
  await einwilligung.locator('[data-ai-consent-accept]').click()

  const ergebnis = scanner.locator('[data-scan-result]')
  await expect(ergebnis).toContainText('BPC-157')
  await expect(ergebnis).toContainText('Aus dem Katalog')
  await expect(ergebnis).toContainText('Vial')
  await expect(ergebnis).toContainText('5 mg')
  expect(mock.table('profiles').find(row => row.id === TEST_USER.id)?.ai_import_consent_at).toBeTruthy()
  // Das Foto ging als JPEG raus, mit den Katalognamen als Schreibweise.
  expect(mock.labelExtract.calls).toHaveLength(1)
  expect(mock.labelExtract.calls[0].mimeType).toBe('image/jpeg')
  expect(mock.labelExtract.calls[0].names).toBeGreaterThan(10)

  await ergebnis.locator('[data-scan-apply]').click()
  await expect(scanner).toBeHidden()
  await expect(wizard.locator(`[data-substance-selected="${mock.catalogId('BPC-157')}"]`)).toBeVisible()

  // Form und Farbe stehen auf der Substanzseite.
  await wizard.getByRole('radio', { name: 'Vial' }).click()
  await expect(wizard.getByRole('radio', { name: 'Vial' })).toHaveAttribute('aria-checked', 'true')
  await next(wizard, 'Zusammensetzung')
  await expect(wizard.getByRole('spinbutton', { name: 'Wirkstoff im Vial' })).toHaveValue('5')
})

test('Kein Etikett erkannt: Hinweis, zurück zur Kamera, nichts übernommen', async ({ page, mock }) => {
  Object.assign(mock.table('profiles').find(row => row.id === TEST_USER.id)!, { ai_import_consent_at: '2026-10-19T08:00:00.000Z' })
  mock.labelExtract.label = null
  const { wizard, scanner } = await scannerOeffnen(page)

  await expect(scanner.locator('[data-ai-consent-note]')).toContainText('Anthropic')
  await scanner.locator('[data-scan-file-input]').setInputFiles(ETIKETT)
  await expect(scanner.locator('[data-scan-hint]')).toContainText('kein lesbares Etikett')
  expect(mock.labelExtract.calls).toHaveLength(1)

  await scanner.getByRole('button', { name: 'Schließen' }).click()
  await expect(scanner).toBeHidden()
  await expect(wizard.getByRole('searchbox')).toHaveValue('')
})

test('Alte Einwilligung nur für Befunde: vor dem ersten Etikett wird neu gefragt', async ({ page, mock }) => {
  const profil = mock.table('profiles').find(row => row.id === TEST_USER.id)!
  Object.assign(profil, { ai_import_consent_at: '2026-10-06T12:00:00.000Z' })
  const { scanner } = await scannerOeffnen(page)

  await expect(scanner.locator('[data-ai-consent-note]')).toHaveCount(0)
  await scanner.locator('[data-scan-file-input]').setInputFiles(ETIKETT)
  const einwilligung = scanner.locator('[data-ai-consent]')
  await expect(einwilligung).toContainText('Etikettfotos')
  expect(mock.labelExtract.calls).toHaveLength(0)

  await einwilligung.locator('[data-ai-consent-check]').check()
  await einwilligung.locator('[data-ai-consent-accept]').click()
  await expect(scanner.locator('[data-scan-result]')).toContainText('BPC-157')
  expect(Date.parse(String(profil.ai_import_consent_at))).toBeGreaterThanOrEqual(Date.parse('2026-10-19T00:00:00.000Z'))
  expect(mock.labelExtract.calls).toHaveLength(1)
})

test('Nur beim Neuanlegen: beim Bearbeiten der Substanz gibt es keinen Scan', async ({ page, mock }) => {
  seedBpc157(mock, { startDate: '2026-09-01' })
  await page.goto('/my-stack')
  await stageObject(page, 'BPC-157').click()
  await page.getByRole('dialog', { name: 'BPC-157' }).getByRole('button', { name: 'Bearbeiten' }).click()
  const edit = page.getByRole('dialog', { name: 'Eintrag bearbeiten' })
  await expectStep(edit, 'Was möchtest du ändern?')
  await edit.getByRole('button', { name: /^Substanz/ }).click()
  await expect(edit.locator('[data-substance-selected]')).toBeVisible()
  await edit.locator('[data-substance-selected]').getByRole('button', { name: 'Auswahl lösen' }).click()
  await expect(edit.getByRole('searchbox')).toBeVisible()
  await expect(edit.locator('[data-substance-scan]')).toHaveCount(0)
})

/**
 * Kamera und Leser nachgebildet: ein Canvas als Kamerabild, ein
 * `BarcodeDetector`, der den Data-Matrix-Code einer Arzneimittelpackung
 * „sieht" (IFA-Format: PZN 01234562, Charge AB12C, Verfall 06/2027).
 */
async function packungsKamera(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const code = '[)>\x1e06\x1d9N110123456242\x1d1TAB12C\x1dD270600\x1dS1234567890AB\x1e\x04'
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => {
          const canvas = document.createElement('canvas')
          canvas.width = 640
          canvas.height = 480
          const ctx = canvas.getContext('2d')!
          const malen = () => { ctx.fillStyle = '#334'; ctx.fillRect(0, 0, 640, 480); requestAnimationFrame(malen) }
          malen()
          return canvas.captureStream(15)
        },
      },
    })
    class Leser {
      static async getSupportedFormats() { return ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'data_matrix'] }
      async detect() { return [{ rawValue: code }] }
    }
    ;(globalThis as unknown as { BarcodeDetector: unknown }).BarcodeDetector = Leser
  })
}

test('Medikament: erst der Packungscode, dann das Etikett — Ester wählen, Verfall und Charge stehen im Assistenten', async ({ page, mock }) => {
  await packungsKamera(page)
  mock.labelExtract.label = {
    name: 'Testosteron 250 mg/ml', brand: 'Pharma X', dosage_form: 'ampoule',
    ingredients: [{ name: null, amount: 250, unit: 'mg', per_amount: 1, per_unit: 'ml' }],
  }
  const { wizard, scanner } = await scannerOeffnen(page)

  // Der Code traegt keinen Namen: die App bittet ums Etikett.
  await expect(scanner.locator('[data-scan-hint]')).toContainText('Packungscode gelesen')
  await scanner.locator('[data-scan-file-input]').setInputFiles(ETIKETT)
  const einwilligung = scanner.locator('[data-ai-consent]')
  await einwilligung.locator('[data-ai-consent-check]').check()
  await einwilligung.locator('[data-ai-consent-accept]').click()

  const ergebnis = scanner.locator('[data-scan-result]')
  await expect(ergebnis).toContainText('30.06.2027')
  await expect(ergebnis).toContainText('AB12C')
  await expect(ergebnis).toContainText('01234562')

  // Welcher Ester? Das Etikett sagt es nicht — ohne Wahl geht es nicht weiter.
  const uebernehmen = ergebnis.locator('[data-scan-apply]')
  await expect(uebernehmen).toBeDisabled()
  await ergebnis.getByRole('button', { name: 'Testosteron Enantat' }).click()
  await uebernehmen.click()
  await expect(scanner).toBeHidden()
  await expect(wizard.locator(`[data-substance-selected="${mock.catalogId('Testosteron Enantat')}"]`)).toBeVisible()
  await expect(wizard.getByRole('radio', { name: 'Ampulle' })).toHaveAttribute('aria-checked', 'true')

  await next(wizard, 'Zusammensetzung')
  await expect(wizard.locator('[data-field="inventory.expiresAt"]')).toHaveValue('2027-06-30')
})
