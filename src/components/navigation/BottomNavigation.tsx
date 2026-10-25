import { CalendarDays, FlaskConical, Home, Plus, User, X } from 'lucide-react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { hapticTick } from '../../lib/haptics'
import { CENTER_ACTION_INDEX, TAB_ITEMS, resolveActiveTabId, type TabId } from './tabModel'
import { LiquidGlassTabBar, type GlassTabItem } from './LiquidGlassTabBar'

/**
 * Die Naht zwischen Navigation und Darstellung.
 *
 * Oben kommt herein, wo man ist und was die mittlere Schaltflaeche tun soll;
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

/**
 * Kennung der mittleren Schaltflaeche im Streifen.
 *
 * Sie ist kein Reiter — sie fuehrt zu keiner Seite —, aber sie ist ein Platz:
 * der Finger kann ueber sie gleiten und auf ihr loslassen. Die zwei
 * Unterstriche halten sie von jeder echten Reiterkennung fern.
 */
export const CENTER_SLOT_ID = '__quick-actions'

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
          {...rest}
        >
          {children}
        </NavLink>
      ),
    }
  })

  /**
   * Die Mitte: dasselbe Symbolmass, dieselbe Klasse, derselbe Platz im
   * Streifen wie ein Reiter. Anders ist nur, wohin sie fuehrt — naemlich
   * nirgends: sie oeffnet den Schnellzugriff. Dass sie offen ist, sagt das
   * Symbol (ein X statt eines Plus) und `aria-expanded`.
   */
  const mitte: GlassTabItem = {
    id: CENTER_SLOT_ID,
    art: 'aktion',
    label: 'Quick Actions',
    icon: quickActionsOpen
      ? <X size={25} aria-hidden="true" />
      : <Plus size={25} aria-hidden="true" />,
    // `aria-current` wird bewusst NICHT durchgereicht: die Darstellung setzt es
    // fuer eine Aktion ohnehin nicht, und ein `aria-current` an einer
    // Schaltflaeche, die zu keiner Seite fuehrt, waere schlicht falsch.
    render: ({ className, children, ...rest }) => (
      <button
        type="button"
        onClick={onToggleQuickActions}
        aria-expanded={quickActionsOpen}
        className={className}
        data-tyd-center
        style={{ color: quickActionsOpen ? 'var(--accent)' : undefined }}
        {...rest}
      >
        {children}
      </button>
    ),
  }

  const plaetze = [
    ...reiter.slice(0, CENTER_ACTION_INDEX),
    mitte,
    ...reiter.slice(CENTER_ACTION_INDEX),
  ]

  /**
   * Halten und schieben endet hier: der Platz unter dem Finger wird beim
   * Loslassen ausgeloest. Ein einfacher Tipp laeuft nicht hierueber — den
   * erledigt das Element selbst, samt allem, was ein Browser an einer
   * Verknuepfung kann.
   */
  const ausloesen = (id: string) => {
    if (id === CENTER_SLOT_ID) { onToggleQuickActions(); return }
    const ziel = TAB_ITEMS.find(tab => tab.id === id)
    if (ziel) navigate(ziel.route)
  }

  return (
    <LiquidGlassTabBar
      items={plaetze}
      activeId={activeId}
      onSelect={ausloesen}
      // Ein Klick je Platz, den der Finger ueberstreicht — wie am Rad einer
      // Uhr, und dasselbe Gefuehl wie im My-Stack-Karussell.
      onPreviewChange={() => { void hapticTick() }}
      ariaLabel={String(t('nav_aria_label', { defaultValue: 'Navigation' }))}
    />
  )
}
