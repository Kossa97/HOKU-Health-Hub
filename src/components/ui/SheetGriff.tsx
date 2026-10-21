import type { CSSProperties } from 'react'
import { useSheetDrag } from '../../lib/useSheetDrag'

/**
 * Der Griff oben im Sheet — und zugleich die Stelle, an der man es nach unten
 * wegzieht (src/lib/useSheetDrag.ts). Die Fläche ist breiter und hoeher als
 * die Pille selbst, damit der Daumen sie trifft; das Blatt ist das naechste
 * `.lg-sheet` oder der naechste Dialog darueber.
 *
 * `onClose` ist derselbe Weg wie Kreuz oder Hintergrund. Solange `disabled`
 * gilt (etwa beim Speichern), bleibt das Blatt stehen.
 */
export function SheetGriff({ onClose, disabled = false, className = '', style }: {
  onClose: () => void
  disabled?: boolean
  /** Abstaende der Pille, wie vorher an `.lg-grabber`. */
  className?: string
  style?: CSSProperties
}) {
  const { griffe } = useSheetDrag<HTMLElement>(() => { if (!disabled) onClose() })
  // Die Flaeche bleibt auch gesperrt im DOM: verschwaende sie mitten im Ziehen,
  // kaemen Loslassen und Abbruch nie an. Gesperrt beginnt nur kein neues Ziehen.
  // Seitlich so breit wie der Inhalt — breiter liesse das Blatt seitwaerts
  // scrollen —, unten nur knapp ueber die Pille, damit sie keinen Knopf der
  // Kopfzeile verdeckt.
  return (
    <div className={`relative ${className}`} style={style} aria-hidden="true">
      <span className="lg-grabber" />
      <span
        {...griffe}
        onPointerDown={event => { if (!disabled) griffe.onPointerDown(event) }}
        data-sheet-griff
        className="absolute inset-x-0 -top-2 -bottom-1.5"
        style={{ touchAction: 'none' }}
      />
    </div>
  )
}
