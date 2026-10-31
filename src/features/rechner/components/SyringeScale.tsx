import { useId, useLayoutEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { formatCalculatorNumber } from '../lib/units'
import './SyringeScale.css'

export function SyringeScale({ drawUnits, capacityUnits, capacityMl, minorStep, majorStep }: {
  drawUnits: number | null
  capacityUnits: number
  capacityMl: number
  minorStep: number | null
  majorStep: number | null
}) {
  const { t, i18n } = useTranslation()
  const id = useId().replace(/:/g, '')
  const fluid = useRef<SVGRectElement>(null)
  const plunger = useRef<SVGGElement>(null)
  const marker = useRef<SVGGElement>(null)
  const status = useRef<HTMLParagraphElement>(null)
  const position = useRef(0)
  const format = (value: number) => formatCalculatorNumber(value, i18n.language)
  const capacityValid = Number.isFinite(capacityUnits) && capacityUnits > 0 && Number.isFinite(capacityMl) && capacityMl > 0
  const valid = capacityValid && drawUnits !== null && Number.isFinite(drawUnits) && drawUnits >= 0 && drawUnits <= capacityUnits
  const ratio = valid ? drawUnits / capacityUnits : null
  const tickCount = minorStep !== null && minorStep > 0 && Number.isFinite(minorStep) ? capacityUnits / minorStep : NaN
  const knownGraduation = capacityValid && Number.isFinite(tickCount) && tickCount >= 1 && tickCount <= 200
  const ticks = !capacityValid ? [] : knownGraduation
    ? Array.from({ length: Math.floor(tickCount + 1e-10) }, (_, index) => {
      const value = (index + 1) * minorStep!
      const majorRatio = majorStep !== null && majorStep > 0 ? value / majorStep : NaN
      return { value, major: Number.isFinite(majorRatio) && Math.abs(majorRatio - Math.round(majorRatio)) < 1e-8 }
    })
    : [{ value: 0, major: true }, { value: capacityUnits, major: true }]
  const settledText = t(knownGraduation ? 'rechner_scale_exact' : 'rechner_scale_unknown')
  const emptyText = t(!capacityValid ? 'rechner_scale_capacity_unknown' : !knownGraduation ? 'rechner_scale_unknown' : 'rechner_scale_empty')
  const pendingText = t('rechner_scale_pending')

  useLayoutEffect(() => {
    let frame = 0
    let pending = true
    const paint = (next: number) => {
      position.current = next
      const displacement = next * 300
      fluid.current?.setAttribute('height', String(displacement))
      plunger.current?.setAttribute('transform', `translate(0 ${displacement})`)
      marker.current?.setAttribute('transform', `translate(0 ${displacement})`)
    }
    if (ratio === null) {
      paint(0)
      if (status.current) status.current.textContent = emptyText
      return
    }
    if (status.current) status.current.textContent = pendingText
    const motion = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
    const finish = () => {
      cancelAnimationFrame(frame)
      paint(ratio)
      if (status.current) status.current.textContent = settledText
    }
    const onMotionChange = () => {
      if (motion?.matches && !pending) finish()
    }
    motion?.addEventListener('change', onMotionChange)
    const timer = window.setTimeout(() => {
      pending = false
      const from = position.current
      if (motion?.matches || from === ratio) {
        finish()
        return
      }
      const started = performance.now()
      const tick = (now: number) => {
        const elapsed = Math.min(1, Math.max(0, (now - started) / 800))
        const progress = elapsed * elapsed * (3 - 2 * elapsed)
        paint(from + (ratio - from) * progress)
        if (elapsed < 1) frame = requestAnimationFrame(tick)
        else finish()
      }
      frame = requestAnimationFrame(tick)
    }, 450)
    return () => {
      window.clearTimeout(timer)
      cancelAnimationFrame(frame)
      motion?.removeEventListener('change', onMotionChange)
    }
  }, [ratio, capacityUnits, capacityMl, settledText, emptyText, pendingText])

  const target = valid ? `${format(drawUnits)} ${t('einh_kurz')}` : null
  const maximum = capacityValid ? `${format(capacityUnits)} ${t('einh_kurz')}` : null
  const paint = (name: string) => `url(#${id}-${name})`

  return <div className="rechner-syringe-scale">
    <div className="rechner-syringe-output">
      <span className="rechner-syringe-target-label">{t('rechner_scale_target')}</span>
      <div className="rechner-syringe-target"><strong>{valid ? format(drawUnits) : '—'}</strong> <span>{t('einh_kurz')}</span></div>
      <p className="rechner-syringe-volume">{ratio !== null ? `${format(ratio * capacityMl)} mL` : t('rechner_scale_empty')}</p>
      <p className="rechner-syringe-capacity">{capacityValid ? `${maximum} / ${format(capacityMl)} mL` : '—'}</p>
    </div>
    <div className="rechner-syringe-diagram" dir="ltr"
      role={valid ? 'meter' : undefined} aria-label={valid ? t('rechner_syringe_fill') : undefined}
      aria-valuemin={valid ? 0 : undefined} aria-valuemax={valid ? capacityUnits : undefined}
      aria-valuenow={valid ? drawUnits : undefined} aria-valuetext={valid ? `${target} / ${maximum}` : undefined}>
      <svg viewBox="0 0 194 830" aria-hidden="true" focusable="false" className="rechner-syringe-drawing">
        <defs>
          <linearGradient id={`${id}-metal`} x1="0" x2="1"><stop stopColor="#647a89" /><stop offset=".28" stopColor="#c9d8e0" /><stop offset=".48" stopColor="#f5fbff" /><stop offset=".64" stopColor="#b2c4ce" /><stop offset="1" stopColor="#546c7b" /></linearGradient>
          <linearGradient id={`${id}-glass`} x1="0" x2="1"><stop stopColor="var(--text-dim)" stopOpacity=".3" /><stop offset=".13" stopColor="var(--text)" stopOpacity=".4" /><stop offset=".23" stopColor="var(--text-dim)" stopOpacity=".13" /><stop offset=".62" stopColor="var(--text)" stopOpacity=".04" /><stop offset=".84" stopColor="var(--text)" stopOpacity=".22" /><stop offset="1" stopColor="var(--text-dim)" stopOpacity=".35" /></linearGradient>
          <linearGradient id={`${id}-liquid`} x1="0" x2="1"><stop stopColor="color-mix(in srgb, var(--accent) 62%, #000)" /><stop offset=".3" stopColor="var(--accent)" stopOpacity=".85" /><stop offset=".75" stopColor="var(--accent)" stopOpacity=".65" /><stop offset="1" stopColor="color-mix(in srgb, var(--accent) 58%, #000)" /></linearGradient>
          <linearGradient id={`${id}-rubber`} x1="0" x2="1"><stop stopColor="#080d14" /><stop offset=".3" stopColor="#35414c" /><stop offset=".58" stopColor="#1e2b36" /><stop offset="1" stopColor="#050a0f" /></linearGradient>
          <clipPath id={`${id}-barrel`}><rect x="57" y="144" width="80" height="320" rx="3" /></clipPath>
        </defs>
        <path d="M96 86 L96 20 L101 12 L101 86 Z" fill={paint('metal')} />
        <g className="rechner-syringe-glass" fill={paint('glass')}>
          <rect x="86" y="83" width="25" height="35" rx="5" />
          <path d="M89 109 H108 L126 127 H70 Z" />
          <rect x="52" y="125" width="90" height="351" rx="10" strokeWidth="1.5" />
        </g>
        <g ref={plunger} className="rechner-syringe-plunger" transform="translate(0 0)">
          <rect className="rechner-syringe-rod rechner-syringe-glass" x="85" y="163" width="24" height="320" rx="3" fill={paint('glass')} />
          <rect x="93" y="164" width="7" height="317" fill="var(--text-dim)" fillOpacity=".2" />
          <rect className="rechner-syringe-thumb rechner-syringe-glass" x="58" y="476" width="78" height="14" rx="7" fill={paint('glass')} />
          <path d="M65 479 H129" stroke="var(--text-dim)" strokeOpacity=".6" />
          <rect className="rechner-syringe-rubber" x="57" y="144" width="80" height="24" rx="5" fill={paint('rubber')} />
          <path d="M60 147 H134 M60 163 H134" stroke="#b6c8d4" strokeOpacity=".46" strokeWidth="2" />
          <path d="M59 154 H135" stroke="#040b11" strokeWidth="4" />
        </g>
        <g clipPath={paint('barrel')}><rect ref={fluid} className="rechner-syringe-fluid" x="57" y="144" width="80" height="0" fill={paint('liquid')} /></g>
        <rect x="60" y="132" width="6" height="333" rx="3" fill="var(--text)" fillOpacity=".17" />
        <path d="M138 137 V465" stroke="var(--text-dim)" strokeOpacity=".35" />
        <g className="rechner-syringe-graduations">
          {ticks.map(({ value, major }, index) => {
            const y = 144 + value / capacityUnits * 300
            const label = format(value)
            return <g key={index}>
              <line x1="70" x2={major ? 96 : 84} y1={y} y2={y} strokeWidth={major ? 2 : 1.3} />
              {major && <text x="100" y={y + 6} textLength={label.length > 5 ? 34 : undefined} lengthAdjust="spacingAndGlyphs">{label}</text>}
            </g>
          })}
        </g>
        <path className="rechner-syringe-glass" d="M53 473 H29 Q23 473 23 480 V489 Q23 494 29 494 H166 Q172 494 172 489 V480 Q172 473 166 473 H142" fill={paint('glass')} />
        <path d="M28 480 H167" stroke="var(--text-dim)" strokeOpacity=".5" />
        {valid && <g ref={marker} className="rechner-syringe-target-marker" transform="translate(0 0)">
          <path d="M146 144 H178 M146 144 L153 139 M146 144 L153 149" fill="none" stroke="var(--accent)" strokeWidth="2.5" />
          <circle cx="179" cy="144" r="3" fill="var(--accent)" />
        </g>}
      </svg>
    </div>
    <p ref={status} className="rechner-syringe-status" role="status" aria-live="polite">{valid ? pendingText : emptyText}</p>
  </div>
}
