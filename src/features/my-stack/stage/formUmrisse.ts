// Die Umrisse der Bühnenformen als graue Fläche für die Ladesilhouette
// (components/ui/Silhouette.tsx). Gezeichnet wird mit denselben Pfaden und
// demselben Ausschnitt wie die echte Form — so steht beim Laden schon der Pen
// da, wo gleich der Pen erscheint, und nicht ein Vial.
import { AMPOULE_OUTER_PATH, AMPOULE_VIEWBOX } from '../extensions/ampoule/ampouleShape'
import { CAPSULE_CAP_PATH, CAPSULE_SHELL_PATH, CAPSULE_VIEWBOX } from '../extensions/capsule/capsuleShape'
import { DROPS_CAP_PATH, DROPS_OUTER_PATH, DROPS_TEAT_PATH, DROPS_VIEWBOX } from '../extensions/drops/dropsShape'
import { GEL_BODY_PATH, GEL_LID_PATH, GEL_VIEWBOX } from '../extensions/gel/gelShape'
import {
  NASAL_SPRAY_BODY_PATH, NASAL_SPRAY_COLLAR_PATH, NASAL_SPRAY_FLANGE, NASAL_SPRAY_NOZZLE_PATH, NASAL_SPRAY_SPEC,
} from '../extensions/nasal-spray/nasalSprayShape'
import { PATCH_BODY, PATCH_VIEWBOX } from '../extensions/patch/patchShape'
import { PEN_BODY, PEN_CAP_PATH, PEN_KNOB_PATH, PEN_VIEWBOX } from '../extensions/pen/penShape'
import { VIAL_CAP_COLLAR, VIAL_CAP_HEIGHT, VIAL_CAP_TOP_PATH, VIAL_OUTER_PATH, VIAL_VIEWBOX } from '../extensions/peptide/vialShape'
import { POWDER_BODY_PATH, POWDER_LID_PATH, POWDER_VIEWBOX } from '../extensions/powder/powderShape'
import { SPRAY_ACTUATOR, SPRAY_COLLAR, SPRAY_NOZZLE, SPRAY_OUTER_PATH, SPRAY_VIEWBOX } from '../extensions/spray/sprayShape'
import { TABLET_BODY, TABLET_VIEWBOX } from '../extensions/tablet/tabletShape'
import { TUBE_BODY_PATH, TUBE_CAP_PATH, TUBE_VIEWBOX } from '../extensions/tube/tubeShape'
import type { DosageFormDefinition } from '../lib/dosageForms'
import type { StageBox } from './types'

export type BuehnenForm = NonNullable<DosageFormDefinition['stageRenderer']>

export interface FormUmriss {
  viewBox: string
  pfade: readonly { d: string; transform?: string }[]
}

type Kasten = { x: number; y: number; width: number; height: number; rx?: number }

function rechteck({ x, y, width: b, height: h, rx = 0 }: Kasten): string {
  const r = Math.min(rx, b / 2, h / 2)
  return `M${x + r} ${y} H${x + b - r} A${r} ${r} 0 0 1 ${x + b} ${y + r} V${y + h - r} A${r} ${r} 0 0 1 ${x + b - r} ${y + h} H${x + r} A${r} ${r} 0 0 1 ${x} ${y + h - r} V${y + r} A${r} ${r} 0 0 1 ${x + r} ${y} Z`
}

function kreis({ cx, cy, r }: { cx: number; cy: number; r: number }): string {
  return `M${cx - r} ${cy} A${r} ${r} 0 1 1 ${cx + r} ${cy} A${r} ${r} 0 1 1 ${cx - r} ${cy} Z`
}

const ausschnitt = ({ x, y, width, height }: StageBox) => `${x} ${y} ${width} ${height}`

// Das Vial ist zusammengesetzt (PeptideVialVisual): Kappe 120 × 58, die um
// 5 % der Breite in den Glaskörper greift, darunter der Körper im Verhältnis
// 5 : 7, auf den die Kontur ohne Seitenverhältnis gestreckt wird.
const VIAL_KAPPE = VIAL_CAP_HEIGHT - 0.05 * VIAL_VIEWBOX.width
const VIAL_KOERPER = (VIAL_VIEWBOX.width * 7) / 5

export const FORM_UMRISSE: Record<BuehnenForm, FormUmriss> = {
  vial: {
    viewBox: `0 0 ${VIAL_VIEWBOX.width} ${VIAL_KAPPE + VIAL_KOERPER}`,
    pfade: [
      { d: VIAL_CAP_TOP_PATH },
      { d: rechteck(VIAL_CAP_COLLAR) },
      { d: VIAL_OUTER_PATH, transform: `translate(0 ${VIAL_KAPPE}) scale(1 ${VIAL_KOERPER / VIAL_VIEWBOX.height})` },
    ],
  },
  ampoule: { viewBox: ausschnitt(AMPOULE_VIEWBOX), pfade: [{ d: AMPOULE_OUTER_PATH }] },
  pen: {
    viewBox: ausschnitt(PEN_VIEWBOX),
    pfade: [{ d: PEN_CAP_PATH }, { d: rechteck(PEN_BODY) }, { d: PEN_KNOB_PATH }],
  },
  tablet: { viewBox: ausschnitt(TABLET_VIEWBOX), pfade: [{ d: kreis(TABLET_BODY) }] },
  capsule: { viewBox: ausschnitt(CAPSULE_VIEWBOX), pfade: [{ d: CAPSULE_SHELL_PATH }, { d: CAPSULE_CAP_PATH }] },
  drops: {
    viewBox: ausschnitt(DROPS_VIEWBOX),
    pfade: [{ d: DROPS_TEAT_PATH }, { d: DROPS_CAP_PATH }, { d: DROPS_OUTER_PATH }],
  },
  powder: { viewBox: ausschnitt(POWDER_VIEWBOX), pfade: [{ d: POWDER_LID_PATH }, { d: POWDER_BODY_PATH }] },
  nasal_spray: {
    viewBox: ausschnitt(NASAL_SPRAY_SPEC.viewBox),
    pfade: [
      { d: NASAL_SPRAY_NOZZLE_PATH },
      { d: rechteck(NASAL_SPRAY_FLANGE) },
      { d: NASAL_SPRAY_COLLAR_PATH },
      { d: NASAL_SPRAY_BODY_PATH },
    ],
  },
  spray: {
    viewBox: ausschnitt(SPRAY_VIEWBOX),
    pfade: [
      { d: rechteck(SPRAY_ACTUATOR) },
      { d: rechteck(SPRAY_NOZZLE) },
      { d: rechteck(SPRAY_COLLAR) },
      { d: SPRAY_OUTER_PATH },
    ],
  },
  gel: { viewBox: ausschnitt(GEL_VIEWBOX), pfade: [{ d: GEL_LID_PATH }, { d: GEL_BODY_PATH }] },
  // In Ruhe, ungebogen
  patch: { viewBox: ausschnitt(PATCH_VIEWBOX), pfade: [{ d: rechteck(PATCH_BODY) }] },
  tube: { viewBox: ausschnitt(TUBE_VIEWBOX), pfade: [{ d: TUBE_BODY_PATH }, { d: TUBE_CAP_PATH }] },
}
