// Baut aus karten.json eine PowerPoint-Datei zum Import in Canva.
// Jede Folie ist eine Karte 1200 x 630 px; Texte, Logos, Linien und Knopf sind einzelne Elemente.
const pptxgen = require('pptxgenjs')
const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const [, , dir, outFile] = process.argv
const cards = JSON.parse(fs.readFileSync(path.join(dir, 'out/karten.json'), 'utf8'))
const PX = 1 / 96                       // 1 px in Zoll
const PT = 0.75                         // 1 px in Punkt
const BG = [15, 17, 22]                 // #0f1116

const ASSET = { haupt_cw: 'hauptlogo.png', kompakt_cw: 'kompaktlogo.png', bildmarke_c: 'bildmarke.png' }
const ASSET_NAME = { haupt_cw: 'Hauptlogo', kompakt_cw: 'Kompaktlogo', bildmarke_c: 'Bildmarke Hoku' }
const b64 = f => 'image/png;base64,' + fs.readFileSync(path.join(dir, f)).toString('base64')
const IMG = Object.fromEntries(Object.entries(ASSET).map(([k, f]) => [k, b64('assets/' + f)]))
const BG_IMG = b64('out/hintergrund.png')

const rgba = s => { const m = s.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m[3] ?? 1 } }
const hex = c => [c.r, c.g, c.b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()
// Halbtransparente Schrift auf den Grund gemischt: in Canva dann eine feste Farbe
const solid = s => { const c = rgba(s); return hex({ r: c.r * c.a + BG[0] * (1 - c.a), g: c.g * c.a + BG[1] * (1 - c.a), b: c.b * c.a + BG[2] * (1 - c.a) }) }
const face = f => /Grotesk/.test(f) ? 'Space Grotesk' : /Plex Mono/.test(f) ? 'IBM Plex Mono' : 'Inter'
const bold = w => +w >= 600

const VNAME = { H: 'Hauptlogo', B1: 'Bildmarke unten rechts', B2: 'Bildmarke oben rechts', B3: 'Bildmarke Halbkreis links, Profilbild davor',
  B4: 'Bildmarke aufsteigend unten Mitte', B5: 'Bildmarke als Ring ums Profilbild', B6: 'Bildmarke als Wasserzeichen (20 %)' }
const TNAME = { a1: 'Karte A1 · Fortschritt', c: 'Karte C · Rückfall', n: 'Neutrale Karte' }

const NOTES = {
  a1: 'Erscheint, wenn Bild, Name und ein positiver Gesamtfortschritt auf „Alle“ stehen. Zahl in Stufen abgerundet: über 10/20/30/50/75/100 %. Werte und Bereiche kommen aus dem Profil.',
  c: 'Rückfall, wenn der Fortschritt nicht positiv ist oder nicht auf „Alle“ steht. Rechts nur Aussagen über Hoku, nie über die Person.\n\nTexte zur Wahl:\nC1 Hoku kann mehr, als du denkst. / Training, Ernährung, Schlaf, Blutbefunde und ein KI-Coach. In einer App. (Empfehlung)\nC2 Mehr als eine Fitness-App. / Hoku verbindet Training, Essen, Schlaf, Körper und Blutbefunde.\nC3 Alles über dich. An einem Ort. / Vom Training bis zum Blutbefund. Mit Tagebuch und KI-Coach.\nC4 Was sagen deine Daten zusammen? / Hoku legt Training, Ernährung, Schlaf und Blutwerte nebeneinander und erklärt sie dir.\nC5 Dein Körper. Dein Alltag. Eine App. / Training, Ernährung, Schlaf, Wearables, Blutbefunde und KI-Coach. (Knopf: Mehr sehen)\nC6 Was würdest du über dich lernen? / Hoku verbindet Training, Ernährung, Schlaf und Blutbefunde. Ein KI-Coach hilft beim Lesen.',
  n: 'Ersatz ohne Bild, Name und Zahl: wenn Bild oder Name nicht auf „Alle“ stehen, der Web-Link aus ist oder es den Namen nicht gibt.\n\nSlogans (Empfehlung zuerst):\nHeute ist ein Datenpunkt, kein Urteil. / Today is a data point, not a verdict.\nSei dein eigener Beweis. / Be your own proof.\nSieh, wer du wirst. · Lerne dich kennen. Wirklich. · Du bist mehr als ein schlechter Tag. · Dein Maßstab bist du.\nGefühl ist gut. Wissen ist besser. · Zahlen schmeicheln nicht. Sie zeigen. · Kein Filter. Nur du. · Ehrlich zu dir. Jeden Tag. · Was du misst, siehst du klarer.\nWer du warst, ist dein Maßstab. · Dranbleiben zeigt sich. Mit der Zeit. · Jeder Tag zählt. Auch die schweren. · Langsam ist auch vorwärts.',
}
const GUIDE = 'Brand-Guide: Bildmarke nur proportional skalieren, nicht färben, verzerren oder mit Schatten versehen. Pupille und heller Rand ganz im Bild lassen. Logos nie größer als die Datei ziehen (Hauptlogo und Kompaktlogo 1200 px, Bildmarke 1024 px). Haupt- und Kompaktlogo ab 240 px Breite.'
const OPEN = 'Noch nicht freigegeben: Anschnitt der Bildmarke (B1–B4, B6), Profilbild vor der Bildmarke (B3, B5), reduzierte Deckkraft (B6).'

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
  pres.title = 'Hoku Link-Karten · Vorlagen für Canva'
  pres.author = 'Hoku'
  pres.theme = { headFontFace: 'Space Grotesk', bodyFontFace: 'Inter' }

  const SECTIONS = [
    ['Gewählt · Hauptlogo (H)', c => c.v === 'H'],
    ['Karte A1 · Bildmarke B1–B6', c => c.type === 'a1' && c.v !== 'H'],
    ['Karte C · Bildmarke B1–B6', c => c.type === 'c' && c.v !== 'H'],
    ['Neutral · Bildmarke B1–B6', c => c.type === 'n' && c.v !== 'H'],
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
        } else if (e.kind === 'icon') {
          s.addImage({ data: await iconPng(e.d, e.sw, e.color), ...box, objectName: 'Symbol', altText: 'Symbol' })
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
                options: { fontFace: face(w.font), bold: bold(w.weight), fontSize: w.size * PT, color: solid(w.color),
                  ...(parseFloat(w.ls) ? { charSpacing: parseFloat(w.ls) * PT } : {}),
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
      const vn = card.v === 'H' ? (card.type === 'n' ? 'Hauptlogo in der Mitte' : 'Hauptlogo unten Mitte') : VNAME[card.v] + ', mit kleinem Logo'
      s.addNotes(`${TNAME[card.type]} · ${card.v} · ${vn}\n1200 × 630 px, Daten erfunden (Mara K.).\n\n${NOTES[card.type]}\n\n${GUIDE}${card.v !== 'H' ? '\n' + OPEN : ''}`)
    }
  }
  await pres.writeFile({ fileName: outFile })
  console.log('geschrieben', outFile)
})()
