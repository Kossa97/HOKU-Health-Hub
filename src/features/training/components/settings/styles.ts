import type { CSSProperties } from 'react'

/** Gemeinsame Textstile der Einstellungen. */

export const hintStyle: CSSProperties = { fontSize: '0.8rem', lineHeight: 1.45, color: 'var(--text-muted)' }

export const noteStyle: CSSProperties = {
  fontSize: '0.82rem', lineHeight: 1.45, color: 'var(--text)',
  padding: '8px 10px', borderRadius: 12,
  background: 'var(--surface-raised)', border: '1px solid var(--border)',
}
