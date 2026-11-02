// Konzept A „Hoku, echt" in hoher Qualität: SVG + transparente PNG (farbig, weiß, schwarz) bis 8192 px,
// dazu das App-Icon. node export-a.cjs <zielordner>
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs')
const A = { gx: 0.16, gy: -0.12, roll: 0.4, n: 1400, streu: 0.9, zitter: 0.45, bright: 1.1, minAlpha: 0.05, schwelle: 0.05 }
const GROESSEN = [8192, 4096, 2048, 1024, 512]
const FASSUNGEN = { farbig: {}, weiss: { einfarbig: [255, 255, 255] }, schwarz: { einfarbig: [0, 0, 0] } }
;(async () => {
  const ziel = process.argv[2]
  const W = (rel, buf) => { const f = path.join(ziel, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, buf); console.log(rel, (buf.length / 1e6).toFixed(1) + ' MB') }
  const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  const p = await b.newPage(); await p.goto('file://' + path.join(__dirname, 'hoku-auge.html'))
  const png = url => Buffer.from(url.split(',')[1], 'base64')
  for (const [name, f] of Object.entries(FASSUNGEN)) {
    // SVG (Vektor, Kreise)
    const svg = await p.evaluate(o => hokuSvg(o), { ...A, ...f, radius: 0.42, fill: f.einfarbig ? (f.einfarbig[0] ? '#ffffff' : '#000000') : undefined, title: 'HOKU – Hoku ' + name })
    W(`SVG/hoku-a-${name}.svg`, Buffer.from(svg))
    // PNG transparent: einmal in 8192 rendern, daraus verkleinern
    await p.evaluate(o => { window.__gross = renderHoku({ size: 8192, radius: 0.42, ...o }) }, { ...A, ...f })
    for (const s of GROESSEN) W(`PNG-transparent/${name}/hoku-a-${name}-${s}.png`, png(await p.evaluate(s => downscale(window.__gross, s).toDataURL('image/png'), s)))
  }
  // App-Icon: dunkle Kachel und Schein wie im Brand-Kit
  await p.evaluate(o => { window.__gross = renderHoku({ size: 8192, radius: 0.34, tile: ['#141c33', '#05060a'], glow: 0.8, ...o }) }, A)
  for (const s of [8192, 1024]) W(`App-Icon/hoku-a-app-icon-${s}.png`, png(await p.evaluate(s => downscale(window.__gross, s).toDataURL('image/png'), s)))
  await b.close()
})()
