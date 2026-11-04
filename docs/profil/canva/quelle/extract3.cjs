// Liest die Karten aus dem Mockup in Originalgroesse (1200 x 630) aus und schreibt
// je Karte die Elemente mit Position, Schrift und Farbe als JSON.
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const [, , htmlPath, outDir] = process.argv
const CARDS = [
  { id: 'a1', call: "HOKU.ogA1('eintraege')" },
  { id: 'c', call: 'HOKU.ogC(0)' },
  { id: 'n', call: 'HOKU.ogN()' },
  { id: 'a1-rang', call: "(D.titel = 'Routinier', HOKU.ogA1('titel'))" },
  { id: 'a1-abztitel', call: "(D.titel = 'Läufer', HOKU.ogA1('titel'))" },
  { id: 'c-rang', call: "(D.titel = 'Routinier', HOKU.ogC(0, true))" },
  { id: 'c-abztitel', call: "(D.titel = 'Läufer', HOKU.ogC(0, true))" },
  { id: 'a1-abzeichen', call: "HOKU.ogA1('abzeichen')" },
  { id: 'c-ersatz', call: 'HOKU.ogC(1)' },
]

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 })
  await page.goto('file://' + path.resolve(htmlPath))
  // Fliesstext in Inter (gibt es in Canva), damit die Masse zur Vorlage passen
  await page.evaluate(() => document.fonts.ready)

  // Hintergrund (Hoku-Licht) einmal als Bild
  await page.evaluate(() => {
    document.body.innerHTML = '<div id="stage" style="width:1200px"></div>'
    document.body.style.padding = '0'
    document.getElementById('stage').innerHTML = '<div class="og" id="bg"></div>'
  })
  await page.locator('#bg').screenshot({ path: path.join(outDir, 'hintergrund.png') })

  const out = []
  for (const card of CARDS) {
    const html = await page.evaluate(c => eval(c), card.call)
    await page.evaluate(h => { document.getElementById('stage').innerHTML = h }, html)
    await page.evaluate(() => document.fonts.ready)
    const data = await page.evaluate(() => {
      const og = document.querySelector('#stage .og')
      const o = og.getBoundingClientRect()
      const R = r => ({ x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height })
      const els = []
      const cs = e => getComputedStyle(e)
      // Bilder
      og.querySelectorAll('img').forEach(img => {
        const src = img.getAttribute('src')
        const key = Object.keys(BK).find(k => BK[k].src === src) || '?'
        els.push({ kind: 'img', key, cls: img.className, ...R(img.getBoundingClientRect()), opacity: +cs(img).opacity })
      })
      // Profilbild
      og.querySelectorAll('.ava').forEach(a => els.push({ kind: 'ava', ...R(a.getBoundingClientRect()), text: a.textContent.trim(),
        font: cs(a).fontFamily, size: parseFloat(cs(a).fontSize), weight: cs(a).fontWeight, color: cs(a).color }))
      // Linien: .rule und linker Rand von .main/.say
      og.querySelectorAll('.rule').forEach(r => els.push({ kind: 'rect', name: 'Linie', ...R(r.getBoundingClientRect()), color: cs(r).backgroundColor }))
      og.querySelectorAll('.main, .say').forEach(m => {
        const bw = parseFloat(cs(m).borderLeftWidth)
        if (bw > 0 && cs(m).borderLeftStyle !== 'none') { const r = R(m.getBoundingClientRect()); els.push({ kind: 'rect', name: 'Trennlinie', x: r.x, y: r.y, w: bw, h: r.h, color: cs(m).borderLeftColor }) }
      })
      // Knopf
      og.querySelectorAll('.pill').forEach(p => els.push({ kind: 'pill', ...R(p.getBoundingClientRect()), text: p.textContent.trim(),
        font: cs(p).fontFamily, size: parseFloat(cs(p).fontSize), weight: cs(p).fontWeight, color: cs(p).color }))
      og.querySelectorAll('.ttl').forEach(p => els.push({ kind: 'chip', ...R(p.getBoundingClientRect()), text: p.textContent.trim(),
        font: cs(p).fontFamily, size: parseFloat(cs(p).fontSize), weight: cs(p).fontWeight, color: cs(p).color, ls: cs(p).letterSpacing }))
      // Symbole
      og.querySelectorAll('svg.ic').forEach(s => els.push({ kind: 'icon', d: s.querySelector('path').getAttribute('d'), sw: s.querySelector('path').getAttribute('stroke-width'), ...R(s.getBoundingClientRect()), color: cs(s).color, inHuge: !!s.closest('.huge') }))
      // Text: je Block (naechster nicht-inline Vorfahr) Zeilen aus Wort-Rechtecken
      const skip = n => n.closest('.ava, .pill, .ttl, svg, .sq')
      const walker = document.createTreeWalker(og, NodeFilter.SHOW_TEXT)
      const blocks = new Map()
      let n
      while ((n = walker.nextNode())) {
        if (!n.textContent.trim() || skip(n.parentElement)) continue
        let b = n.parentElement
        while (b !== og && cs(b).display === 'inline') b = b.parentElement
        if (!blocks.has(b)) blocks.set(b, [])
        blocks.get(b).push(n)
      }
      for (const [b, nodes] of blocks) {
        const words = []
        for (const tn of nodes) {
          const st = cs(tn.parentElement)
          const re = /\S+/g; let m
          while ((m = re.exec(tn.textContent))) {
            const rg = document.createRange(); rg.setStart(tn, m.index); rg.setEnd(tn, m.index + m[0].length)
            const r = rg.getBoundingClientRect()
            words.push({ t: m[0], x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height,
              font: st.fontFamily, size: parseFloat(st.fontSize), weight: st.fontWeight, color: st.color,
              ls: st.letterSpacing, tt: st.textTransform, lh: st.lineHeight, it: st.fontStyle === 'italic' })
          }
        }
        if (!words.length) continue
        const bst = cs(b)
        els.push({ kind: 'text', cls: b.className, align: bst.textAlign, words })
      }
      return { els }
    })
    out.push({ id: card.id, ...data })
  }
  fs.writeFileSync(path.join(outDir, 'karten.json'), JSON.stringify(out, null, 1))
  await browser.close()
  console.log('Karten:', out.length)
})()
