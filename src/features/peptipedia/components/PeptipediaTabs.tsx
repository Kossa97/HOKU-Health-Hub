import { useEffect, useRef } from 'react'
import type { PeptipediaLocale } from '../content/types'
import { PEPTIPEDIA_UI_COPY } from '../content/uiCopy'
import { peptipediaTabs, type PeptipediaMode, type PeptipediaTabId } from '../routing'

export function PeptipediaTabs({ locale, activeTab, onSelect, mode = 'public' }: {
  locale: PeptipediaLocale
  activeTab: PeptipediaTabId
  onSelect: (id: PeptipediaTabId) => void
  mode?: PeptipediaMode
}) {
  const tabs = peptipediaTabs(mode)
  const strip = useRef<HTMLDivElement>(null)
  const buttons = useRef<Partial<Record<PeptipediaTabId, HTMLButtonElement | null>>>({})
  useEffect(() => {
    const button = buttons.current[activeTab]
    const container = strip.current
    if (!button || !container) return
    if (button.offsetLeft < container.scrollLeft) container.scrollLeft = button.offsetLeft
    else if (button.offsetLeft + button.offsetWidth > container.scrollLeft + container.clientWidth) {
      container.scrollLeft = button.offsetLeft + button.offsetWidth - container.clientWidth
    }
  }, [activeTab])

  return (
    <div className={`sticky ${mode === 'public' ? 'top-14' : 'top-0'} z-20 -mx-1 bg-black px-1 py-1.5`}>
      <div ref={strip} role="tablist" aria-label={locale === 'de' ? 'Peptidinformationen' : 'Peptide information'}
        className="relative flex gap-0 overflow-x-auto rounded-full bg-[var(--lg-fill)] p-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((id, index) => (
          <button key={id} ref={button => { buttons.current[id] = button }} type="button" role="tab"
            id={`tab-${id}`} aria-controls={`panel-${id}`} aria-selected={activeTab === id}
            tabIndex={activeTab === id ? 0 : -1} onClick={() => onSelect(id)}
            onKeyDown={event => {
              let next: number | undefined
              if (event.key === 'ArrowRight') next = (index + 1) % tabs.length
              if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length
              if (event.key === 'Home') next = 0
              if (event.key === 'End') next = tabs.length - 1
              if (next === undefined) return
              event.preventDefault()
              const nextId = tabs[next]
              onSelect(nextId)
              buttons.current[nextId]?.focus({ preventScroll: true })
            }}
            className={`shrink-0 min-h-10 rounded-full px-4 text-[14px] font-semibold transition-colors duration-200 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--lg-accent)] focus-visible:-outline-offset-2 ${activeTab === id ? 'bg-[var(--lg-fill-selected)] text-[var(--lg-text)] shadow-[0_3px_8px_rgba(0,0,0,0.25)]' : 'text-[var(--lg-text-2)]'}`}>
            {PEPTIPEDIA_UI_COPY[locale].tabs[id]}
          </button>
        ))}
      </div>
    </div>
  )
}
