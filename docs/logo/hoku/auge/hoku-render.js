// Gemeinsamer Renderer für Hoku (siehe hoku-auge.html).
const { neuesAuge, augeSchritt, augePunkt, PUPILLE, IRIS_ANTEIL } = HokuAuge
const CYAN = [110, 230, 255], VIOLET = [175, 135, 255], PINK = [255, 120, 200]
const PALETTEN = {
  cyanweiss: { vorn: [255, 255, 255], rand: [104, 230, 252], hinten: [0, 150, 192] },
  eiscyan: { vorn: [214, 250, 255], rand: [52, 212, 240], hinten: [0, 128, 172] },
  // Cyan (Logo mit Monogramm): Körper durchgehend Cyan, Kante weiß über kanteWeiss
  cyan: { vorn: [120, 236, 255], rand: [52, 214, 246], hinten: [0, 128, 176] },
  schnee: { vorn: [255, 255, 255], rand: [228, 239, 247], hinten: [150, 182, 206] },
}
const clamp01 = v => Math.max(0, Math.min(1, v))
const TAU = Math.PI * 2

function farbe(X, Y, hue, sicht, pal) {
  if (!pal || pal === 'heute') {
    const m = clamp01((X - Y) * 0.32 + 0.5 + (hue - 0.5) * 0.7)
    let r = CYAN[0] + (VIOLET[0] - CYAN[0]) * m, g = CYAN[1] + (VIOLET[1] - CYAN[1]) * m, b = CYAN[2] + (VIOLET[2] - CYAN[2]) * m
    if (Y > 0.55) { const q = Math.min(1, (Y - 0.55) * 1.4); r += (PINK[0] - r) * q; g += (PINK[1] - g) * q; b += (PINK[2] - b) * q }
    return [r, g, b]
  }
  const p = PALETTEN[pal], f = Math.pow(clamp01((sicht - 0.32) / 0.63), 1 / 1.2), u = 1 - f
  const [a, c, q] = u < 0.5 ? [p.vorn, p.rand, u / 0.5] : [p.rand, p.hinten, (u - 0.5) / 0.5]
  return [a[0] + (c[0] - a[0]) * q, a[1] + (c[1] - a[1]) * q, a[2] + (c[2] - a[2]) * q]
}

function fib(n) {
  const pts = [], ga = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n, r = Math.sqrt(1 - y * y), th = ga * i
    pts.push({ i, iris: (i * IRIS_ANTEIL) % 1 < IRIS_ANTEIL - 1e-9, x: Math.cos(th) * r, y, z: Math.sin(th) * r })
  }
  return pts
}

// Ungleichmäßigkeit: feste Streuung der Punktgröße je Punkt (Nutzer 26.10.: „mehr Ungleichmäßigkeit")
function zufall(i) { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x) }
function groesse(i, o) {
  const n = o.n || 460, basis = Math.sqrt(460 / n)          // mehr Punkte, kleinere Punkte
  const st = o.streu || 0, u = zufall(i), v = zufall(i + 7919)
  // meist mittel, wenige groß, einige fein
  const f = st ? (0.62 + 0.55 * u * u + (v > 0.93 ? 0.45 * st : 0)) : 1
  return basis * (1 + (f - 1) * st)
}
// Punkte wie die Engine sie für ein Bild berechnet: [{X, Y, sicht, licht}]
// o: gx, gy (Blick), roll, hoer (0/1), stimme, irisW, pupille (Faktor auf PUPILLE), kraeftig, n
function hokuPunkte(o) {
  const a = neuesAuge()
  const ein = { ziel: { gx: o.gx || 0, gy: o.gy || 0 }, gross: false, sichtbar: true, hoert: !!o.hoer, stimme: o.stimme || 0, weniger: true }
  for (let i = 0; i < 4; i++) augeSchritt(a, 1 / 60, ein)
  a.irisW = o.irisW || 0
  if (o.pupille) {
    a.rp = PUPILLE * o.pupille * (o.hoer ? 1.22 : 1)
    a.lidKante = -a.rp * 1.08
  }
  const cp = Math.cos(a.pitch), sp = Math.sin(a.pitch), cy = Math.cos(a.yaw), sy = Math.sin(a.yaw)
  const rc = Math.cos(o.roll || 0), rs = Math.sin(o.roll || 0), aus = [0, 0, 0, 0, 0], out = []
  const pts = fib(o.n || 460)
  if (o.zitter) {
    // Punkte leicht aus dem Spiralraster schieben (Anteil des mittleren Abstands), sonst stapeln
    // sie sich bei vielen Punkten am Pupillenrand zu Streifen
    const d = Math.sqrt(4 * Math.PI / pts.length) * o.zitter
    for (const p of pts) {
      p.x += (zufall(p.i + 101) - 0.5) * 2 * d; p.y += (zufall(p.i + 202) - 0.5) * 2 * d; p.z += (zufall(p.i + 303) - 0.5) * 2 * d
      const l = Math.hypot(p.x, p.y, p.z); p.x /= l; p.y /= l; p.z /= l
    }
  }
  for (const p of pts) {
    const x0 = p.x * rc - p.y * rs, y0 = p.x * rs + p.y * rc, z0 = p.z
    const y1 = y0 * cp - z0 * sp, z1 = y0 * sp + z0 * cp
    // eigene Pupillenform (z. B. das Monogramm): window.FORM.punkt statt der runden Irisblende
    if (o.form) FORM.punkt(a, x0 * cy + z1 * sy, y1, -x0 * sy + z1 * cy, aus, o)
    else augePunkt(a, x0 * cy + z1 * sy, y1, -x0 * sy + z1 * cy, p.iris, p.i, aus)
    const Z = Math.max(-1, Math.min(1, aus[4])), f = (Z + 1) / 2
    const sicht = (o.kraeftig ? 0.32 + 0.63 * Math.pow(f, 1.2) : 0.1 + 0.85 * f * f) * aus[2]
    out.push({ X: aus[0], Y: aus[1], Z, sicht, licht: aus[3], g: groesse(p.i, o) })
  }
  // lose Partikel um die Kugel (Nutzer-Vorlage: Hoku als leuchtende Wolke)
  for (let i = 0; i < (o.schweben || 0); i++) {
    const u = zufall(i + 5001) * 2 - 1, w = zufall(i + 6001) * TAU, rr = Math.sqrt(1 - u * u)
    const d = 1.02 + 0.3 * Math.pow(zufall(i + 7001), 1.8), x = Math.cos(w) * rr * d, y = u * d, z = Math.sin(w) * rr
    const f = (z + 1) / 2, sicht = (0.15 + 0.55 * f) * (1 - (d - 1.02) / 0.34)
    out.push({ X: x, Y: y, Z: z, sicht, licht: 1, g: 0.5 + 0.5 * zufall(i + 8001) })
  }
  // zusätzliche Partikel der Form (gleichmäßige Kontur)
  if (o.form && FORM.extra) for (const q of FORM.extra(a, o)) {
    const f = (q.z + 1) / 2, sicht = o.kraeftig ? 0.32 + 0.63 * Math.pow(f, 1.2) : 0.1 + 0.85 * f * f
    out.push({ X: q.x, Y: q.y, Z: q.z, sicht, licht: q.licht, g: q.g * Math.sqrt(460 / (o.n || 460)) })
  }
  return out
}

const VS = 'attribute vec2 aP; attribute float aS; attribute vec4 aC; uniform vec2 uR; varying vec4 vC; void main(){ vec2 p = aP / uR * 2.0 - 1.0; gl_Position = vec4(p.x, -p.y, 0.0, 1.0); gl_PointSize = aS; vC = aC; }'
const FS = 'precision highp float; varying vec4 vC; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = d < 0.42 ? 1.0 : (d < 0.62 ? mix(0.95, 0.4, (d - 0.42) / 0.2) : max(0.0, 0.4 * (1.0 - (d - 0.62) / 0.38))); a *= vC.a; gl_FragColor = vec4(vC.rgb * a, a); }'

// o: size, radius, dy, hue, bright, glow, sizeMul, tile: [innen, aussen] | null, pal, + hokuPunkte-Optionen
window.renderHoku = function (o) {
  const S = o.size, R = S * o.radius, cx = S / 2, cy = S / 2 + (o.dy || 0) * S
  const out = document.createElement('canvas'); out.width = out.height = S
  const ctx = out.getContext('2d')
  if (o.tile) {
    const g = ctx.createRadialGradient(S * 0.5, S * 0.42, 0, S * 0.5, S * 0.42, S * 0.62 * 1.414)
    g.addColorStop(0, o.tile[0]); g.addColorStop(1, o.tile[1])
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S)
  }
  if (o.glow) {
    const g = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 2)
    const gc = o.glowColor || [[70, 170, 255], [150, 110, 255]]
    g.addColorStop(0, `rgba(${gc[0]},${0.18 * o.glow})`); g.addColorStop(0.5, `rgba(${gc[1]},${0.08 * o.glow})`); g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S)
  }
  const gcv = document.createElement('canvas'); gcv.width = gcv.height = S
  const gl = gcv.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: S <= 4096, preserveDrawingBuffer: true })
  if (!gl) throw new Error('WebGL fehlt')
  const sh = (t, src) => { const x = gl.createShader(t); gl.shaderSource(x, src); gl.compileShader(x); return x }
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr); gl.useProgram(pr)
  const data = [], dotR = 0.034 * R, bright = o.bright ?? 0.85
  for (const p of hokuPunkte(o)) {
    if (p.sicht < 0.003) continue
    let c = o.einfarbig || farbe(p.X, p.Y, o.hue ?? 0.45, p.sicht, o.pal)
    if (o.kanteWeiss && !o.einfarbig && p.licht > 1) { const q = Math.min(1, (p.licht - 1) * o.kanteWeiss); c = c.map((v, k) => v + ((o.weiss || [255, 255, 255])[k] - v) * q) }
    const alpha = clamp01(p.sicht * bright * p.licht)
    // kaum sichtbare Punkte (Rückseite, hinter der Pupille) wären groß nur graue Schleier
    if (o.minAlpha && alpha < o.minAlpha) continue
    const sz = dotR * (0.55 + 0.6 * p.sicht) * 3 * (o.sizeMul || 1) * p.g
    data.push(cx + p.X * R, cy + p.Y * R, sz, c[0] / 255, c[1] / 255, c[2] / 255, alpha)
  }
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW)
  const at = (n, k, off) => { const l = gl.getAttribLocation(pr, n); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, k, gl.FLOAT, false, 28, off) }
  at('aP', 2, 0); at('aS', 1, 8); at('aC', 4, 12)
  gl.uniform2f(gl.getUniformLocation(pr, 'uR'), S, S)
  gl.viewport(0, 0, S, S); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT)
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE)
  gl.drawArrays(gl.POINTS, 0, data.length / 7)
  ctx.drawImage(gcv, 0, 0)
  return out
}

// Vektor: jeder Partikel ein Kreis, Größe wie der helle Kern im Raster, Deckkraft nach Tiefe.
// o.fill: Farbe für einfarbig; ohne fill farbig wie in der App. Hinten liegende, kaum sichtbare Punkte entfallen.
window.hokuSvg = function (o) {
  const S = o.vb || 1024, R = S * (o.radius || 0.42), c = S / 2, out = [], bright = o.bright ?? 1
  const pts = hokuPunkte(o).filter(p => p.sicht > (o.schwelle ?? 0.06)).sort((a, b) => a.Z - b.Z)
  for (const p of pts) {
    const sz = 0.034 * R * (0.55 + 0.6 * p.sicht) * 3 * (o.sizeMul || 1) * p.g
    const r = sz * 0.31 * (o.dotMul || 1)
    const a = clamp01(p.sicht * bright * p.licht)
    const col = o.fill || (() => { const k = farbe(p.X, p.Y, o.hue ?? 0.45, p.sicht, o.pal); return '#' + k.map(v => Math.round(v).toString(16).padStart(2, '0')).join('') })()
    out.push(`<circle cx="${(c + p.X * R).toFixed(2)}" cy="${(c + p.Y * R).toFixed(2)}" r="${r.toFixed(2)}" fill="${col}"${a < 0.995 ? ` fill-opacity="${a.toFixed(2)}"` : ''}/>`)
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}"><title>${o.title || 'Hoku'}</title>${out.join('')}</svg>`
}

window.downscale = function (src, size) {
  let c = src
  while (c.width / 2 >= size) {
    const n = document.createElement('canvas'); n.width = n.height = Math.round(c.width / 2)
    const x = n.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(c, 0, 0, n.width, n.height); c = n
  }
  if (c.width !== size) {
    const n = document.createElement('canvas'); n.width = n.height = size
    const x = n.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(c, 0, 0, size, size); c = n
  }
  return c
}
