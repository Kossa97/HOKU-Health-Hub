/** `prefers-reduced-motion`: dann springt die Ansicht statt zu scrollen, und nichts federt. */
export function prefersReducedMotion(): boolean {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}
