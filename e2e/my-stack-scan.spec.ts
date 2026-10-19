import type { Locator, Page } from '@playwright/test'
import { expect, test } from './support/fixtures'
import { TEST_USER } from './support/mockSupabase'
import { expectStep, next, seedBpc157, stageObject } from './support/myStack'

/**
 * Substanz per Scan: Etikett fotografieren (bzw. Foto auswaehlen), per KI
 * auslesen, Vorschlag uebernehmen — der Assistent steht danach vorbelegt da.
 * Ohne Einwilligung geht kein Foto raus. Den Barcode-Weg pruefen die
 * Unit-Tests (`substanzScan.test.ts`): eine Kamera mit Barcode gibt es hier nicht.
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

  await next(wizard, 'Darreichungsform')
  await expect(wizard.getByRole('button', { name: 'Vial' })).toHaveAttribute('aria-pressed', 'true')
  await next(wizard, 'Farbe')
  await next(wizard, 'Tracking-Tiefe')
  await next(wizard, 'Stärke')
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
