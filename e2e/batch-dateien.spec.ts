import { expect, test } from './support/fixtures'
import { TEST_USER } from './support/mockSupabase'
import { seedPeptide, stageObject } from './support/myStack'

/**
 * Speicher `batch-files` ist privat: Analyse-Dokumente oeffnen ueber einen
 * signierten Link — auch wenn noch die fruehere oeffentliche URL gespeichert ist.
 */

const PFAD = `${TEST_USER.id}/1730000000000.pdf`
const ALTE_URL = `https://example.supabase.co/storage/v1/object/public/batch-files/${PFAD}`

function mitDokument(mock: Parameters<typeof seedPeptide>[0], wert: string) {
  seedPeptide(mock, 'BPC-157', {
    startDate: '2026-09-01',
    inventory: { package_quantity: 5, package_unit: 'mg', remaining_quantity: 5 },
  })
  for (const zeile of mock.table('stack_item_inventory')) zeile.batch_file_url = wert
}

for (const [fall, wert] of [['alte oeffentliche URL', ALTE_URL], ['neuer Pfad', PFAD]] as const) {
  test(`Analyse-Dokument (${fall}) oeffnet ueber einen signierten Link`, async ({ page, mock }) => {
    mitDokument(mock, wert)
    mock.storage.set('batch-files', [PFAD])
    await page.goto('/my-stack')
    await stageObject(page, 'BPC-157').click()

    const link = page.locator('[data-stage-detail]').getByRole('link', { name: /1730000000000\.pdf/ })
    await expect(link).toHaveAttribute('href', /\/storage\/v1\/object\/sign\/batch-files\/.+1730000000000\.pdf\?token=e2e/)
    await expect(link).not.toHaveAttribute('href', /object\/public/)
    await expect(link).toHaveAttribute('target', '_blank')
  })
}

test('Analyse-Dokument, das es nicht mehr gibt: Name ohne Link', async ({ page, mock }) => {
  mitDokument(mock, PFAD)
  await page.goto('/my-stack')
  await stageObject(page, 'BPC-157').click()

  const detail = page.locator('[data-stage-detail]')
  await expect(detail.locator('[aria-disabled="true"]', { hasText: '1730000000000.pdf' })).toBeVisible()
  await expect(detail.getByRole('link', { name: /1730000000000\.pdf/ })).toHaveCount(0)
})
