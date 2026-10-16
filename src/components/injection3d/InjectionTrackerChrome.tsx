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
        style={{
          width: 44, height: 44, borderRadius: 14, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: overlay ? 'rgba(8,13,26,0.72)' : 'var(--surface)',
          border: '1px solid var(--border)',
          backdropFilter: overlay ? 'blur(16px)' : undefined,
          WebkitBackdropFilter: overlay ? 'blur(16px)' : undefined,
          pointerEvents: overlay ? 'auto' : undefined,
          color: 'var(--text-dim)',
        }}
      >
        <ArrowLeft size={16} />
      </button>
      <div style={{ flex: 1 }}>
        <p style={{
          fontSize: '0.62rem', fontWeight: 800, letterSpacing: 0,
          textTransform: 'uppercase', color: 'var(--accent)',
          textShadow: overlay ? '0 2px 12px rgba(0,0,0,0.75)' : undefined,
        }}>
          {t('injection_pro_title', { defaultValue: 'Injektionstracker Pro' })}
        </p>
        <h1 style={{ fontSize: '1.32rem', fontWeight: 900, color: 'var(--text)', letterSpacing: 0, lineHeight: 1.1, textShadow: overlay ? '0 2px 14px rgba(0,0,0,0.8)' : undefined }}>
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
    <div role="alert" style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 22,
      padding: 22,
      textAlign: 'center',
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: 18,
        background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 14px',
      }}>
        <AlertTriangle size={22} color="#f59e0b" aria-hidden="true" />
      </div>
      <h2 style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--text)', marginBottom: hint ? 8 : 18 }}>{title}</h2>
      {hint && (
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 18 }}>{hint}</p>
      )}
      <button type="button" className="btn-secondary min-h-11 w-full" onClick={onRetry}>
        <RefreshCw size={14} aria-hidden="true" /> {t('routine_confirmation_retry', { defaultValue: 'Erneut versuchen' })}
      </button>
    </div>
  )
}
