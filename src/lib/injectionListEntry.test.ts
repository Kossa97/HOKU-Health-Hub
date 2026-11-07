// src/lib/injectionListEntry.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { InjectionLog3D } from './injectionLogTypes'
import { INJECTION_SITE_PRESETS } from './injectionSitePresets'
import { hasExactInjectionPosition } from './injectionHistory'
import { proximityWarning } from './injectionGeometry'
import {
  INJECTION_LIST_MODEL_VERSION,
  INJECTION_VIEW_STORAGE_KEY,
  isListInjection,
  lastInjectionAtSite,
  listPinDraft,
  readInjectionView,
  writeInjectionView,
} from './injectionListEntry'

const bauchRechts = INJECTION_SITE_PRESETS.find(p => p.region === 'abdomen' && p.side === 'right')!

function log(id: string, loggedAt: string, overrides: Partial<InjectionLog3D> = {}): InjectionLog3D {
  return {
    id, user_id: 'u', dose_log_id: null, stack_item_id: null, cycle_id: null, stack_item_name: null,
    cycle_name: null, dose: null, unit: null, method: null, notes: null, logged_at: loggedAt,
    created_at: null, warning_state: null, substance_label: null,
    ...listPinDraft(bauchRechts),
    ...overrides,
  }
}

beforeEach(() => {
  const speicher = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => speicher.get(k) ?? null,
    setItem: (k: string, v: string) => { speicher.set(k, v) },
  })
})

describe('Listen-Eintraege', () => {
  it('tragen Stelle und Standardposition, aber eine eigene Kennung', () => {
    const draft = listPinDraft(bauchRechts)
    expect(draft.model_version).toBe(INJECTION_LIST_MODEL_VERSION)
    expect(draft.body_region).toBe('abdomen')
    expect(draft.body_side).toBe('right')
    expect(draft.position).toEqual(bauchRechts.position)
  })

  it('erscheinen nie als Pin auf dem Torso', () => {
    const entry = log('a', '2026-11-06T08:00:00Z')
    expect(isListInjection(entry)).toBe(true)
    expect(hasExactInjectionPosition(entry)).toBe(false)
  })

  it('zaehlen fuer die Abstandswarnung mit Torso-Eintraegen zusammen', () => {
    const now = new Date('2026-11-07T08:00:00Z')
    const listEntry = log('a', '2026-11-06T08:00:00Z')
    const torsoDraft = { ...listPinDraft(bauchRechts), model_version: 'placeholder-v1' }
    expect(proximityWarning(torsoDraft, [listEntry], now).level).toBe('strong')
  })
})

describe('lastInjectionAtSite', () => {
  it('nimmt den juengsten Eintrag der Stelle aus beiden Ansichten', () => {
    const logs = [
      log('alt', '2026-11-01T08:00:00Z'),
      log('torso', '2026-11-05T08:00:00Z', { model_version: 'placeholder-v1' }),
      log('anders', '2026-11-06T08:00:00Z', { body_side: 'left' }),
    ]
    expect(lastInjectionAtSite(logs, bauchRechts)?.id).toBe('torso')
  })

  it('ohne Eintrag: null', () => {
    expect(lastInjectionAtSite([], bauchRechts)).toBeNull()
  })
})

describe('gewaehlte Ansicht', () => {
  it('startet mit dem Torso und merkt sich die Liste', () => {
    expect(readInjectionView()).toBe('torso')
    writeInjectionView('liste')
    expect(localStorage.getItem(INJECTION_VIEW_STORAGE_KEY)).toBe('liste')
    expect(readInjectionView()).toBe('liste')
    writeInjectionView('torso')
    expect(readInjectionView()).toBe('torso')
  })
})
