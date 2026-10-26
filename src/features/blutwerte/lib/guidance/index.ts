import type { MarkerGuidance } from '../markerGuidance'
import { GUIDANCE_HORMONE2 } from './hormone2'
import { GUIDANCE_VITAMINE } from './vitamine'
import { GUIDANCE_ELEKTROLYTE } from './elektrolyte'
import { GUIDANCE_BLUTBILD1 } from './blutbild1'
import { GUIDANCE_LIPIDE } from './lipide'
import { GUIDANCE_NIERE } from './niere'
import { GUIDANCE_STOFFWECHSEL } from './stoffwechsel'
import { GUIDANCE_LEBER } from './leber'
import { GUIDANCE_ENZYME } from './enzyme'
import { GUIDANCE_HORMONE1 } from './hormone1'
import { GUIDANCE_BLUTBILD2 } from './blutbild2'

/** Einordnungen je Kategorie; jedes Paket ist mit seinen Quellen abgeglichen. */
export const GUIDANCE_PAKETE: Array<Record<string, MarkerGuidance>> = [
  GUIDANCE_HORMONE2,
  GUIDANCE_VITAMINE,
  GUIDANCE_ELEKTROLYTE,
  GUIDANCE_BLUTBILD1,
  GUIDANCE_LIPIDE,
  GUIDANCE_NIERE,
  GUIDANCE_STOFFWECHSEL,
  GUIDANCE_LEBER,
  GUIDANCE_ENZYME,
  GUIDANCE_HORMONE1,
  GUIDANCE_BLUTBILD2,
]
