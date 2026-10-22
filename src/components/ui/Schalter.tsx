/** iOS-Schalter (nur die Optik; Rolle und Zustand trägt der Knopf drumherum) */
export function Schalter({ an }: { an: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{
        position: 'relative', display: 'block', width: 51, height: 31, borderRadius: 16, flexShrink: 0,
        background: an ? 'var(--lg-good)' : 'rgba(120,120,128,0.32)',
        transition: 'background-color 200ms ease',
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: 2, width: 27, height: 27, borderRadius: '50%',
        background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
        // transform statt left: gleitet ohne Layout je Frame
        transform: an ? 'translateX(20px)' : 'none',
        transition: 'transform 260ms var(--lg-ease-out)',
      }} />
    </span>
  )
}
