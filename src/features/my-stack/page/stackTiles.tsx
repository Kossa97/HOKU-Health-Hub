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
      <div className={`flex h-28 w-full flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-slate-600/55 bg-slate-900/25 text-slate-500 transition-colors group-hover:border-cyan-400/45 group-hover:text-cyan-200 group-focus-visible:border-cyan-300/60 sm:h-36`}>
        <span className={`flex h-9 w-9 items-center justify-center rounded-full border border-cyan-300/15 bg-cyan-300/[0.03] text-cyan-200 shadow-[0_0_22px_rgba(34,211,238,0.08)] transition-all duration-500 group-hover:border-cyan-300/35 group-hover:bg-cyan-300/10 group-hover:shadow-[0_0_30px_rgba(34,211,238,0.18)] group-focus-visible:border-cyan-300/45 group-focus-visible:bg-cyan-300/10 group-focus-visible:shadow-[0_0_30px_rgba(34,211,238,0.22)]`}>
          <Plus size={18} strokeWidth={1.45} />
        </span>
        <span className="px-2 text-center text-[10px] font-semibold leading-tight">{label}</span>
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
        <span className={`flex h-[78%] w-full flex-col items-center justify-center gap-4 rounded-[2rem] border-2 border-dashed px-5 text-center transition-[border-color,box-shadow] duration-300 group-focus-visible:border-cyan-300 ${
          active
            ? 'border-cyan-300/55 bg-[radial-gradient(ellipse_at_50%_40%,rgba(34,211,238,0.14),rgba(15,23,42,0.35)_70%)]'
            : 'border-cyan-300/60 bg-cyan-400/[0.05] shadow-[0_0_28px_rgba(34,211,238,0.22)]'
        }`}>
          <span className={`flex h-16 w-16 items-center justify-center rounded-full border text-cyan-200 transition-all duration-500 ${
            active
              ? 'border-cyan-300/50 bg-cyan-300/15 shadow-[0_0_40px_rgba(34,211,238,0.28)]'
              : 'border-cyan-300/25 bg-cyan-300/[0.06] shadow-[0_0_24px_rgba(34,211,238,0.12)]'
          }`}>
            <Plus size={30} strokeWidth={1.6} aria-hidden="true" />
          </span>
          <span className="text-lg font-bold leading-tight text-white">{title}</span>
          <span className="text-sm leading-snug text-slate-400">{hint}</span>
        </span>
      </span>
      <span aria-hidden="true" className="mt-1 shrink-0 text-xs">{'\u00a0'}</span>
    </button>
  )
}
