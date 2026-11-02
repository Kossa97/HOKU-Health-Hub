// Rendert ein glTF-Modell aus ./models als PNG mit Alphakanal.
// Aufruf: node render.js <modell.glb> <ausgabe.png> [yaw] [pitch] [size]
const http = require('http'), fs = require('fs'), path = require('path')
const { chromium } = require('playwright')
const ROOT = __dirname
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.hdr': 'application/octet-stream', '.wasm': 'application/wasm', '.bin': 'application/octet-stream', '.png': 'image/png', '.jpg': 'image/jpeg' }
const srv = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]))
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.statusCode = 404; return res.end() }
  res.setHeader('Content-Type', MIME[path.extname(p)] || 'application/octet-stream')
  fs.createReadStream(p).pipe(res)
})
;(async () => {
  const [model, out, yaw = '0', pitch = '8', size = '2048'] = process.argv.slice(2)
  await new Promise(r => srv.listen(0, r))
  const port = srv.address().port
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
  const p = await b.newPage({ viewport: { width: +size, height: +size } })
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()))
  await p.goto(`http://127.0.0.1:${port}/render.html?model=${encodeURIComponent(model)}&yaw=${yaw}&pitch=${pitch}&size=${size}`)
  await p.waitForFunction(() => window.__done, null, { timeout: 180000 })
  const info = await p.evaluate(() => window.__done)
  const data = await p.evaluate(() => document.querySelector('canvas').toDataURL('image/png'))
  fs.writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'))
  console.log(JSON.stringify({ out, ...info, errors: errs }))
  await b.close(); srv.close()
})().catch(e => { console.error(e); process.exit(1) })
