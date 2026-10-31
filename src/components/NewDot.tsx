/** Indicator dot for undiscovered features — steht still, nichts daran ist live. */
export function NewDot({ className = '' }: { className?: string }) {
  return (
    <span className={`relative flex h-2 w-2 shrink-0 ${className}`}>
      <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-400" />
    </span>
  )
}
