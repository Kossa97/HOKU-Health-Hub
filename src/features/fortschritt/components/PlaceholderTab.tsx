import { panel } from '../styles'

export function PlaceholderTab({ title, description }: { title: string; description: string }) {
  return (
    <section style={{ ...panel, padding: '32px 20px', textAlign: 'center' }}>
      <h2 style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-dim)', marginBottom: 8 }}>{title}</h2>
      <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', lineHeight: 1.5 }}>
        {description}
      </p>
    </section>
  )
}
