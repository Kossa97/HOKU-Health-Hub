// SVG-Dateien nebeneinander als PNG (weiß, je 300 px, dazu 32 und 16 px echt). node svgpng.cjs out.png a.svg b.svg …
const { chromium } = require('playwright'); const fs = require('fs')
;(async () => {
  const [out, ...files] = process.argv.slice(2)
  const svgs = files.map(f => 'data:image/svg+xml;base64,' + fs.readFileSync(f).toString('base64'))
  const html = `<body style="margin:0;background:#fff;display:flex;gap:20px;padding:20px;align-items:flex-end">${svgs.map(s => `<div style="text-align:center"><img src="${s}" width=300 height=300><br><img src="${s}" width=64 height=64> <img src="${s}" width=32 height=32> <img src="${s}" width=16 height=16></div>`).join('')}</body>`
  const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined })
  const p = await b.newPage({ viewport: { width: 40 + files.length * 320, height: 420 } }); await p.setContent(html); await p.waitForTimeout(200)
  await p.screenshot({ path: out }); await b.close()
})()
