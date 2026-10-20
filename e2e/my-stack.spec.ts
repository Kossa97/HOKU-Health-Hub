import { expect, test } from './support/fixtures'
import { RpcError } from './support/mockSupabase'
import { expectStep, next, seedBpc157, seedPeptide, stageObject } from './support/myStack'

/**
 * My Stack auf dem Geraet: Anlegen, Bearbeiten, Plan aendern, Speichern.
 *
 * Die Unit-Tests pruefen die Teile einzeln; hier laeuft der ganze Weg im
 * Browser — Tippen, Schritte, Speichern, Neuladen, was danach auf dem
 * Bildschirm steht — gegen ein nachgebildetes Supabase.
 */

test('Anlegen: BPC-157 aus dem Katalog, mit Plan, steht danach auf der Bühne', async ({ page, mock }) => {
  await page.goto('/my-stack')
  await expect(page.getByText('Noch keine Substanzen')).toBeVisible()

  await page.getByRole('button', { name: 'Neue Substanz' }).click()
  const wizard = page.getByRole('dialog', { name: 'Substanz hinzufügen' })
  await wizard.getByRole('searchbox').fill('BPC-157')
  await wizard.getByRole('option', { name: /^BPC-157 Body/ }).click()

  await next(wizard, 'Darreichungsform')
  await expect(wizard.getByRole('button', { name: 'Vial' })).toHaveAttribute('aria-pressed', 'true')
  await next(wizard, 'Farbe')
  await next(wizard, 'Tracking-Tiefe')
  await next(wizard, 'Stärke')
  await wizard.getByRole('spinbutton', { name: 'Wirkstoff im Vial' }).fill('5')
  await wizard.getByRole('spinbutton', { name: 'Lösungsmittel' }).fill('2')
  await next(wizard, 'Einnahmeplan')
  await wizard.getByRole('combobox', { name: 'Methode' }).selectOption('Subkutan')
  await wizard.getByRole('spinbutton', { name: /^Menge/ }).fill('250')
  await wizard.getByRole('combobox', { name: 'Einheit' }).fill('mcg')
  await next(wizard, 'Zusammenfassung')
  await expect(wizard.getByText('Morgens · 250 mcg')).toBeVisible()

  await wizard.getByRole('button', { name: 'Speichern' }).click()
  await expect(wizard).toBeHidden()
  await expect(page.getByRole('status').filter({ hasText: 'Substanz hinzugefügt' })).toBeVisible()

  // Was beim Backend ankam.
  const save = mock.rpcCalls.find(call => call.name === 'save_stack_item_with_plan')
  expect(save?.params).toMatchObject({
    p_item: { display_name: 'BPC-157', category: 'peptide', dosage_form: 'vial' },
    p_ingredients: [{ catalog_substance_id: mock.catalogId('BPC-157'), amount_value: 5, amount_unit: 'mg', basis_value: 1, basis_unit: 'vial' }],
    p_plan: { dose: 250, unit: 'mcg', method: 'Subkutan', frequency: 'Täglich', intake_time: 'morgens', start_date: '2026-09-28' },
  })

  // Der neue Eintrag steht in der Mitte — nicht die „Neu"-Kachel davor.
  const vial = stageObject(page, 'BPC-157')
  await expect(vial).toBeInViewport({ ratio: 0.9 })
  await expect(page.locator('[data-vial-add]')).not.toBeInViewport({ ratio: 0.5 })

  // Nichts ragt seitlich aus dem Bildschirm.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})

test('Bearbeiten: Notiz ergänzen speichert nur den Eintrag', async ({ page, mock }) => {
  seedBpc157(mock, { startDate: '2026-09-01' })
  await page.goto('/my-stack')
  await stageObject(page, 'BPC-157').click()

  const detail = page.getByRole('dialog', { name: 'BPC-157' })
  await detail.getByRole('button', { name: 'Bearbeiten' }).click()
  const edit = page.getByRole('dialog', { name: 'Eintrag bearbeiten' })
  await expectStep(edit, 'Was möchtest du ändern?')
  await edit.getByRole('button', { name: /^Produkt & Notizen/ }).click()
  await expectStep(edit, 'Produkt & Notizen')
  await edit.getByRole('textbox', { name: 'Notizen (optional)' }).fill('Im Kühlschrank lagern')
  await edit.getByRole('button', { name: 'Fertig' }).click()
  await expectStep(edit, 'Was möchtest du ändern?')
  await expect(edit.getByRole('button', { name: /^Produkt & Notizen/ })).toContainText('Im Kühlschrank lagern')

  await edit.getByRole('button', { name: 'Speichern' }).click()
  await expect(edit).toBeHidden()
  await expect(page.getByRole('status').filter({ hasText: 'aktualisiert' })).toBeVisible()

  expect(mock.rpcCalls.map(call => call.name)).toEqual(['save_stack_item'])
  expect(mock.rpcCalls[0].params).toMatchObject({
    p_item: { display_name: 'BPC-157', notes: 'Im Kühlschrank lagern' },
  })
  // Beim Bearbeiten geht der Bestand NICHT mit (sonst ueberschriebe er den Rest).
  expect(mock.rpcCalls[0].params.p_item).not.toHaveProperty('inventory')
  await expect(detail.getByText('Im Kühlschrank lagern')).toBeVisible()
})

test('Plan ändern: neue Menge ab sofort wird eine neue Planstufe', async ({ page, mock }) => {
  seedBpc157(mock, { startDate: '2026-09-01' })
  await page.goto('/my-stack')
  await stageObject(page, 'BPC-157').click()

  const detail = page.getByRole('dialog', { name: 'BPC-157' })
  await expect(detail.getByText('Tag 28')).toBeVisible()
  await detail.getByRole('button', { name: 'Plan & Verlauf öffnen' }).click()
  await page.getByRole('button', { name: 'Plan anpassen' }).click()

  const plan = page.getByRole('dialog', { name: 'Plan anpassen' })
  await expect(plan.getByRole('radio', { name: 'Ab sofort' })).toBeChecked()
  await plan.getByRole('spinbutton', { name: /^Menge/ }).fill('500')
  await plan.getByRole('button', { name: 'Speichern' }).click()
  await expect(plan).toBeHidden()

  const change = mock.rpcCalls.find(call => call.name === 'create_plan_version')
  expect(change?.params).toMatchObject({
    p_change_kind: 'dose',
    p_schedule: { dose: 500, unit: 'mcg', frequency: 'Täglich', method: 'Subkutan' },
  })
  // Die alte Stufe bleibt im Verlauf; auf dem Bildschirm steht die neue Menge.
  expect(mock.table('cycle_plan_versions')).toHaveLength(2)
  await expect(page.getByText('500 mcg').first()).toBeVisible()
})

test('Archivieren des letzten Eintrags: die Bühne zeigt, was die Zeile darüber beschreibt', async ({ page, mock }) => {
  for (const name of ['BPC-157', 'GHK-Cu', 'TB-500']) seedPeptide(mock, name, { startDate: '2026-09-01' })
  await page.goto('/my-stack')
  await page.getByRole('button', { name: 'Zu TB-500' }).click()
  await expect(page.getByText('3 / 3')).toBeVisible()
  await expect(stageObject(page, 'TB-500')).toBeInViewport({ ratio: 0.9 })

  await stageObject(page, 'TB-500').click()
  await page.getByRole('dialog', { name: 'TB-500' }).getByRole('button', { name: 'Löschen' }).click()
  await page.getByRole('dialog', { name: 'Substanz entfernen' }).getByRole('button', { name: 'Archivieren (behalten)' }).click()

  await expect(page.getByRole('button', { name: 'Zu TB-500' })).toHaveCount(0)
  expect(mock.table('stack_items').find(row => row.display_name === 'TB-500')).toMatchObject({ archived: true })
  // Aktiv ist wieder der erste, und genau der steht in der Mitte — die alte
  // Scrollposition allein landete auf dem Nachbarn.
  await expect(page.getByText('1 / 2')).toBeVisible()
  await expect(stageObject(page, 'BPC-157')).toBeInViewport({ ratio: 0.9 })
  await expect(stageObject(page, 'GHK-Cu')).not.toBeInViewport({ ratio: 0.5 })
})

test('Reiter wechseln: der aktive Eintrag bleibt, wo er dabei ist — und steht in der Mitte', async ({ page, mock }) => {
  seedPeptide(mock, 'BPC-157', { startDate: '2026-09-01' })
  seedPeptide(mock, 'HCG', { startDate: '2026-09-01', category: 'hormone' })
  seedPeptide(mock, 'TB-500', { startDate: '2026-09-01' })
  await page.goto('/my-stack')
  // Alle: BPC-157, HCG, TB-500 (sortiert nach Name).
  await page.getByRole('button', { name: 'Zu TB-500' }).click()
  await expect(page.getByText('3 / 3')).toBeVisible()

  // Peptide: TB-500 steht dort an anderer Stelle — und bleibt aktiv.
  await page.getByRole('tab', { name: /^Peptide/ }).click()
  await expect(page.getByText('2 / 2')).toBeVisible()
  await expect(stageObject(page, 'TB-500')).toBeInViewport({ ratio: 0.9 })

  // Hormone: TB-500 ist nicht dabei — der erste des Reiters.
  await page.getByRole('tab', { name: /^Hormone/ }).click()
  await expect(page.getByText('1 / 1')).toBeVisible()
  await expect(stageObject(page, 'HCG')).toBeInViewport({ ratio: 0.9 })
})

test('Karussell: nur sichtbare Vials lassen Blasen aufsteigen', async ({ page, mock }) => {
  // Die Blasen waren SMIL-Animationen und kosteten, fuer alle Vials zugleich,
  // im Ruhezustand mehr Stilberechnung als alles andere auf der Seite. Heute
  // sind sie CSS-Animationen — nur sichtbare Vials tragen sie trotzdem.
  for (const name of ['BPC-157', 'CJC-1295', 'GHK-Cu', 'Ipamorelin', 'KPV', 'TB-500']) {
    seedPeptide(mock, name, { startDate: '2026-09-01' })
  }
  await page.goto('/my-stack')
  const blasen = (index: number) => page.locator(`[data-vial-index="${index}"] [data-vial-detail="liquid-bubble"]`).count()
  await expect.poll(() => blasen(0)).toBeGreaterThan(0)
  await expect.poll(() => blasen(5)).toBe(0)

  await page.locator('[data-vial-index="5"]').evaluate(el => el.scrollIntoView({ inline: 'center', block: 'nearest' }))
  await expect.poll(() => blasen(5)).toBeGreaterThan(0)
  await expect.poll(() => blasen(0)).toBe(0)
})

test('Neue Version ausgeliefert: fehlender Programmteil lädt neu statt abzustürzen', async ({ page, mock }) => {
  // So sah JAVASCRIPT-REACT-2 aus: die installierte App lief mit dem alten
  // Stand, der Kalender-Teil war nach einem Deployment nicht mehr da.
  seedBpc157(mock, { startDate: '2026-09-01' })
  // Der alte Entry verweist auf einen entfernten Chunk. Nach dem Reload
  // liefert der Server den aktuellen Entry samt neuem Chunk-Namen.
  let entryAnfragen = 0
  let alteChunkAnfragen = 0
  let aktuelleChunkAnfragen = 0
  await page.route(/\/assets\/index-[\w-]+\.js$/, async route => {
    const response = await route.fetch()
    const body = await response.text()
    const ersterStand = entryAnfragen++ === 0
    await route.fulfill({
      response,
      body: ersterStand ? body.replaceAll(/Dashboard-[\w-]+\.js/g, 'Dashboard-entfernte-version.js') : body,
    })
  })
  await page.route(/\/assets\/Dashboard-[\w-]+\.js$/, async route => {
    if (route.request().url().endsWith('/Dashboard-entfernte-version.js')) {
      alteChunkAnfragen++
      return route.fulfill({ status: 404, body: 'gone' })
    }
    aktuelleChunkAnfragen++
    return route.continue()
  })
  // Erst die Ausgangsseite fertig laden, dann den Versionswechsel ausloesen.
  await page.goto('/my-stack')
  await expect(stageObject(page, 'BPC-157')).toBeVisible()
  const neuGeladen = page.waitForEvent('load')
  await page.getByRole('link', { name: 'Kalender' }).click()
  await neuGeladen
  await expect(page).toHaveURL(/\/kalender$/)
  await expect(page.locator('#due-intakes')).toBeVisible()
  await expect(page.locator('#due-intakes')).toContainText('BPC-157')
  expect(entryAnfragen).toBe(2)
  expect(alteChunkAnfragen).toBe(1)
  expect(aktuelleChunkAnfragen).toBe(1)
  await expect(page.getByRole('navigation', { name: 'Navigation' })).toBeVisible()
})

test('Speichern scheitert: Meldung mit Grund, Assistent bleibt offen, nichts angelegt', async ({ page, mock }) => {
  mock.onRpc('save_stack_item_with_plan', () => {
    throw new RpcError('Another open cycle exists')
  })
  await page.goto('/my-stack')
  await page.getByRole('button', { name: 'Neue Substanz' }).click()
  const wizard = page.getByRole('dialog', { name: 'Substanz hinzufügen' })
  await wizard.getByRole('searchbox').fill('BPC-157')
  await wizard.getByRole('option', { name: /^BPC-157 Body/ }).click()
  await next(wizard, 'Darreichungsform')
  await next(wizard, 'Farbe')
  await next(wizard, 'Tracking-Tiefe')
  await next(wizard, 'Stärke')
  await wizard.getByRole('spinbutton', { name: 'Wirkstoff im Vial' }).fill('5')
  await wizard.getByRole('spinbutton', { name: 'Lösungsmittel' }).fill('2')
  await next(wizard, 'Einnahmeplan')
  await wizard.getByRole('combobox', { name: 'Methode' }).selectOption('Subkutan')
  await wizard.getByRole('spinbutton', { name: /^Menge/ }).fill('250')
  await next(wizard, 'Zusammenfassung')

  await wizard.getByRole('button', { name: 'Speichern' }).click()
  await expect(wizard.getByRole('alert')).toContainText('Another open cycle exists')
  await expect(wizard).toBeVisible()
  expect(mock.table('stack_items')).toHaveLength(0)
})

test('Öffnen: die Oberfläche bewegt sich sofort, auch wenn der Sichtbarkeitswächter nur einmal meldet', async ({ page, mock }) => {
  seedBpc157(mock, { startDate: '2026-09-01' })
  // Wie auf dem iPhone beobachtet: nach der ersten Meldung („draussen" — das
  // Karussell steht da noch auf der Neu-Kachel) kommt lange keine mehr.
  await page.addInitScript(() => {
    const Original = window.IntersectionObserver
    window.IntersectionObserver = class extends Original {
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        let erste = true
        super((entries, observer) => {
          if (!erste) return
          erste = false
          callback(entries, observer)
        }, options)
      }
    }
  })
  await page.goto('/my-stack')
  const rim = stageObject(page, 'BPC-157').locator('[data-vial-detail="liquid-rim"]')
  await expect(rim).toBeAttached()

  // Zehn Blicke im Abstand von 100 ms: die Oberflaeche aendert sich fast jedes Mal.
  const wechsel = await rim.evaluate(async element => {
    let zuletzt = element.getAttribute('d')
    let anzahl = 0
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 100))
      const jetzt = element.getAttribute('d')
      if (jetzt !== zuletzt) anzahl++
      zuletzt = jetzt
    }
    return anzahl
  })
  expect(wechsel).toBeGreaterThanOrEqual(6)
})

test('Bühne und Reiter reichen bis an den Bildschirmrand', async ({ page, mock }) => {
  seedBpc157(mock, { startDate: '2026-09-01' })
  await page.goto('/my-stack')
  await expect(stageObject(page, 'BPC-157')).toBeVisible()
  // Jeder abschneidende Vorfahr von Karussell und Reiterleiste muss die volle
  // Breite haben — sonst endet das Bild 12 px vor dem Rand.
  const engsterRahmen = await page.evaluate(() => {
    const breiten: number[] = []
    for (const start of ['[data-vial-index="0"]', '[data-stack-tabs]']) {
      for (let n = document.querySelector(start)?.parentElement ?? null; n && n !== document.body; n = n.parentElement) {
        if (getComputedStyle(n).overflowX === 'visible') continue
        const r = n.getBoundingClientRect()
        breiten.push(Math.min(r.right, window.innerWidth) - Math.max(r.left, 0))
      }
    }
    return { engster: Math.min(...breiten), bildschirm: window.innerWidth }
  })
  expect(engsterRahmen.engster).toBe(engsterRahmen.bildschirm)
})

test('Vollbild der Substanz: der Schließen-Knopf liegt unter der Statuszeile', async ({ page, mock, browserName }) => {
  test.skip(browserName !== 'chromium', 'Safe-Area-Emulation benötigt eine Chromium-CDP-Sitzung.')
  seedBpc157(mock, { startDate: '2026-09-01' })
  // Wie ein iPhone mit Notch: 47 px oben gehoeren der Uhr und dem Akku.
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 47, bottom: 34 } })
  await page.goto('/my-stack')
  await stageObject(page, 'BPC-157').click()
  const schliessen = page.locator('[data-stage-detail]').getByRole('button', { name: 'Schließen' })
  await expect(schliessen).toBeVisible()
  const box = await schliessen.boundingBox()
  expect(box?.y).toBeGreaterThanOrEqual(47)
})
