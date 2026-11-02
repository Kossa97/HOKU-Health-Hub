import { useId } from 'react'
import { useActiveLook } from '../../lib/look'
import { aktiveHokuFarbe, PALETTEN, useHokuFarbWahl } from './lib/hokuFarbe'

/** Hokus neues Leistenzeichen; folgt weiterhin der Profilfarbe und dem App-Design. */
export function DotLogo() {
  const id = useId()
  const look = useActiveLook()
  const [wahl] = useHokuFarbWahl()
  const farbe = aktiveHokuFarbe(look, wahl)
  const palette = farbe === 'heute' ? null : PALETTEN[farbe === 'stimmung' ? 'glut' : farbe]
  const tint = `hoku-ton-${id}`, mask = `hoku-maske-${id}`, gradient = `hoku-verlauf-${id}`
  const tones = (channel: number) => palette && [palette.hinten, palette.rand, palette.vorn].map(c => c[channel] / 255).join(' ')

  return (
    <svg viewBox="0 0 30 30" width={30} height={30} aria-hidden="true" className="tyd-dot-logo">
      <defs>
        {palette && farbe !== 'cyanweiss' && (
          <filter id={tint} colorInterpolationFilters="sRGB">
            <feColorMatrix type="matrix" values="0 0 1 0 0  0 0 1 0 0  0 0 1 0 0  0 0 0 1 0" />
            <feComponentTransfer>
              <feFuncR type="table" tableValues={tones(0) || undefined} />
              <feFuncG type="table" tableValues={tones(1) || undefined} />
              <feFuncB type="table" tableValues={tones(2) || undefined} />
            </feComponentTransfer>
          </filter>
        )}
        {farbe === 'heute' && (
          <>
            <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="rgb(110,230,255)" />
              <stop offset=".65" stopColor="rgb(175,135,255)" />
              <stop offset="1" stopColor="rgb(255,120,200)" />
            </linearGradient>
            <mask id={mask} maskUnits="userSpaceOnUse" x="0" y="0" width="30" height="30" style={{ maskType: 'alpha' }}>
              <image href="/icons/hoku-dunkel-symbol-128.png" width={30} height={30} />
            </mask>
          </>
        )}
      </defs>
      <g className="tyd-dot-logo-glow">
        <g className="tyd-dot-logo-wob">
          {farbe === 'heute'
            ? <rect width={30} height={30} fill={`url(#${gradient})`} mask={`url(#${mask})`} />
            : <image href="/icons/hoku-dunkel-symbol-128.png" width={30} height={30} filter={farbe === 'cyanweiss' ? undefined : `url(#${tint})`} />}
        </g>
      </g>
    </svg>
  )
}
