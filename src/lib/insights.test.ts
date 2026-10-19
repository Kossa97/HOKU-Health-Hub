import { describe, expect, it } from 'vitest'
import { effectsByPeptide, topSideEffects, type EffectRow } from './insights'
import { symptomLabel, type SymptomRow } from './tagebuch/diary'

const label = (observation: Parameters<typeof symptomLabel>[0]) => symptomLabel(observation, 'de')
const chip = (felder: Partial<SymptomRow>): SymptomRow => ({
  symptom_key: 'nausea', custom_label: null, kind: 'side_effect', severity: 3,
  duration_minutes: null, ongoing: false, position: 0, ...felder,
})
function eintrag(felder: Partial<EffectRow>): EffectRow {
  return {
    id: 'e', type: 'side_effect', description: 'Titel', severity: 3, stack_item_id: null,
    occurred_at: '2026-09-01T08:00:00Z', stack_items: { display_name: 'BPC-157' }, ...felder,
  }
}

describe('Protokoll-Einblicke aus dem Tagebuch', () => {
  it('haeufigste Nebenwirkungen zaehlen Chips, nicht Titel; aeltere Eintraege mit ihrem Titel', () => {
    const stats = topSideEffects([
      eintrag({ effect_symptoms: [chip({}), chip({ symptom_key: 'headache', position: 1 })] }),
      eintrag({ effect_symptoms: [chip({}), chip({ symptom_key: 'more_energy', kind: 'effect', position: 1 })] }),
      eintrag({ description: 'Rötung' }),
    ], label)
    expect(stats).toEqual([
      { text: 'Übelkeit', count: 2 },
      { text: 'Kopfschmerzen', count: 1 },
      { text: 'Rötung', count: 1 },
    ])
  })

  it('je Substanz: Chips beider Arten und Ø Intensitaet ueber die Chips', () => {
    const [bpc] = effectsByPeptide([
      eintrag({ type: null, effect_symptoms: [chip({ severity: 2 }), chip({ symptom_key: 'more_energy', kind: 'effect', severity: 5, position: 1 })] }),
      eintrag({ type: null, severity: null }),
    ])
    expect(bpc).toEqual({ name: 'BPC-157', effects: 1, sideEffects: 1, avgSeverity: 3.5 })
  })

  it('eigener Name wie ein Katalog-Chip zaehlt zu diesem', () => {
    const stats = topSideEffects([
      eintrag({ effect_symptoms: [chip({ symptom_key: 'redness' })] }),
      eintrag({ effect_symptoms: [chip({ symptom_key: null, custom_label: 'rötung ' })] }),
      eintrag({ description: 'Redness' }),
    ], label)
    expect(stats).toEqual([{ text: 'Rötung', count: 3 }])
  })
})
