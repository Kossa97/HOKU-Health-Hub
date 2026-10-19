import { CalendarDays, FlaskConical, Home, Plus, User } from 'lucide-react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { hapticTick } from '../../lib/haptics'
import { TAB_ITEMS, resolveActiveTabId, type TabId } from './tabModel'
import { LiquidGlassTabBar, type GlassTabItem } from './LiquidGlassTabBar'

/**
 * Die Naht zwischen Navigation und Darstellung.
 *
 * Oben kommt herein, wo man ist und was der Plus-Knopf tun soll;
 * unten geht hinaus, was der Bildschirm zeigt. Dazwischen steht diese Datei —
 * und sie ist die EINZIGE Stelle, die geaendert werden muss, wenn im nativen
 * iOS-Bau Apples echte Tab-Bar an die Stelle der Web-Nachbildung tritt:
 * `LiquidGlassTabBar` austauschen, Modell und Router bleiben, wie sie sind.
 */

const ICONS: Record<TabId, typeof Home> = {
  home: Home,
  'my-stack': FlaskConical,
  kalender: CalendarDays,
  profil: User,
}

export interface BottomNavigationProps {
  pathname: string
  quickActionsOpen: boolean
  onToggleQuickActions: () => void
}

export function BottomNavigation({
  pathname,
  quickActionsOpen,
  onToggleQuickActions,
}: BottomNavigationProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const activeId = resolveActiveTabId(pathname)

  const reiter: GlassTabItem[] = TAB_ITEMS.map(tab => {
    const Icon = ICONS[tab.id]
    return {
      id: tab.id,
      label: tab.labelKey ? String(t(tab.labelKey, { defaultValue: tab.fallbackLabel })) : tab.fallbackLabel,
      icon: <Icon size={25} aria-hidden="true" />,
      render: ({ className, children, ...rest }) => (
        <NavLink
          to={tab.route}
          className={className}
          {...(tab.obKey ? { 'data-ob': tab.obKey } : {})}
          {...rest}
        >
          {children}
        </NavLink>
      ),
    }
  })

  /**
   * Halten und schieben endet hier: der Reiter unter dem Finger wird beim
   * Loslassen geöffnet. Ein einfacher Tipp läuft nicht hierüber — den
   * erledigt das Element selbst, samt allem, was ein Browser an einer
   * Verknüpfung kann.
   */
  const ausloesen = (id: string) => {
    const ziel = TAB_ITEMS.find(tab => tab.id === id)
    if (ziel) navigate(ziel.route)
  }

  return (
    <div className="tyd-tabdock" data-open={quickActionsOpen}>
      <LiquidGlassTabBar
        items={reiter}
        activeId={activeId}
        onSelect={ausloesen}
        // Ein Klick je Platz, den der Finger ueberstreicht — wie am Rad einer
        // Uhr, und dasselbe Gefuehl wie im My-Stack-Karussell.
        onPreviewChange={() => { void hapticTick() }}
        ariaLabel={String(t('nav_aria_label', { defaultValue: 'Navigation' }))}
      />
      {/* Der Schnellzugriff ist kein Reiter: er führt zu keiner Seite. Darum
          steht er wie in iOS 26 als eigene Glas-Scheibe neben der Kapsel. Offen
          dreht sich das Plus zum X; aria-expanded sagt es der Vorlesung. */}
      <button
        type="button"
        onClick={onToggleQuickActions}
        aria-expanded={quickActionsOpen}
        aria-label={String(t('home_quick_actions', { defaultValue: 'Quick Actions' }))}
        className="tyd-tabdock-action lg-btn-primary"
      >
        <Plus size={26} strokeWidth={2.6} aria-hidden="true" />
      </button>
    </div>
  )
}
