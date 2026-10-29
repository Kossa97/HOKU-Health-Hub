// Hoku (Maskottchen) als drei grosse PNGs, 2048 x 2048. Aufruf: node export.cjs
// Kugel aus dem echten Renderer docs/logo/dot/echt/dot-icon.html (gleiche Werte wie das App-Icon).
//  1 hoku-schwarz.png      – leuchtend auf schwarzem Quadrat (ohne Rundung, wie die Kachel des Icons)
//  2 hoku-transparent.png  – leuchtend, Hintergrund transparent (fuer dunkle Flaechen)
//  3 hoku-einfarbig.png    – einfarbig schwarze Punkte, transparent (fuer hellen Grund, Druck)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs')
const BASIS = { radius: 0.33, rot: 0.6, tilt: 0.38, hue: 0.45, bright: 1.0, glow: 0.65, breath: 0.02, phases: [0.4, 2.1, 4.0] }
const S = 2048
;(async () => {
  const b = await chromium.launch({ channel: 'chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  const p = await b.newPage(); await p.goto('file://' + path.join(__dirname, '../../dot/echt/dot-icon.html'))
  const png = async (o, datei) => {
    const url = await p.evaluate(([o, s]) => downscale(renderDot(o), s).toDataURL('image/png'), [{ ...BASIS, size: S * 2, ...o }, S])
    fs.writeFileSync(path.join(__dirname, datei), Buffer.from(url.split(',')[1], 'base64')); console.log('wrote', datei)
  }
  await png({ layers: { tile: true, glow: true, points: true } }, 'hoku-schwarz.png')
  await png({ layers: { glow: true, points: true } }, 'hoku-transparent.png')
  // einfarbig: Vektor-Punkte (Vorderseite) gross gerastert
  const svg = await p.evaluate(o => dotSvg(o), { ...BASIS, radius: 0.38, dotMul: 1.25, fill: '#000' })
  await p.setContent(`<body style="margin:0;background:transparent">${svg.replace('width="256" height="256"', `width="${S}" height="${S}"`)}</body>`)
  await p.setViewportSize({ width: S, height: S })
  await p.locator('svg').screenshot({ path: path.join(__dirname, 'hoku-einfarbig.png'), omitBackground: true }); console.log('wrote hoku-einfarbig.png')
  // 4 hoku-weiss.png – dieselben Punkte in Weiss, transparent (fuer dunklen Grund und Fotos)
  await p.setContent(`<body style="margin:0;background:transparent">${svg.replace('width="256" height="256"', `width="${S}" height="${S}"`).replace('fill="#000"', 'fill="#fff"')}</body>`)
  await p.locator('svg').screenshot({ path: path.join(__dirname, 'hoku-weiss.png'), omitBackground: true }); console.log('wrote hoku-weiss.png')
  // 5 hoku-farbig.png – nur die Punkte in Dots Farben, scharf, ohne Schein und ohne weichen Saum, transparent
  const farbig = await p.evaluate(o => {
    const S = 256, R = S * o.radius, cx = S / 2, cy = S / 2, out = []
    const rc = Math.cos(o.rot), rs = Math.sin(o.rot), ct = Math.cos(o.tilt), st = Math.sin(o.tilt), ph = o.phases
    for (const p of fib(460)) {
      const X = p.x * rc + p.z * rs, Z0 = -p.x * rs + p.z * rc
      const Y = p.y * ct - Z0 * st, Z = p.y * st + Z0 * ct, f = (Z + 1) / 2, z = 0.1 + 0.85 * f * f
      if (z < 0.35) continue
      const th = Math.atan2(Y, X), s = 1 + o.breath * (Math.sin(2 * th + ph[0]) + 0.7 * Math.sin(3 * th + ph[1]) + 0.4 * Math.sin(5 * th + ph[2]))
      const r = 0.034 * R * (0.55 + 0.6 * z) * 3 * 0.42 * 1.25
      const [cr, cg, cb] = dotColor(X, Y, o.hue).map(Math.round)
      out.push(`<circle cx="${(cx + X * R * s).toFixed(2)}" cy="${(cy + Y * R * s).toFixed(2)}" r="${r.toFixed(2)}" fill="rgb(${cr},${cg},${cb})"/>`)
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">${out.join('')}</svg>`
  }, { ...BASIS, radius: 0.38 })
  fs.writeFileSync(path.join(__dirname, 'hoku-farbig.svg'), farbig)
  await p.setContent(`<body style="margin:0;background:transparent">${farbig.replace('width="256" height="256"', `width="${S}" height="${S}"`)}</body>`)
  await p.locator('svg').screenshot({ path: path.join(__dirname, 'hoku-farbig.png'), omitBackground: true }); console.log('wrote hoku-farbig.png')
  await b.close()
})()
