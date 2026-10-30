/** Masse des Auswahlrads (WheelPicker) — auch fuer das Band dahinter (SetWheelSheet). */

export const WHEEL_ITEM_H = 38
/** Winkel je Zeile auf der Walze. */
export const WHEEL_STEP_RAD = (20 * Math.PI) / 180
/** Walzenradius: so gross, dass eine Zeile genau einen Schritt Bogen fuellt. */
export const WHEEL_RADIUS = WHEEL_ITEM_H / WHEEL_STEP_RAD
/** Sichtbare Hoehe: der Walzendurchmesser, auf ganze Pixel. */
export const WHEEL_HEIGHT = Math.round(2 * WHEEL_RADIUS)
/** Innenabstand oben und unten, damit auch die erste und letzte Zeile in die Mitte kommt. */
export const WHEEL_PAD = (WHEEL_HEIGHT - WHEEL_ITEM_H) / 2
