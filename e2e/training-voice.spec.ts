import { expect, test } from './support/fixtures'
import { TEST_USER } from './support/mockSupabase'

/**
 * Im Training schreiben und sprechen (ohne KI): „80 kg 8" trägt ein und hakt
 * ab, „gleich wie eben" wiederholt, „Pause 2 Minuten" startet die Pause,
 * Rückgängig im Hinweis nimmt einen Eintrag zurück. Das Sprechen läuft über
 * eine nachgebaute Spracherkennung (halten, loslassen schickt ab).
 */

test('Training: Sätze per Text und Sprache eintragen, Rückgängig', async ({ page, mock }) => {
  mock.insert('training_routines', {
    user_id: TEST_USER.id, name: 'Push', kind: 'strength', weekdays: [1], sort_order: 0,
    exercises: [{ exerciseId: 'bench_press_barbell', restS: 90, sets: [{ type: 'normal' }, { type: 'normal' }, { type: 'normal' }] }],
  })
  // Nachgebaute Spracherkennung: start() merkt sich, stop() liefert den Satz und endet
  await page.addInitScript(() => {
    class FakeRecognition {
      lang = ''; continuous = false; interimResults = false
      onresult: ((e: unknown) => void) | null = null
      onerror: ((e: unknown) => void) | null = null
      onend: (() => void) | null = null
      start() { (window as unknown as { __rec: FakeRecognition }).__rec = this }
      stop() {
        const said = (window as unknown as { __say?: string }).__say ?? ''
        this.onresult?.({ results: [[{ transcript: said }]] })
        this.onend?.()
      }
      abort() { this.onend?.() }
    }
    const w = window as unknown as { SpeechRecognition: unknown; webkitSpeechRecognition: unknown }
    w.SpeechRecognition = FakeRecognition
    w.webkitSpeechRecognition = FakeRecognition
  })

  await page.goto('/training')
  await page.getByRole('button', { name: 'Push starten' }).click()
  const live = page.getByRole('dialog', { name: 'Push' })
  const input = live.getByRole('textbox', { name: 'Satz eintragen, z. B. 80 kg 8' })

  // Tippen
  await input.fill('80 kg 8')
  await input.press('Enter')
  await expect(page.getByText('Bankdrücken (Langhantel) · Satz 1: 80 kg × 8 abgehakt')).toBeVisible()
  await expect(live.getByRole('checkbox', { name: 'Satz abhaken' }).first()).toHaveAttribute('aria-checked', 'true')
  await expect(input).toHaveValue('')

  // Sprechen: halten, loslassen
  await page.evaluate(() => { (window as unknown as { __say: string }).__say = 'gleich wie eben' })
  const mic = live.getByRole('button', { name: 'Halten und sprechen' })
  await mic.dispatchEvent('pointerdown', { button: 0, pointerId: 1 })
  await expect(mic).toHaveAttribute('aria-pressed', 'true')
  await mic.dispatchEvent('pointerup', { button: 0, pointerId: 1 })
  await expect(page.getByText('Bankdrücken (Langhantel) · Satz 2: 80 kg × 8 abgehakt')).toBeVisible()
  await expect(page.getByText('„gleich wie eben“')).toBeVisible()

  // Rückgängig im Hinweis
  await page.getByRole('button', { name: 'Rückgängig' }).click()
  await expect(live.getByRole('checkbox', { name: 'Satz abhaken' }).nth(1)).toHaveAttribute('aria-checked', 'false')

  // Pause und Unverständliches
  await input.fill('Pause 2 Minuten')
  await input.press('Enter')
  await expect(page.getByText('Pause 2:00 gestartet')).toBeVisible()
  await input.fill('Kaffee bitte')
  await input.press('Enter')
  await expect(page.getByText('Nicht verstanden – nichts eingetragen')).toBeVisible()

  // Hilfe
  await live.getByRole('button', { name: 'Was kann ich sagen?' }).click()
  await expect(live.getByText('„Gleich wie eben“ · „Noch ein Satz“')).toBeVisible()
  if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/training-sprechen.png` })
})
