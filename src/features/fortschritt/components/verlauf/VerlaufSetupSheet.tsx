import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import { useScrollLock } from '../../hooks/useScrollLock'
import { useSheetPresence } from '../../hooks/useSheetPresence'

const SHEET_Z = 10050

/** Volldeckend — var(--surface) ist im Dark-Theme halbtransparent. */
const SHEET_BG = 'var(--app-bg)'

interface Props {
  open: boolean
  onClose: () => void
  children: ReactNode
}

export function VerlaufSetupSheet({ open, onClose, children }: Props) {
  const { t } = useTranslation()
  const { mounted, shown } = useSheetPresence(open)
  // Gesperrt bis das Sheet ganz hinausgefahren ist, nicht nur bis zum Schließen.
  useScrollLock(mounted)

  if (!mounted) return null

  return createPortal(
    <div
      data-app-modal
      data-shown={shown}
      inert={!open}
      className="fs-sheet"
      role="dialog"
      aria-modal="true"
      aria-label={t('fortschritt_setup_title')}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: SHEET_Z,
        display: 'flex',
        flexDirection: 'column',
        background: SHEET_BG,
        width: '100%',
        maxWidth: '100vw',
        minHeight: '100dvh',
        overflow: 'hidden',
        overscrollBehavior: 'none',
        touchAction: 'manipulation',
      }}
    >
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: 'max(12px, env(safe-area-inset-top)) 16px 12px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <h2 style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--text)' }}>
          {t('fortschritt_setup_title')}
        </h2>
        <button
          type="button"
          onClick={onClose}
          data-app-back-close
          aria-label={t('close')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            borderRadius: 10,
            border: '1px solid var(--border)',
            background: 'var(--surface-input)',
            color: 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          <X size={18} />
        </button>
      </header>

      <div style={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain',
        padding: '14px 16px max(20px, env(safe-area-inset-bottom))',
      }}>
        {children}
      </div>

      <footer style={{
        flexShrink: 0,
        padding: '12px 16px max(16px, env(safe-area-inset-bottom))',
        borderTop: '1px solid var(--border)',
        background: SHEET_BG,
      }}>
        <button
          type="button"
          className="btn-primary"
          onClick={onClose}
          style={{ width: '100%' }}
        >
          {t('fortschritt_setup_done')}
        </button>
      </footer>
    </div>,
    document.body,
  )
}
