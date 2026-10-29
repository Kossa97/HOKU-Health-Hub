import { type ReactNode, useEffect } from 'react'

/**
 * Formular der Ernährung unter der festen Kugel — kein schwebendes Blatt mehr:
 * Die Kugel bleibt oben sichtbar, das Formular steht direkt darunter im Fluss.
 * Gleiche Schnittstelle wie `Sheet` (compliance), damit die Formulare unverändert
 * bleiben. Nicht modal: Die Kugel und das Zurück bleiben erreichbar; Escape schließt.
 * Beim Öffnen springt die Seite nach oben — Kugel groß, Formular gleich darunter.
 */
export function Sheet({ labelledBy, busy = false, onClose, children, role = 'dialog', tall: _tall, ...data }: {
  labelledBy: string
  busy?: boolean
  onClose: () => void
  children: ReactNode
  role?: 'dialog' | 'alertdialog'
  /** Ohne Wirkung (das Formular steht im Fluss); nur für die gleiche Schnittstelle wie `Sheet`. */
  tall?: boolean
} & Record<`data-${string}`, boolean | string>) {
  useEffect(() => { window.scrollTo({ top: 0 }) }, [])
  void _tall
  return (
    <div
      // Für die Zurück-Geste der App (AppBackNavigation): sie schließt das Formular, statt die Seite zu verlassen.
      data-app-modal
      role={role}
      aria-labelledby={labelledBy}
      {...data}
      className="lg-surface lg-flat mt-1 px-5 pb-5 pt-4"
      onKeyDown={event => {
        if (event.key !== 'Escape' || busy) return
        event.stopPropagation()
        onClose()
      }}
    >
      {children}
    </div>
  )
}
