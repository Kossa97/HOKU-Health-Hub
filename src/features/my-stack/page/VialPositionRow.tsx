import type { CSSProperties } from 'react'
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/**
 * Wo bin ich. Bei 70 % Breite sind die Nachbarn nur noch
 * angeschnitten — ohne diese Zeile wuesste niemand, ob nach
 * dem dritten Wisch noch fuenf kommen oder einer. Vorn steht
 * ein „+" fuer die „Neu"-Kachel: sie liegt links von der
 * ersten Substanz, und ohne diesen Hinweis sucht sie dort
 * niemand. Bis zu sieben Substanzen als Punkte, darueber eine
 * Leiste, weil fuenfzehn Punkte niemand mehr zaehlt.
 * Die Zeile ist immer gleich hoch (h-2.5): Punkte, Leiste
 * oder „+" duerfen die Buehne darueber nicht groesser oder
 * kleiner machen. Die Knoepfe sind 24 px hoch und ragen per
 * negativem Rand ueber die Zeile hinaus — gross genug zum
 * Treffen, ohne die Zeile zu strecken.
 */
export function VialPositionRow({ stagePeptides, activeIndex, addTileActive, selectAddTile, selectPeptideIndex }: {
  stagePeptides: readonly { id: string; name: string }[]
  activeIndex: number
  addTileActive: boolean
  selectAddTile: () => void
  selectPeptideIndex: (index: number) => void
}) {
  const { t } = useTranslation()
  return (
    <div data-vial-position className="mb-2 mt-1 flex h-2.5 shrink-0 items-center justify-center">
      <div className="relative flex items-center">
      <button
        type="button"
        onClick={selectAddTile}
        aria-label={String(t('my_stack_go_to_add_tile', { defaultValue: 'Zur Kachel „Neue Substanz“' }))}
        aria-current={addTileActive || undefined}
        data-vial-add-dot
        className="-my-[7px] flex h-6 min-w-6 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      >
        <span className={`flex h-4 w-4 items-center justify-center rounded-full transition-colors duration-300 ${
          addTileActive ? 'bg-[var(--lg-text)] text-black' : 'bg-white/[0.16] text-[var(--lg-text-2)]'
        }`}>
          <Plus size={11} strokeWidth={2.6} aria-hidden="true" />
        </span>
      </button>
      {stagePeptides.length <= 7 ? stagePeptides.map((p, index) => {
        const aktuell = !addTileActive && index === activeIndex
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => selectPeptideIndex(index)}
            aria-label={String(t('my_stack_go_to_item', { defaultValue: 'Zu {{name}}', name: p.name }))}
            aria-current={aktuell || undefined}
            data-vial-dot={index}
            className="-my-[7px] flex h-6 min-w-5 items-center justify-center rounded-full px-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            <span className="stack-dot" data-on={aktuell} />
          </button>
        )
      }) : (
        <div className="ml-1.5 h-1 w-24 overflow-hidden rounded-full bg-white/[0.16]">
          {/* Verschoben per transform (eigene Breite × Position), nicht per
              Rand — so laeuft die Leiste auf dem Compositor. */}
          <div
            className={`h-full rounded-full transition-[transform,background-color] duration-300 [transform:translateX(calc(var(--pos)*100%))] rtl:[transform:translateX(calc(var(--pos)*-100%))] ${addTileActive ? 'bg-white/30' : 'bg-[var(--lg-text)]'}`}
            style={{
              width: `${100 / stagePeptides.length}%`,
              '--pos': activeIndex,
            } as CSSProperties}
          />
        </div>
      )}
      {/* „2 / 5" gehoert zur Position, nicht zur Haltbarkeit: hier unten
          bricht es nie um, oben schob ein langer Hinweis („Seit 8 Tagen
          abgelaufen!") die Zaehlung in eine eigene Zeile. */}
      {/* Absolut daneben: die Punkte bleiben mittig unter der Buehne und
          springen nicht, wenn die Zaehlung bei der „Neu"-Kachel verschwindet. */}
      {!addTileActive && stagePeptides.length > 0 && (
        <span data-vial-counter className="absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap font-mono text-[11px] leading-none tabular-nums text-[var(--lg-text-3)]">
          {activeIndex + 1} / {stagePeptides.length}
        </span>
      )}
      </div>
    </div>
  )
}
