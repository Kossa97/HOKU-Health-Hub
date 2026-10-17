import type { ReactNode } from 'react'

/**
 * Unteres Sheet fuer Melden, Blockieren, Konto loeschen und Rechtstexte.
 * Schwebendes Glas-Sheet wie in iOS (.lg-sheet); Escape und Tippen auf
 * den Hintergrund schliessen, ausser waehrend etwas laeuft.
 */
export function Sheet({ labelledBy, busy = false, onClose, children, role = 'dialog', tall = false, ...data }: {
  labelledBy: string
  busy?: boolean
  onClose: () => void
  children: ReactNode
  role?: 'dialog' | 'alertdialog'
  tall?: boolean
} & Record<`data-${string}`, boolean | string>) {
  return (
    <div
      data-app-modal
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-10"
      onClick={event => {
        // Nicht nach oben durchreichen: liegt das Sheet in einem anderen
        // Dialog, schloesse der Klick sonst auch den.
        event.stopPropagation()
        if (!busy) onClose()
      }}
    >
      <div
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        {...data}
        className={`lg-sheet w-full max-w-md overflow-y-auto overscroll-contain px-5 pb-5 pt-2 ${tall ? 'max-h-[85vh]' : 'max-h-[90vh]'}`}
        onClick={event => event.stopPropagation()}
        onKeyDown={event => {
          if (event.key !== 'Escape' || busy) return
          event.stopPropagation()
          onClose()
        }}
      >
        <span className="lg-grabber mb-3" aria-hidden="true" />
        {children}
      </div>
    </div>
  )
}
