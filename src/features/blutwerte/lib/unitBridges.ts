/**
 * Veroeffentlichte Umrechnungsfaktoren konventionell → SI je Marker.
 * Gemeinsame Quelle fuer den Rechner und die Blutwerte-Anzeige.
 */
export const CONVERSION_SOURCES = {
  mayo: 'https://www.mayocliniclabs.com/order-tests/si-unit-conversion.html',
  labcorp: 'https://www.labcorp.com/test-menu/resources/si-unit-conversion-table',
  ngsp: 'https://ngsp.org/ifcc.asp',
  urea: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11867516/',
}

export interface MarkerBridge {
  from: string
  to: string
  factor: number
  source: keyof typeof CONVERSION_SOURCES
}

// Published conventional → SI factors, reviewed 2026-09-28. Reverse conversions
// divide by the same factor, avoiding inconsistent rounded reciprocal tables.
// No generic bridges for Lp(a), protein hormones or biological IU → mass/moles.
export const MARKER_BRIDGES: Record<string, MarkerBridge> = {
  'Glukose': { from: 'mg/dL', to: 'mmol/L', factor: 0.0555, source: 'labcorp' },
  'Cholesterin gesamt': { from: 'mg/dL', to: 'mmol/L', factor: 0.0259, source: 'labcorp' },
  'LDL-Cholesterin': { from: 'mg/dL', to: 'mmol/L', factor: 0.0259, source: 'labcorp' },
  'HDL-Cholesterin': { from: 'mg/dL', to: 'mmol/L', factor: 0.0259, source: 'labcorp' },
  'Triglyceride': { from: 'mg/dL', to: 'mmol/L', factor: 0.0113, source: 'mayo' },
  'Kreatinin': { from: 'mg/dL', to: 'µmol/L', factor: 88.4, source: 'labcorp' },
  'Harnstoff': { from: 'mg/dL', to: 'mmol/L', factor: 0.1665, source: 'urea' },
  'Harnsäure': { from: 'mg/dL', to: 'µmol/L', factor: 59.48, source: 'urea' },
  'Bilirubin gesamt': { from: 'mg/dL', to: 'µmol/L', factor: 17.1, source: 'labcorp' },
  'Testosteron': { from: 'ng/dL', to: 'nmol/L', factor: 0.0347, source: 'mayo' },
  'Freies Testosteron': { from: 'ng/dL', to: 'pmol/L', factor: 34.672, source: 'mayo' },
  'Östradiol': { from: 'pg/mL', to: 'pmol/L', factor: 3.671, source: 'mayo' },
  'Kortisol': { from: 'µg/dL', to: 'nmol/L', factor: 27.6, source: 'mayo' },
  'DHEA-S': { from: 'µg/dL', to: 'µmol/L', factor: 0.027, source: 'mayo' },
  'Progesteron': { from: 'ng/mL', to: 'nmol/L', factor: 3.18, source: 'mayo' },
  'fT3': { from: 'pg/mL', to: 'pmol/L', factor: 1.54, source: 'mayo' },
  'fT4': { from: 'ng/dL', to: 'pmol/L', factor: 12.87, source: 'mayo' },
  // Vitamin D refers specifically to the app's 25-OH total vitamin D marker.
  'Vitamin D': { from: 'ng/mL', to: 'nmol/L', factor: 2.496, source: 'mayo' },
  'Vitamin B12': { from: 'ng/mL', to: 'pmol/L', factor: 738, source: 'labcorp' },
  'Folsäure': { from: 'ng/mL', to: 'nmol/L', factor: 2.265, source: 'labcorp' },
  'Eisen': { from: 'µg/dL', to: 'µmol/L', factor: 0.179, source: 'labcorp' },
  'Magnesium': { from: 'mg/dL', to: 'mmol/L', factor: 0.4114, source: 'labcorp' },
  'Kalzium': { from: 'mg/dL', to: 'mmol/L', factor: 0.25, source: 'mayo' },
  'Zink': { from: 'µg/dL', to: 'µmol/L', factor: 0.153, source: 'labcorp' },
}
