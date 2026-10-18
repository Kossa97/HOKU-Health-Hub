// src/components/injection3d/InjectionTrackerChrome.tsx
//
// Kopf der Trackerseite und die Ansicht, wenn der Tracker nicht laedt.
import { useTranslation } from 'react-i18next'
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react'

export function InjectionTrackerHeader({ onBack, overlay = false }: { onBack: () => void; overlay?: boolean }) {
  const { t } = useTranslation()
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      ...(overlay ? {
        position: 'absolute',
        top: 'calc(16px + env(safe-area-inset-top))',
        left: 14,
        right: 14,
        zIndex: 25,
        pointerEvents: 'none',
      } : null),
    }}>
      <button
        onClick={onBack}
        aria-label={String(t('back', { defaultValue: 'Zurück' }))}
        className="lg-glass lg-icon-btn lg-press shrink-0"
        style={{ pointerEvents: overlay ? 'auto' : undefined }}
      >
        <ArrowLeft size={20} />
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: 13, fontWeight: 600,
          color: 'var(--lg-text-2)',
          textShadow: overlay ? '0 1px 10px rgba(0,0,0,0.8)' : undefined,
        }}>
          {t('injection_pro_title', { defaultValue: 'Injektionstracker Pro' })}
        </p>
        <h1 className="truncate" style={{ fontSize: 28, fontWeight: 700, lineHeight: '34px', letterSpacing: '0.013em', color: 'var(--lg-text)', textShadow: overlay ? '0 2px 14px rgba(0,0,0,0.8)' : undefined }}>
          {t('injection_map_title', { defaultValue: '3D Injektionskarte' })}
        </h1>
      </div>
    </div>
  )
}

// Ersetzt das fruehere Einrichtungs-SQL: Nutzer sehen nur, dass es gerade
// nicht geht, und koennen es erneut versuchen.
export function InjectionTrackerUnavailable({ title, hint, onRetry }: { title: string; hint?: string; onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <div role="alert" className="lg-surface" style={{ padding: 22, textAlign: 'center' }}>
      <div className="lg-icon-tile" style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--lg-warn)', margin: '0 auto 14px' }}>
        <AlertTriangle size={24} aria-hidden="true" />
      </div>
      <h2 className="lg-title2" style={{ marginBottom: hint ? 8 : 18 }}>{title}</h2>
      {hint && (
        <p style={{ fontSize: 15, color: 'var(--lg-text-3)', lineHeight: 1.5, marginBottom: 18 }}>{hint}</p>
      )}
      <button type="button" data-quiet className="lg-gray-btn min-h-11 w-full" onClick={onRetry}>
        <RefreshCw size={14} aria-hidden="true" /> {t('routine_confirmation_retry', { defaultValue: 'Erneut versuchen' })}
      </button>
    </div>
  )
}
