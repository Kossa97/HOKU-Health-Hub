import { useMemo } from 'react'

/**
 * Dots Logo in der Leiste: eine kleine Punktkugel. Ist er zu Hause, pulsiert,
 * leuchtet und wackelt sie leise (CSS, `data-dot-drinnen` an der Schaltfläche);
 * ist er draußen, ruht sie gedimmt. Über ihr ist sein Eingang.
 */

const CYAN = [110, 230, 255], VIOLET = [175, 135, 255], PINK = [255, 120, 200]
const mischen = (a: number[], b: number[], m: number) => a.map((v, i) => v + (b[i] - v) * m)

function farbe(x: number, y: number) {
  let c = mischen(CYAN, VIOLET, Math.max(0, Math.min(1, (x - y) * 0.32 + 0.5 - 0.035)))
  if (y > 0.55) c = mischen(c, PINK, Math.min(1, (y - 0.55) * 1.4))
  return `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`
}

export function DotLogo() {
  const punkte = useMemo(() => {
    const n = 46, ga = Math.PI * (3 - Math.sqrt(5))
    return Array.from({ length: n }, (_, i) => {
      const y = 1 - (2 * (i + 0.5)) / n, rr = Math.sqrt(1 - y * y), th = ga * i
      const x = Math.cos(th) * rr, z = Math.sin(th) * rr
      const Y = y * Math.cos(0.38) - z * Math.sin(0.38), Z = y * Math.sin(0.38) + z * Math.cos(0.38), f = (Z + 1) / 2
      return { cx: +(x * 11).toFixed(2), cy: +(Y * 11).toFixed(2), r: +(0.55 + 0.7 * f).toFixed(2), fill: farbe(x, Y), o: +(0.15 + 0.85 * f * f).toFixed(2) }
    })
  }, [])
  return (
    <svg viewBox="-15 -15 30 30" width={30} height={30} aria-hidden="true" className="tyd-dot-logo">
      <g className="tyd-dot-logo-glow">
        <g className="tyd-dot-logo-wob">
          {punkte.map((p, i) => <circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill={p.fill} opacity={p.o} />)}
        </g>
      </g>
    </svg>
  )
}
