import { mkdirSync, writeFileSync } from 'node:fs'
import { expect, test } from './support/fixtures'
import { seedPeptide } from './support/myStack'

/**
 * Prüfung der Looks (nur auf Abruf: `npm run looks:audit`).
 *
 * Öffnet die Hauptseiten in jedem Look, legt ein Bildschirmfoto ab und sucht
 * Schrift, die sich zu wenig vom Grund abhebt. Der Bericht zeigt, wo noch
 * feste Farben stecken, die ein Look nicht erreicht. Ausgabe:
 * `test-results/look-audit/<look>/<seite>.png` und `bericht.json`.
 */
const LOOKS = (process.env.LOOK_AUDIT_LOOKS ?? 'schwarz,softdark,papier').split(',')
const SEITEN: [string, string][] = [
  ['heute', '/'], ['stack', '/my-stack'], ['blutwerte', '/blutwerte'], ['verlauf', '/progress'],
  ['kalender', '/kalender'], ['tagebuch', '/tagebuch'], ['ernaehrung', '/ernaehrung'],
  ['training', '/training'], ['injektionen', '/injektionen'], ['profil', '/profil'],
]
const OUT = process.env.LOOK_AUDIT_OUT ?? 'test-results/look-audit'

interface Fund { seite: string; text: string; pfad: string; kontrast: number; schrift: string; grund: string }

test.skip(!process.env.LOOK_AUDIT, 'nur mit LOOK_AUDIT=1')

for (const look of LOOKS) {
  test(`Looks: ${look}`, async ({ page, mock }) => {
    test.skip(test.info().project.name !== 'iphone-13')
    test.setTimeout(180_000)
    await page.addInitScript(l => localStorage.setItem('tyd_look', l), look)
    seedPeptide(mock, 'BPC-157', { startDate: '2026-09-01', inventory: { package_quantity: 5, package_unit: 'vial', remaining_quantity: 3, reconstitution_ml: 2, expires_at: '2027-03-31' } })
    seedPeptide(mock, 'Magnesium', { startDate: '2026-09-01', category: 'supplement', form: { dosage_form: 'tablet', zutat: { amount_value: 400, amount_unit: 'mg', basis_value: 1, basis_unit: 'tablet' } } })
    mkdirSync(`${OUT}/${look}`, { recursive: true })
    const funde: Fund[] = []
    for (const [name, path] of SEITEN) {
      await page.goto(path)
      await page.waitForTimeout(2200)
      await expect(page.locator('html')).toHaveAttribute('data-look', look)
      await page.screenshot({ path: `${OUT}/${look}/${name}.png`, fullPage: false })
      const seite = await page.evaluate(() => {
        type RGBA = [number, number, number, number]
        const parse = (c: string): RGBA | null => {
          const m = c.match(/rgba?\(([^)]+)\)/)
          if (!m) return null
          const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number)
          return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]
        }
        const over = (top: RGBA, under: RGBA): RGBA => {
          const a = top[3] + under[3] * (1 - top[3])
          if (a === 0) return [0, 0, 0, 0]
          const mix = (i: number) => (top[i] * top[3] + under[i] * under[3] * (1 - top[3])) / a
          return [mix(0), mix(1), mix(2), a]
        }
        const lum = ([r, g, b]: RGBA) => {
          const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
        }
        const bodyBg = parse(getComputedStyle(document.body).backgroundColor) ?? [0, 0, 0, 1]
        const grund = (el: Element): RGBA => {
          const stack: RGBA[] = []
          for (let n: Element | null = el; n; n = n.parentElement) {
            const c = parse(getComputedStyle(n).backgroundColor)
            if (c && c[3] > 0) { stack.push(c); if (c[3] >= 1) break }
          }
          let acc: RGBA = bodyBg[3] >= 1 ? bodyBg : [0, 0, 0, 1]
          for (let i = stack.length - 1; i >= 0; i--) acc = over(stack[i], acc)
          return acc
        }
        const pfad = (el: Element) => {
          const teile: string[] = []
          for (let n: Element | null = el; n && teile.length < 4 && n !== document.body; n = n.parentElement) {
            const cls = [...n.classList].filter(c => !c.includes(':') && !c.includes('[')).slice(0, 2).join('.')
            teile.unshift(n.tagName.toLowerCase() + (cls ? '.' + cls : ''))
          }
          return teile.join(' > ')
        }
        const out: { text: string; pfad: string; kontrast: number; schrift: string; grund: string }[] = []
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
        const seen = new Set<Element>()
        for (let t = walker.nextNode(); t; t = walker.nextNode()) {
          const el = t.parentElement
          if (!el || seen.has(el) || !(t.textContent ?? '').trim()) continue
          seen.add(el)
          const cs = getComputedStyle(el)
          const r = el.getBoundingClientRect()
          if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > innerHeight || cs.visibility === 'hidden' || Number(cs.opacity) < 0.1) continue
          const fg = parse(cs.color); if (!fg) continue
          const bg = grund(el)
          const sichtbar = over(fg, bg)
          const l1 = lum(sichtbar), l2 = lum(bg)
          const k = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
          if (k < 3) out.push({ text: (t.textContent ?? '').trim().slice(0, 40), pfad: pfad(el), kontrast: Math.round(k * 100) / 100, schrift: cs.color, grund: `rgb(${bg.slice(0, 3).map(Math.round).join(' ')})` })
        }
        return out
      })
      for (const f of seite) funde.push({ seite: name, ...f })
    }
    writeFileSync(`${OUT}/${look}/bericht.json`, JSON.stringify({ look, anzahl: funde.length, funde }, null, 2))
    console.log(`${look}: ${funde.length} Stellen mit Kontrast unter 3:1`)
  })
}
