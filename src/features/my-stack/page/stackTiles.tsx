import { Plus } from 'lucide-react'

// Empty "ghost" vial that adds a new substance when clicked — nur noch im
// leeren Stack; im Karussell steht `AddStageTile`.
export function AddVialTile({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="group mx-auto flex w-20 flex-col items-center sm:w-24"
    >
      <div className="flex h-28 w-full flex-col items-center justify-center gap-1.5 rounded-2xl border-[1.5px] border-dashed border-white/25 bg-[rgba(28,28,30,0.72)] text-[var(--lg-text-3)] transition-colors group-hover:border-[rgba(100,210,255,0.6)] group-focus-visible:border-cyan-300/60 sm:h-36">
        <span className="lg-glass lg-icon-btn !h-9 !w-9 !text-[#64d2ff]">
          <Plus size={18} strokeWidth={2} />
        </span>
        <span className="px-2 text-center text-[11px] font-semibold leading-tight">{label}</span>
      </div>
    </button>
  )
}

// „Neue Substanz" im Karussell. Sie steht vor der ersten Substanz und ist
// so gross wie die Objekte daneben — als kleines Kaestchen in einem Platz
// fuer ein Vial sah man sie am Rand nicht, und niemand kam auf die Idee,
// nach links zu wischen. Die Zeile unter der Karte ist dieselbe wie bei den
// Objekten, damit alles auf einer Standlinie steht.
export function AddStageTile({ active, title, hint, onClick }: { active: boolean; title: string; hint: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={title}
      className="group flex h-full min-h-0 w-full flex-col items-center focus-visible:outline-none"
    >
      <span className="flex min-h-0 w-full flex-1 items-end justify-center">
        {/* Volle Breite und ein Schimmer am Rand: steht die erste Substanz
            in der Mitte, lugt von der Karte nur der rechte Rand herein. Der
            muss auffallen, sonst weiss niemand, dass links noch etwas ist. */}
        <span className={`flex h-[78%] w-full flex-col items-center justify-center gap-4 rounded-[2rem] border-[1.5px] border-dashed bg-[rgba(28,28,30,0.72)] px-5 text-center transition-[border-color,box-shadow] duration-300 group-focus-visible:border-cyan-300 ${
          active
            ? 'border-white/25'
            : 'border-[rgba(100,210,255,0.6)] shadow-[0_0_28px_rgba(0,204,245,0.18)]'
        }`}>
          {/* Der Plus-Kreis ist der Knopf: Glas, solange die Karte am Rand
              lugt, getöntes Glas, sobald sie in der Mitte steht. */}
          <span className={`lg-icon-btn !h-16 !w-16 ${active ? 'lg-btn-primary' : 'lg-glass !text-[#64d2ff]'}`}>
            <Plus size={30} strokeWidth={2} aria-hidden="true" />
          </span>
          <span className="text-xl font-bold leading-tight text-[var(--lg-text)]">{title}</span>
          <span className="text-[15px] leading-snug text-[var(--lg-text-3)]">{hint}</span>
        </span>
      </span>
      <span aria-hidden="true" className="mt-1 shrink-0 text-xs">{'\u00a0'}</span>
    </button>
  )
}
