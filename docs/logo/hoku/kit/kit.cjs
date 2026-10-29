// HOKU – Schriftzug-Kit. Aufruf: node kit.cjs   (danach export.sh fuer die Einfarb-Varianten)
// Endfassung von Schriftzug 2 aus ../schriftzug: duenne Versalien, das O ist Dots Kugel.
// Korrekturen gegenueber dem Konzept:
//  - U um 10 naeher an K (K oeffnet sich nach rechts und wirkt sonst zu weit weg)
//  - Vektor-O 4 % groesser als die Versalhoehe (optischer Ueberhang runder Formen), Leucht-O 10 %
//    (der weiche Rand frisst Groesse)
//  - Kleinfassung (unter 24 px Hoehe): Strich 16 statt 7, O als volle Scheibe – Dot als Punkt
// Schreibt: hoku-wortmarke.svg (Master, schwarz), hoku-klein.svg, hoku-wortmarke-leuchtend-*.png,
//           hoku-klein-leuchtend.png, hoku-lockup-*.png, uebersicht.png
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs')
const HIER = __dirname
const BASIS = { rot: 0.6, tilt: 0.38, hue: 0.45, bright: 1.0, glow: 0.65, breath: 0.02, phases: [0.4, 2.1, 4.0] }
const CAP = [68, 188]                      // Versalhoehe 120
const W = 540, H = 256

const LETTERS = stroke => [
  'M20 68 V188 M100 68 V188 M20 128 H100',            // H
  'M300 68 V188 M380 68 L300 148 M330 118 L400 188',  // K, Arm und Bein genau 45 Grad
  'M440 68 V148 A40 40 0 0 0 520 148 V68',            // U
]
const O = { cx: 200, cy: 128 }
const R_VEKTOR = 62.4, R_LEUCHT = 66, R_SCHEIBE = 62
const g = (stroke, farbe, cap = 'square') => `<g fill="none" stroke="${farbe}" stroke-width="${stroke}" stroke-linecap="${cap}" stroke-linejoin="miter">${LETTERS(stroke).map(d => `<path d="${d}"/>`).join('')}</g>`
const svg = (inhalt, title = 'HOKU') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><title>${title}</title>${inhalt}</svg>`

;(async () => {
  const b = await chromium.launch({ channel: 'chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  const p = await b.newPage(); await p.goto('file://' + path.join(HIER, '../../dot/echt/dot-icon.html'))
  const ANTEIL = 0.4
  const kugel = async extra => p.evaluate(o => downscale(renderDot(o), 1024).toDataURL('image/png'),
    { ...BASIS, size: 2048, radius: ANTEIL / 2, bright: 1.45, glow: 0.9, sizeMul: 1.2, layers: { glow: true, points: true }, ...extra })
  const kugelPng = await kugel({})
  const kugelKlein = await kugel({ n: 160, sizeMul: 1.9, bright: 1.6 })    // weniger, groessere Punkte fuer klein
  const kreise = (await p.evaluate(o => dotSvg(o), { ...BASIS, radius: 0.38, dotMul: 1.25 })).match(/<circle[^>]+\/>/g).join('')

  // ---- Vektor-Master (schwarz) und Kleinfassung ----
  const s = R_VEKTOR / (0.38 * 256 * 1.02)
  const kugelGruppe = farbe => `<g fill="${farbe}" transform="translate(${(O.cx - 128 * s).toFixed(2)} ${(O.cy - 128 * s).toFixed(2)}) scale(${s.toFixed(4)})">${kreise}</g>`
  fs.writeFileSync(path.join(HIER, 'hoku-wortmarke.svg'), svg(g(7, '#000') + kugelGruppe('#000')))
  fs.writeFileSync(path.join(HIER, 'hoku-klein.svg'), svg(g(16, '#000') + `<circle cx="${O.cx}" cy="${O.cy}" r="${R_SCHEIBE}" fill="#000"/>`, 'HOKU klein'))

  // ---- Leuchtfassungen (transparent, fuer dunklen Grund) ----
  const leuchtend = (hoehe, { stroke = 7, png = kugelPng, r = R_LEUCHT } = {}) => {
    const k = r * 2 / ANTEIL
    const buchstaben = 'data:image/svg+xml;base64,' + Buffer.from(svg(g(stroke, '#fff'))).toString('base64')
    return `<div class="wm" style="position:relative;width:${W * hoehe / H}px;height:${hoehe}px">
      <img src="${png}" style="position:absolute;left:${(O.cx - k / 2) / W * 100}%;top:${(O.cy - k / 2) / H * 100}%;width:${k / W * 100}%;mix-blend-mode:screen">
      <img src="${buchstaben}" style="position:absolute;inset:0;width:100%;height:100%"></div>`
  }
  const shot = async (html, datei, breite, hoehe) => {
    await p.setContent(`<body style="margin:0;background:transparent">${html}</body>`)
    await p.setViewportSize({ width: breite, height: hoehe })
    await p.locator('.wm').first().screenshot({ path: path.join(HIER, datei), omitBackground: true })
  }
  for (const h of [1024, 512, 256]) await shot(leuchtend(h), `hoku-wortmarke-leuchtend-${h}.png`, Math.ceil(W * h / H), h)
  await shot(leuchtend(128, { stroke: 16, png: kugelKlein, r: 64 }), 'hoku-klein-leuchtend-128.png', 280, 128)

  // ---- Lockup: Icon + Schriftzug (Website-Kopf, Pressebild) ----
  const icon = 'data:image/png;base64,' + fs.readFileSync(path.join(HIER, '../../dot/kit/dot-icon-1024.png')).toString('base64')
  const lockup = (hoehe, hg) => `<div class="wm" style="display:flex;align-items:center;gap:${hoehe * 0.32}px;padding:${hoehe * 0.3}px;background:${hg}">
      <img src="${icon}" style="width:${hoehe}px;height:${hoehe}px;border-radius:${hoehe * 0.225}px">${leuchtend(hoehe * 0.9)}</div>`
  await shot(lockup(256, '#000'), 'hoku-lockup-schwarz.png', 1400, 420)
  await shot(lockup(256, 'transparent'), 'hoku-lockup-transparent.png', 1400, 420)

  // ---- Uebersicht ----
  const b64 = f => 'data:image/svg+xml;base64,' + fs.readFileSync(path.join(HIER, f)).toString('base64')
  const inv = f => 'data:image/svg+xml;base64,' + Buffer.from(fs.readFileSync(path.join(HIER, f), 'utf8').replaceAll('#000', '#fff')).toString('base64')
  await p.setContent(`<!doctype html><meta charset="utf-8"><style>
    body{margin:0;background:#0b0c0e;color:#e8eaf0;font:14px/1.4 system-ui,sans-serif;padding:36px;width:1080px}
    h1{font-weight:500;font-size:22px;margin:0 0 20px} h2{font-size:15px;margin:22px 0 8px;font-weight:600;color:#c9cfdb}
    .row{display:flex;gap:14px;align-items:stretch} .t{border-radius:14px;border:1px solid #1d2027;display:flex;align-items:center;justify-content:center;padding:22px}
    .k{background:#000} .l{background:#eef0f4} .c{background:#6ee6ff} .ladder{gap:26px;align-items:flex-end}
    .lab{font-size:12px;color:#7d8696;text-align:center;margin-top:6px}
  </style><h1>HOKU – Schriftzug-Kit</h1>
  <h2>Hauptfassung: leuchtend auf Schwarz</h2><div class="row"><div class="t k" style="flex:1;height:200px">${leuchtend(150)}</div></div>
  <h2>Einfarbig: Schwarz · Weiß · Cyan</h2><div class="row">
    <div class="t l" style="flex:1"><img src="${b64('hoku-wortmarke.svg')}" style="height:90px"></div>
    <div class="t k" style="flex:1"><img src="${inv('hoku-wortmarke.svg')}" style="height:90px"></div>
    <div class="t c" style="flex:1"><img src="${b64('hoku-wortmarke.svg')}" style="height:90px"></div></div>
  <h2>Größenleiter (Höhe in px) – ab 24 px abwärts die Kleinfassung</h2>
  <div class="row"><div class="t k ladder" style="flex:1">
    ${[96, 48, 32].map(h => `<div>${leuchtend(h)}<div class="lab">${h}</div></div>`).join('')}
    ${[24, 16].map(h => `<div>${leuchtend(h, { stroke: 16, png: kugelKlein, r: 64 })}<div class="lab">${h} klein</div></div>`).join('')}</div>
    <div class="t l ladder" style="flex:1">
    ${[48, 32].map(h => `<div><img src="${b64('hoku-wortmarke.svg')}" style="height:${h}px"><div class="lab">${h}</div></div>`).join('')}
    ${[24, 16].map(h => `<div><img src="${b64('hoku-klein.svg')}" style="height:${h}px"><div class="lab">${h} klein</div></div>`).join('')}</div></div>
  <h2>Lockup mit Icon</h2><div class="row"><div class="t k" style="flex:1">${lockup(90, 'transparent')}</div></div>`)
  await p.setViewportSize({ width: 1152, height: 900 })
  await p.screenshot({ path: path.join(HIER, 'uebersicht.png'), fullPage: true })
  console.log('fertig'); await b.close()
})()
