// Baut aus karten.json eine PowerPoint-Datei zum Import in Canva.
// Jede Folie ist eine Karte 1200 x 630 px; Texte, Logos, Linien und Knopf sind einzelne Elemente.
const pptxgen = require('pptxgenjs')
const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const [, , dir, outFile] = process.argv
const cards = JSON.parse(fs.readFileSync(path.join(dir, 'out3/karten.json'), 'utf8'))
const PX = 1 / 96                       // 1 px in Zoll
const PT = 0.75                         // 1 px in Punkt
const BG = [15, 17, 22]                 // #0f1116

const ASSET = { haupt_cw: 'hauptlogo.png', kompakt_cw: 'kompaktlogo.png', haupt_w: 'hauptlogo-weiss.png', kompakt_w: 'kompaktlogo-weiss.png', bildmarke_c: 'bildmarke.png' }
const ASSET_NAME = { haupt_cw: 'Hauptlogo Cyan', kompakt_cw: 'Kompaktlogo Cyan', haupt_w: 'Hauptlogo Weiß', kompakt_w: 'Kompaktlogo Weiß', bildmarke_c: 'Bildmarke Hoku' }
const b64 = f => 'image/png;base64,' + fs.readFileSync(path.join(dir, f)).toString('base64')
const IMG = Object.fromEntries(Object.entries(ASSET).map(([k, f]) => [k, b64('assets/' + f)]))
const BG_IMG = b64('out3/hintergrund.png')

const rgba = s => { const m = s.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m[3] ?? 1 } }
const hex = c => [c.r, c.g, c.b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()
// Halbtransparente Schrift auf den Grund gemischt: in Canva dann eine feste Farbe
const solid = s => { const c = rgba(s); return hex({ r: c.r * c.a + BG[0] * (1 - c.a), g: c.g * c.a + BG[1] * (1 - c.a), b: c.b * c.a + BG[2] * (1 - c.a) }) }
const face = f => /Grotesk/.test(f) ? 'Space Grotesk' : /Plex Mono/.test(f) ? 'IBM Plex Mono' : 'Inter'
const bold = w => +w >= 600

const GUIDE = 'Brand-Guide: Bildmarke nur proportional skalieren, nicht färben, verzerren oder verschatten. Anschnitt an der Bildkante ist freigegeben (B1, B3); Pupille und heller Rand bleiben ganz im Bild. Logos nie größer als die Datei (Haupt- und Kompaktlogo 1200 px, Bildmarke 1024 px), Haupt- und Kompaktlogo ab 240 px Breite. Steht Hoku groß im Bild, ist das kleine Logo weiß.'
const ALL = '1200 × 630 px, Daten erfunden (Mara K.). Der Kreis mit „M“ steht für das Profilbild: geprüftes Bild, sonst die Initiale.'
const CARD = {
  'a1': ['Freigegeben', 'Fortschritt · Hauptlogo unten Mitte', 'Erscheint, wenn der Web-Link an ist und der Gesamtfortschritt positiv und auf „Alle“ ist. Zahl in Stufen abgerundet: über 10/20/30/50/75/100 %, rechnet über alle Bereiche. „trackt 9 Werte“ zählt nur die fürs Web freigegebenen Bereiche (Bereiche darunter). Links: „Seit X dabei“ = Mitgliedschaft (unter 1 Monat Tage, ab 1 Jahr Jahre, abgerundet) und die Zahl aller Einträge. Cyan nur für 9, 30 % und Trend-Symbol.'],
  'c': ['Freigegeben', 'Rückfall · Hoku unten rechts (B1)', 'Erscheint, wenn der Fortschritt nicht positiv ist oder nicht auf „Alle“ steht. Rechts nur Aussagen über Hoku. Text gilt nur zusammen mit der Musterfunktion zum Start, sonst Folie 6 (Ersatz). EN: More than just tracking. / You track. Hoku connects. / Hoku’s smart engine layers your data and can find patterns you’d never have spotted on your own.'],
  'n': ['Freigegeben', 'Neutral · Hoku als Halbkreis links (B3)', 'Erscheint, wenn der Web-Link aus ist, das Profil privat ist oder der Name unbekannt ist. Slogan: Sieh, wer du wirst. / See who you’re becoming. Hauptlogo weiß, 480 px, mittig auf Höhe der Pupille.'],
  'a1-abzeichen': ['Varianten', 'Fortschritt · zweite Angabe Abzeichen', 'Statt der Einträge die Zahl der fürs Web freigegebenen Abzeichen.'],
  'a1-titel': ['Varianten', 'Fortschritt · mit Titel (künftig)', 'Titel, den man sich verdienen muss, als leise Marke unter dem Namen. Gibt es noch nicht, braucht ein eigenes Vorhaben.'],
  'c-ersatz': ['Varianten', 'Rückfall · Ersatztext', 'Nur falls die Musterfunktion erst nach den Link-Karten fertig wird. EN: … layers your data and shows you what has changed since your start.'],
}

// Woerter eines Blocks in Zeilen und, bei grossen Luecken, in Stuecke teilen
function segments(words) {
  const lines = []
  for (const w of words) {
    const L = lines.find(l => Math.abs(l.y - w.y) < w.h * 0.5)
    if (L) L.words.push(w); else lines.push({ y: w.y, words: [w] })
  }
  lines.sort((a, b) => a.y - b.y)
  const pieces = []
  for (const l of lines) {
    l.words.sort((a, b) => a.x - b.x)
    let cur = [l.words[0]]
    for (let i = 1; i < l.words.length; i++) {
      const p = l.words[i - 1], w = l.words[i]
      if (w.x - (p.x + p.w) > p.size * 0.6) { pieces.push([cur]); cur = [w] } else cur.push(w)
    }
    pieces.push([cur])
  }
  // Mehrzeilige Bloecke ohne Luecken zusammenhalten
  if (lines.length > 1 && pieces.length === lines.length) return [lines.map(l => l.words)]
  return pieces
}

async function iconPng(d, sw, color) {
  const c = rgba(color)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="256" height="256"><path d="${d}" fill="none" stroke="rgb(${c.r},${c.g},${c.b})" stroke-opacity="${c.a}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  return 'image/png;base64,' + (await sharp(Buffer.from(svg)).png().toBuffer()).toString('base64')
}

;(async () => {
  const pres = new pptxgen()
  pres.defineLayout({ name: 'OG', width: 1200 * PX, height: 630 * PX })
  pres.layout = 'OG'
  pres.title = 'Hoku Link-Karten · freigegeben'
  pres.author = 'Hoku'
  pres.theme = { headFontFace: 'Space Grotesk', bodyFontFace: 'Inter' }

  const SECTIONS = [
    ['Freigegeben', c => CARD[c.id][0] === 'Freigegeben'],
    ['Varianten', c => CARD[c.id][0] === 'Varianten'],
  ]
  for (const [title, f] of SECTIONS) {
    pres.addSection({ title })
    for (const card of cards.filter(f)) {
      const s = pres.addSlide({ sectionTitle: title })
      s.background = { color: '0F1116' }
      s.addImage({ data: BG_IMG, x: 0, y: 0, w: 1200 * PX, h: 630 * PX, objectName: 'Hintergrund Hoku-Licht', altText: 'Hintergrund' })
      for (const e of card.els) {
        const box = { x: e.x * PX, y: e.y * PX, w: e.w * PX, h: e.h * PX }
        if (e.kind === 'img') {
          s.addImage({ data: IMG[e.key], ...box, objectName: ASSET_NAME[e.key], altText: ASSET_NAME[e.key],
            ...(e.opacity < 1 ? { transparency: Math.round((1 - e.opacity) * 100) } : {}) })
        } else if (e.kind === 'ava') {
          s.addShape(pres.shapes.OVAL, { ...box, fill: { color: '383C45' }, line: { color: '45484F', width: 1.25 }, objectName: 'Profilbild (Foto hier einsetzen)' })
          s.addText(e.text, { ...box, isTextBox: true, margin: 0, align: 'center', valign: 'middle', fontFace: face(e.font), bold: bold(e.weight),
            fontSize: e.size * PT, color: solid(e.color), objectName: 'Profilbild Initiale' })
        } else if (e.kind === 'rect') {
          s.addShape(pres.shapes.RECTANGLE, { ...box, w: Math.max(e.w, 1.2) * PX, h: Math.max(e.h, 1.2) * PX, fill: { color: solid(e.color) }, line: { type: 'none' }, objectName: e.name })
        } else if (e.kind === 'pill') {
          s.addText(e.text, { ...box, shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: e.h * PX / 2, fill: { color: '2672CF' }, line: { type: 'none' },
            margin: 0, align: 'center', valign: 'middle', fontFace: face(e.font), bold: bold(e.weight), fontSize: e.size * PT, color: 'FFFFFF', objectName: 'Knopf' })
        } else if (e.kind === 'chip') {
          s.addText(e.text.toUpperCase(), { ...box, shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: e.h * PX / 2, fill: { type: 'none' }, line: { color: solid('rgba(255,255,255,.28)'), width: 0.9 },
            margin: 0, align: 'center', valign: 'middle', fontFace: face(e.font), fontSize: e.size * PT, color: solid(e.color), charSpacing: parseFloat(e.ls) * PT, objectName: 'Titel' })
        } else if (e.kind === 'icon') {
          s.addImage({ data: await iconPng(e.d, e.sw, e.color), ...box, ...(e.inHuge ? { x: (e.x + 46) * PX } : {}), objectName: e.inHuge ? 'Trend-Symbol' : 'Symbol', altText: 'Symbol' })
        } else if (e.kind === 'text') {
          for (const lines of segments(e.words)) {
            const all = lines.flat(), w0 = all[0]
            const left = Math.min(...all.map(w => w.x)), right = Math.max(...all.map(w => w.x + w.w))
            const top = Math.min(...all.map(w => w.y)), bottom = Math.max(...all.map(w => w.y + w.h))
            const lh = parseFloat(w0.lh) || w0.size * 1.2
            const multi = lines.length > 1
            const runs = []
            lines.forEach((ln, li) => ln.forEach((w, wi) => {
              const last = wi === ln.length - 1
              runs.push({ text: (w.tt === 'uppercase' ? w.t.toUpperCase() : w.t).replace(/‑/g, '-') + (last ? '' : ' '),
                options: { fontFace: face(w.font), bold: bold(w.weight), italic: !!w.it, fontSize: w.size * PT, color: solid(w.color),
                  ...(parseFloat(w.ls) > 0 ? { charSpacing: parseFloat(w.ls) * PT } : {}),
                  ...(last && li < lines.length - 1 ? { breakLine: true } : {}) } })
            }))
            const align = e.align === 'center' ? 'center' : 'left'
            const width = right - left, slack = width * 0.18 + 24
            const x = align === 'center' ? left - slack / 2 : left
            const pad = multi ? (lh - w0.h) / 2 : 0
            s.addText(runs, { isTextBox: true, x: x * PX, y: (top - pad) * PX, w: (width + slack) * PX, h: (bottom - top + 2 * pad) * PX,
              margin: 0, align, valign: 'top', fit: 'none', ...(multi ? { lineSpacing: lh * PT } : {}),
              objectName: 'Text ' + all.map(w => w.t).join(' ').slice(0, 30) })
          }
        }
      }
      const [, nm, nt] = CARD[card.id]
      s.addNotes(`${nm}\n${ALL}\n\n${nt}\n\n${GUIDE}`)
    }
  }
  await pres.writeFile({ fileName: outFile })
  console.log('geschrieben', outFile)
})()
