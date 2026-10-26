// Rendert alle Icon-Dateien aus dot-icon.html. Aufruf: node export.cjs <repo-root> [nur-vorschau-ordner]
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const BASIS = { radius: 0.33, rot: 0.6, tilt: 0.38, hue: 0.45, bright: 1.0, glow: 0.65, breath: 0.02, phases: [0.4, 2.1, 4.0] }
const ALLES = { tile: true, glow: true, points: true }
module.exports = { BASIS }
async function render(p, opts, size) {
  const url = await p.evaluate(([o, s]) => downscale(renderDot(o), s).toDataURL('image/png'), [opts, size])
  return Buffer.from(url.split(',')[1], 'base64')
}
;(async () => {
  const [root, vorschau] = process.argv.slice(2)
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  const p = await b.newPage(); await p.goto('file://' + path.join(__dirname, 'dot-icon.html'))
  const W = (rel, buf) => { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, buf); console.log('wrote', rel) }
  const big = { ...BASIS, size: 2048, layers: ALLES }
  if (vorschau) {
    const ruhe = { ...big, bright: 0.85, glow: 0.4 }
    for (const [n, o] of [['ruhe', ruhe], ['sprechen', big]]) for (const s of [1024, 180, 120, 87, 58]) W(`${vorschau}/${n}-${s}.png`, await render(p, o, s))
    await b.close(); return
  }
  const K = 'docs/logo/dot/kit', A = 'android/app/src/main/res'
  const marke = await p.evaluate(o => dotSvg(o), { ...BASIS, radius: 0.38, dotMul: 1.25 })
  W(`${K}/dot-marke.svg`, Buffer.from(marke))
  const icon1024 = await render(p, big, 1024)
  W('ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', icon1024)
  W(`${K}/dot-icon-1024.png`, icon1024)
  W('public/icon-512.png', await render(p, big, 512))
  W('public/icon-192.png', await render(p, big, 192))
  W(`${K}/favicon-64.png`, await render(p, { ...big, radius: 0.42, bright: 1.2, glow: 1.0 }, 64))
  W(`${K}/favicon-32.png`, await render(p, { ...big, radius: 0.44, bright: 1.3, glow: 1.0 }, 32))
  // Ebenen fuer Icon Composer (iOS 26)
  W(`${K}/ebenen/hintergrund.png`, await render(p, { ...big, layers: { tile: true } }, 1024))
  W(`${K}/ebenen/schein.png`, await render(p, { ...big, layers: { glow: true } }, 1024))
  W(`${K}/ebenen/punkte.png`, await render(p, { ...big, layers: { points: true } }, 1024))
  // Android: Launcher-PNGs (Form wird im Browser zugeschnitten), adaptiver Vordergrund ohne Kachel, Kugel in der sicheren Zone
  const fg = { ...big, radius: 0.33 * 0.6, layers: { glow: true, points: true } }
  for (const [d, s] of [['mdpi', 48], ['hdpi', 72], ['xhdpi', 96], ['xxhdpi', 144], ['xxxhdpi', 192]]) {
    const png = await render(p, big, s)
    for (const [name, rad] of [['ic_launcher', '17%'], ['ic_launcher_round', '50%']]) {
      const url = await p.evaluate(([src, s, rad]) => new Promise(res => { const i = new Image(); i.onload = () => { const c = document.createElement('canvas'); c.width = c.height = s; const x = c.getContext('2d'); const r = rad === '50%' ? s / 2 : s * 0.17; x.beginPath(); x.roundRect(0, 0, s, s, r); x.clip(); x.drawImage(i, 0, 0); res(c.toDataURL('image/png')) }; i.src = src }), ['data:image/png;base64,' + png.toString('base64'), s, rad])
      W(`${A}/mipmap-${d}/${name}.png`, Buffer.from(url.split(',')[1], 'base64'))
    }
    W(`${A}/mipmap-${d}/ic_launcher_foreground.png`, await render(p, fg, Math.round(s * 108 / 48)))
  }
  await b.close()
})()
