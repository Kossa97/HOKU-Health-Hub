const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { Resvg } = require('@resvg/resvg-js')
const root = path.resolve(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file))
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex')
const assert = (condition, message) => { if (!condition) throw new Error(message) }
const manifest = JSON.parse(read('docs/logo/hoku/EINBAU-CHECKS.json'))
assert(hash(read(manifest.source)) === manifest.sourceSha256, 'Approved dark source changed')
for (const p of manifest.pngs) {
  const bytes = read(p.file)
  assert(bytes.readUInt32BE(16) === p.width && bytes.readUInt32BE(20) === p.height, p.file + ': dimensions changed')
  assert(hash(bytes) === p.sha256, p.file + ': contents changed')
  const opaque = ['app', 'maskable', 'favicon', 'splash'].includes(p.kind)
  assert(bytes[25] === (opaque ? 2 : 6), p.file + ': RGB/alpha format')
  if (p.kind === 'app' || p.kind === 'favicon') {
    const fill = Math.max(p.occupied.width, p.occupied.height) / p.width
    assert(fill >= (p.kind === 'app' ? .84 : .85) && fill <= .99, p.file + ': empty margins or clipped artwork')
  }
  if (p.kind === 'maskable') assert(p.occupied.radius <= p.width * .4, p.file + ': maskable crop')
  if (p.kind === 'adaptive') {
    assert(p.occupied.radius <= p.width * 33 / 108, p.file + ': adaptive safe zone')
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${p.width}" height="${p.height}"><image width="${p.width}" height="${p.height}" href="data:image/png;base64,${bytes.toString('base64')}"/></svg>`
    const pixels = new Resvg(svg).render().pixels
    for (const i of [3, (p.width - 1) * 4 + 3, ((p.height - 1) * p.width) * 4 + 3, (p.height * p.width - 1) * 4 + 3]) assert(pixels[i] === 0, p.file + ': foreground has a rectangular matte')
  }
}
for (const size of [180, 192, 512]) assert(hash(read(`public/icons/hoku-${size}.png`)) === hash(read(`public/icons/hoku-dunkel-${size}.png`)), 'Stale public icon alias: ' + size)
for (const size of [192, 512]) assert(hash(read(`public/icon-${size}.png`)) === hash(read(`public/icons/hoku-dunkel-${size}.png`)), 'Stale notification icon: ' + size)
for (const size of [32, 48, 64]) assert(hash(read(`public/icons/hoku-fav-blau-${size}.png`)) === hash(read(`public/icons/hoku-fav-dunkel-${size}.png`)), 'Stale favicon alias: ' + size)
const ico = read('public/favicon.ico')
assert(hash(ico) === manifest.faviconSha256 && ico.readUInt16LE(2) === 1 && ico.readUInt16LE(4) === 4, 'Favicon ICO header')
for (const [i, size] of [16, 32, 48, 64].entries()) {
  const p = 6 + i * 16, len = ico.readUInt32LE(p + 8), offset = ico.readUInt32LE(p + 12), bytes = ico.subarray(offset, offset + len)
  assert(ico[p] === size && bytes.readUInt32BE(16) === size && bytes.readUInt32BE(20) === size && hash(bytes) === hash(read(`public/icons/hoku-fav-dunkel-${size}.png`)), 'ICO entry ' + size)
}
const html = read('index.html').toString(), vite = read('vite.config.ts').toString()
assert(html.includes('hoku-dunkel-180.png') && !html.includes('hoku-fav-blau'), 'HTML references old icons')
for (const m of html.matchAll(/href="(\/icons\/[^"?]+)(?:\?[^"]*)?"/g)) assert(fs.existsSync(path.join(root, 'public', m[1])), 'Missing HTML icon: ' + m[1])
for (const name of ['hoku-dunkel-192.png', 'hoku-dunkel-512.png', 'hoku-dunkel-maskable-512.png']) assert(vite.includes('/icons/' + name) && fs.existsSync(path.join(root, 'public/icons', name)), 'Missing PWA icon: ' + name)
assert(vite.includes("background_color: '#000101'"), 'PWA background mismatch')
assert(read('android/app/src/main/res/values/ic_launcher_background.xml').toString().includes('#000101'), 'Android background mismatch')
assert(read('src/features/dot/DotLogo.tsx').toString().includes('fill="currentColor"'), 'Navigation does not inherit the icon color')
for (const file of ['public/icon.svg', 'public/favicon.svg']) assert(read(file).length < 1024 * 1024, file + ': oversized embedded bitmap')
const ios = JSON.parse(read('ios/App/App/Assets.xcassets/AppIcon.appiconset/Contents.json'))
for (const image of ios.images) if (image.filename) assert(fs.existsSync(path.join(root, 'ios/App/App/Assets.xcassets/AppIcon.appiconset', image.filename)), 'Missing iOS asset')
console.log(JSON.stringify({ pngsVerified: manifest.pngs.length, approvedDarkSource: true, safeAreas: true, legacyUrlsUpdated: true, navigationUpdated: true, faviconEntries: 4, references: 'passed' }))
