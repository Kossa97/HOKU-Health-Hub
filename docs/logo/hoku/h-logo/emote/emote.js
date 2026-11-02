/**
 * Hoku zeigt das H-Monogramm (Nutzer 02.11.2026: „als wäre es Dot, der sich dazu entwickelt hat,
 * oder es als Emote zeigt"). Gebaut wie die Gesten in src/features/dot/engine/gesten.ts:
 * - emote:     wie „Herz C" – Kugel aus gedämpften Partikeln, vorn wölbt sich das Monogramm aus eigenen
 *              Partikeln heraus (Kontur am hellsten, Füllung), leicht gedreht.
 * - roehren:   wie das X aus runden Balken – Hoku ist ganz zum Monogramm geworden, Partikel auf Röhren im Raum.
 * - wandel:    mitten in der Verwandlung – ein Teil ist angekommen, der Rest fliegt noch aus der Kugel heran.
 * - schrift:   wie Hokus Schrift („Welcome to Hoku") – gleichmäßiges Punktraster mit Lichtlauf.
 * Monogramm wie docs/logo/hoku/h-logo/h_logo.py (A · Linie): d 0,275, w 0,19, quer 0,569, Knick 0,2.
 */
(function () {
  const TAU = Math.PI * 2
  const rnd = s => { let x = s >>> 0 || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296 } }
  const MG = { d: 0.275, w: 0.19, quer: 0.569, knick: 0.2 }

  // Mittellinien des Monogramms (wie h_logo.py), optisch mittig, Einheit Armlänge
  function linien(m = MG) {
    const arme = [-90, 30, 150].map(g => g * Math.PI / 180), out = [], qs = []
    const A = f => [Math.cos(f), Math.sin(f)], P = f => [-Math.sin(f), Math.cos(f)]
    const bez = (a, b, c, t) => [(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * b[0] + t * t * c[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * b[1] + t * t * c[1]]
    for (let k = 0; k < 3; k++) {
      const f = arme[k], g = arme[(k + 1) % 3], a = A(f), p = P(f), b = A(g), q = P(g), d = m.d
      const e1 = [a[0] + d * p[0], a[1] + d * p[1]], vm = d / Math.sin(Math.PI / 3)
      const v = [vm * Math.cos(f + Math.PI / 3), vm * Math.sin(f + Math.PI / 3)], e2 = [b[0] - d * q[0], b[1] - d * q[1]]
      const t = m.knick / Math.tan(Math.PI / 3), n1 = Math.hypot(e1[0] - v[0], e1[1] - v[1]), n2 = Math.hypot(e2[0] - v[0], e2[1] - v[1])
      const t1 = [v[0] + (e1[0] - v[0]) / n1 * t, v[1] + (e1[1] - v[1]) / n1 * t], t2 = [v[0] + (e2[0] - v[0]) / n2 * t, v[1] + (e2[1] - v[1]) / n2 * t]
      out.push([e1, ...Array.from({ length: 17 }, (_, i) => bez(t1, v, t2, i / 16)), e2])
      qs.push([[a[0] * m.quer + d * p[0], a[1] * m.quer + d * p[1]], [a[0] * m.quer - d * p[0], a[1] * m.quer - d * p[1]]])
    }
    const alle = out.concat(qs), pts = alle.flat(), h = m.w / 2
    const x0 = Math.min(...pts.map(p => p[0])) - h, x1 = Math.max(...pts.map(p => p[0])) + h
    const y0 = Math.min(...pts.map(p => p[1])) - h, y1 = Math.max(...pts.map(p => p[1])) + h
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, sk = 2 / Math.max(x1 - x0, y1 - y0)
    // auf Breite/Höhe 2 normiert (−1 … 1), mittig
    const norm = l => l.map(p => [(p[0] - cx) * sk, (p[1] - cy) * sk])
    return { zuege: out.map(norm), quer: qs.map(norm), w: m.w * sk }
  }

  // Maske der Strichfläche (Canvas) für Innen-Test, Rand und Füllung
  function maske(L) {
    const N = 900, c = document.createElement('canvas'); c.width = c.height = N
    const x = c.getContext('2d'), s = N * 0.45, T = p => [N / 2 + p[0] * s, N / 2 + p[1] * s]
    x.strokeStyle = '#fff'; x.lineWidth = L.w * s; x.lineJoin = 'round'; x.lineCap = 'butt'
    for (const z of L.zuege.concat(L.quer)) { x.beginPath(); z.forEach((p, i) => i ? x.lineTo(...T(p)) : x.moveTo(...T(p))); x.stroke() }
    const d = x.getImageData(0, 0, N, N).data, inn = (u, v) => { const X = Math.round(N / 2 + u * s), Y = Math.round(N / 2 + v * s); return X >= 0 && Y >= 0 && X < N && Y < N && d[(Y * N + X) * 4 + 3] > 127 }
    const rand = []
    for (let Y = 1; Y < N - 1; Y++) for (let X = 1; X < N - 1; X++) {
      const i = (Y * N + X) * 4 + 3
      if (d[i] > 127 && (d[i - 4] <= 127 || d[i + 4] <= 127 || d[i - N * 4] <= 127 || d[i + N * 4] <= 127)) rand.push([(X - N / 2) / s, (Y - N / 2) / s])
    }
    return { inn, rand }
  }

  // Poisson-Scheibe: aus Kandidaten mit Mindestabstand auswählen
  function duenne(kand, r, max = 1e9) {
    const g = new Map(), out = [], key = (x, y) => Math.floor(x / r) + ',' + Math.floor(y / r)
    for (const p of kand) {
      if (out.length >= max) break
      let frei = true
      for (let dx = -1; dx <= 1 && frei; dx++) for (let dy = -1; dy <= 1 && frei; dy++)
        for (const q of g.get((Math.floor(p[0] / r) + dx) + ',' + (Math.floor(p[1] / r) + dy)) || []) if (Math.hypot(q[0] - p[0], q[1] - p[1]) < r) { frei = false; break }
      if (frei) { out.push(p); const k = key(p[0], p[1]); if (!g.has(k)) g.set(k, []); g.get(k).push(p) }
    }
    return out
  }

  function fib(n) {
    const pts = [], ga = Math.PI * (3 - Math.sqrt(5))
    for (let i = 0; i < n; i++) { const y = 1 - (2 * (i + 0.5)) / n, r = Math.sqrt(1 - y * y), th = ga * i; pts.push([Math.cos(th) * r, y, Math.sin(th) * r]) }
    return pts
  }

  // drehen (yaw um y, pitch um x) und perspektivisch abbilden wie die Gesten (fern 4)
  function bild(p, o) {
    const cy = Math.cos(o.yaw || 0), sy = Math.sin(o.yaw || 0), cp = Math.cos(o.pitch || 0), sp = Math.sin(o.pitch || 0)
    let x = p[0] * cy + p[2] * sy, z = -p[0] * sy + p[2] * cy, y = p[1]
    const y2 = y * cp - z * sp, z2 = y * sp + z * cp, fern = 4, s = fern / (fern - z2)
    return [x * s, y2 * s, z2]
  }

  const sichtAus = z => 0.28 + 0.72 * Math.max(0, Math.min(1, (z + 1) / 2))

  window.EMOTE = function (o) {
    const art = o.emote, R = rnd(o.saat || 11), L = linien(), M = maske(L), out = []
    const groesse = o.mono || 0.62          // halbe Breite des Monogramms in Kugelradien
    const streu = () => 0.75 + 0.45 * R() * R() + (R() > 0.95 ? 0.35 : 0)

    if (art === 'emote' || art === 'wandel') {
      // Monogramm aus eigenen Partikeln: Kontur (hell) und Füllung
      const kontur = duenne(M.rand.slice().sort(() => R() - 0.5), o.konturAbstand || 0.045)
      const kand = []; while (kand.length < 9000) { const u = R() * 2 - 1, v = R() * 2 - 1; if (M.inn(u, v)) kand.push([u, v]) }
      const fuell = duenne(kand, o.fuellAbstand || 0.06).filter(p => !kontur.some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.035))
      const mono = kontur.map(p => ({ p, k: 1 })).concat(fuell.map(p => ({ p, k: 0 })))
      // Kugel ohne die Fläche vor dem Monogramm (wie beim Herz)
      const kugel = fib(o.n || 460).filter(q => !(q[2] > 0 && M.inn(q[0] / groesse, q[1] / groesse)))
      const wulst = o.wulst ?? 0.18
      for (const { p, k } of mono) {
        const x = p[0] * groesse, y = p[1] * groesse, z = Math.sqrt(Math.max(0.05, 1 - x * x - y * y)) * (1 + wulst * (k ? 0.4 : 1))
        let ziel = [x, y, z]
        if (art === 'wandel') {
          // noch unterwegs: von einem Kugelpunkt zum Ziel, Anteil q angekommen
          const q = Math.min(1, Math.max(0, (o.fortschritt ?? 0.7) * 1.4 - R() * 0.4))
          const a = R() * TAU, b = Math.acos(2 * R() - 1), s0 = [Math.sin(b) * Math.cos(a), Math.cos(b), Math.sin(b) * Math.sin(a)]
          const e = q * q * (3 - 2 * q); ziel = [s0[0] + (ziel[0] - s0[0]) * e, s0[1] + (ziel[1] - s0[1]) * e, s0[2] + (ziel[2] - s0[2]) * e]
          if (q < 0.98) {
            // Schweif wie in der Engine: ein Stück zurück, kleiner und blasser
            const back = Math.max(0, e - 0.12), sch = [s0[0] + (x - s0[0]) * back, s0[1] + (y - s0[1]) * back, s0[2] + (z - s0[2]) * back], B = bild(sch, o)
            out.push({ X: B[0], Y: B[1], Z: B[2], sicht: sichtAus(B[2]) * 0.45, licht: 1, g: 0.75 })
          }
        }
        const B = bild(ziel, o)
        out.push({ X: B[0], Y: B[1], Z: B[2], sicht: sichtAus(B[2]), licht: k ? (o.konturLicht ?? 1.9) : 1.25, g: (k ? 0.85 : 1) * streu() })
      }
      if (art === 'emote' && !o.ohneKugel) for (const q of kugel) {
        const B = bild(q, o)
        // Lichtwelle wie beim Herzschlag: ein heller Ring läuft von vorn über die Kugel
        let w = 0
        if (o.welle) { const ang = Math.acos(Math.max(-1, Math.min(1, q[2]))); w = Math.exp(-Math.pow(ang - o.welle, 2) / 0.05) }
        out.push({ X: B[0], Y: B[1], Z: B[2], sicht: sichtAus(B[2]) * ((o.kugelLicht ?? 0.55) + 0.6 * w), licht: 1 + 0.6 * w, g: streu() })
      } else if (art === 'emote') {
        // ohne Kugel: ein paar lose Partikel schweben noch um das Zeichen
        for (let i = 0; i < (o.lose || 120); i++) {
          const a = R() * TAU, r = 0.75 + 0.5 * Math.sqrt(R()), q = [Math.cos(a) * r, Math.sin(a) * r, (R() - 0.5) * 0.8], B = bild(q, o)
          out.push({ X: B[0], Y: B[1], Z: B[2], sicht: (0.25 + 0.35 * R()) * (1.3 - r * 0.6), licht: 1, g: 0.6 + 0.5 * R() })
        }
      } else {
        // was von der Kugel noch übrig ist: blass, wird weniger
        const rest = Math.round(kugel.length * (1 - (o.fortschritt ?? 0.7)))
        for (let i = 0; i < rest; i++) { const q = kugel[Math.floor(R() * kugel.length)], B = bild(q, o); out.push({ X: B[0], Y: B[1], Z: B[2], sicht: sichtAus(B[2]) * 0.5, licht: 1, g: streu() }) }
      }
    } else if (art === 'roehren') {
      // Partikel auf runden Röhren entlang der Mittellinien (wie das X aus Balken)
      const rr = L.w / 2 * groesse * (o.dick ?? 1.15), schritt = o.schritt || 0.032, ringe = o.ringe || 9
      const zuege = L.zuege.concat(L.quer.map(q => { const a = q[0], b = q[1], h = L.w / 2; const len = Math.hypot(b[0] - a[0], b[1] - a[1]); return [[a[0] + (b[0] - a[0]) * h / len, a[1] + (b[1] - a[1]) * h / len], [b[0] - (b[0] - a[0]) * h / len, b[1] - (b[1] - a[1]) * h / len]] }))
      for (const z of zuege) {
        for (let i = 0; i < z.length - 1; i++) {
          const a = z[i], b = z[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]) * groesse, n = Math.max(1, Math.round(len / schritt))
          const tx = (b[0] - a[0]) * groesse / len, ty = (b[1] - a[1]) * groesse / len, nx = -ty, ny = tx
          for (let j = 0; j < n; j++) {
            const u = (j + R()) / n, cx = (a[0] + (b[0] - a[0]) * u) * groesse, cy = (a[1] + (b[1] - a[1]) * u) * groesse
            for (let k = 0; k < ringe; k++) {
              if (R() > (o.dichte ?? 0.55)) continue
              const w = (k + R() * 0.8) / ringe * TAU, p = [cx + nx * Math.cos(w) * rr, cy + ny * Math.cos(w) * rr, Math.sin(w) * rr]
              const B = bild(p, o)
              out.push({ X: B[0], Y: B[1], Z: B[2], sicht: 0.35 + 0.65 * Math.max(0, Math.min(1, (p[2] / rr + 1) / 2)), licht: 1 + 0.6 * Math.max(0, Math.sin(w)), g: streu() * 0.8 })
            }
          }
        }
      }
    } else if (art === 'schrift') {
      // Punktraster wie Hokus Schrift, Lichtlauf von links oben
      const ab = o.raster || 0.05
      for (let v = -1; v <= 1; v += ab) for (let u = -1; u <= 1; u += ab) {
        if (!M.inn(u, v)) continue
        const x = u * groesse, y = v * groesse, B = bild([x, y, 0.4], o)
        const licht = 1 + 0.9 * Math.max(0, Math.sin(2.2 - (u - v) * 1.6))
        out.push({ X: B[0], Y: B[1], Z: B[2], sicht: 0.85, licht, g: 0.7 + 0.25 * R() })
      }
    }
    return out
  }
})()
