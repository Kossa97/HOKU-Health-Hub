import type { Page } from '@playwright/test'

/**
 * Eine Messung in der Detailansicht bearbeiten: „Messungen" aufklappen, die
 * Messung antippen (kleine Detailansicht), dort „Bearbeiten".
 * @param messung wie die Zeile heisst, z. B. „14 µg/dL vom 15.09.2026"
 */
export async function messungBearbeiten(page: Page, messung: string) {
  await messungOeffnen(page, messung)
  await page.getByRole('button', { name: `${messung} bearbeiten` }).click()
}

/** „Messungen" aufklappen (falls zu) und die Messung im Detail zeigen (falls zu). */
export async function messungOeffnen(page: Page, messung: string) {
  await messungenAufklappen(page)
  const zeile = page.getByRole('button', { name: messung, exact: true })
  if (await zeile.getAttribute('aria-expanded') !== 'true') await zeile.click()
}

export async function messungenAufklappen(page: Page) {
  const kopf = page.locator('[data-bw-history-toggle]')
  if (await kopf.getAttribute('aria-expanded') !== 'true') await kopf.click()
}
