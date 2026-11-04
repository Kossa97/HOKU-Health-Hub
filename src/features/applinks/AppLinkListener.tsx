import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { appLinkRoute } from './lib/appLinks'

/**
 * Öffnet das System die App über einen geteilten Profil-Link (Universal Link /
 * App Link), springt die App auf `/u/<name>`. Andere Adressen werden ignoriert.
 * Nur in der nativen App; das Plugin hält das Ereignis vom Kaltstart zurück,
 * bis dieser Listener steht.
 */
export function AppLinkListener() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const handle = App.addListener('appUrlOpen', ({ url }) => {
      const route = appLinkRoute(url)
      if (route) navigate(route)
    })
    return () => { void handle.then(h => h.remove()) }
  }, [navigate])

  return null
}
