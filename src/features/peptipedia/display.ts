import type { PeptideCategory, ResearchStatus } from './content/types'

// ─── Display helpers ──────────────────────────────────────────────────────────

// i18n-Keys statt fester Strings — Komponenten übersetzen via t(CATEGORY_LABEL_KEYS[cat])
export const CATEGORY_LABEL_KEYS: Record<PeptideCategory, string> = {
  grundlagen: 'plib_cat_grundlagen',
  heilung:          'plib_cat_heilung',
  wachstumshormon:  'plib_cat_wachstumshormon',
  nootropikum:      'plib_cat_nootropikum',
  stoffwechsel:     'plib_cat_stoffwechsel',
  anti_aging:       'plib_cat_anti_aging',
  sexualgesundheit: 'plib_cat_sexualgesundheit',
}

export const STATUS_LABEL_KEYS: Record<ResearchStatus, string> = {
  unverified: 'plib_status_unverified',
  preclinical: 'plib_status_preclinical',
  phase_1:     'plib_status_phase_1',
  phase_2:     'plib_status_phase_2',
  human_research: 'plib_status_human_research',
  historical_approval: 'plib_status_historical_approval',
  approved:    'plib_status_approved',
}

/** Ton der Status-Kapsel (.lg-tag[data-tone]); ohne Ton neutral grau. */
export const STATUS_TONES: Record<ResearchStatus, 'good' | 'warn' | 'accent' | undefined> = {
  unverified: undefined,
  preclinical: undefined,
  phase_1:     'accent',
  phase_2:     'accent',
  human_research: 'accent',
  historical_approval: 'warn',
  approved:    'good',
}
