import { useEffect } from 'react'

/** Zeichnet neu, wenn das Farbschema wechselt — der Canvas liest Farben nur beim Zeichnen. */
export function useThemeRedraw(redraw: () => void): void {
  useEffect(() => {
    if (typeof window === 'undefined') return
    const observer = typeof MutationObserver !== 'undefined'
      ? new MutationObserver(() => redraw())
      : null
    observer?.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] })
    const media = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null
    media?.addEventListener?.('change', redraw)
    return () => {
      observer?.disconnect()
      media?.removeEventListener?.('change', redraw)
    }
  }, [redraw])
}
