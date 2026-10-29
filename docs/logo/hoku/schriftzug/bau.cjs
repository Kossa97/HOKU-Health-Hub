// Hoku – Schriftzuege, bei denen das O Dots Kugel ist. Aufruf: node bau.cjs
// Buchstaben h, k, u sind Pfade (kein <text>), Winkel genau 45 Grad.
// Die Kugel kommt aus dem echten Renderer docs/logo/dot/echt/dot-icon.html:
//   Leuchtfassung (Raster, fuer dunklen Grund) und Vektorfassung (Punkte als Kreise, einfarbig).
// Schreibt: 1-hoku.svg, 2-HOKU.svg (nur Buchstaben), 3-hoku-vektor.svg (komplett vektoriell),
//           *-leuchtend.png (Buchstaben + leuchtende Kugel, transparent), uebersicht.png
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs')
const HIER = __dirname
const BASIS = { rot: 0.6, tilt: 0.38, hue: 0.45, bright: 1.0, glow: 0.65, breath: 0.02, phases: [0.4, 2.1, 4.0] }

// ---- 1: hoku klein, rund, Strich 20 (Grundlinie 200, x-Hoehe 100, Oberlaenge 40) ----
const KLEIN = {
  w: 540, h: 240, stroke: 20, cap: 'round',
  o: { cx: 196, cy: 150, r: 54 },             // Kugel etwas groesser als ein Strich-o (weicher Rand)
  d: [
    'M30 40 V200 M30 150 A42 42 0 0 1 114 150 V200',     // h
    'M276 40 V200 M346 100 L286 160 M316 130 L386 200', // k (Arm und Bein genau 45 Grad)
    'M426 100 V150 A42 42 0 0 0 510 150 M510 100 V200', // u
  ],
}
// ---- 2: HOKU Versalien, duenn, weit gesperrt (Versalhoehe 68..188, Strich 7) ----
const GROSS = {
  w: 560, h: 256, stroke: 7, cap: 'square',
  o: { cx: 200, cy: 128, r: 66 },
  d: [
    'M20 68 V188 M100 68 V188 M20 128 H100',              // H
    'M300 68 V188 M380 68 L300 148 M330 118 L400 188',    // K
    'M450 68 V148 A40 40 0 0 0 530 148 V68',              // U
  ],
}
const pfad = (L, farbe) => `<g fill="none" stroke="${farbe}" stroke-width="${L.stroke}" stroke-linecap="${L.cap}" stroke-linejoin="round">${L.d.map(d => `<path d="${d}"/>`).join('')}</g>`
const svg = (L, inhalt) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${L.w} ${L.h}" width="${L.w}" height="${L.h}"><title>Hoku</title>${inhalt}</svg>`

;(async () => {
  const b = await chromium.launch({ channel: 'chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  const p = await b.newPage(); await p.goto('file://' + path.join(HIER, '../../dot/echt/dot-icon.html'))
  // Leuchtende Kugel ohne Kachel, transparent; Kugel fuellt 40 % der Kantenlaenge (Rest = Schein)
  const KUGEL_ANTEIL = 0.4
  // heller als im Icon: neben reinweissen Buchstaben wirkt die Icon-Helligkeit blass
  const kugelPng = await p.evaluate(o => downscale(renderDot(o), 1024).toDataURL('image/png'),
    { ...BASIS, size: 2048, radius: KUGEL_ANTEIL / 2, bright: 1.45, glow: 0.9, sizeMul: 1.2, layers: { glow: true, points: true } })
  // Vektor-Kugel: Vorderseite als Kreise im 256er-Feld, Radius 0,38 * 256
  const kugelSvg = await p.evaluate(o => dotSvg(o), { ...BASIS, radius: 0.38, dotMul: 1.25 })
  const kreise = kugelSvg.match(/<circle[^>]+\/>/g).join('')

  // Buchstaben-SVGs (weiss) und vollstaendig vektorielle Fassung
  for (const [name, L] of [['1-hoku', KLEIN], ['2-HOKU', GROSS]]) fs.writeFileSync(path.join(HIER, `${name}.svg`), svg(L, pfad(L, '#fff')))
  const vektor = (L, farbe) => {
    const s = (L.o.r * 1.02) / (0.38 * 256)  // Kugelradius auf das O abbilden
    const t = `translate(${L.o.cx - 128 * s} ${L.o.cy - 128 * s}) scale(${s})`
    return svg(L, pfad(L, farbe) + `<g fill="${farbe}" transform="${t}">${kreise}</g>`)
  }
  fs.writeFileSync(path.join(HIER, '3-hoku-vektor.svg'), vektor(KLEIN, '#000'))
  fs.writeFileSync(path.join(HIER, '3-hoku-vektor-weiss.svg'), vektor(KLEIN, '#fff'))
  fs.writeFileSync(path.join(HIER, '2-HOKU-vektor.svg'), vektor(GROSS, '#000'))

  // Leuchtfassung: Buchstaben + Kugel als Bild an der Stelle des O
  const leuchtend = (L, hoehe) => {
    const k = L.o.r * 2 / KUGEL_ANTEIL
    return `<div class="wm" style="position:relative;width:${L.w * hoehe / L.h}px;height:${hoehe}px">
      <img src="${kugelPng}" style="position:absolute;left:${(L.o.cx - k / 2) / L.w * 100}%;top:${(L.o.cy - k / 2) / L.h * 100}%;width:${k / L.w * 100}%;mix-blend-mode:screen">
      <img src="data:image/svg+xml;base64,${Buffer.from(svg(L, pfad(L, '#fff'))).toString('base64')}" style="position:absolute;inset:0;width:100%;height:100%">
    </div>`
  }
  const b64 = f => 'data:image/svg+xml;base64,' + fs.readFileSync(path.join(HIER, f)).toString('base64')
  const icon = 'data:image/png;base64,' + fs.readFileSync(path.join(HIER, '../../dot/kit/dot-icon-1024.png')).toString('base64')

  // Einzelbilder (transparent) fuer die Leuchtfassungen
  for (const [name, L] of [['1-hoku', KLEIN], ['2-HOKU', GROSS]]) {
    await p.setContent(`<body style="margin:0;background:transparent">${leuchtend(L, 480)}</body>`)
    await p.setViewportSize({ width: Math.ceil(L.w * 480 / L.h), height: 480 })
    await p.locator('.wm').screenshot({ path: path.join(HIER, `${name}-leuchtend.png`), omitBackground: true })
  }

  const zeile = (titel, text, gross, hell, klein) => `<section><h2>${titel}</h2><p>${text}</p><div class="row">
      <div class="tile black big">${gross}</div><div class="tile light">${hell}</div><div class="tile black small">${klein}</div></div></section>`
  await p.setContent(`<!doctype html><meta charset="utf-8"><style>
    body{margin:0;background:#0b0c0e;color:#e8eaf0;font:15px/1.4 system-ui,sans-serif;padding:36px}
    h1{font-weight:500;font-size:22px;margin:0 0 24px} h2{font-size:17px;margin:0 0 2px;font-weight:600} p{margin:0 0 12px;color:#9aa3b2}
    section{margin-bottom:28px} .row{display:flex;gap:16px}
    .tile{height:190px;border-radius:14px;display:flex;align-items:center;justify-content:center;border:1px solid #1d2027;overflow:hidden}
    .black{background:#000} .light{background:#eef0f4;width:300px} .big{width:460px} .small{width:200px;flex-direction:column;gap:16px}
    .store{display:flex;align-items:center;gap:16px;background:#1c1f26;border-radius:14px;padding:16px 20px;width:520px}
    .store img{width:72px;height:72px;border-radius:16px} .store b{display:block;font-size:17px} .store span{color:#9aa3b2;font-size:14px}
  </style><h1>Hoku – Schriftzüge, das O ist Dots Kugel</h1>
  ${zeile('1 · hoku', 'Klein und rund. Die Kugel sitzt als o mitten im Wort.', leuchtend(KLEIN, 110), `<img src="${b64('3-hoku-vektor.svg')}" style="height:92px">`, `${leuchtend(KLEIN, 40)}${leuchtend(KLEIN, 22)}`)}
  ${zeile('2 · HOKU', 'Versalien, dünn und weit gesperrt wie ein Messgerät. Die Kugel ist das O.', leuchtend(GROSS, 120), `<img src="${b64('2-HOKU-vektor.svg')}" style="height:96px">`, `${leuchtend(GROSS, 44)}${leuchtend(GROSS, 24)}`)}
  ${zeile('3 · hoku vektor', 'Wie 1, die Kugel aus einfarbigen Punkten – für Druck, Prägung, hellen Grund.', `<img src="${b64('3-hoku-vektor-weiss.svg')}" style="height:110px">`, `<img src="${b64('3-hoku-vektor.svg')}" style="height:92px">`, `<img src="${b64('3-hoku-vektor-weiss.svg')}" style="height:40px"><img src="${b64('3-hoku-vektor-weiss.svg')}" style="height:22px">`)}
  <section><h2>So im App Store</h2><p>Icon bleibt die Kugel; Name und Untertitel als Vorschlag.</p>
    <div class="store"><img src="${icon}"><div><b>Hoku – Biohacking Tracker</b><span>Peptide, Stack & Blutwerte</span></div></div></section>`)
  await p.setViewportSize({ width: 1060, height: 900 })
  await p.screenshot({ path: path.join(HIER, 'uebersicht.png'), fullPage: true })
  console.log('fertig'); await b.close()
})()
