import type { StageFormSpec } from '../../stage/types'

// The vial's stage description. The shell itself still lives in
// PeptideVialVisual; this is what the stage needs to know about the form.

// Die Silhouette. Unveraendert — die Innenkontur kommt hinzu, sie ersetzt
// nichts. Frueher stand dieser Pfad viermal woertlich in PeptideVialVisual.
export const VIAL_OUTER_PATH = 'M28 0 L92 0 L92 24 C92 35 116 41 116 56 L116 252 C116 274 102 286 76 286 L44 286 C18 286 4 274 4 252 L4 56 C4 41 28 35 28 24 Z'

// Wandstaerke in viewBox-Einheiten: 5 % der Koerperbreite, dasselbe Verhaeltnis
// wie bei der Ampulle (3,4 von 68). Ein fester Absolutwert saehe auf dem fast
// doppelt so breiten Vial duenn aus.
export const VIAL_WALL = 5.6

// Die nach innen versetzte Kontur. Sie zeichnet die Wandstaerke — die doppelte
// Linie, die einen hohlen Koerper von einer Silhouette unterscheidet — und sie
// beschneidet die Fluessigkeit, damit ein Glasboden darunter sichtbar bleibt.
export const VIAL_INNER_PATH = 'M33.6 4 L86.4 4 L86.4 26 C86.4 37 110.4 43.5 110.4 58 L110.4 250 C110.4 269.5 98 280.4 75.5 280.4 L44.5 280.4 C22 280.4 9.6 269.5 9.6 250 L9.6 58 C9.6 43.5 33.6 37 33.6 26 Z'

export const VIAL_VIEWBOX = { x: 0, y: 0, width: 120, height: 294 } as const

// Die Kappe sitzt in einem eigenen Ausschnitt (120 × 58) ueber dem Glas.
export const VIAL_CAP_HEIGHT = 58
export const VIAL_CAP_TOP_PATH = 'M14 32 L14 20 C14 7 106 7 106 20 L106 32 Z'
export const VIAL_CAP_COLLAR = { x: 17, y: 30, width: 86, height: 27, rx: 3 } as const

// Die Kanten des Glaskoerpers, auf dem das Etikett sitzt — dieselben Werte
// wie im aeusseren Pfad (`L 4 252` und `L 116 56`).
export const VIAL_BODY = { x: 4, right: 116 } as const

// Wie bei der Ampulle: hergeleitet statt geraten. Hier stand 3,5 %, der
// Koerper beginnt bei 3,33 % — ein Haar, aber dieselbe Fehlerquelle.
export const VIAL_LABEL_INSET_PCT =
  (VIAL_BODY.x - VIAL_VIEWBOX.x) / VIAL_VIEWBOX.width

export const VIAL_SPEC: StageFormSpec = {
  viewBox: VIAL_VIEWBOX,
  // Innerhalb der Innenkontur, nicht der aeusseren: der Boden endet bei 280,4
  // und laesst darunter den Glasboden stehen.
  chamber: {
    x: 9.6,
    y: 36,
    width: 100.8,
    height: 244.4,
    // Gerendert, nicht in viewBox-Einheiten: das Vial wird mit
    // preserveAspectRatio="none" in eine 80 x 112 grosse Kachel gezogen.
    // (100,8/120 * 80) / (244,4/294 * 112) = 0,722.
    aspect: 0.722,
  },
  // A vial is drawn down over weeks, so its fill level says something.
  hasMeaningfulFill: true,
}
