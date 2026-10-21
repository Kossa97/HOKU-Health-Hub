import { useCallback, useEffect, useRef, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

const EDGE_WIDTH_PX = 24
const MIN_SWIPE_PX = 72
const HORIZONTAL_DOMINANCE = 1.25
const MODAL_SELECTOR = '[data-app-modal], [role="dialog"][aria-modal="true"]'

interface GestureStart {
  pointerId: number
  x: number
  y: number
}

function modalRoot(element: Element): HTMLElement | null {
  const appModal = element.closest<HTMLElement>('[data-app-modal]')
  if (appModal) return appModal
  const semanticDialog = element.closest<HTMLElement>('[role="dialog"][aria-modal="true"]')
  if (semanticDialog) return semanticDialog
  return element instanceof HTMLElement ? element : null
}

function topmostModal(): HTMLElement | null {
  const unique = new Set<HTMLElement>()
  document.querySelectorAll<HTMLElement>(MODAL_SELECTOR).forEach(element => {
    const root = modalRoot(element)
    if (root && !root.hidden && root.getAttribute('aria-hidden') !== 'true') unique.add(root)
  })

  return [...unique]
    .map((element, order) => ({
      element,
      order,
      zIndex: Number.parseInt(window.getComputedStyle(element).zIndex, 10) || 0,
    }))
    .sort((a, b) => a.zIndex - b.zIndex || a.order - b.order)
    .at(-1)?.element ?? null
}

function isBackSwipe(start: GestureStart, event: PointerEvent): boolean {
  const dx = event.clientX - start.x
  const dy = event.clientY - start.y
  return dx >= MIN_SWIPE_PX && dx > Math.abs(dy) * HORIZONTAL_DOMINANCE
}

export function AppBackNavigation({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const gesture = useRef<GestureStart | null>(null)
  const dirtyModals = useRef(new WeakSet<HTMLElement>())

  const requestBack = useCallback(() => {
    const modal = topmostModal()
    if (modal) {
      // data-app-back-self-confirm: das Fenster fragt beim Schliessen selbst
      // nach (eigenes Sheet) — dann kein zweites Browser-Fenster davor.
      if (dirtyModals.current.has(modal) && !modal.hasAttribute('data-app-back-self-confirm')) {
        const german = (document.documentElement.lang || navigator.language || 'de').toLowerCase().startsWith('de')
        const confirmed = window.confirm(german
          ? 'Ungespeicherte Änderungen verwerfen?'
          : 'Discard unsaved changes?')
        if (!confirmed) return
      }

      const closeControl = modal.matches('[data-app-back-close]')
        ? modal
        : modal.querySelector<HTMLElement>('[data-app-back-close]')
      if (closeControl) {
        // Ein gesperrter Schliessen-Knopf (aria-disabled) schliesst nicht —
        // die Geste tut dann nichts, statt ihn rot wackeln zu lassen.
        if (closeControl.getAttribute('aria-disabled') !== 'true') closeControl.click()
        return
      }

      const dialog = modal.matches('[role="dialog"]')
        ? modal
        : modal.querySelector<HTMLElement>('[role="dialog"]') ?? modal
      dialog.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        bubbles: true,
        cancelable: true,
      }))
      return
    }

    // Seiten ohne Leiste (Ernährung) haben einen eigenen Schließen-Knopf: die Geste löst ihn aus —
    // so schließt sie auch, wenn man direkt dort eingestiegen ist.
    const pageClose = document.querySelector<HTMLElement>('[data-app-page-close]')
    if (pageClose) {
      pageClose.click()
      return
    }

    if (location.pathname === '/' || location.pathname === '/auth') return
    const historyIndex = window.history.state?.idx
    if (typeof historyIndex === 'number' && historyIndex <= 0) return
    navigate(-1)
  }, [location.pathname, navigate])

  useEffect(() => {
    const markDirty = (event: Event) => {
      if (!(event.target instanceof Element)) return
      const root = modalRoot(event.target)
      if (root) dirtyModals.current.add(root)
    }
    const markInteractionDirty = (event: Event) => {
      if (!(event.target instanceof Element) || event.target.closest('[data-app-back-close]')) return
      const root = modalRoot(event.target)
      if (root?.hasAttribute('data-app-back-dirty-on-interaction')) dirtyModals.current.add(root)
    }
    document.addEventListener('input', markDirty, true)
    document.addEventListener('change', markDirty, true)
    document.addEventListener('click', markInteractionDirty, true)
    return () => {
      document.removeEventListener('input', markDirty, true)
      document.removeEventListener('change', markDirty, true)
      document.removeEventListener('click', markInteractionDirty, true)
    }
  }, [])

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' || event.clientX > EDGE_WIDTH_PX) return
      gesture.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
    }
    const onPointerUp = (event: PointerEvent) => {
      const start = gesture.current
      gesture.current = null
      if (!start || event.pointerId !== start.pointerId || !isBackSwipe(start, event)) return
      requestBack()
    }
    const cancel = () => { gesture.current = null }

    window.addEventListener('pointerdown', onPointerDown, { passive: true })
    window.addEventListener('pointerup', onPointerUp, { passive: true })
    window.addEventListener('pointercancel', cancel, { passive: true })
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', cancel)
    }
  }, [requestBack])

  return children
}
