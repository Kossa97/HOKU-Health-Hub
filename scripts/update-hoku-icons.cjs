// Install the approved organic cyan Hoku, with a crop appropriate to each surface.
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const zlib = require('node:zlib')
const { Resvg } = require('@resvg/resvg-js')

const root = path.resolve(process.argv[2] || path.join(__dirname, '..'))
const sourceFile = 'docs/logo/hoku/brand-kit-v2/QUELLEN/hoku-app-icon-organisch-cyan-v3-master.png'
const source = fs.readFileSync(path.join(root, sourceFile))
const sourceWidth = source.readUInt32BE(16), sourceHeight = source.readUInt32BE(20)
const dataUrl = 'data:image/png;base64,' + source.toString('base64')
const background = '#000101'
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex')
const checks = []

function svg(w, h, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`
}
function bounds(pixels, w, h, alpha = false) {
  let left = w, right = -1, top = h, bottom = -1, radius = 0
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = (y * w + x) * 4
    if (alpha ? pixels[p + 3] >= 128 : Math.max(pixels[p], pixels[p + 1], pixels[p + 2]) >= 60) {
      left = Math.min(left, x); right = Math.max(right, x)
      top = Math.min(top, y); bottom = Math.max(bottom, y)
      radius = Math.max(radius, Math.hypot(x + .5 - w / 2, y + .5 - h / 2))
    }
  }
  return { left, right, top, bottom, width: right - left + 1, height: bottom - top + 1, radius }
}
const decoded = new Resvg(svg(sourceWidth, sourceHeight, `<image width="${sourceWidth}" height="${sourceHeight}" href="${dataUrl}"/>`)).render()
const sourceBounds = bounds(decoded.pixels, sourceWidth, sourceHeight)
const sourceDiameter = Math.max(sourceBounds.width, sourceBounds.height)
const sourceCenter = [(sourceBounds.left + sourceBounds.right + 1) / 2, (sourceBounds.top + sourceBounds.bottom + 1) / 2]

function scene(w, h, diameter, { transparent = false, isolated = false, mask } = {}) {
  const scale = diameter / sourceDiameter
  const image = `<image x="${w / 2 - sourceCenter[0] * scale}" y="${h / 2 - sourceCenter[1] * scale}" width="${sourceWidth * scale}" height="${sourceHeight * scale}" href="${dataUrl}"${isolated ? ' filter="url(#particles)"' : ''}/>`
  // Native SVG alpha extraction removes the dark matte for layered/native surfaces.
  // Bright cyan and white point cores retain their original RGB values.
  const filter = isolated ? '<filter id="particles" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 4 0 -0.14"/></filter>' : ''
  const clip = mask === 'circle' ? `<circle cx="${w / 2}" cy="${h / 2}" r="${w / 2}"/>` : `<rect width="${w}" height="${h}" rx="${w * .17}"/>`
  const defs = `<defs>${filter}${mask ? `<clipPath id="shape">${clip}</clipPath>` : ''}</defs>`
  const content = (transparent ? '' : `<rect width="${w}" height="${h}" fill="${background}"/>`) + image
  return svg(w, h, defs + (mask ? `<g clip-path="url(#shape)">${content}</g>` : content))
}
function chunk(name, data) {
  const type = Buffer.from(name), length = Buffer.alloc(4), crc = Buffer.alloc(4)
  length.writeUInt32BE(data.length); crc.writeUInt32BE(zlib.crc32(Buffer.concat([type, data])))
  return Buffer.concat([length, type, data, crc])
}
function rgbPng(render) {
  const pixels = render.pixels, stride = 1 + render.width * 3, rows = Buffer.alloc(stride * render.height)
  for (let y = 0; y < render.height; y++) for (let x = 0; x < render.width; x++) {
    const p = (y * render.width + x) * 4, q = y * stride + 1 + x * 3
    if (pixels[p + 3] !== 255) throw new Error('Unexpected alpha in opaque icon')
    rows[q] = pixels[p]; rows[q + 1] = pixels[p + 1]; rows[q + 2] = pixels[p + 2]
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(render.width); header.writeUInt32BE(render.height, 4); header[8] = 8; header[9] = 2
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(rows, { level: 9 })), chunk('IEND', Buffer.alloc(0))])
}
function write(file, bytes) {
  const target = path.resolve(root, file), content = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes)
  if (!target.startsWith(root + path.sep)) throw new Error('Export outside the selected repository')
  fs.mkdirSync(path.dirname(target), { recursive: true })
  if (fs.existsSync(target) && fs.readFileSync(target).equals(content)) return
  const temporary = target + '.tmp'
  fs.writeFileSync(temporary, content); fs.renameSync(temporary, target)
}
function exportPng(file, content, kind, transparent = false) {
  const render = new Resvg(content).render(), pixels = render.pixels
  const png = transparent ? render.asPng() : rgbPng(render)
  const occupied = bounds(pixels, render.width, render.height, transparent)
  if (!occupied.width || occupied.right < 0) throw new Error(file + ': empty image')
  if (kind === 'maskable' && occupied.radius > render.width * .4) throw new Error(file + ': maskable safe-zone overflow')
  if (kind === 'adaptive' && occupied.radius > render.width * 33 / 108) throw new Error(file + ': adaptive safe-zone overflow')
  write(file, png)
  checks.push({ file, kind, width: render.width, height: render.height, colorType: png[25], occupied, sha256: hash(png) })
  return png
}
function app(file, size, ratio = .84, kind = 'app') {
  return exportPng(file, scene(size, size, size * ratio), kind)
}
function ico(entries) {
  const header = Buffer.alloc(6 + entries.length * 16)
  header.writeUInt16LE(1, 2); header.writeUInt16LE(entries.length, 4)
  let offset = header.length
  entries.forEach(({ size, png }, i) => { const p = 6 + i * 16; header[p] = size; header[p + 1] = size; header.writeUInt16LE(1, p + 4); header.writeUInt16LE(32, p + 6); header.writeUInt32LE(png.length, p + 8); header.writeUInt32LE(offset, p + 12); offset += png.length })
  return Buffer.concat([header, ...entries.map(e => e.png)])
}

// Web/PWA: current names bust old icon caches; old public URLs remain updated aliases.
for (const size of [180, 192, 512]) {
  app(`public/icons/hoku-organisch-v3-${size}.png`, size)
  app(`public/icons/hoku-dunkel-${size}.png`, size)
  app(`public/icons/hoku-${size}.png`, size)
}
app('public/apple-touch-icon.png', 180)
app('public/icons/hoku-organisch-v3-1024.png', 1024)
app('public/icons/hoku-dunkel-1024.png', 1024)
app('public/icons/hoku-organisch-v3-maskable-512.png', 512, .76, 'maskable')
app('public/icons/hoku-dunkel-maskable-512.png', 512, .76, 'maskable')
app('public/icons/hoku-maskable-512.png', 512, .76, 'maskable')
for (const size of [192, 512]) app(`public/icon-${size}.png`, size)
const faviconEntries = []
for (const size of [16, 32, 48, 64]) {
  const content = scene(size, size, size * .92)
  exportPng(`public/icons/hoku-fav-organisch-v3-${size}.png`, content, 'favicon')
  const png = exportPng(`public/icons/hoku-fav-dunkel-${size}.png`, content, 'favicon')
  if (size !== 16) exportPng(`public/icons/hoku-fav-blau-${size}.png`, content, 'favicon')
  faviconEntries.push({ size, png })
}
write('public/favicon.ico', ico(faviconEntries))
const embedded = (file, size) => svg(size, size, `<image width="${size}" height="${size}" href="data:image/png;base64,${fs.readFileSync(path.join(root, file)).toString('base64')}"/>`)
write('public/icon.svg', embedded('public/icon-512.png', 512))
write('public/favicon.svg', embedded('public/icons/hoku-fav-organisch-v3-64.png', 64))
for (const size of [64, 128]) exportPng(`public/icons/hoku-dunkel-symbol-${size}.png`, scene(size, size, size * .92, { transparent: true, isolated: true }), 'symbol', true)

// iOS supplies its own corner mask. The submitted square PNG has no alpha channel.
app('ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', 1024)
for (const [density, size] of [['mdpi', 48], ['hdpi', 72], ['xhdpi', 96], ['xxhdpi', 144], ['xxxhdpi', 192]]) {
  for (const [name, mask] of [['ic_launcher', 'rounded'], ['ic_launcher_round', 'circle']]) exportPng(`android/app/src/main/res/mipmap-${density}/${name}.png`, scene(size, size, size * .84, { mask }), 'legacy', true)
  const foregroundSize = Math.round(size * 108 / 48)
  exportPng(`android/app/src/main/res/mipmap-${density}/ic_launcher_foreground.png`, scene(foregroundSize, foregroundSize, foregroundSize * .59, { transparent: true, isolated: true }), 'adaptive', true)
}

// Launch screens retain their existing dimensions; only their centered artwork changes.
const iosSplash = 'ios/App/App/Assets.xcassets/Splash.imageset/'
for (const file of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) exportPng(iosSplash + file, scene(2732, 2732, 2732 * .24, { isolated: true }), 'splash')
const res = 'android/app/src/main/res'
for (const dir of fs.readdirSync(path.join(root, res))) {
  const file = `${res}/${dir}/splash.png`
  if (!dir.startsWith('drawable') || !fs.existsSync(path.join(root, file))) continue
  const bytes = fs.readFileSync(path.join(root, file)), w = bytes.readUInt32BE(16), h = bytes.readUInt32BE(20)
  exportPng(file, scene(w, h, Math.min(w, h) * .24, { isolated: true }), 'splash')
}

// Reproducible visual proof, including the launcher's final 72dp crop of its 108dp layer.
const embed = (file, x, y, w, h) => `<image x="${x}" y="${y}" width="${w}" height="${h}" href="data:image/png;base64,${fs.readFileSync(path.join(root, file)).toString('base64')}"/>`
const label = (text, x, y, size = 23) => `<text x="${x}" y="${y}" font-family="Segoe UI" font-size="${size}" fill="#FFFFFF">${text}</text>`
let proof = `<rect width="1800" height="1450" fill="#081014"/>${label('HOKU / ORGANISCHES CYAN-ICON IN DER APP',40,55,32)}`
proof += label('iOS · tatsächliches App-Icon', 40, 110) + embed('ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', 40, 145, 360, 360)
proof += label('PWA · normale Fassung', 480, 110) + embed('public/icons/hoku-dunkel-512.png', 480, 145, 360, 360)
proof += label('Android · adaptive Kreis-Maske', 920, 110)
const foreground = fs.readFileSync(path.join(root, 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png')).toString('base64')
proof += `<svg x="920" y="145" width="360" height="360" viewBox="72 72 288 288"><defs><clipPath id="adaptive-proof"><circle cx="216" cy="216" r="144"/></clipPath></defs><g clip-path="url(#adaptive-proof)"><rect width="432" height="432" fill="${background}"/><image width="432" height="432" href="data:image/png;base64,${foreground}"/></g></svg>`
proof += label('PWA · maskierbar', 1360, 110) + embed('public/icons/hoku-dunkel-maskable-512.png', 1360, 145, 360, 360)
proof += label('Favicons / Leistenzeichen · tatsächliche Pixelgrößen',40,580)
for (const [i, size] of [16, 32, 48, 64].entries()) proof += embed(`public/icons/hoku-fav-dunkel-${size}.png`, 40 + i * 180, 620, size, size) + label(`${size} px`,40+i*180,730,19)
const nav = fs.readFileSync(path.join(root, 'docs/logo/hoku/branding/hoku-nav-etwas-dichter.svg'), 'utf8').replace(/<svg[^>]*>|<\/svg>/g, '')
proof += `<svg x="800" y="618" width="30" height="30" viewBox="0 0 30 30"><g color="#A1A1A6">${nav}</g></svg>` + label('Leiste · separat gewählt',800,730,19)
proof += label('Android Startbildschirm · 360 × 640', 40, 815) + embed('android/app/src/main/res/drawable-port-xhdpi/splash.png', 40, 850, 281, 500)
proof += label('iOS Startbildschirm · Aspect Fill', 480, 815)
const splash = fs.readFileSync(path.join(root, iosSplash + 'splash-2732x2732.png')).toString('base64')
proof += `<svg x="480" y="850" width="281" height="500" viewBox="0 0 393 699"><image width="393" height="699" preserveAspectRatio="xMidYMid slice" href="data:image/png;base64,${splash}"/></svg>`
proof += label('Keine zusätzliche Kachel im adaptiven Vordergrund.',920,920,23) + label('Kontrollierte Ausschnitte statt verkleinerter Originalränder.',920,965,23)
write('docs/logo/hoku/eingebaut.png', new Resvg(svg(1800, 1450, proof), { font: { loadSystemFonts: true, defaultFontFamily: 'Segoe UI' } }).render().asPng())
write('docs/logo/hoku/EINBAU-CHECKS.json', JSON.stringify({ source: sourceFile, sourceSha256: hash(source), sourceBounds, background, ratios: { app: .84, favicon: .92, maskable: .76, adaptive: .59, symbol: .92, splash: .24 }, pngs: checks, faviconSha256: hash(fs.readFileSync(path.join(root, 'public/favicon.ico'))) }, null, 2))
console.log(JSON.stringify({ installedPngs: checks.length, background, sourceBounds, checks: 'passed' }))
