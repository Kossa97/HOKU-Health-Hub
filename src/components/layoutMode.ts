export interface RouteLayoutMode {
  lockViewport: boolean
  /** Vollbild ohne Rand und Leiste (Injektionen). */
  hideBottomNav: boolean
  /** Nur die Leiste weg, die Seite scrollt normal — sie hat oben links ein X; die Zurück-Geste schließt. */
  hideTabBar: boolean
}

export function routeLayoutMode(pathname: string): RouteLayoutMode {
  const injectionFullscreen = pathname === '/injektionen'
  return {
    lockViewport: injectionFullscreen || pathname === '/my-stack' || pathname === '/rechner',
    hideBottomNav: injectionFullscreen,
    hideTabBar: injectionFullscreen || pathname === '/ernaehrung',
  }
}
