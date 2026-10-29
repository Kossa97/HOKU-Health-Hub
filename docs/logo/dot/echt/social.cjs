// Dot in hoher Auflösung für Social Media. Aufruf: node docs/logo/dot/echt/social.cjs <repo-root>
// Gerendert wird immer größer als das Ziel (bis 8192, die Grenze von WebGL hier) und dann schrittweise verkleinert.
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs')
const BASIS = { radius: 0.33, rot: 0.6, tilt: 0.38, hue: 0.45, bright: 1.0, glow: 0.65, breath: 0.02, phases: [0.4, 2.1, 4.0] }
const ALLES = { tile: true, glow: true, points: true }
// [Datei, Render-Breite, Render-Höhe, Ausgabe-Breiten, Zusatz]
const JOBS = [
  ['dot-quadrat', 8192, 8192, [8192, 4096, 2048, 1080], {}],
  ['dot-transparent', 8192, 8192, [8192, 4096, 2048], { layers: { glow: true, points: true } }],
  ['dot-profilbild', 8192, 8192, [2048, 1080], { radius: 0.38 }],
  ['dot-hochformat-4x5', 4320, 5400, [2160, 1080], {}],
  ['dot-story-9x16', 4320, 7680, [2160, 1080], {}],
  ['dot-banner-3x1', 6000, 2000, [3000, 1500], {}],
]
;(async () => {
  const root = process.argv[2], out = path.join(root, 'docs/logo/dot/social')
  fs.mkdirSync(out, { recursive: true })
  const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  const p = await b.newPage(); await p.goto('file://' + path.join(__dirname, 'dot-icon.html'))
  for (const [name, w, h, widths, extra] of JOBS) {
    const o = { ...BASIS, layers: ALLES, ...extra, size: w, w, h }
    await p.evaluate(o => { window.__c = renderDot(o) }, o)
    for (const ow of widths) {
      const url = await p.evaluate(ow => downscale(window.__c, ow).toDataURL('image/png'), ow)
      const oh = Math.round(ow * h / w), f = `${name}-${ow}x${oh}.png`
      fs.writeFileSync(path.join(out, f), Buffer.from(url.split(',')[1], 'base64'))
      console.log('wrote', f)
    }
  }
  await b.close()
})()
