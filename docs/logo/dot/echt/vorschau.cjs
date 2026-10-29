// Vorschau: node vorschau.cjs out.png '<json-opts>' [size]
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => {
  const [out, optsS, sizeS] = process.argv.slice(2)
  const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  const p = await b.newPage()
  await p.goto('file://' + path.join(__dirname, 'dot-icon.html'))
  const url = await p.evaluate(([o, s]) => { const c = renderDot(o); return downscale(c, s).toDataURL('image/png') }, [JSON.parse(optsS), +(sizeS || 512)])
  fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64')); await b.close(); console.log('wrote', out)
})()
