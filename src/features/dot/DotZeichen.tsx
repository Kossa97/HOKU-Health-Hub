/**
 * Dot im Kleinen: überall, wo Dot etwas für den Nutzer erkennt oder ausliest
 * (Befund, Essensfoto, Etikett), steht statt „KI" seine Punktkugel.
 *
 * - `DotZeichen`: still, für Knöpfe und Kacheln.
 * - `DotArbeitet`: dreht sich langsam und atmet, solange Dot liest. Eine
 *   CSS-Animation, damit sie weiterläuft, während die Seite auf die Antwort
 *   wartet; bei reduzierter Bewegung pulsiert nur die Deckkraft (`dot.css`).
 */
import './dot.css'

/** Punkte einer Kugel (Fibonacci), von vorn gesehen: Abstand zur Mitte, Tiefe für Größe und Helligkeit. */
const PUNKTE = (() => {
  const n = 34
  const goldenerWinkel = Math.PI * (3 - Math.sqrt(5))
  return Array.from({ length: n }, (_, i) => {
    const y = 1 - (2 * (i + 0.5)) / n
    const r = Math.sqrt(1 - y * y)
    const a = goldenerWinkel * i
    const z = Math.sin(a) * r
    return { x: Math.cos(a) * r, y, z }
  }).sort((p, q) => p.z - q.z)
})()

function Kugel({ groesse }: { groesse: number }) {
  return (
    <svg width={groesse} height={groesse} viewBox="-1.25 -1.25 2.5 2.5" aria-hidden="true" className="tyd-dot-kugel">
      {PUNKTE.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={0.085 + 0.065 * (p.z + 1) / 2}
          fill="currentColor"
          opacity={0.28 + 0.72 * (p.z + 1) / 2}
          // Jeder sechste Punkt blinkt beim Arbeiten versetzt (nur in DotArbeitet sichtbar)
          className={i % 6 === 0 ? 'tyd-dot-funke' : undefined}
          style={i % 6 === 0 ? { animationDelay: `${(i % 5) * 180}ms` } : undefined}
        />
      ))}
    </svg>
  )
}

/** Dots Zeichen für Knöpfe. Farbe über `currentColor`, Standard ist die Akzentfarbe. */
export function DotZeichen({ groesse = 20, className = '' }: { groesse?: number; className?: string }) {
  return (
    <span className={`inline-flex shrink-0 text-[var(--lg-accent,#00ccf5)] ${className}`} data-dot-zeichen>
      <Kugel groesse={groesse} />
    </span>
  )
}

/** Dot liest gerade: Kugel mit Text darunter, als Statusmeldung für Vorleser. */
export function DotArbeitet({ text, groesse = 52 }: { text: string; groesse?: number }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center gap-3 py-6 text-center" data-dot-arbeitet>
      <span className="tyd-dot-arbeitet text-[var(--lg-accent,#00ccf5)]">
        <Kugel groesse={groesse} />
      </span>
      <p className="text-[15px] leading-snug text-[var(--lg-text-2)]">{text}</p>
    </div>
  )
}
