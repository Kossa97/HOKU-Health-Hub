// src/components/injection3d/InjectionTrackerChrome.tsx
//
// Kopf der Trackerseite und die Ansicht, wenn der Tracker nicht laedt.
import { useTranslation } from 'react-i18next'
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react'

export function InjectionTrackerHeader({ onBack, overlay = false }: { onBack: () => void; overlay?: boolean }) {
  const { t } = useTranslation()
  // Ueber der Karte liest sich weisse Schrift auch auf heller Haut: ein weicher
  // Verlauf ueber die volle Breite statt eines Textschattens. Ein grosser
  // Schatten wuerde von `truncate` an der Textbox abgeschnitten und stuende
  // als dunkles Rechteck hinter der Ueberschrift.
  const textShadow = overlay ? '0 1px 2px rgba(0,0,0,0.45)' : undefined
  return (
    <>
    {overlay && (
      <div aria-hidden="true" style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 'calc(120px + env(safe-area-inset-top))',
        zIndex: 24,
        pointerEvents: 'none',
        background: 'linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.22) 55%, rgba(0,0,0,0))',
      }} />
    )}
    <div data-injection-cover={overlay ? 'top' : undefined} style={{
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
          fontSize: 13, fontWeight: 500,
          color: 'var(--lg-text-2)',
          textShadow,
        }}>
          {t('injection_pro_title', { defaultValue: 'Injektionstracker Pro' })}
        </p>
        <h1 className="truncate" style={{ fontSize: 28, fontWeight: 500, lineHeight: '34px', letterSpacing: '-0.01em', color: 'var(--lg-text)', textShadow }}>
          {t('injection_map_title', { defaultValue: '3D Injektionskarte' })}
        </h1>
      </div>
    </div>
    </>
  )
}

// Ersetzt das fruehere Einrichtungs-SQL: Nutzer sehen nur, dass es gerade
// nicht geht, und koennen es erneut versuchen.
export function InjectionTrackerUnavailable({ title, hint, onRetry }: { title: string; hint?: string; onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <div role="alert" className="lg-surface" style={{ padding: 24, textAlign: 'center' }}>
      <div className="lg-icon-tile" style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--lg-warn)', margin: '0 auto 14px' }}>
        <AlertTriangle size={24} aria-hidden="true" />
      </div>
      <h2 className="lg-title2" style={{ marginBottom: hint ? 8 : 20 }}>{title}</h2>
      {hint && (
        <p style={{ fontSize: 15, color: 'var(--lg-text-3)', lineHeight: 1.5, marginBottom: 20 }}>{hint}</p>
      )}
      <button type="button" data-quiet className="lg-gray-btn min-h-11 w-full" onClick={onRetry}>
        <RefreshCw size={14} aria-hidden="true" /> {t('routine_confirmation_retry', { defaultValue: 'Erneut versuchen' })}
      </button>
    </div>
  )
}
