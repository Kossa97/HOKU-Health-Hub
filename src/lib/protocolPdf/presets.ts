// Vorgefertigte PDF-Muster: setzen die Häkchen-Auswahl. Der Renderer bleibt
// section-basiert — ein Muster ist nur eine benannte Vorauswahl (+ Anonymität).

import type { PdfLang, ProtocolData, SectionId } from './types'
import { SECTIONS } from './sections'

export type PresetId = 'arzt' | 'coach' | 'forum'
export type ActivePreset = PresetId | 'custom'

export interface PdfPreset {
  id: PresetId
  label: Record<PdfLang, string>
  description: Record<PdfLang, string>
  /** Gewünschte Sektionen (Reihenfolge egal; PDF-Reihenfolge kommt aus SECTIONS). */
  sections: SectionId[]
}

/**
 * Arzt: Labor + Protokoll + Nebenwirkungen, wenig Community.
 * Coach: Adherence / Wohlbefinden / Reviews, Blutwerte bewusst aus.
 * Forum: anonym (ohne personal), ohne Labor und ohne persönliche Notizen.
 */
export const PRESETS: PdfPreset[] = [
  {
    id: 'arzt',
    label: { de: 'Arzt', en: 'Doctor' },
    description: {
      de: 'Labor, Protokoll und Nebenwirkungen — fürs Gespräch mit dem Arzt.',
      en: 'Labs, protocol and side effects — for your doctor visit.',
    },
    sections: ['personal', 'summary', 'cycles', 'adherence', 'bloodwork', 'weight', 'effects', 'notes'],
  },
  {
    id: 'coach',
    label: { de: 'Coach', en: 'Coach' },
    description: {
      de: 'Adherence, Wohlbefinden und Feedback — ohne Laborwerte.',
      en: 'Adherence, well-being and feedback — without lab values.',
    },
    sections: ['personal', 'summary', 'cycles', 'adherence', 'weight', 'wellness', 'effects', 'reviews', 'notes'],
  },
  {
    id: 'forum',
    label: { de: 'Forum', en: 'Forum' },
    description: {
      de: 'Anonym, ohne Labor und ohne Namen — zum Teilen online.',
      en: 'Anonymous, no labs and no name — safe to share online.',
    },
    sections: ['summary', 'cycles', 'adherence', 'weight', 'wellness', 'effects', 'reviews'],
  },
]

export function getPreset(id: PresetId): PdfPreset {
  const preset = PRESETS.find(p => p.id === id)
  if (!preset) throw new Error(`Unknown PDF preset: ${id}`)
  return preset
}

/** Sektionen eines Musters, gefiltert auf verfügbare Daten (Notizen immer, wenn im Muster). */
export function applyPreset(id: PresetId, data: ProtocolData): SectionId[] {
  const wanted = new Set(getPreset(id).sections)
  return SECTIONS
    .filter(s => wanted.has(s.id) && (s.alwaysAvailable || s.hasData(data)))
    .map(s => s.id)
}

/** Erkennt, ob die aktuelle Auswahl exakt einem Muster entspricht (bzgl. verfügbarer Daten). */
export function matchPreset(selected: SectionId[], data: ProtocolData): ActivePreset {
  const selectedSet = new Set(selected)
  for (const preset of PRESETS) {
    const applied = applyPreset(preset.id, data)
    if (applied.length !== selectedSet.size) continue
    if (applied.every(id => selectedSet.has(id))) return preset.id
  }
  return 'custom'
}
