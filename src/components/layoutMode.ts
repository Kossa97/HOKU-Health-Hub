export interface RouteLayoutMode {
  lockViewport: boolean
  hideBottomNav: boolean
}

export function routeLayoutMode(pathname: string): RouteLayoutMode {
  const injectionFullscreen = pathname === '/injektionen'
  return {
    lockViewport: injectionFullscreen || pathname === '/my-stack' || pathname === '/rechner',
    hideBottomNav: injectionFullscreen,
  }
}
