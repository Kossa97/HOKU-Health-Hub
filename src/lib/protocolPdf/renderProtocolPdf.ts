// Nativer jsPDF-Renderer für das Protokoll-PDF (helles, druckfertiges A4-Dokument).
// Nur WinAnsi-sichere Zeichen verwenden (Helvetica) — KEIN Δ, ✓, →, ≈, ↑/↓.
// Für Deltas +/- mit Zahl schreiben.

import type { jsPDF } from 'jspdf'
import type {
  ProtocolData, PdfBuildOptions, PdfLang, PdfCycle, PdfEffect, SectionId,
} from './types'
import { SECTIONS, visibleSections, resolveSubject } from './sections'
import { fromMinutes, symptomLabel } from '../tagebuch/diary'
import { prepareLongRangePoints, type ChartPoint } from './chartData'
import {
  aggregate, chooseBucketSize, summarise,
  type BucketSize, type WellnessBucket, type WellnessSample,
} from './wellnessBuckets'

type RGB = [number, number, number]

/**
 * Einheitliches Report-Chrome für alle Tabs (Arzt/Forum-Stil):
 * weiß, Navy, Haarlinien, klinische Typo. Nur Texte/Abschnitte ändern sich je Preset.
 */
interface Theme {
  ink: RGB
  muted: RGB
  faint: RGB
  rule: RGB
  accent: RGB
  headFill: RGB
  zebra: RGB
  cardFill: RGB
  good: RGB
  bad: RGB
}

const THEME_REPORT: Theme = {
  ink: [17, 24, 39],
  muted: [75, 85, 99],
  faint: [107, 114, 128],
  rule: [209, 213, 219],
  accent: [30, 58, 95],
  headFill: [243, 244, 246],
  zebra: [249, 250, 251],
  cardFill: [255, 255, 255],
  good: [21, 128, 61],
  bad: [185, 28, 28],
}

// Kurzaliase für Charts und Stellen ohne Theme-Kontext
const INK = THEME_REPORT.ink
const MUTED = THEME_REPORT.muted
const FAINT = THEME_REPORT.faint
const RULE = THEME_REPORT.rule

const PAGE_W = 210
const PAGE_H = 297
const MARGIN = 16
const CONTENT_W = PAGE_W - MARGIN * 2
const TOP_Y = 24        // Start-Y auf Inhaltsseiten (unter Running Header)
const BOTTOM_Y = 282    // Fußzeile beginnt hier

// ─── Copy ─────────────────────────────────────────────────────────────────

interface Copy {
  docTitle: string
  brand: string
  coverPurpose: string
  coverSubtitle: string
  coverDocKind: string
  subject: string
  period: string
  createdAt: string
  contents: string
  sectionTitles: Record<SectionId, string>
  age: string; gender: string; male: string; female: string; height: string; weight: string; years: string
  kpiAdherence: string; kpiWeight: string; kpiCycles: string; kpiDays: string
  cyclesHead: [string, string, string, string, string]
  statusActive: string; statusDone: string
  adherenceIntro: string; taken: string; skipped: string
  bloodMarker: string; bloodUnit: string; bloodRange: string; bloodFirst: string; bloodLast: string; bloodChange: string
  weightStart: string; weightEnd: string; weightChange: string; kg: string
  wellnessEnergy: string; wellnessSleep: string; wellnessMood: string; wellnessLibido: string
  scale: string; wellnessSpread: string; wellnessEntries: string; wellnessWeeklyNote: string
  aggDay: string; aggWeek: string; aggMonth: string; aggQuarter: string
  unitDay: string; unitWeek: string; unitMonth: string; unitQuarter: string
  effectType: string; effectDesc: string; effectSeverity: string; effectDate: string; effect: string; sideEffect: string
  /** Dauer am Chip: Einheiten [Einzahl, Mehrzahl] wie im Picker-Rad, „hält an". */
  durationUnits: [[string, string], [string, string], [string, string], [string, string]]; ongoing: string
  reviewSubstance: string; reviewRating: string; reviewEffect: string; reviewTolerability: string; reviewAgain: string
  againYes: string; againUnsure: string; againNo: string
  notesEmpty: string
  disclaimerTitle: string; disclaimer: string
  noData: string
  footer: string
}

const COPY: Record<PdfLang, Copy> = {
  de: {
    docTitle: 'Substanz-Protokoll',
    brand: 'TRACK YOUR DOSE',
    coverPurpose: 'Persönliche Dokumentation',
    coverSubtitle: 'Verlaufsprotokoll aus selbst erfassten Daten',
    coverDocKind: 'Protokoll (Selbstauskunft)',
    subject: 'Betreff',
    period: 'Zeitraum',
    createdAt: 'Erstellt am',
    contents: 'Inhalt',
    sectionTitles: {
      personal: 'Persönliche Angaben', summary: 'Zusammenfassung', cycles: 'Protokoll / Zyklen',
      adherence: 'Einnahmetreue', bloodwork: 'Blutwerte', weight: 'Gewichtsverlauf',
      wellness: 'Wohlbefinden', effects: 'Wirkungen & Nebenwirkungen', reviews: 'Erfahrungen',
      notes: 'Notizen / Fragen',
    },
    age: 'Alter', gender: 'Geschlecht', male: 'männlich', female: 'weiblich', height: 'Größe', weight: 'Gewicht', years: 'Jahre',
    kpiAdherence: 'Einnahmetreue', kpiWeight: 'Gewicht (Veränd.)', kpiCycles: 'Aktive Zyklen', kpiDays: 'Zeitraum',
    cyclesHead: ['Substanz', 'Dosis', 'Methode', 'Frequenz', 'Zeitraum'],
    statusActive: 'aktiv', statusDone: 'beendet',
    adherenceIntro: 'Anteil bestätigter Einnahmen im Zeitraum, je Substanz.',
    taken: 'genommen', skipped: 'ausgelassen',
    bloodMarker: 'Marker', bloodUnit: 'Einheit', bloodRange: 'Normbereich',
    bloodFirst: 'Erst', bloodLast: 'Letzt', bloodChange: 'Veränd.',
    weightStart: 'Start', weightEnd: 'Ende', weightChange: 'Veränderung', kg: 'kg',
    wellnessEnergy: 'Energie', wellnessSleep: 'Schlaf', wellnessMood: 'Wohlbefinden', wellnessLibido: 'Libido', scale: 'Skala 1–10',
    wellnessSpread: 'Senkrechter Strich: niedrigster und höchster Wert im Abschnitt.', wellnessEntries: 'Einträge',
    wellnessWeeklyNote: 'Lange Zeiträume: Anzeige als Wochenmittel (lesbarer Verlauf).',
    aggDay: 'Tageswerte', aggWeek: 'Median je Woche', aggMonth: 'Median je Monat', aggQuarter: 'Median je Quartal',
    unitDay: 'Tage', unitWeek: 'Wochen', unitMonth: 'Monate', unitQuarter: 'Quartale',
    effectType: 'Typ', effectDesc: 'Beschreibung', effectSeverity: 'Stärke', effectDate: 'Datum',
    effect: 'Wirkung', sideEffect: 'Nebenwirkung',
    durationUnits: [['Min.', 'Min.'], ['Std.', 'Std.'], ['Tag', 'Tage'], ['Woche', 'Wochen']], ongoing: 'hält an',
    reviewSubstance: 'Substanz', reviewRating: 'Bewertung', reviewEffect: 'Wirkung', reviewTolerability: 'Verträglichkeit', reviewAgain: 'Wieder nehmen',
    againYes: 'Ja', againUnsure: 'Unsicher', againNo: 'Nein',
    notesEmpty: '(keine Notiz eingetragen)',
    disclaimerTitle: 'Hinweis',
    disclaimer: 'Dieses Dokument dient ausschließlich der persönlichen Dokumentation und Forschung. Es ist kein medizinischer Rat, keine Diagnose und keine Therapieempfehlung. Angaben werden vom Nutzer selbst erfasst. Konsultiere vor Entscheidungen eine medizinische Fachperson.',
    noData: 'Keine Daten im gewählten Zeitraum.',
    footer: 'Erstellt mit HOKU: Health Hub',
  },
  en: {
    docTitle: 'Substance Protocol',
    brand: 'TRACK YOUR DOSE',
    coverPurpose: 'Personal documentation',
    coverSubtitle: 'Progress protocol from self-reported data',
    coverDocKind: 'Protocol (self-reported)',
    subject: 'Subject',
    period: 'Period',
    createdAt: 'Created',
    contents: 'Contents',
    sectionTitles: {
      personal: 'Personal details', summary: 'Summary', cycles: 'Protocol / cycles',
      adherence: 'Adherence', bloodwork: 'Bloodwork', weight: 'Weight trend',
      wellness: 'Well-being', effects: 'Effects & side effects', reviews: 'Experiences',
      notes: 'Notes / questions',
    },
    age: 'Age', gender: 'Sex', male: 'male', female: 'female', height: 'Height', weight: 'Weight', years: 'years',
    kpiAdherence: 'Adherence', kpiWeight: 'Weight (change)', kpiCycles: 'Active cycles', kpiDays: 'Period',
    cyclesHead: ['Substance', 'Dose', 'Route', 'Frequency', 'Period'],
    statusActive: 'active', statusDone: 'completed',
    adherenceIntro: 'Share of confirmed doses in the period, per substance.',
    taken: 'taken', skipped: 'skipped',
    bloodMarker: 'Marker', bloodUnit: 'Unit', bloodRange: 'Normal range',
    bloodFirst: 'First', bloodLast: 'Last', bloodChange: 'Change',
    weightStart: 'Start', weightEnd: 'End', weightChange: 'Change', kg: 'kg',
    wellnessEnergy: 'Energy', wellnessSleep: 'Sleep', wellnessMood: 'Well-being', wellnessLibido: 'Libido', scale: 'Scale 1–10',
    wellnessSpread: 'Vertical bar: lowest and highest value in the interval.', wellnessEntries: 'entries',
    wellnessWeeklyNote: 'Long ranges: shown as weekly averages (clearer trend).',
    aggDay: 'Daily values', aggWeek: 'Median per week', aggMonth: 'Median per month', aggQuarter: 'Median per quarter',
    unitDay: 'days', unitWeek: 'weeks', unitMonth: 'months', unitQuarter: 'quarters',
    effectType: 'Type', effectDesc: 'Description', effectSeverity: 'Severity', effectDate: 'Date',
    effect: 'Effect', sideEffect: 'Side effect',
    durationUnits: [['min', 'min'], ['h', 'h'], ['day', 'days'], ['week', 'weeks']], ongoing: 'ongoing',
    reviewSubstance: 'Substance', reviewRating: 'Rating', reviewEffect: 'Effect', reviewTolerability: 'Tolerability', reviewAgain: 'Take again',
    againYes: 'Yes', againUnsure: 'Unsure', againNo: 'No',
    notesEmpty: '(no note entered)',
    disclaimerTitle: 'Note',
    disclaimer: 'This document is for personal documentation and research only. It is not medical advice, diagnosis, or treatment recommendation. All data is self-reported by the user. Consult a medical professional before making decisions.',
    noData: 'No data in the selected period.',
    footer: 'Created with HOKU: Health Hub',
  },
}


function applyMedicalCopy(base: Copy, lang: PdfLang): Copy {
  if (lang === 'de') {
    return {
      ...base,
      docTitle: 'Befundbericht',
      brand: 'HOKU · MEDIZINISCHE DOKUMENTATION',
      coverPurpose: 'Zur Vorlage bei der behandelnden Fachperson',
      coverSubtitle: 'Persönliche Verlaufs- und Labordokumentation',
      coverDocKind: 'Befundbericht (Selbstauskunft)',
      subject: 'Patient',
      contents: 'Gliederung',
      footer: 'Vertraulich — persönliche medizinische Dokumentation · HOKU',
      sectionTitles: {
        ...base.sectionTitles,
        personal: 'Patientendaten',
        summary: 'Klinische Übersicht',
        cycles: 'Therapieprotokoll',
        adherence: 'Therapietreue',
        bloodwork: 'Laborbefund',
        weight: 'Körpergewicht',
        wellness: 'Befinden',
        effects: 'Beobachtungen & Nebenwirkungen',
        reviews: 'Einschätzungen',
        notes: 'Fragen an die behandelnde Person',
      },
      disclaimerTitle: 'Hinweis zur Verwendung',
      disclaimer:
        'Dieses Dokument ist eine vom Nutzer erstellte Verlaufsdokumentation und kein amtlicher Labor- oder Arztbrief. Es ersetzt keine ärztliche Diagnose, Beratung oder Therapie. Bitte mit der behandelnden Fachperson besprechen.',
    }
  }
  return {
    ...base,
    docTitle: 'Medical Report',
    brand: 'HOKU · MEDICAL DOCUMENTATION',
    coverPurpose: 'For review by the treating clinician',
    coverSubtitle: 'Personal progress and lab documentation',
    coverDocKind: 'Medical report (self-reported)',
    subject: 'Patient',
    contents: 'Contents',
    footer: 'Confidential — personal medical documentation · HOKU',
    sectionTitles: {
      ...base.sectionTitles,
      personal: 'Patient details',
      summary: 'Clinical overview',
      cycles: 'Treatment protocol',
      adherence: 'Treatment adherence',
      bloodwork: 'Lab results',
      weight: 'Body weight',
      wellness: 'Well-being',
      effects: 'Observations & side effects',
      reviews: 'Assessments',
      notes: 'Questions for the clinician',
    },
    disclaimerTitle: 'Intended use',
    disclaimer:
      'This document is a user-generated progress record and not an official lab or physician letter. It does not replace medical diagnosis, advice, or treatment. Please review with a qualified clinician.',
  }
}

function applyCoachCopy(base: Copy, lang: PdfLang): Copy {
  if (lang === 'de') {
    return {
      ...base,
      docTitle: 'Coaching-Report',
      brand: 'HOKU · COACHING',
      coverPurpose: 'Zur Abstimmung mit dem Coach',
      coverSubtitle: 'Adherence, Wohlbefinden und Feedback auf einen Blick',
      coverDocKind: 'Coaching-Report (Selbstauskunft)',
      subject: 'Athlet',
      contents: 'Übersicht',
      footer: 'Persönlicher Coaching-Report · HOKU',
      sectionTitles: {
        ...base.sectionTitles,
        personal: 'Profil',
        summary: 'Leistungs-Überblick',
        cycles: 'Protokoll',
        adherence: 'Adherence',
        weight: 'Körpergewicht',
        wellness: 'Wohlbefinden',
        effects: 'Feedback & Nebenwirkungen',
        reviews: 'Erfahrungen',
        notes: 'Notizen für den Coach',
      },
      disclaimerTitle: 'Hinweis',
      disclaimer:
        'Dieser Report fasst selbst erfasste Trainings- und Verlaufsdaten zusammen. Er ersetzt keine medizinische Beratung.',
    }
  }
  return {
    ...base,
    docTitle: 'Coaching Report',
    brand: 'HOKU · COACHING',
    coverPurpose: 'For review with your coach',
    coverSubtitle: 'Adherence, well-being and feedback at a glance',
    coverDocKind: 'Coaching report (self-reported)',
    subject: 'Athlete',
    contents: 'Overview',
    footer: 'Personal coaching report · HOKU',
    sectionTitles: {
      ...base.sectionTitles,
      personal: 'Profile',
      summary: 'Performance overview',
      cycles: 'Protocol',
      adherence: 'Adherence',
      weight: 'Body weight',
      wellness: 'Well-being',
      effects: 'Feedback & side effects',
      reviews: 'Experiences',
      notes: 'Notes for the coach',
    },
    disclaimerTitle: 'Note',
    disclaimer:
      'This report summarises self-reported training and progress data. It is not medical advice.',
  }
}

function applyForumCopy(base: Copy, lang: PdfLang): Copy {
  if (lang === 'de') {
    return {
      ...base,
      docTitle: 'Community-Protokoll',
      brand: 'HOKU · ANONYM',
      coverPurpose: 'Ohne Personendaten',
      coverSubtitle: 'Anonymisiertes Protokoll zum Teilen in Foren und Gruppen',
      coverDocKind: 'Community-Protokoll (anonym)',
      subject: 'Nutzer',
      contents: 'Inhalt',
      footer: 'Anonymisiert zum Teilen · HOKU',
      sectionTitles: {
        ...base.sectionTitles,
        summary: 'Überblick',
        cycles: 'Protokoll',
        adherence: 'Einnahmetreue',
        weight: 'Gewicht',
        wellness: 'Wohlbefinden',
        effects: 'Wirkungen & Nebenwirkungen',
        reviews: 'Erfahrungen',
      },
      disclaimerTitle: 'Hinweis zum Teilen',
      disclaimer:
        'Dieses Protokoll ist anonymisiert und enthält keine persönlichen Stammdaten und keine Laborwerte. Vor dem Posten bitte trotzdem prüfen, ob nichts Identifizierendes in Freitexten steht.',
    }
  }
  return {
    ...base,
    docTitle: 'Community Protocol',
    brand: 'HOKU · ANONYMOUS',
    coverPurpose: 'No personal data',
    coverSubtitle: 'Anonymised protocol for forums and communities',
    coverDocKind: 'Community protocol (anonymous)',
    subject: 'User',
    contents: 'Contents',
    footer: 'Anonymised for sharing · HOKU',
    sectionTitles: {
      ...base.sectionTitles,
      summary: 'Overview',
      cycles: 'Protocol',
      adherence: 'Adherence',
      weight: 'Weight',
      wellness: 'Well-being',
      effects: 'Effects & side effects',
      reviews: 'Experiences',
    },
    disclaimerTitle: 'Sharing note',
    disclaimer:
      'This protocol is anonymised and excludes personal identity fields and lab values. Still check free-text for anything identifying before posting.',
  }
}

function resolveCopy(preset: PdfBuildOptions['preset'], lang: PdfLang): Copy {
  const base = COPY[lang]
  if (preset === 'arzt') return applyMedicalCopy(base, lang)
  if (preset === 'coach') return applyCoachCopy(base, lang)
  if (preset === 'forum') return applyForumCopy(base, lang)
  return base
}

const FREQ_EN: Record<string, string> = {
  'Täglich': 'Daily', '2x täglich': '2x daily', '3x täglich': '3x daily',
  'Jeden 2. Tag': 'Every 2nd day', 'Alle X Tage': 'Every X days',
  '5 Tage an / 2 aus': '5 on / 2 off', 'Mo-Fr': 'Mon-Fri',
  'Wöchentlich': 'Weekly', 'Wochentage wählen': 'Selected weekdays',
}

const NORMAL_RANGES: Record<string, [number, number]> = {
  'IGF-1': [100, 300], 'Testosteron': [264, 916], 'Östradiol': [10, 40], 'SHBG': [10, 57],
  'LH': [1.5, 9.3], 'FSH': [1.5, 12.4], 'TSH': [0.4, 4.0], 'CRP': [0, 5.0],
  'Vitamin D': [30, 100], 'Ferritin': [30, 400], 'Hämoglobin': [13.5, 17.5],
  'Hematokrit': [40, 52], 'GH': [0, 3.0], 'Kortisol': [6, 23], 'Insulin': [2, 25],
}

// ─── Format-Helfer ──────────────────────────────────────────────────────────

function fmtDate(iso: string, lang: PdfLang): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-US', { dateStyle: 'medium' }).format(d)
}

function fmtNum(n: number, digits = 1): string {
  const r = Math.round(n * 10 ** digits) / 10 ** digits
  return String(r)
}

function signed(n: number, digits = 1, suffix = ''): string {
  const s = fmtNum(Math.abs(n), digits)
  return `${n > 0 ? '+' : n < 0 ? '-' : ''}${s}${suffix}`
}

function freqLabel(freq: string | null, lang: PdfLang): string {
  if (!freq) return '–'
  return lang === 'en' ? (FREQ_EN[freq] ?? freq) : freq
}

function cyclePeriod(c: PdfCycle, lang: PdfLang): string {
  const from = fmtDate(c.start_date, lang)
  const to = c.end_date ? fmtDate(c.end_date, lang) : (lang === 'de' ? 'laufend' : 'ongoing')
  return `${from} – ${to}`
}

// ─── Render-Kontext ──────────────────────────────────────────────────────────

interface Ctx {
  doc: jsPDF
  y: number
  lang: PdfLang
  c: Copy
  theme: Theme
}

function setFill(doc: jsPDF, [r, g, b]: RGB) { doc.setFillColor(r, g, b) }
function setText(doc: jsPDF, [r, g, b]: RGB) { doc.setTextColor(r, g, b) }
function setDraw(doc: jsPDF, [r, g, b]: RGB) { doc.setDrawColor(r, g, b) }

function ensureSpace(ctx: Ctx, needed: number) {
  if (ctx.y + needed > BOTTOM_Y) {
    ctx.doc.addPage()
    ctx.y = TOP_Y
  }
}

function sectionTitle(ctx: Ctx, title: string) {
  ensureSpace(ctx, 16)
  const { doc, theme } = ctx
  ctx.y += 2
  // Klinische Zwischenüberschrift: Uppercase, doppelte Haarlinie (Arzt/Forum-Stil)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  setText(doc, theme.accent)
  doc.text(title.toUpperCase(), MARGIN, ctx.y, { charSpace: 0.4 })
  ctx.y += 2.2
  setDraw(doc, theme.accent)
  doc.setLineWidth(0.35)
  doc.line(MARGIN, ctx.y, PAGE_W - MARGIN, ctx.y)
  setDraw(doc, theme.rule)
  doc.setLineWidth(0.15)
  doc.line(MARGIN, ctx.y + 0.7, PAGE_W - MARGIN, ctx.y + 0.7)
  ctx.y += 6
}

function bodyText(ctx: Ctx, text: string, opts: { size?: number; color?: RGB; gap?: number } = {}) {
  const { doc } = ctx
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(opts.size ?? 9.5)
  setText(doc, opts.color ?? MUTED)
  const lines = doc.splitTextToSize(text, CONTENT_W) as string[]
  ensureSpace(ctx, lines.length * 4.6 + (opts.gap ?? 0))
  doc.text(lines, MARGIN, ctx.y)
  ctx.y += lines.length * 4.6 + (opts.gap ?? 2)
}

function finalYAfterTable(doc: jsPDF): number {
  // lastAutoTable wird von jspdf-autotable zur Laufzeit an das doc gehängt.
  return (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? TOP_Y
}

// ─── Vektor-Charts ───────────────────────────────────────────────────────────

interface Series {
  name: string
  color: RGB
  points: ChartPoint[]
  /** Strichmuster für S/W-Druck (z. B. [2, 1.5]). */
  dash?: number[]
}

function drawLineChart(
  ctx: Ctx, series: Series[],
  opts: {
    height: number
    yMin?: number
    yMax?: number
    legend?: boolean
    /** Punkte zeichnen; default: nur bei wenigen Messwerten. */
    showDots?: boolean
    /** Kurze Datumsachsen-Beschriftung (Von / Bis). */
    xLabels?: boolean
  },
) {
  const { doc, lang } = ctx
  const legendH = opts.legend ? 6 : 0
  const xLabelH = opts.xLabels ? 5 : 0
  const h = opts.height
  ensureSpace(ctx, h + legendH + xLabelH + 4)

  const x0 = MARGIN + 12
  const x1 = PAGE_W - MARGIN
  const yBot = ctx.y + h
  const plotW = x1 - x0

  const allV = series.flatMap(s => s.points.map(p => p.v))
  const allT = series.flatMap(s => s.points.map(p => p.t))
  if (allV.length === 0) { ctx.y += h + legendH + xLabelH; return }
  let vMin = opts.yMin ?? Math.min(...allV)
  let vMax = opts.yMax ?? Math.max(...allV)
  if (vMin === vMax) { vMin -= 1; vMax += 1 }
  const tMin = Math.min(...allT)
  const tMax = Math.max(...allT)
  const tSpan = tMax - tMin || 1

  const sx = (t: number) => x0 + ((t - tMin) / tSpan) * plotW
  const sy = (v: number) => yBot - ((v - vMin) / (vMax - vMin)) * h

  const pointCount = series.reduce((n, s) => n + s.points.length, 0)
  const showDots = opts.showDots ?? pointCount <= 28

  // Gridlines + Y-Ticks (3)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  for (let i = 0; i <= 2; i++) {
    const v = vMin + ((vMax - vMin) * i) / 2
    const yy = sy(v)
    setDraw(doc, RULE); doc.setLineWidth(0.2)
    doc.line(x0, yy, x1, yy)
    setText(doc, FAINT)
    doc.text(fmtNum(v, Math.abs(vMax - vMin) < 5 ? 1 : 0), x0 - 2, yy + 1.5, { align: 'right' })
  }

  // Serien (Strichmuster + Farbe — S/W und Farbe)
  for (const s of series) {
    if (s.points.length === 0) continue
    setDraw(doc, s.color)
    doc.setLineWidth(1.15)
    if (s.dash && s.dash.length > 0) doc.setLineDashPattern(s.dash, 0)
    else doc.setLineDashPattern([], 0)
    const pts = [...s.points].sort((a, b) => a.t - b.t)
    for (let i = 1; i < pts.length; i++) {
      doc.line(sx(pts[i - 1].t), sy(pts[i - 1].v), sx(pts[i].t), sy(pts[i].v))
    }
    doc.setLineDashPattern([], 0)
    if (showDots) {
      setFill(doc, s.color)
      for (const p of pts) doc.circle(sx(p.t), sy(p.v), 0.75, 'F')
    }
  }

  ctx.y = yBot + 3

  if (opts.xLabels) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    setText(doc, FAINT)
    // Lokal formatieren — toISOString verschiebt Datumsachsen um einen Tag (UTC).
    const fmtAxis = (ms: number) => {
      const d = new Date(ms)
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      return fmtDate(iso, lang)
    }
    doc.text(fmtAxis(tMin), x0, ctx.y)
    doc.text(fmtAxis(tMax), x1, ctx.y, { align: 'right' })
    ctx.y += xLabelH
  }

  if (opts.legend) {
    let lx = x0
    doc.setFontSize(7.5)
    for (const s of series) {
      setFill(doc, s.color); doc.circle(lx + 1, ctx.y - 1, 1, 'F')
      setText(doc, MUTED)
      doc.text(s.name, lx + 3.5, ctx.y)
      lx += 4 + doc.getTextWidth(s.name) + 6
    }
    ctx.y += legendH
  }
}

function drawAdherenceBars(ctx: Ctx, rows: { label: string; pct: number; detail: string }[]) {
  const { doc } = ctx
  const rowH = 9
  for (const r of rows) {
    ensureSpace(ctx, rowH + 2)
    const { theme } = ctx
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
    setText(doc, theme.ink)
    doc.text(r.label, MARGIN, ctx.y)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5)
    setText(doc, theme.muted)
    doc.text(`${r.pct}%  ·  ${r.detail}`, PAGE_W - MARGIN, ctx.y, { align: 'right' })
    ctx.y += 2.5
    const barW = CONTENT_W
    setFill(doc, theme.rule)
    doc.roundedRect(MARGIN, ctx.y, barW, 2.4, 1.2, 1.2, 'F')
    const fillW = Math.max(0.1, (r.pct / 100) * barW)
    setFill(doc, r.pct >= 80 ? theme.good : r.pct >= 50 ? theme.accent : theme.bad)
    doc.roundedRect(MARGIN, ctx.y, fillW, 2.4, 1.2, 1.2, 'F')
    ctx.y += rowH - 2.5
  }
}

// ─── Deckblatt (einheitlich: Briefkopf wie Arzt/Forum) ───────────────────────

function coverPage(ctx: Ctx, data: ProtocolData, opts: PdfBuildOptions, includedTitles: string[]) {
  const { doc, c, lang, theme } = ctx
  const includePersonal = opts.sections.includes('personal')
  const subject = resolveSubject(data, includePersonal, lang)
  const created = new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-US', { dateStyle: 'long' }).format(new Date())
  const period = `${fmtDate(opts.range.from, lang)} – ${fmtDate(opts.range.to, lang)}`

  // Doppelte Kopf-Linie (Briefkopf)
  setDraw(doc, theme.accent)
  doc.setLineWidth(0.8)
  doc.line(MARGIN, 18, PAGE_W - MARGIN, 18)
  doc.setLineWidth(0.25)
  doc.line(MARGIN, 20, PAGE_W - MARGIN, 20)

  doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
  setText(doc, theme.accent)
  doc.text(c.brand.toUpperCase(), MARGIN, 28, { charSpace: 0.6 })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
  setText(doc, theme.muted)
  doc.text(c.coverPurpose, PAGE_W - MARGIN, 28, { align: 'right' })

  // Dokumenttitel
  doc.setFont('helvetica', 'bold'); doc.setFontSize(22)
  setText(doc, theme.ink)
  doc.text(c.docTitle, MARGIN, 48)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10)
  setText(doc, theme.muted)
  doc.text(c.coverSubtitle, MARGIN, 56)

  // Meta-Block (eckig, befundartig)
  const boxY = 66
  const boxH = 42
  setDraw(doc, theme.accent); doc.setLineWidth(0.4)
  setFill(doc, theme.cardFill)
  doc.rect(MARGIN, boxY, CONTENT_W, boxH, 'FD')
  setFill(doc, theme.accent)
  doc.rect(MARGIN, boxY, 1.2, boxH, 'F')

  const meta: [string, string][] = [
    [c.subject, subject],
    [c.period, period],
    [c.createdAt, created],
    [lang === 'de' ? 'Dokument' : 'Document', c.coverDocKind],
  ]
  let my = boxY + 9
  for (const [label, value] of meta) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
    setText(doc, theme.muted)
    doc.text(label.toUpperCase(), MARGIN + 6, my, { charSpace: 0.35 })
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
    setText(doc, theme.ink)
    doc.text(value, MARGIN + 48, my)
    my += 8.2
  }

  // Gliederung
  let cy = boxY + boxH + 14
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
  setText(doc, theme.accent)
  doc.text(c.contents.toUpperCase(), MARGIN, cy, { charSpace: 0.7 })
  cy += 2.5
  setDraw(doc, theme.rule); doc.setLineWidth(0.3)
  doc.line(MARGIN, cy, PAGE_W - MARGIN, cy)
  cy += 8
  includedTitles.forEach((title, i) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10)
    setText(doc, theme.muted)
    const num = `${i + 1}.`
    doc.text(num, MARGIN, cy)
    setText(doc, theme.ink)
    doc.text(title, MARGIN + 10, cy)
    setDraw(doc, theme.rule); doc.setLineWidth(0.15)
    const tw = doc.getTextWidth(title)
    const startX = MARGIN + 12 + tw
    if (startX < PAGE_W - MARGIN - 8) {
      for (let x = startX; x < PAGE_W - MARGIN - 4; x += 2.2) {
        doc.line(x, cy - 0.5, x + 0.8, cy - 0.5)
      }
    }
    cy += 7.2
  })
}


// ─── Sektions-Renderer ───────────────────────────────────────────────────────

function renderPersonal(ctx: Ctx, data: ProtocolData) {
  const { c, lang } = ctx
  const p = data.profile
  if (!p) { bodyText(ctx, c.noData); return }
  const rows: [string, string][] = []
  const name = p.display_name?.trim() || p.username?.trim()
  if (name) rows.push([lang === 'de' ? 'Name' : 'Name', name])
  if (p.age != null) rows.push([c.age, `${p.age} ${c.years}`])
  const sex = p.bio_sex === 'male' ? c.male : p.bio_sex === 'female' ? c.female : p.gender
  if (sex) rows.push([c.gender, sex])
  if (p.height_cm != null) rows.push([c.height, `${p.height_cm} cm`])
  if (p.weight_kg != null) rows.push([c.weight, `${fmtNum(Number(p.weight_kg))} ${c.kg}`])
  if (rows.length === 0) { bodyText(ctx, c.noData); return }
  simpleKeyValueTable(ctx, rows)
}

function simpleKeyValueTable(ctx: Ctx, rows: [string, string][]) {
  autoTableSafe(ctx, {
    body: rows.map(([k, v]) => [k, v]),
    columnStyles: { 0: { cellWidth: 46, fontStyle: 'bold', textColor: MUTED }, 1: { textColor: INK } },
    theme: 'plain',
  })
}

function renderSummary(ctx: Ctx, data: ProtocolData, opts: PdfBuildOptions) {
  const { doc, c, lang } = ctx
  const decided = data.doseLogs.filter(l => l.taken != null)
  const takenN = decided.filter(l => l.taken).length
  const adherence = decided.length > 0 ? Math.round((takenN / decided.length) * 100) : null

  const weights = [...data.weightLogs].sort((a, b) => a.logged_at.localeCompare(b.logged_at))
  const wDelta = weights.length >= 2 ? weights[weights.length - 1].weight_kg - weights[0].weight_kg : null
  const activeN = data.cycles.filter(x => x.active).length
  const days = Math.max(1, Math.round(
    (new Date(opts.range.to).getTime() - new Date(opts.range.from).getTime()) / 86400000) + 1)

  const cards: { label: string; value: string }[] = [
    { label: c.kpiAdherence, value: adherence != null ? `${adherence}%` : '–' },
    { label: c.kpiWeight, value: wDelta != null ? signed(wDelta, 1, ` ${c.kg}`) : '–' },
    { label: c.kpiCycles, value: String(activeN) },
    { label: c.kpiDays, value: `${days} ${lang === 'de' ? 'Tage' : 'days'}` },
  ]

  const gap = 4
  const cardW = (CONTENT_W - gap * (cards.length - 1)) / cards.length
  const cardH = 20
  ensureSpace(ctx, cardH + 4)
  const { theme } = ctx
  cards.forEach((card, i) => {
    const x = MARGIN + i * (cardW + gap)
    setDraw(doc, theme.rule); doc.setLineWidth(0.3)
    setFill(doc, theme.cardFill)
    doc.rect(x, ctx.y, cardW, cardH, 'FD')
    setFill(doc, theme.accent)
    doc.rect(x, ctx.y, 1.1, cardH, 'F')
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7)
    setText(doc, theme.faint)
    doc.text(card.label.toUpperCase(), x + 4, ctx.y + 7, { charSpace: 0.3, maxWidth: cardW - 8 })
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15)
    setText(doc, theme.ink)
    doc.text(card.value, x + 4, ctx.y + 16)
  })
  ctx.y += cardH + 6
}

function renderCycles(ctx: Ctx, data: ProtocolData) {
  const { c, lang } = ctx
  const body = data.cycles.map(cy => {
    const name = cy.stack_item_name || cy.name
    const status = cy.active ? c.statusActive : c.statusDone
    const dose = cy.dose != null ? `${fmtNum(cy.dose, 2)} ${cy.unit ?? ''}`.trim() : '–'
    return [
      `${name}\n(${status})`,
      dose,
      cy.method || '–',
      freqLabel(cy.frequency, lang),
      cyclePeriod(cy, lang),
    ]
  })
  autoTableSafe(ctx, {
    head: [c.cyclesHead as unknown as string[]],
    body,
    columnStyles: {
      0: { cellWidth: 34, fontStyle: 'bold' },
      1: { cellWidth: 26 },
      2: { cellWidth: 28 },
      3: { cellWidth: 34 },
    },
  })
}

function renderAdherence(ctx: Ctx, data: ProtocolData) {
  const { c } = ctx
  bodyText(ctx, c.adherenceIntro, { gap: 3 })
  const byPep = new Map<string, { taken: number; total: number }>()
  for (const l of data.doseLogs) {
    if (l.taken == null) continue
    const key = l.stack_item_id ?? '—'
    const e = byPep.get(key) ?? { taken: 0, total: 0 }
    e.total += 1; if (l.taken) e.taken += 1
    byPep.set(key, e)
  }
  const rows = [...byPep.entries()]
    .map(([pid, e]) => ({
      label: data.stackItemNames.get(pid) ?? (ctx.lang === 'de' ? 'Unbekannt' : 'Unknown'),
      pct: Math.round((e.taken / e.total) * 100),
      detail: `${e.taken}/${e.total} ${c.taken}`,
    }))
    .sort((a, b) => b.pct - a.pct)
  if (rows.length === 0) { bodyText(ctx, c.noData); return }
  drawAdherenceBars(ctx, rows)
}

function renderBloodwork(ctx: Ctx, data: ProtocolData) {
  const { c, lang } = ctx
  const markers = Array.from(new Set(data.bloodwork.map(b => b.marker))).sort()
  const body = markers.map(m => {
    const entries = data.bloodwork
      .filter(b => b.marker === m)
      .map(b => ({ date: b.tested_at, value: Number(b.value), unit: b.unit }))
      .filter(e => Number.isFinite(e.value))
      .sort((a, b) => a.date.localeCompare(b.date))
    const unit = entries.find(e => e.unit)?.unit ?? ''
    const range = NORMAL_RANGES[m]
    const first = entries[0]?.value
    const last = entries[entries.length - 1]?.value
    const change = first != null && last != null && entries.length >= 2 ? last - first : null
    return [
      m,
      unit || '–',
      range ? `${range[0]}–${range[1]}` : '–',
      first != null ? fmtNum(first, 2) : '–',
      last != null ? fmtNum(last, 2) : '–',
      change != null ? signed(change, 2) : '–',
    ]
  })
  autoTableSafe(ctx, {
    head: [[c.bloodMarker, c.bloodUnit, c.bloodRange, c.bloodFirst, c.bloodLast, c.bloodChange]],
    body,
    columnStyles: {
      0: { cellWidth: 40, fontStyle: 'bold' },
      1: { cellWidth: 22 },
      2: { cellWidth: 30 },
    },
  })
  void lang
}

function renderWeight(ctx: Ctx, data: ProtocolData) {
  const { c, theme } = ctx
  const raw = [...data.weightLogs]
    .sort((a, b) => a.logged_at.localeCompare(b.logged_at))
    .map(w => ({ t: new Date(w.logged_at).getTime(), v: w.weight_kg }))
  if (raw.length === 0) { bodyText(ctx, c.noData); return }

  const { points, weekly } = prepareLongRangePoints(raw)
  if (points.length >= 2) {
    drawLineChart(
      ctx,
      [{ name: c.weight, color: theme.accent, points }],
      { height: 36, xLabels: true, showDots: points.length <= 28 },
    )
  }
  if (weekly) bodyText(ctx, c.wellnessWeeklyNote, { size: 7.5, gap: 1 })

  const first = raw[0].v
  const last = raw[raw.length - 1].v
  const delta = last - first
  const summary = `${c.weightStart}: ${fmtNum(first)} ${c.kg}   ·   ${c.weightEnd}: ${fmtNum(last)} ${c.kg}   ·   ${c.weightChange}: ${signed(delta, 1, ' ' + c.kg)}`
  bodyText(ctx, summary, { color: INK, size: 9.5, gap: 2 })
}

const WELLNESS_CHART_H = 22

function bucketLabels(c: Copy, size: BucketSize): { aggregation: string; unit: string } {
  if (size === 'day') return { aggregation: c.aggDay, unit: c.unitDay }
  if (size === 'week') return { aggregation: c.aggWeek, unit: c.unitWeek }
  if (size === 'month') return { aggregation: c.aggMonth, unit: c.unitMonth }
  return { aggregation: c.aggQuarter, unit: c.unitQuarter }
}

function drawWellnessChart(
  ctx: Ctx,
  opts: { title: string; summary: string; caption: string; period: string; buckets: WellnessBucket[] },
) {
  const { doc, theme } = ctx
  const height = WELLNESS_CHART_H
  ensureSpace(ctx, height + 14)

  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5)
  setText(doc, theme.ink)
  doc.text(opts.title, MARGIN, ctx.y)
  if (opts.summary) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5)
    setText(doc, theme.muted)
    doc.text(opts.summary, PAGE_W - MARGIN, ctx.y, { align: 'right' })
  }
  ctx.y += 3

  const x0 = MARGIN + 8
  const x1 = PAGE_W - MARGIN
  const yBottom = ctx.y + height
  const plotWidth = x1 - x0
  const timeMin = opts.buckets[0].t
  const timeMax = opts.buckets[opts.buckets.length - 1].t
  const timeSpan = timeMax - timeMin || 1
  const margin = Math.min(plotWidth / 2, plotWidth / (opts.buckets.length * 2 || 1))
  const scaleX = (time: number) => x0 + margin + ((time - timeMin) / timeSpan) * (plotWidth - margin * 2)
  const scaleY = (value: number) => yBottom - (value / 10) * height

  doc.setFont('helvetica', 'normal'); doc.setFontSize(7)
  for (const value of [0, 5, 10]) {
    const y = scaleY(value)
    setDraw(doc, theme.rule); doc.setLineWidth(0.2)
    doc.line(x0, y, x1, y)
    setText(doc, theme.faint)
    doc.text(String(value), x0 - 2, y + 1.5, { align: 'right' })
  }

  setDraw(doc, theme.rule); doc.setLineWidth(0.9)
  for (const bucket of opts.buckets) {
    if (bucket.max === bucket.min) continue
    doc.line(scaleX(bucket.t), scaleY(bucket.min), scaleX(bucket.t), scaleY(bucket.max))
  }

  setDraw(doc, theme.accent); doc.setLineWidth(1.1)
  for (let index = 1; index < opts.buckets.length; index++) {
    const previous = opts.buckets[index - 1]
    const current = opts.buckets[index]
    doc.line(scaleX(previous.t), scaleY(previous.median), scaleX(current.t), scaleY(current.median))
  }
  setFill(doc, theme.accent)
  for (const bucket of opts.buckets) doc.circle(scaleX(bucket.t), scaleY(bucket.median), 0.9, 'F')

  ctx.y = yBottom + 3.5
  doc.setFontSize(7.5)
  setText(doc, theme.faint)
  doc.text(opts.caption, x0, ctx.y)
  doc.text(opts.period, PAGE_W - MARGIN, ctx.y, { align: 'right' })
  ctx.y += 6
}

function renderWellness(ctx: Ctx, data: ProtocolData) {
  const { c, lang } = ctx
  const samplesFor = (field: 'energie' | 'schlaf' | 'wohlbefinden' | 'libido'): WellnessSample[] =>
    data.dailyLogs
      .filter(log => log[field] != null)
      .map(log => ({ date: log.log_date.slice(0, 10), value: log[field] as number }))

  const metrics = [
    { title: c.wellnessEnergy, samples: samplesFor('energie') },
    { title: c.wellnessSleep, samples: samplesFor('schlaf') },
    { title: c.wellnessMood, samples: samplesFor('wohlbefinden') },
    { title: c.wellnessLibido, samples: samplesFor('libido') },
  ].filter(metric => metric.samples.length > 0)

  if (metrics.length === 0) { bodyText(ctx, c.noData); return }

  bodyText(ctx, `${c.scale}   ·   ${c.wellnessSpread}`, { size: 8, gap: 2 })

  for (const metric of metrics) {
    const bucketSize = chooseBucketSize(metric.samples)
    const buckets = aggregate(metric.samples, bucketSize)
    if (buckets.length === 0) continue

    if (buckets.length < 2) {
      ensureSpace(ctx, 8)
      ctx.doc.setFont('helvetica', 'bold'); ctx.doc.setFontSize(9.5)
      setText(ctx.doc, ctx.theme.ink)
      ctx.doc.text(metric.title, MARGIN, ctx.y)
      ctx.doc.setFont('helvetica', 'normal'); ctx.doc.setFontSize(8.5)
      setText(ctx.doc, ctx.theme.muted)
      ctx.doc.text(`${fmtNum(buckets[0].median)} / 10`, PAGE_W - MARGIN, ctx.y, { align: 'right' })
      ctx.y += 6
      continue
    }

    const { aggregation, unit } = bucketLabels(c, bucketSize)
    const summary = summarise(buckets)
    const caption = bucketSize === 'day'
      ? `${aggregation} · ${buckets.length} ${unit}`
      : `${aggregation} · ${buckets.length} ${unit} · ${summary?.entries ?? 0} ${c.wellnessEntries}`
    const summaryText = summary
      ? `${c.weightStart} ${fmtNum(summary.first)}   ·   ${c.weightEnd} ${fmtNum(summary.last)}   ·   ${c.weightChange} ${signed(summary.delta, 1)}`
      : ''
    const dates = metric.samples.map(sample => sample.date).sort()
    const period = `${fmtDate(dates[0], lang)} – ${fmtDate(dates[dates.length - 1], lang)}`

    drawWellnessChart(ctx, { title: metric.title, summary: summaryText, caption, period, buckets })
  }
}

/**
 * Tabellenzeilen der Beobachtungen: Art, Name mit Dauer, darunter Titel des
 * Eintrags (wenn er etwas anderes sagt) und Substanz, Stärke, Datum.
 */
export function effectTableBody(effects: PdfEffect[], lang: PdfLang): string[][] {
  const c = COPY[lang]
  return effects.map(e => {
    const name = e.symptom_key || e.custom_label
      ? symptomLabel({ key: e.symptom_key ?? null, customLabel: e.custom_label ?? null }, lang)
      : e.description
    let duration = ''
    if (e.ongoing) duration = c.ongoing
    else if (e.duration_minutes) {
      const { num, unit } = fromMinutes(e.duration_minutes)
      duration = `${num} ${c.durationUnits[unit][num === 1 ? 0 : 1]}`
    }
    const context = [
      e.description.trim() && e.description.trim().toLowerCase() !== name.trim().toLowerCase() ? e.description.trim() : '',
      e.stack_item_name ?? '',
    ].filter(Boolean).join(' · ')
    return [
      e.type === 'effect' ? c.effect : c.sideEffect,
      (duration ? `${name} · ${duration}` : name) + (context ? `\n(${context})` : ''),
      `${e.severity}/5`,
      fmtDate(e.occurred_at, lang),
    ]
  })
}

function renderEffects(ctx: Ctx, data: ProtocolData) {
  const { c, lang } = ctx
  const body = effectTableBody(data.effects, lang)
  autoTableSafe(ctx, {
    head: [[c.effectType, c.effectDesc, c.effectSeverity, c.effectDate]],
    body,
    columnStyles: {
      0: { cellWidth: 30, fontStyle: 'bold' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 32 },
    },
  })
}

function renderReviews(ctx: Ctx, data: ProtocolData) {
  const { c } = ctx
  // Bewertungen v2: Wirkung, Vertraeglichkeit, „Wieder nehmen?" — bei alten
  // Bewertungen ohne diese Angaben ein Strich.
  const skala = (wert: number | null | undefined) => (wert ? `${wert}/5` : '–')
  const wieder = (wert: string | null | undefined) =>
    wert === 'ja' ? c.againYes : wert === 'unsicher' ? c.againUnsure : wert === 'nein' ? c.againNo : '–'
  const body = data.reviews.map(r => [
    r.stack_item_name ?? '–',
    `${'*'.repeat(Math.max(0, Math.min(5, r.rating)))}${'.'.repeat(5 - Math.max(0, Math.min(5, r.rating)))}  (${r.rating}/5)`,
    skala(r.wirkung),
    skala(r.vertraeglichkeit),
    wieder(r.wieder_nehmen),
  ])
  autoTableSafe(ctx, {
    head: [[c.reviewSubstance, c.reviewRating, c.reviewEffect, c.reviewTolerability, c.reviewAgain]],
    body,
    columnStyles: { 0: { fontStyle: 'bold' }, 1: { cellWidth: 40 }, 2: { cellWidth: 22 }, 3: { cellWidth: 30 }, 4: { cellWidth: 28 } },
  })
}

function renderNotes(ctx: Ctx, opts: PdfBuildOptions) {
  const { c } = ctx
  const note = opts.note.trim()
  bodyText(ctx, note || c.notesEmpty, { color: note ? INK : FAINT, size: 10 })
}

// ─── autotable-Wrapper ───────────────────────────────────────────────────────

interface AutoTableOpts {
  head?: string[][]
  body: (string | number)[][]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columnStyles?: Record<number, any>
  theme?: 'striped' | 'grid' | 'plain'
}

// autoTable wird zur Laufzeit injiziert (dynamischer Import in buildProtocolPdf).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let autoTableFn: any = null

function autoTableSafe(ctx: Ctx, o: AutoTableOpts) {
  const { doc, theme } = ctx
  ensureSpace(ctx, 14)
  const table = typeof autoTableFn === 'function' ? autoTableFn : autoTableFn?.default
  if (typeof table !== 'function') {
    throw new Error('jspdf-autotable failed to load')
  }
  table(doc, {
    startY: ctx.y,
    head: o.head,
    body: o.body,
    theme: o.theme ?? 'grid',
    margin: { left: MARGIN, right: MARGIN, bottom: PAGE_H - BOTTOM_Y },
    styles: {
      font: 'helvetica', fontSize: 8.5, cellPadding: 2.4,
      textColor: theme.ink, lineColor: theme.rule, lineWidth: 0.2, overflow: 'linebreak',
    },
    headStyles: {
      fillColor: theme.headFill,
      textColor: theme.accent,
      fontStyle: 'bold',
      fontSize: 8,
      lineColor: theme.rule,
      lineWidth: 0.2,
    },
    alternateRowStyles: { fillColor: theme.zebra },
    columnStyles: o.columnStyles,
  })
  ctx.y = finalYAfterTable(doc) + 6
}

// ─── Kopf-/Fußzeile (finaler Pass über alle Seiten) ──────────────────────────

function decoratePages(doc: jsPDF, c: Copy, subject: string, theme: Theme) {
  const total = doc.getNumberOfPages()
  for (let p = 2; p <= total; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7)
    setText(doc, theme.accent)
    doc.text(c.docTitle.toUpperCase(), MARGIN, 11, { charSpace: 0.35 })
    doc.setFont('helvetica', 'normal')
    setText(doc, theme.muted)
    doc.text(subject, PAGE_W - MARGIN, 11, { align: 'right' })
    setDraw(doc, theme.accent); doc.setLineWidth(0.35)
    doc.line(MARGIN, 14, PAGE_W - MARGIN, 14)
    setDraw(doc, theme.rule); doc.setLineWidth(0.15)
    doc.line(MARGIN, 15, PAGE_W - MARGIN, 15)
    setDraw(doc, theme.rule); doc.setLineWidth(0.25)
    doc.line(MARGIN, 286, PAGE_W - MARGIN, 286)
    doc.setFontSize(7)
    setText(doc, theme.muted)
    doc.text(c.footer, MARGIN, 291)
    doc.text(`${p} / ${total}`, PAGE_W - MARGIN, 291, { align: 'right' })
  }
}

// ─── Öffentliche API ─────────────────────────────────────────────────────────

const RENDERERS: Record<SectionId, (ctx: Ctx, data: ProtocolData, opts: PdfBuildOptions) => void> = {
  personal: (ctx, data) => renderPersonal(ctx, data),
  summary: (ctx, data, opts) => renderSummary(ctx, data, opts),
  cycles: (ctx, data) => renderCycles(ctx, data),
  adherence: (ctx, data) => renderAdherence(ctx, data),
  bloodwork: (ctx, data) => renderBloodwork(ctx, data),
  weight: (ctx, data) => renderWeight(ctx, data),
  wellness: (ctx, data) => renderWellness(ctx, data),
  effects: (ctx, data) => renderEffects(ctx, data),
  reviews: (ctx, data) => renderReviews(ctx, data),
  notes: (ctx, _data, opts) => renderNotes(ctx, opts),
}

export async function buildProtocolPdf(data: ProtocolData, opts: PdfBuildOptions): Promise<jsPDF> {
  const [{ jsPDF: JsPdf }, autoTableMod] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  autoTableFn = autoTableMod.default ?? autoTableMod

  const doc = new JsPdf('p', 'mm', 'a4')
  const theme = THEME_REPORT
  const c = resolveCopy(opts.preset, opts.lang)
  const ctx: Ctx = { doc, y: TOP_Y, lang: opts.lang, c, theme }

  const shown = visibleSections(opts.sections, data)
  const titles = shown.map(id => c.sectionTitles[id])

  coverPage(ctx, data, opts, titles)

  // Inhaltsseiten
  doc.addPage()
  ctx.y = TOP_Y
  for (const id of shown) {
    const def = SECTIONS.find(s => s.id === id)!
    sectionTitle(ctx, c.sectionTitles[id])
    RENDERERS[id](ctx, data, opts)
    ctx.y += 4
    void def
  }

  // Disclaimer (immer)
  ensureSpace(ctx, 30)
  ctx.y += 2
  sectionTitle(ctx, c.disclaimerTitle)
  bodyText(ctx, c.disclaimer, { size: 8.5, color: MUTED })

  const includePersonal = opts.sections.includes('personal')
  decoratePages(doc, c, resolveSubject(data, includePersonal, opts.lang), theme)

  return doc
}

export function pdfFileName(opts: PdfBuildOptions): string {
  if (opts.preset === 'arzt') {
    return `HOKU-${opts.lang === 'de' ? 'Befund' : 'Report'}-${opts.range.to}.pdf`
  }
  if (opts.preset === 'coach') {
    return `HOKU-${opts.lang === 'de' ? 'Coaching-Report' : 'Coaching-Report'}-${opts.range.to}.pdf`
  }
  if (opts.preset === 'forum') {
    return `HOKU-${opts.lang === 'de' ? 'Community' : 'Community'}-${opts.range.to}.pdf`
  }
  return `HOKU-${opts.lang === 'de' ? 'Protokoll' : 'Protocol'}-${opts.range.to}.pdf`
}
