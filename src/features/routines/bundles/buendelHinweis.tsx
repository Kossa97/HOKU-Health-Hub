import toast from 'react-hot-toast'
import { AlertTriangle, Layers } from 'lucide-react'

/**
 * Ein Hinweis im Stil der App-Meldungen (dunkle Kapsel oben), mit Symbol, einer
 * zweiten Zeile und auf Wunsch „Rückgängig". Für alles, was beim Bündeln
 * passiert.
 */
export function buendelHinweis({ text, zusatz, art = 'info', rueckgaengig, rueckgaengigText }: {
  text: string
  zusatz?: string
  art?: 'info' | 'warnung'
  rueckgaengig?: () => void
  rueckgaengigText?: string
}) {
  return toast.custom(sichtbar => (
    <div
      role="status"
      data-buendel-hinweis
      className={`flex w-[min(440px,calc(100vw-32px))] items-center gap-3 rounded-[16px] bg-[#2c2c2e] py-2 pl-3 pr-2 text-[15px] text-white shadow-[0_8px_30px_rgba(0,0,0,0.5)] transition-[opacity,transform] duration-200 ${sichtbar.visible ? 'opacity-100' : '-translate-y-2 opacity-0'}`}
    >
      <span
        aria-hidden="true"
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${art === 'warnung'
          ? 'bg-[color-mix(in_srgb,var(--lg-warn)_18%,transparent)] text-[var(--lg-warn-text)]'
          : 'bg-white/10 text-white/70'}`}
      >
        {art === 'warnung' ? <AlertTriangle size={16} strokeWidth={1.5} /> : <Layers size={16} strokeWidth={1.5} />}
      </span>
      <span className="min-w-0 flex-1 leading-snug">
        <span className="block">{text}</span>
        {zusatz && <span className="block text-[13px] text-[var(--lg-text-3)]">{zusatz}</span>}
      </span>
      {rueckgaengig && (
        <button
          type="button"
          onClick={() => { toast.dismiss(sichtbar.id); rueckgaengig() }}
          className="tyd-press min-h-11 shrink-0 rounded-[10px] px-3 text-[15px] font-medium text-[var(--lg-accent-text)]"
        >
          {rueckgaengigText}
        </button>
      )}
    </div>
  ), { duration: rueckgaengig ? 5000 : 3200 })
}
