// Konzepte A–C: SVG (einfarbig) und farbiges App-Icon 1024. node konzepte.cjs <ordner>
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs')
const T = ['#141c33', '#05060a']
const A = { gx: 0.16, gy: -0.12, roll: 0.4 }
const B = { gx: 0.05, gy: -0.04, roll: 1.1, hoer: 1, stimme: 0.6, irisW: 0.2, pupille: 0.85 }
module.exports = { A, B, T }
if (require.main === module) (async () => {
  const dir = process.argv[2]
  const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  const p = await b.newPage(); await p.goto('file://' + path.join(__dirname, 'hoku-auge.html'))
  for (const [n, o] of [['a', A], ['b', B]]) {
    fs.writeFileSync(`${dir}/${n}-symbol.svg`, await p.evaluate(o => hokuSvg({ ...o, radius: 0.41, dotMul: 0.95, schwelle: 0.4 }), o))
    const url = await p.evaluate(o => downscale(renderHoku({ size: 2048, radius: 0.34, tile: ['#141c33', '#05060a'], glow: 0.8, bright: 1.1, sizeMul: 1.08, ...o }), 1024).toDataURL('image/png'), o)
    fs.writeFileSync(`${dir}/${n}-icon-1024.png`, Buffer.from(url.split(',')[1], 'base64'))
  }
  await b.close()
})()
