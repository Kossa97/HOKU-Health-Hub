import {
  useEffect,
  useState,
  useRef,
  useLayoutEffect,
  useCallback,
  type CSSProperties,
} from 'react'
import { denyProps } from '../lib/denyFeedback'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Check, ChevronLeft, ChevronRight, X, RotateCcw } from 'lucide-react'
import { useOnboarding } from '../context/OnboardingContext'
import { ONBOARDING_STEPS, ONBOARDING_TOUR_STEP_COUNT } from './onboardingSteps'
import { OB_Z } from './onboardingLayers'
import { computeCalloutLayout, type CalloutPlacement } from './onboardingPlacement'
import {
  getOnboardingInteractionEl,
  getOpenAppModal,
  measureOnboardingTarget,
  shouldShowOnboardingSpotlight,
} from './onboardingTarget'

const SPOT_PAD = 8
const SCRIM = 'rgba(0, 6, 18, 0.58)'

function CalloutArrow({ placement, left }: { placement: CalloutPlacement; left: number }) {
  if (placement === 'center') return null
  const above = placement === 'top'
  return (
    <span
      className={`ob-callout-arrow ob-callout-arrow--${above ? 'top' : 'bottom'}`}
      style={{ position: 'absolute', left }}
    />
  )
}

function SpotlightScrim({ hole }: { hole: DOMRect | null }) {
  const paneStyle: CSSProperties = {
    position: 'fixed',
    background: SCRIM,
    pointerEvents: 'auto',
  }

  if (!hole || hole.width < 2 || hole.height < 2) {
    return (
      <div id="ob-scrim-root" aria-hidden>
        <div className="ob-scrim-pane fixed inset-0" style={{ ...paneStyle, zIndex: OB_Z.scrim }} />
      </div>
    )
  }

  const x = Math.max(0, hole.left - SPOT_PAD)
  const y = Math.max(0, hole.top - SPOT_PAD)
  const w = hole.width + SPOT_PAD * 2
  const h = hole.height + SPOT_PAD * 2
  const r = 10

  // Ring is rendered OUTSIDE #ob-scrim-root so its z-index is in the global stacking context.
  // Inside #ob-scrim-root (z-index 10000), any child z-index is capped by the parent — the nav
  // and modals at 10030/10040 would cover a ring at 10045 if it were nested inside the scrim root.
  return (
    <>
      <div id="ob-scrim-root" aria-hidden>
        <div className="ob-scrim-pane" style={{ ...paneStyle, zIndex: OB_Z.scrim, top: 0, left: 0, right: 0, height: y }} />
        <div className="ob-scrim-pane" style={{ ...paneStyle, zIndex: OB_Z.scrim, top: y, left: 0, width: x, height: h }} />
        <div className="ob-scrim-pane" style={{ ...paneStyle, zIndex: OB_Z.scrim, top: y, left: x + w, right: 0, height: h }} />
        <div className="ob-scrim-pane" style={{ ...paneStyle, zIndex: OB_Z.scrim, top: y + h, left: 0, right: 0, bottom: 0 }} />
      </div>
      <div
        className="ob-highlight-ring pointer-events-none"
        style={{
          position: 'fixed',
          zIndex: OB_Z.ring,
          top: y,
          left: x,
          width: w,
          height: h,
          borderRadius: r,
        }}
      />
    </>
  )
}

function isPanelNode(node: EventTarget | null): boolean {
  if (!(node instanceof Node)) return false
  return !!document.getElementById('ob-callout')?.contains(node)
}

export function Onboarding() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { step, total, active, needsLanguagePick, next, prev, skip } = useOnboarding()

  const meta = ONBOARDING_STEPS[step]
  const steps = ONBOARDING_STEPS.map(m => ({
    ...m,
    title: t(m.titleKey),
    subtitle: t(m.subtitleKey),
    description: t(m.descriptionKey),
    tapHint: m.tapHintKey ? t(m.tapHintKey) : null,
  }))
  const s = steps[step]

  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [fieldIndex, setFieldIndex] = useState(0)
  const [canAdvance, setCanAdvance] = useState(true)
  const simConfirmedRef = useRef(false)
  const [simPhase, setSimPhase] = useState<'card'|'sheet'|'done'>('card')
  const [simTime, setSimTime] = useState('')
  const [panelH, setPanelH] = useState(200)
  const [viewportKey, setViewportKey] = useState(0)
  const [layout, setLayout] = useState<ReturnType<typeof computeCalloutLayout>>(() =>
    computeCalloutLayout(null, window.innerWidth, window.innerHeight, 200, { prefer: 'center' }),
  )

  const panelRef = useRef<HTMLDivElement>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const nextRef = useRef(next)

  // When a step has clickSelector, that element is interactive (not the ring target).
  const getInteractionEl = useCallback((m: typeof meta) => {
    if (!m) return null
    if (m.clickSelector) return document.querySelector<HTMLElement>(m.clickSelector)
    return getOnboardingInteractionEl(m)
  }, [])

  useEffect(() => {
    nextRef.current = next
  }, [next])

  const wantsTarget = !!meta?.targetSelector
  const showSpotlight = shouldShowOnboardingSpotlight(meta, targetRect)
  // Target inside an open modal → snap card to top of viewport, ring stays on field
  const isModalTarget = showSpotlight && modalOpen
  const useCenteredCallout = !showSpotlight || meta?.placement === 'center' || isModalTarget
  const isFirst = step === 0
  const isLast = step === total - 1
  const tourStepNumber = step > 0 && !isLast ? step : null
  const progressLabel =
    tourStepNumber === null
      ? isFirst
        ? t('ob_intro')
        : t('finish')
      : t('step_of', { current: tourStepNumber, total: ONBOARDING_TOUR_STEP_COUNT })

  useEffect(() => {
    document.body.classList.toggle('onboarding-active', active && !needsLanguagePick)
    return () => document.body.classList.remove('onboarding-active')
  }, [active, needsLanguagePick])

  // Force layout recalculation on viewport resize (needed when targetRect doesn't change)
  useEffect(() => {
    const onResize = () => setViewportKey(k => k + 1)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (!active || needsLanguagePick) return
    const route = meta?.route ?? (step === 0 ? '/' : undefined)
    if (route) navigate(route)
  }, [step, active, needsLanguagePick, meta?.route, navigate])

  const syncModalLayer = useCallback(() => {
    document.querySelectorAll('[data-app-modal]').forEach(el => {
      const modal = el as HTMLElement
      const visible = modal.getBoundingClientRect().height > 0
      if (visible && active && !needsLanguagePick) {
        modal.style.zIndex = String(OB_Z.appModal)
        modal.style.pointerEvents = 'auto'
      } else {
        modal.style.zIndex = ''
        modal.style.pointerEvents = ''
      }
    })
  }, [active, needsLanguagePick])

  useEffect(() => {
    if (!active || needsLanguagePick) return
    syncModalLayer()
    const mo = new MutationObserver(syncModalLayer)
    mo.observe(document.body, { childList: true, subtree: true, attributes: true })
    return () => {
      mo.disconnect()
      document.querySelectorAll('[data-app-modal]').forEach(el => {
        const modal = el as HTMLElement
        modal.style.zIndex = ''
        modal.style.pointerEvents = ''
      })
    }
  }, [active, needsLanguagePick, syncModalLayer])

  // Returns cycle fields: individual inputs OR data-ob-self containers (treated as one field block)
  const getCycleFields = useCallback((el: HTMLElement | null): HTMLElement[] => {
    if (!el) return []
    const SINGLE = 'input:not([type="hidden"]):not([type="file"]):not([disabled]), select:not([disabled])'
    if (el.matches(SINGLE)) return [el]

    const selfContainers = [...el.querySelectorAll<HTMLElement>('[data-ob-self]')]
    const result: HTMLElement[] = []

    // Walk all descendants in DOM order — collect data-ob-self containers as blocks,
    // and visible standalone inputs/selects not inside a data-ob-self container.
    for (const node of el.querySelectorAll<HTMLElement>('[data-ob-self], ' + SINGLE)) {
      if (node.matches('[data-ob-self]')) {
        // Always include self-containers (weekday picker, dates, intake, reminder)
        if (!result.includes(node)) result.push(node)
      } else {
        const r = node.getBoundingClientRect()
        if (r.height <= 4 || r.height >= 72 || r.width <= 20) continue
        const parent = selfContainers.find(c => c.contains(node))
        if (parent) {
          if (!result.includes(parent)) result.push(parent)
        } else {
          result.push(node)
        }
      }
    }
    return result
  }, [])

  const measureTarget = useCallback(() => {
    setModalOpen(!!getOpenAppModal())
    // Gate the "Weiter" button: enabled only once the step's precondition is met.
    setCanAdvance((() => {
      switch (meta?.precondition) {
        case 'filled': {
          const tgt = getInteractionEl(meta)
          const input = tgt?.matches('input,select,textarea')
            ? (tgt as HTMLInputElement)
            : tgt?.querySelector<HTMLInputElement>('input,select,textarea') ?? null
          return !!input && String(input.value).trim().length > 0
        }
        case 'positive': {
          const tgt = getInteractionEl(meta)
          const input = tgt?.matches('input') ? (tgt as HTMLInputElement)
            : tgt?.querySelector<HTMLInputElement>('input') ?? null
          return !!input && Number(input.value) > 0
        }
        case 'modal':    return !!getOpenAppModal()
        case 'no-modal': return !getOpenAppModal()
        case 'sim':      return simConfirmedRef.current
        default:         return true
      }
    })())
    const el = getInteractionEl(meta)

    // Compute base rect: use active cycling field if available, else primary target.
    let baseRect: DOMRect | null = null
    if (meta?.advance === 'next' && el) {
      const fields = getCycleFields(el)
      if (fields.length > 0) {
        const active = fields[Math.min(fieldIndex, fields.length - 1)]
        const r = active.getBoundingClientRect()
        if (r.width >= 2 && r.height >= 2) baseRect = r
      }
    }
    if (!baseRect) baseRect = measureOnboardingTarget(meta)

    // Expand ring to cover visible extra-target subtrees (e.g. interval/weekdays).
    if (meta?.extraTargets?.length && baseRect) {
      const extras = meta.extraTargets
        .map(s => document.querySelector<HTMLElement>(s))
        .filter((e): e is HTMLElement => !!e)
        .map(e => e.getBoundingClientRect())
        .filter(r => r.width >= 2 && r.height >= 2)
      if (extras.length > 0) {
        const all = [baseRect, ...extras]
        const l  = Math.min(...all.map(r => r.left))
        const t  = Math.min(...all.map(r => r.top))
        const ri = Math.max(...all.map(r => r.right))
        const b  = Math.max(...all.map(r => r.bottom))
        setTargetRect(new DOMRect(l, t, ri - l, b - t))
        return
      }
    }
    setTargetRect(baseRect)
  }, [meta, fieldIndex, getCycleFields])

  // Reset per-step gating on step change (precondition steps start dimmed)
  useEffect(() => {
    setFieldIndex(0)
    simConfirmedRef.current = false
    setSimPhase('card')
    const now = new Date()
    setSimTime(`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`)
    setCanAdvance(!meta?.precondition)
  }, [step, meta?.precondition])

  useEffect(() => {
    cleanupRef.current?.()
    cleanupRef.current = null
    setTargetRect(null)

    if (!active || needsLanguagePick || !meta) return

    const el = getInteractionEl(meta)

    if (meta.scrollTarget && el) {
      requestAnimationFrame(() => {
        el.scrollIntoView({ block: 'center', behavior: 'smooth', inline: 'nearest' })
        window.setTimeout(measureTarget, 350)
      })
    } else {
      measureTarget()
    }

    const poll = window.setInterval(measureTarget, 100)
    const stopPoll = window.setTimeout(() => clearInterval(poll), 10000)

    const onLayout = () => measureTarget()
    window.addEventListener('resize', onLayout)
    window.addEventListener('scroll', onLayout, true)
    // Recompute on every keystroke/select change so requireFilled gating is live
    // (independent of the 100ms poll window which stops after 10s).
    document.addEventListener('input', onLayout, true)
    document.addEventListener('change', onLayout, true)
    const modalEl = el?.closest('[data-app-modal]')
    modalEl?.addEventListener('scroll', onLayout, true)

    return () => {
      clearInterval(poll)
      clearTimeout(stopPoll)
      window.removeEventListener('resize', onLayout)
      window.removeEventListener('scroll', onLayout, true)
      document.removeEventListener('input', onLayout, true)
      document.removeEventListener('change', onLayout, true)
      modalEl?.removeEventListener('scroll', onLayout, true)
    }
  }, [step, active, needsLanguagePick, meta, measureTarget])

  // Clicking the designated target auto-advances — same as pressing "Weiter".
  // This makes tapping the highlighted element feel natural, while "Weiter"
  // still lights up as a visible backup once the precondition is met.
  useEffect(() => {
    cleanupRef.current?.()
    cleanupRef.current = null
    if (!active || needsLanguagePick) return

    let fired = false
    const delegated = (e: Event) => {
      if (fired) return
      const target = getInteractionEl(meta)
      if (!target) return
      // Only auto-advance for action steps (navigate / open modal / save).
      // For 'next' steps (field explanations) the user must press "Weiter".
      if (meta?.advance !== 'click') return
      if (target === e.target || target.contains(e.target as Node)) {
        fired = true
        window.setTimeout(() => {
          // Re-measure so canAdvance is current, then advance
          measureTarget()
          window.setTimeout(() => nextRef.current(), 20)
        }, 80)
      }
    }
    document.addEventListener('click', delegated, true)
    cleanupRef.current = () => document.removeEventListener('click', delegated, true)
    return () => {
      cleanupRef.current?.()
      cleanupRef.current = null
    }
  }, [step, active, needsLanguagePick, meta, measureTarget])


  // Auto-skip optional steps whose target never appears.
  useEffect(() => {
    if (!active || needsLanguagePick || !meta?.optionalTarget) return
    const id = window.setTimeout(() => {
      if (!getInteractionEl(meta)) nextRef.current()
    }, 1100)
    return () => clearTimeout(id)
  }, [step, active, needsLanguagePick, meta])

  useEffect(() => {
    if (!active || needsLanguagePick || !showSpotlight) return
    const el = getInteractionEl(meta)
    if (!el) return
    el.setAttribute('data-ob-active', '')
    return () => el.removeAttribute('data-ob-active')
  }, [step, active, needsLanguagePick, meta, showSpotlight])


  useEffect(() => {
    if (!active || needsLanguagePick) return
    const block = (e: Event) => {
      const node = e.target
      if (isPanelNode(node)) return
      if (node instanceof Element && node.closest('[data-ob-confirm]')) return
      // Use clickSelector element if available, otherwise targetSelector.
      const interactionRoot = meta?.clickSelector
        ? document.querySelector<HTMLElement>(meta.clickSelector)
        : getOnboardingInteractionEl(meta)
      if (interactionRoot && node instanceof Node && interactionRoot.contains(node)) return
      // Allow clicks inside extra-target subtrees (e.g. interval + weekdays at freq step)
      if (meta?.extraTargets && node instanceof Element) {
        const inside = meta.extraTargets.some(sel => {
          const el = document.querySelector(sel)
          return el ? el.contains(node) : false
        })
        if (inside) return
      }
      e.preventDefault()
      e.stopPropagation()
    }
    document.addEventListener('click', block, true)
    document.addEventListener('pointerdown', block, true)
    return () => {
      document.removeEventListener('click', block, true)
      document.removeEventListener('pointerdown', block, true)
    }
  }, [step, active, needsLanguagePick, meta])

  useLayoutEffect(() => {
    const el = panelRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setPanelH(el.offsetHeight))
    ro.observe(el)
    setPanelH(el.offsetHeight)
    return () => ro.disconnect()
  }, [step, s?.title, s?.description, s?.tapHint, showSpotlight, useCenteredCallout])

  useLayoutEffect(() => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const hole = showSpotlight ? targetRect : null

    if (useCenteredCallout) {
      let snap: 'top' | 'bottom' | undefined = meta?.snapToViewport
      if (snap === undefined && isModalTarget) {
        // Put the card in the OPPOSITE half of the viewport from the highlighted
        // target so it never covers it. Use the active cycling field if present,
        // otherwise the target rect itself (e.g. badge/button targets with no input).
        const el = getInteractionEl(meta)
        const fields = getCycleFields(el)
        const currentField = fields[Math.min(fieldIndex, fields.length - 1)] ?? null
        const rect = currentField?.getBoundingClientRect() ?? targetRect
        const targetCenter = rect ? rect.top + rect.height / 2 : vh / 2
        snap = targetCenter < vh / 2 ? 'bottom' : 'top'
      }
      setLayout(computeCalloutLayout(null, vw, vh, panelH, { prefer: 'center', snap }))
      return
    }

    // When the sim confirmation sheet is open, snap callout to top so it
    // doesn't overlap the bottom sheet content.
    if (meta?.id === 'sim-confirm' && simPhase === 'sheet') {
      setLayout(computeCalloutLayout(null, vw, vh, panelH, { prefer: 'center', snap: 'top' }))
      return
    }

    const prefer =
      meta?.placement === 'top' ? 'top' : meta?.placement === 'bottom' ? 'bottom' : 'auto'
    const maxBottom = hole ? hole.top - 12 : undefined
    setLayout(
      computeCalloutLayout(hole, vw, vh, panelH, { prefer, maxBottom }),
    )
  }, [targetRect, panelH, step, useCenteredCallout, showSpotlight, meta?.placement, meta?.snapToViewport, isModalTarget, fieldIndex, getCycleFields, viewportKey, simPhase, meta?.id])

  if (!active || needsLanguagePick || !s) return null

  const panelStyle: CSSProperties = {
    position: 'fixed',
    zIndex: OB_Z.panel,
    top: layout.top,
    left: layout.left,
    width: layout.width,
    pointerEvents: 'auto',
  }

  const scrimLayer = <SpotlightScrim hole={showSpotlight ? targetRect : null} />

  const calloutLayer = (
    <div
      id="ob-callout"
      ref={panelRef}
      className={`ob-callout-card ob-callout-panel ${useCenteredCallout ? 'ob-callout-center' : 'ob-callout-anchored'}`}
      style={panelStyle}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ob-callout-title"
    >
      {!useCenteredCallout && (
        <CalloutArrow placement={layout.placement} left={layout.arrowLeft} />
      )}

      <div key={step} className="ob-step-enter">
        <div className="ob-callout-header">
          <span className="ob-step-badge">{progressLabel}</span>
          <button type="button" onClick={skip} className="ob-callout-close" aria-label={t('skip')}>
            <X size={16} />
          </button>
        </div>

        <div className={`ob-callout-main ${useCenteredCallout ? 'ob-callout-main--center' : ''}`}>
          <div className="ob-callout-title-row">
            <span className="ob-emoji-glow text-xl leading-none" aria-hidden>
              {s.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p className="ob-callout-kicker">{s.subtitle}</p>
              <p id="ob-callout-title" className="ob-callout-title">
                {s.title}
              </p>
            </div>
          </div>

          <p className="ob-callout-body whitespace-pre-line">
            {meta?.id === 'sim-confirm' && simPhase === 'sheet'
              ? t('obx_sim_sheet_callout_desc')
              : s.description}
          </p>

          {s.advance === 'click' && showSpotlight && (
            <p className="ob-tap-cue">{s.tapHint ?? t('ob_tap_highlight')}</p>
          )}

          {wantsTarget && !showSpotlight && !getInteractionEl(meta) && (
            <p className="ob-waiting-hint">{t('ob_waiting_target')}</p>
          )}
        </div>

        <div className="ob-callout-actions">
          <button
            type="button"
            onClick={() => { if (!isFirst) prev() }}
            data-app-back-close
            {...denyProps(isFirst)}
            className="ob-nav-btn"
            aria-label={t('back')}
            style={{ width: 'auto', padding: '0 12px', gap: 5 }}
          >
            <ChevronLeft size={16} /> {t('back')}
          </button>
          {/* "Weiter" exists on every step but stays dimmed until the step's
              precondition (canAdvance) is met, then lights up. */}
          <button
            type="button"
            onClick={() => { if (canAdvance) nextRef.current() }}
            {...denyProps(!canAdvance)}
            className="ob-primary-btn flex-1 justify-center"
            style={{ opacity: canAdvance ? 1 : 0.4, cursor: canAdvance ? 'pointer' : 'not-allowed' }}
          >
            {isLast ? t('finish') : t('next')}
            <ChevronRight size={14} />
          </button>
        </div>

        {isFirst && (
          <button type="button" onClick={skip} className="ob-skip-tour-link">
            {t('ob_skip_tour')}
          </button>
        )}
        {isLast && <p className="ob-profile-hint">{t('ob_profile_hint')}</p>}
      </div>
    </div>
  )

  const simConfirm = meta?.id === 'sim-confirm' ? createPortal(
    <>
      {/* ── Amber "Noch fällig" card — matches real calendar style ── */}
      {simPhase !== 'done' && (
        <div style={{
          position:'fixed', left:12, right:12,
          bottom:'calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 16px)',
          zIndex: OB_Z.panel - 2,
          background:'rgba(245,158,11,0.10)', border:'1px solid rgba(245,158,11,0.32)',
          borderRadius:18, padding:'14px 16px',
          boxShadow:'0 12px 40px rgba(0,0,0,0.45)',
          display:'flex', alignItems:'center', gap:12,
        }}>
          <div style={{ flex:1, minWidth:0 }}>
            <p style={{ fontSize:'0.62rem', fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase', color:'#f59e0b' }}>
              {t('obx_sim_kicker')}
            </p>
            <p style={{ fontSize:'0.88rem', fontWeight:800, color:'var(--text)' }}>{t('obx_sim_substance')}</p>
            <p style={{ fontSize:'0.7rem', color:'#d97706', fontWeight:600 }}>{t('obx_sim_time')}</p>
          </div>
          <button type="button" data-ob="ob-sim-confirm" data-ob-confirm
            onClick={() => setSimPhase('sheet')}
            style={{ flexShrink:0, padding:'10px 16px', borderRadius:12, border:'none',
              background:'linear-gradient(135deg,#f59e0b,#d97706)',
              color:'#07091a', fontWeight:800, fontSize:'0.85rem', cursor:'pointer',
              display:'inline-flex', alignItems:'center', gap:6 }}>
            <Check size={16} />{t('obx_sim_btn')}
          </button>
        </div>
      )}

      {/* ── Mock confirmation sheet (matches real Dashboard confirmSheet) ── */}
      {simPhase === 'sheet' && (
        <>
          <div style={{ position:'fixed', inset:0, zIndex: OB_Z.panel - 1, background:'rgba(0,0,0,0.60)' }} />
          <div style={{
            position:'fixed', bottom:0, left:0, right:0, zIndex: OB_Z.panel - 1,
            borderRadius:'24px 24px 0 0', border:'1px solid var(--border)',
            paddingBottom:'calc(24px + env(safe-area-inset-bottom, 0px))', background:'var(--surface)',
          }}>
            <div style={{ padding:'20px 18px 0' }}>
              <div style={{ margin:'0 auto 20px', height:4, width:40, borderRadius:2, background:'var(--border)' }} />
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                <Check size={15} color="#10b981" />
                <h2 style={{ fontSize:'1rem', fontWeight:900, color:'var(--text)' }}>{t('obx_sim_sheet_title')}</h2>
              </div>
              <p style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginBottom:20 }}>{t('obx_sim_sheet_hint')}</p>
              <label style={{ fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--text-muted)', display:'block', marginBottom:6 }}>
                {t('uhrzeit_label', { defaultValue: 'Uhrzeit' })}
              </label>
              <input type="time" value={simTime} onChange={e => setSimTime(e.target.value)}
                className="input"
                style={{ marginBottom:6, fontWeight:700, colorScheme:'inherit' }} />
              <p style={{ fontSize:'0.68rem', color:'var(--text-muted)', marginBottom:20, lineHeight:1.4 }}>
                {t('obx_sim_time_hint', { defaultValue: 'Passe die Uhrzeit an falls nötig — sie wird vorausgefüllt mit der geplanten Einnahmezeit.' })}
              </p>
              <div style={{ display:'flex', gap:12 }}>
                <button type="button" data-ob-confirm
                  onClick={() => setSimPhase('card')}
                  className="btn-secondary" style={{ flex:1 }}>
                  {t('obx_sim_sheet_cancel')}
                </button>
                <button type="button" data-ob="ob-sim-confirm" data-ob-confirm
                  onClick={() => { simConfirmedRef.current = true; setCanAdvance(true); setSimPhase('done') }}
                  className="btn-primary" style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                  <Check size={14} />{t('obx_sim_sheet_btn')}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Done state: green confirmation ── */}
      {simPhase === 'done' && (
        <div style={{
          position:'fixed', left:12, right:12,
          bottom:'calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 16px)',
          zIndex: OB_Z.panel - 2,
          background:'rgba(16,185,129,0.12)', border:'1px solid rgba(16,185,129,0.30)',
          borderRadius:18, padding:'14px 16px',
          display:'flex', alignItems:'center', gap:12,
        }}>
          <Check size={22} color="#10b981" />
          <div>
            <p style={{ fontSize:'0.82rem', fontWeight:800, color:'#10b981' }}>{t('einnahme_bestaetigt', { defaultValue: 'Einnahme bestätigt' })}</p>
            <p style={{ fontSize:'0.7rem', color:'var(--text-muted)' }}>{t('obx_sim_substance')} · {simTime}</p>
          </div>
        </div>
      )}
    </>, document.body) : null

  return (
    <>
      {createPortal(scrimLayer, document.body)}
      {simConfirm}
      {createPortal(calloutLayer, document.body)}
    </>
  )
}

export function OnboardingRestartButton() {
  const { restart } = useOnboarding()
  const navigate = useNavigate()
  const { t } = useTranslation()

  return (
    <button
      type="button"
      onClick={() => {
        restart()
        navigate('/')
      }}
      className="ob-restart-btn"
    >
      <RotateCcw size={15} />
      {t('ob_restart')}
    </button>
  )
}
