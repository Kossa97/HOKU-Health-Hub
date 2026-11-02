/**
 * HOKU-Monogramm (Vorlage vom Nutzer, 02.11.2026): drei H-Arme im Abstand von 120°.
 * Jeder Arm hat zwei parallele Balken mit Querstrich; die Balken benachbarter Arme
 * laufen innen in einem gerundeten Knick zusammen. Einheit: Armlänge = 1, Mitte (0, 0),
 * y nach unten. Gemessen an der Vorlage (1254 px): Mitte (627, 640), Armlänge 473 px.
 */
window.MONO = { d: 0.275, w: 0.165, quer: 0.569, knick: 0.22, ende: 0.03, fuellen: true }

/** Zeichnet das Monogramm in einen 2D-Kontext (Mitte cx, cy; Armlänge L px). w: Strichstärke. */
window.zeichneMonogramm = function (ctx, cx, cy, L, m = MONO) {
  const { d, w, quer, knick } = m
  const arme = [-90, 30, 150].map(g => g * Math.PI / 180)
  const A = f => [Math.cos(f), Math.sin(f)], P = f => [-Math.sin(f), Math.cos(f)]
  const pt = (x, y) => [cx + x * L, cy + y * L]
  ctx.save(); ctx.lineWidth = w * L; ctx.lineCap = 'butt'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#fff'
  for (let k = 0; k < 3; k++) {
    const f = arme[k], g = arme[(k + 1) % 3], a = A(f), p = P(f), b = A(g), q = P(g)
    const e1 = pt(a[0] + d * p[0], a[1] + d * p[1])
    const vm = d / Math.sin(Math.PI / 3), v = pt(vm * Math.cos(f + Math.PI / 3), vm * Math.sin(f + Math.PI / 3))
    const e2 = pt(b[0] - d * q[0], b[1] - d * q[1])
    ctx.beginPath(); ctx.moveTo(...e1); ctx.arcTo(...v, ...e2, knick * L); ctx.lineTo(...e2); ctx.stroke()
    // Querstrich
    const c1 = pt(a[0] * quer + d * p[0], a[1] * quer + d * p[1]), c2 = pt(a[0] * quer - d * p[0], a[1] * quer - d * p[1])
    ctx.beginPath(); ctx.moveTo(...c1); ctx.lineTo(...c2); ctx.stroke()
  }
  ctx.restore()
}

/**
 * Abstandsfeld des Monogramms (exakte euklidische Distanztransformation, Felzenszwalb).
 * Liefert sdf(u, v) in Einheiten der Armlänge: < 0 innen, > 0 außen, und die Richtung nach außen.
 */
window.monogrammFeld = function (m = MONO, N = 1024) {
  const c = document.createElement('canvas'); c.width = c.height = N
  const ctx = c.getContext('2d'), L = N * 0.38
  zeichneMonogramm(ctx, N / 2, N / 2, L, m)
  const px = ctx.getImageData(0, 0, N, N).data, innen = new Uint8Array(N * N)
  for (let i = 0; i < N * N; i++) innen[i] = px[i * 4 + 3] > 127 ? 1 : 0
  // Innenfläche füllen (Nutzer 02.11.2026: „das Innere weg"): alles, was von außen nicht
  // erreichbar ist, gehört zur Form. Die offenen Kerben an den Armenden bleiben frei.
  if (m.fuellen !== false) {
    const aussen = new Uint8Array(N * N), stapel = [0]; aussen[0] = 1
    while (stapel.length) {
      const i = stapel.pop(), x = i % N, y = (i / N) | 0
      for (const j of [x > 0 ? i - 1 : -1, x < N - 1 ? i + 1 : -1, y > 0 ? i - N : -1, y < N - 1 ? i + N : -1])
        if (j >= 0 && !aussen[j] && !innen[j]) { aussen[j] = 1; stapel.push(j) }
    }
    for (let i = 0; i < N * N; i++) if (!aussen[i]) innen[i] = 1
  }
  const edt = (ziel) => {
    const INF = 1e20, f = new Float64Array(N * N)
    for (let i = 0; i < N * N; i++) f[i] = innen[i] === ziel ? 0 : INF
    const d1 = (g, n) => {
      const v = new Int32Array(n), z = new Float64Array(n + 1), o = new Float64Array(n); let k = 0
      v[0] = 0; z[0] = -INF; z[1] = INF
      for (let q = 1; q < n; q++) {
        let s = ((g[q] + q * q) - (g[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
        while (s <= z[k]) { k--; s = ((g[q] + q * q) - (g[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]) }
        k++; v[k] = q; z[k] = s; z[k + 1] = INF
      }
      k = 0
      for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; o[q] = (q - v[k]) * (q - v[k]) + g[v[k]] }
      return o
    }
    const col = new Float64Array(N)
    for (let x = 0; x < N; x++) { for (let y = 0; y < N; y++) col[y] = f[y * N + x]; const o = d1(col, N); for (let y = 0; y < N; y++) f[y * N + x] = o[y] }
    const row = new Float64Array(N)
    for (let y = 0; y < N; y++) { for (let x = 0; x < N; x++) row[x] = f[y * N + x]; const o = d1(row, N); for (let x = 0; x < N; x++) f[y * N + x] = Math.sqrt(o[x]) }
    return f
  }
  const zuInnen = edt(1), zuAussen = edt(0), S = new Float32Array(N * N)
  for (let i = 0; i < N * N; i++) S[i] = (innen[i] ? -zuAussen[i] : zuInnen[i]) / L
  const at = (x, y) => S[Math.min(N - 1, Math.max(0, y)) * N + Math.min(N - 1, Math.max(0, x))]
  const feld = (u, v) => {
    const x = N / 2 + u * L - 0.5, y = N / 2 + v * L - 0.5, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0
    const a = at(x0, y0), b = at(x0 + 1, y0), cc = at(x0, y0 + 1), dd = at(x0 + 1, y0 + 1)
    return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + cc * (1 - fx) * fy + dd * fx * fy
  }
  feld.richtung = (u, v) => {
    const h = 1.5 / L, gx = feld(u + h, v) - feld(u - h, v), gy = feld(u, v + h) - feld(u, v - h), l = Math.hypot(gx, gy) || 1
    return [gx / l, gy / l]
  }
  feld.innen = innen; feld.N = N; feld.L = L
  // Kontur verfolgen (Moore-Nachbarschaft), Start: oberster Randpunkt
  let start = -1
  for (let i = 0; i < N * N && start < 0; i++) if (innen[i]) start = i
  const NB = [[-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1]]
  const zug = []; let cx = start % N, cy = (start / N) | 0, rueck = 0
  for (let schritt = 0; schritt < N * 16; schritt++) {
    zug.push([cx, cy])
    let gefunden = false
    for (let k = 0; k < 8; k++) {
      const r = (rueck + 1 + k) % 8, nx = cx + NB[r][0], ny = cy + NB[r][1]
      if (nx >= 0 && ny >= 0 && nx < N && ny < N && innen[ny * N + nx]) { cx = nx; cy = ny; rueck = (r + 4) % 8; gefunden = true; break }
    }
    if (!gefunden || (cx === start % N && cy === ((start / N) | 0) && zug.length > 2)) break
  }
  // glätten und nach Bogenlänge abtasten
  const glatt = zug.map((_, i) => { let x = 0, y = 0; for (let j = -3; j <= 3; j++) { const p = zug[(i + j + zug.length) % zug.length]; x += p[0]; y += p[1] } return [x / 7, y / 7] })
  const bogen = [0]; for (let i = 1; i <= glatt.length; i++) { const a = glatt[i - 1], b = glatt[i % glatt.length]; bogen.push(bogen[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])) }
  const gesamt = bogen[glatt.length], M2 = 4096, kontur = []
  for (let k = 0, j = 0; k < M2; k++) {
    const ziel = (k / M2) * gesamt
    while (bogen[j + 1] < ziel) j++
    const a = glatt[j], b = glatt[(j + 1) % glatt.length], f = (ziel - bogen[j]) / Math.max(1e-9, bogen[j + 1] - bogen[j])
    kontur.push([(a[0] + (b[0] - a[0]) * f + 0.5 - N / 2) / L, (a[1] + (b[1] - a[1]) * f + 0.5 - N / 2) / L])
  }
  // Startpunkt so legen, dass Winkel 0 (rechts) etwa beim Konturpunkt rechts der Mitte liegt
  let beste = 0, bw = 1e9
  kontur.forEach(([u, v], i) => { const w = Math.abs(Math.atan2(v, u)); if (w < bw && u > 0) { bw = w; beste = i } })
  feld.kontur = kontur.slice(beste).concat(kontur.slice(0, beste))
  // Umlaufsinn: Winkel soll mit dem Index steigen
  const a1 = Math.atan2(feld.kontur[40][1], feld.kontur[40][0])
  if (a1 < 0) feld.kontur = [feld.kontur[0], ...feld.kontur.slice(1).reverse()]
  let t = 0; for (let i = 0; i < N * N; i++) t = Math.min(t, S[i]); feld.tiefe = -t
  return feld
}

/**
 * Pupille in Form des Monogramms, gerechnet wie die runde Irisblende in engine/auge.ts:
 * Partikel im Monogramm weichen an seinen Rand und bilden dort eine dichte, helle Kante;
 * Partikel der Rückseite, die man durch das Monogramm sähe, verschwinden.
 * o.mono: { gross (Armlänge in Kugelradien), band (Breite der verdichteten Kante),
 *           hell (Aufhellen an der Kante), kontur (Abstand gleichmäßiger Konturpartikel, 0 = aus) }
 */
window.monogrammPupille = function (m = MONO) {
  const feld = monogrammFeld(m)
  const tang = (a, x, y, z) => [x * a.rx[0] + z * a.rx[2], x * a.uy[0] + y * a.uy[1] + z * a.uy[2]]
  let konturPunkte = null, konturFuer = '', versteckt = 0
  return {
    feld,
    punkt(a, x, y, z, aus, o) {
      const M = o.mono, K = M.gross, W = M.band, h = feld.tiefe * K
      aus[0] = x; aus[1] = y; aus[2] = 1; aus[3] = 1; aus[4] = z
      const G = a.G, dd = x * G[0] + y * G[1] + z * G[2]
      if (dd > 0.2) {
        const [pa, pb0] = tang(a, x, y, z), pb = pb0 - (M.dy || 0), s = feld(pa / K, pb / K) * K
        if (M.rand === 'app' && s < 0) { aus[2] = 0; versteckt++; return } // geht als Randpartikel in extra() auf
        if (s < W) {
          // wie engine/auge.ts: aus der Pupille auf [Rand, Rand + 0,93·Band], von dort außen dicht dahinter;
          // innen nach der Richtung von der Mitte (wie der Kreis), damit sich der Rand gleichmäßig füllt
          const q = (s + h) / (W + h), s2 = 0.93 * W * q
          let tu, tv
          if (s < 0 && M.richtung === 'winkel') {
            const kz = feld.kontur, t = ((Math.atan2(pb, pa) / (2 * Math.PI)) + 1) % 1
            const p = kz[Math.min(kz.length - 1, Math.floor(t * kz.length))], [nx, ny] = feld.richtung(p[0], p[1])
            tu = p[0] * K + nx * s2; tv = p[1] * K + ny * s2
          } else {
            const [nx, ny] = feld.richtung(pa / K, pb / K), dl = Math.max(0, s2 - s)
            tu = pa + nx * dl; tv = pb + ny * dl
          }
          const du = tu - pa, dv = tv - pb
          aus[0] += du * a.rx[0] + dv * a.uy[0]
          aus[1] += dv * a.uy[1]
          aus[3] = 1 + M.hell * (1 - q)
        }
      } else if (z < 0) {
        // durch das Monogramm sähe man die Rückseite: dort nichts
        const zf = Math.sqrt(Math.max(0, 1 - x * x - y * y)), [pa, pb0] = tang(a, x, y, zf), pb = pb0 - (M.dy || 0)
        if (feld(pa / K, pb / K) < 0.01) aus[2] = 0.02
      }
    },
    // gleichmäßig verteilte Partikel genau auf der Kante (Poisson-Scheibe), leicht außerhalb
    extra(a, o) {
      const M = o.mono
      if (M.rand === 'app') {
        // Rand wie die Pupille in der App: die Partikel aus dem Monogramm liegen als Band dicht
        // am Rand (Abstand 0 … 0,93·Band, innen dichter und heller), gleichmäßig über die Kontur
        // Anzahl wie in der App: genau die Partikel, die im Monogramm lagen (organisch: zufällige Lage,
        // wie Punkte gleichmäßig in einer Fläche liegen, Abstand q ~ √u, innen wenige, heller)
        const kz = feld.kontur, K = M.gross, n = M.randAnzahl === 'auto' || !M.randAnzahl ? Math.round(versteckt * (M.randFaktor || 1)) : M.randAnzahl, out = [], G = a.G
        versteckt = 0
        for (let i = 0; i < n; i++) {
          // geschlossen: jeder Partikel bekommt einen eigenen Abschnitt der Kontur, darin liegt er zufällig
          const t = M.geschlossen ? (i + (zufall(i + 31337) - 0.5) * M.geschlossen + 0.5) / n : zufall(i + 31337)
          const p = kz[((Math.floor(t * kz.length) % kz.length) + kz.length) % kz.length]
          const q = Math.pow(zufall(i + 4711), M.randKurve ?? 0.5), s2 = 0.93 * M.band * q
          const [nx, ny] = feld.richtung(p[0], p[1]), pa = p[0] * K + nx * s2, pb = p[1] * K + ny * s2 + (M.dy || 0)
          const tt = Math.sqrt(Math.max(0, 1 - pa * pa - pb * pb))
          const x = G[0] * tt + pa * a.rx[0] + pb * a.uy[0], y = G[1] * tt + pb * a.uy[1], z = G[2] * tt + pa * a.rx[2] + pb * a.uy[2]
          const u = zufall(i + 999), g = 1 + ((0.62 + 0.55 * u * u) - 1) * (o.streu || 0)
          out.push({ x, y, z, licht: 1 + M.hell * (1 - q), g })
        }
        return out
      }
      if (!M.kontur) return []
      const key = JSON.stringify(M)
      if (konturFuer !== key) {
        const N = feld.N, L = feld.L, kand = []
        for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
          const i = y * N + x
          if (feld.innen[i] && (!feld.innen[i - 1] || !feld.innen[i + 1] || !feld.innen[i - N] || !feld.innen[i + N])) kand.push([(x + 0.5 - N / 2) / L, (y + 0.5 - N / 2) / L])
        }
        // fester Zufall, dann ausdünnen auf Mindestabstand
        for (let i = kand.length - 1; i > 0; i--) { const j = Math.floor(zufall(i + 911) * (i + 1)); [kand[i], kand[j]] = [kand[j], kand[i]] }
        const r = M.kontur / M.gross, wahl = [], zelle = r, gitter = new Map()
        const k = (x, y) => Math.floor(x / zelle) + ',' + Math.floor(y / zelle)
        for (const [u, v] of kand) {
          let frei = true
          for (let dx = -1; dx <= 1 && frei; dx++) for (let dy = -1; dy <= 1 && frei; dy++) {
            for (const [qu, qv] of gitter.get((Math.floor(u / zelle) + dx) + ',' + (Math.floor(v / zelle) + dy)) || []) if (Math.hypot(qu - u, qv - v) < r) { frei = false; break }
          }
          if (frei) { wahl.push([u, v]); const kk = k(u, v); if (!gitter.has(kk)) gitter.set(kk, []); gitter.get(kk).push([u, v]) }
        }
        konturPunkte = wahl; konturFuer = key
      }
      const K = M.gross, out = [], st = M.konturStreu || 0
      konturPunkte.forEach(([u, v], i) => {
        // leicht außerhalb der Kante; mit konturStreu unregelmäßig in die Kante hinein verteilt
        const aus = M.band * (0.12 + st * Math.pow(zufall(i + 777), 1.6))
        const [nx, ny] = feld.richtung(u, v), pa = (u * K) + nx * aus, pb = (v * K) + ny * aus + (M.dy || 0)
        const t = Math.sqrt(Math.max(0, 1 - pa * pa - pb * pb)), G = a.G
        const x = G[0] * t + pa * a.rx[0] + pb * a.uy[0], y = G[1] * t + pb * a.uy[1], z = G[2] * t + pa * a.rx[2] + pb * a.uy[2]
        const q = Math.min(1, aus / M.band)
        out.push({ x, y, z, licht: 1 + M.hell * (1 - 0.6 * q), g: st ? 0.45 + 0.7 * Math.pow(zufall(i + 4242), 2) : 0.55 + 0.35 * zufall(i + 4242) })
      })
      return out
    },
  }
}
