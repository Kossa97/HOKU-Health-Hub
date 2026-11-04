// Breiten und Höhen aus TrueType-Dateien, ohne Abhängigkeit.
//
// Die Link-Karte (`profileCard.js`) baut ein SVG mit festen Positionen; resvg setzt
// den Text, aber Mitte, Umbruch und Kürzung muss die Karte vorher selbst wissen.
// Gelesen werden nur `head` (Einheiten je Geviert), `hhea` (Ober-/Unterlänge, wie
// Chrome sie für die Zeilenbox nimmt), `hmtx` (Vorschub je Glyphe) und `cmap`
// (Format 4 und 12). Unterschneidung (GPOS) fehlt: Breiten liegen dadurch um
// wenige Prozent über dem, was resvg zeichnet — die Kürzung ist also eher zu früh
// als zu spät. `profileCard.test.js` vergleicht mit resvg.

function tables(buf) {
  const n = buf.readUInt16BE(4)
  const out = {}
  for (let i = 0; i < n; i++) {
    const at = 12 + i * 16
    out[buf.toString('latin1', at, at + 4)] = { offset: buf.readUInt32BE(at + 8), length: buf.readUInt32BE(at + 12) }
  }
  return out
}

function readCmap(buf, start) {
  const n = buf.readUInt16BE(start + 2)
  const subs = []
  for (let i = 0; i < n; i++) {
    const at = start + 4 + i * 8
    subs.push({ platform: buf.readUInt16BE(at), encoding: buf.readUInt16BE(at + 2), offset: start + buf.readUInt32BE(at + 4) })
  }
  const map = new Map()
  // Format 12 (volles Unicode) vor Format 4 (nur BMP), beide aus Unicode-Tabellen.
  const unicode = subs.filter(s => s.platform === 0 || (s.platform === 3 && (s.encoding === 1 || s.encoding === 10)))
  const f12 = unicode.find(s => buf.readUInt16BE(s.offset) === 12)
  const f4 = unicode.find(s => buf.readUInt16BE(s.offset) === 4)
  if (f12) {
    const groups = buf.readUInt32BE(f12.offset + 12)
    for (let g = 0; g < groups; g++) {
      const at = f12.offset + 16 + g * 12
      const startCode = buf.readUInt32BE(at)
      const endCode = buf.readUInt32BE(at + 4)
      const glyph = buf.readUInt32BE(at + 8)
      for (let c = startCode; c <= endCode && c - startCode < 0x10000; c++) map.set(c, glyph + c - startCode)
    }
  } else if (f4) {
    const o = f4.offset
    const segX2 = buf.readUInt16BE(o + 6)
    const ends = o + 14
    const starts = ends + segX2 + 2
    const deltas = starts + segX2
    const ranges = deltas + segX2
    for (let s = 0; s < segX2 / 2; s++) {
      const end = buf.readUInt16BE(ends + s * 2)
      const begin = buf.readUInt16BE(starts + s * 2)
      const delta = buf.readInt16BE(deltas + s * 2)
      const rangeAt = ranges + s * 2
      const range = buf.readUInt16BE(rangeAt)
      for (let c = begin; c <= end && c !== 0xffff; c++) {
        let glyph
        if (range === 0) glyph = (c + delta) & 0xffff
        else {
          const g = buf.readUInt16BE(rangeAt + range + (c - begin) * 2)
          glyph = g === 0 ? 0 : (g + delta) & 0xffff
        }
        if (glyph) map.set(c, glyph)
      }
    }
  }
  return map
}

/** Liest eine TTF-Datei: `{ upm, ascent, descent, advance(codepoint) | null }`. */
export function parseFont(buf) {
  const t = tables(buf)
  for (const k of ['head', 'hhea', 'hmtx', 'cmap']) if (!t[k]) throw new Error(`Schrift ohne ${k}`)
  const upm = buf.readUInt16BE(t.head.offset + 18)
  const ascent = buf.readInt16BE(t.hhea.offset + 4)
  const descent = -buf.readInt16BE(t.hhea.offset + 6)
  const longMetrics = buf.readUInt16BE(t.hhea.offset + 34)
  const cmap = readCmap(buf, t.cmap.offset)
  const glyphAdvance = glyph => buf.readUInt16BE(t.hmtx.offset + Math.min(glyph, longMetrics - 1) * 4)
  return {
    upm,
    ascent: ascent / upm,
    descent: descent / upm,
    /** Vorschub in Geviert (1 = Schriftgröße) oder `null`, wenn die Schrift das Zeichen nicht hat. */
    advance(codepoint) {
      const glyph = cmap.get(codepoint)
      return glyph === undefined ? null : glyphAdvance(glyph) / upm
    },
  }
}
