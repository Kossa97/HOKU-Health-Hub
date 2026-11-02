// Probe: rendert eine Reihe von Fassungen nebeneinander. node probe.cjs <out.png> '<json-array of opts>'
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs')
;(async () => {
  const [out, json, size = '512'] = process.argv.slice(2)
  const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  const p = await b.newPage(); await p.goto('file://' + path.join(__dirname, 'hoku-auge.html'))
  const url = await p.evaluate(([list, s]) => {
    const cs = list.map(o => downscale(renderHoku({ size: 2048, ...o }), s))
    const all = document.createElement('canvas'); all.width = s * cs.length; all.height = s
    cs.forEach((c, i) => all.getContext('2d').drawImage(c, i * s, 0))
    return all.toDataURL('image/png')
  }, [JSON.parse(json), +size])
  fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64')); await b.close()
})()
