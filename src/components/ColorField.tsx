import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent } from 'react'
import {
  anteil,
  FELD_START,
  hexToHsv,
  hsvToHex,
  MARKEN_FARBTOENE,
  type HSV,
} from '../features/my-stack/lib/colorField'

export interface ColorFieldProps {
  value: string
  onChange: (hex: string) => void
}

// Die Lupe, die beim Ziehen mit dem Finger ueber der Flaeche schwebt: der
// Finger selbst deckt genau die Stelle ab, die man treffen will. Eine Maus
// hat das Problem nicht — der Zeiger sitzt daneben, nicht darueber —, deshalb
// erscheint sie nur bei `pointerType === 'touch'`.
const LUPE_GROESSE = 96
const LUPE_ZOOM = 3
const LUPE_ABSTAND = 28

// Eine Flaeche zum Ziehen statt einer Reihe fertiger Felder: Saettigung nach
// rechts, Helligkeit nach oben, darunter die Farbtonschiene. Beides mit dem
// Finger zu bedienen, beides auch mit den Pfeiltasten.
//
// Zwei Dinge, ohne die es auf dem Handy nicht funktioniert:
//   touch-action: none  — sonst scrollt die Seite, statt dass der Griff folgt.
//   setPointerCapture   — sonst reisst der Zug ab, sobald der Finger die
//                         Flaeche verlaesst, und der Griff bleibt stehen.
export function ColorField({ value, onChange }: ColorFieldProps) {
  const [hsv, setHsv] = useState<HSV>(() => hexToHsv(value) ?? FELD_START)

  // Was wir zuletzt selbst gemeldet haben. Ohne das setzt der eigene Ruf von
  // aussen den Griff neu — bei Saettigung 0 hat jeder Farbton dieselbe Farbe,
  // der Ton ginge beim Ziehen durch Weiss also verloren.
  const gemeldet = useRef<string>(hsvToHex(hexToHsv(value) ?? FELD_START))
  useEffect(() => {
    if (value === gemeldet.current) return
    const vonAussen = hexToHsv(value)
    if (vonAussen) {
      setHsv(vonAussen)
      gemeldet.current = hsvToHex(vonAussen)
    }
  }, [value])

  const melden = useCallback((next: HSV) => {
    setHsv(next)
    const hex = hsvToHex(next)
    gemeldet.current = hex
    onChange(hex)
  }, [onChange])

  const flaecheRef = useRef<HTMLDivElement | null>(null)
  const schieneRef = useRef<HTMLDivElement | null>(null)

  // Wo die Lupe gerade schwebt — und was sie zeigt. `null` heisst: kein
  // Finger auf der Flaeche, keine Lupe im Bild.
  const [lupe, setLupe] = useState<{
    x: number
    y: number
    relX: number
    relY: number
    breite: number
    hoehe: number
  } | null>(null)

  const ausFlaeche = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const kasten = flaecheRef.current?.getBoundingClientRect()
    if (!kasten) return
    const relX = anteil(event.clientX, kasten.left, kasten.width)
    const relY = anteil(event.clientY, kasten.top, kasten.height)
    melden({ h: hsv.h, s: relX, v: 1 - relY })

    setLupe(event.pointerType === 'touch'
      ? { x: event.clientX, y: event.clientY, relX, relY, breite: kasten.width, hoehe: kasten.height }
      : null)
  }, [hsv.h, melden])

  const ausSchiene = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const kasten = schieneRef.current?.getBoundingClientRect()
    if (!kasten) return
    melden({ ...hsv, h: anteil(event.clientX, kasten.left, kasten.width) * 360 })
  }, [hsv, melden])

  const ziehen = (
    lesen: (event: ReactPointerEvent<HTMLDivElement>) => void,
    beendet?: () => void,
  ) => ({
    onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => {
      event.currentTarget.setPointerCapture?.(event.pointerId)
      lesen(event)
    },
    onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) lesen(event)
    },
    onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => {
      event.currentTarget.releasePointerCapture?.(event.pointerId)
      beendet?.()
    },
    onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => {
      event.currentTarget.releasePointerCapture?.(event.pointerId)
      beendet?.()
    },
  })

  const tasten = (event: ReactKeyboardEvent<HTMLDivElement>, achse: 'flaeche' | 'ton') => {
    const schritt = event.shiftKey ? 0.1 : 0.02
    const links = event.key === 'ArrowLeft'
    const rechts = event.key === 'ArrowRight'
    const hoch = event.key === 'ArrowUp'
    const runter = event.key === 'ArrowDown'
    if (!links && !rechts && !hoch && !runter) return
    event.preventDefault()

    if (achse === 'ton') {
      const richtung = links || runter ? -1 : 1
      melden({ ...hsv, h: (hsv.h + richtung * (event.shiftKey ? 30 : 6) + 360) % 360 })
      return
    }
    melden({
      h: hsv.h,
      s: hsv.s + (rechts ? schritt : links ? -schritt : 0),
      v: hsv.v + (hoch ? schritt : runter ? -schritt : 0),
    })
  }

  const hex = hsvToHex(hsv)
  const reinerTon = hsvToHex({ h: hsv.h, s: 1, v: 1 })

  return (
    <div className="select-none">
      <div className="flex items-stretch gap-3">
        {/* Die Flaeche. Der Farbton kommt von unten, darueber liegen zwei
            Verlaeufe: Weiss nach rechts weg, Schwarz nach oben weg. Das ist
            die klassische HSV-Flaeche — sie stimmt an jeder Stelle mit dem
            ueberein, was hsvToHex ausrechnet. */}
        <div
          ref={flaecheRef}
          data-color-field="area"
          role="slider"
          tabIndex={0}
          aria-label="Sättigung und Helligkeit"
          aria-valuetext={`Sättigung ${Math.round(hsv.s * 100)} Prozent, Helligkeit ${Math.round(hsv.v * 100)} Prozent`}
          aria-valuenow={Math.round(hsv.s * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          onKeyDown={event => tasten(event, 'flaeche')}
          {...ziehen(ausFlaeche, () => setLupe(null))}
          className="relative h-[132px] flex-1 cursor-crosshair touch-none rounded-xl border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_6px_18px_rgba(0,0,0,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          style={{
            background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${reinerTon})`,
          }}
        >
          <span
            data-color-field="area-thumb"
            className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.45),0_2px_8px_rgba(0,0,0,0.5)]"
            style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: hex }}
          />
        </div>

        {/* Das Ergebnis als Perle, in derselben Machart wie die Objekte im
            Formular: Glanzpunkt oben links, dunkler Rand unten rechts. */}
        <div className="flex w-[68px] shrink-0 flex-col items-center justify-center gap-2">
          <span
            data-color-field="result"
            className="h-11 w-11 rounded-full shadow-[0_2px_6px_rgba(0,0,0,0.40),inset_0_1px_0_rgba(255,255,255,0.22)]"
            style={{
              background: `radial-gradient(circle at 32% 26%, rgba(255,255,255,0.45), rgba(255,255,255,0.06) 42%, rgba(0,0,0,0.30) 100%), ${hex}`,
            }}
          />
          <span className="font-mono text-xs uppercase text-slate-400">{hex}</span>
        </div>
      </div>

      {/* Die Farbtonschiene. Die Striche darunter sitzen auf unseren eigenen
          Farbtoenen — sie schraenken nichts ein, sie zeigen nur, wo die Farben
          der App liegen. */}
      <div
        ref={schieneRef}
        data-color-field="hue"
        role="slider"
        tabIndex={0}
        aria-label="Farbton"
        aria-valuenow={Math.round(hsv.h)}
        aria-valuemin={0}
        aria-valuemax={360}
        onKeyDown={event => tasten(event, 'ton')}
        {...ziehen(ausSchiene)}
        className="relative mt-3 h-6 cursor-pointer touch-none rounded-full border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        style={{
          background: 'linear-gradient(to right, #ff0000, #ffff00 16.67%, #00ff00 33.33%, #00ffff 50%, #0000ff 66.67%, #ff00ff 83.33%, #ff0000)',
        }}
      >
        {MARKEN_FARBTOENE.map(marke => (
          <span
            key={marke.name}
            data-color-field-mark={marke.name}
            className="pointer-events-none absolute -bottom-[7px] h-[5px] w-[2px] -translate-x-1/2 rounded-full bg-white/45"
            style={{ left: `${(marke.h / 360) * 100}%` }}
          />
        ))}
        <span
          data-color-field="hue-thumb"
          className="pointer-events-none absolute top-1/2 h-7 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.45),0_2px_8px_rgba(0,0,0,0.5)]"
          style={{ left: `${(hsv.h / 360) * 100}%`, background: reinerTon }}
        />
      </div>

      {/* Die Lupe: derselbe Farbverlauf wie die Flaeche, nur um `LUPE_ZOOM`
          vergroessert und so verschoben, dass genau die beruehrte Stelle in
          ihrer Mitte liegt — ein Ausschnitt aus einer gedachten groesseren
          Flaeche, nicht ein Bild, das skaliert wuerde. Sie schwebt ueber dem
          Finger statt unter ihm, sonst verdeckt der Finger selbst, was sie
          zeigen soll. `position: fixed`, weil sie an Bildschirmkoordinaten
          haengt, nicht an der (unbewegten) Flaeche. */}
      {lupe && (
        <div
          data-color-field="lupe"
          aria-hidden="true"
          className="pointer-events-none fixed z-50 overflow-hidden rounded-full border-2 border-white/85 shadow-[0_10px_28px_rgba(0,0,0,0.55)]"
          style={{
            left: lupe.x - LUPE_GROESSE / 2,
            top: Math.max(8, lupe.y - LUPE_ABSTAND - LUPE_GROESSE),
            width: LUPE_GROESSE,
            height: LUPE_GROESSE,
          }}
        >
          <div
            className="absolute"
            style={{
              width: lupe.breite * LUPE_ZOOM,
              height: lupe.hoehe * LUPE_ZOOM,
              left: LUPE_GROESSE / 2 - lupe.relX * lupe.breite * LUPE_ZOOM,
              top: LUPE_GROESSE / 2 - lupe.relY * lupe.hoehe * LUPE_ZOOM,
              background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${reinerTon})`,
            }}
          />
          {/* Das Fadenkreuz sitzt immer in der Mitte der Lupe — dort liegt
              der Punkt, der gerade gemeldet wird, unabhaengig davon, wo auf
              der Flaeche der Finger steht. */}
          <span className="pointer-events-none absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.55)]" />
        </div>
      )}
    </div>
  )
}
