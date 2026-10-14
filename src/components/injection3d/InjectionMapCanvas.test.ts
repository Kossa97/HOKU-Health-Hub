import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('InjectionMapCanvas WebGL-Haushalt', () => {
  const quelle = () => readFileSync(new URL('./InjectionMapCanvas.tsx', import.meta.url), 'utf8')

  it('gibt den WebGL-Kontext beim Ausbauen wieder her', () => {
    // react-three-fiber raeumt seine Objekte auf, ruft aber kein
    // `forceContextLoss()`. Der Kontext haengt dann bis zur Garbage
    // Collection, und Browser erlauben nur rund sechzehn gleichzeitig. In der
    // Konsole stand deshalb reihenweise „THREE.WebGLRenderer: Context Lost."
    // -- auf Kalender und My Stack, also auf Seiten ganz ohne 3D.
    const source = quelle()

    expect(source).toContain('gl.forceContextLoss()')
    expect(source).toContain('gl.dispose()')
    // Der Renderer muss beim Erzeugen gemerkt werden, sonst gibt es beim
    // Ausbauen nichts herzugeben.
    expect(source).toContain('renderer.current = gl')
  })

  it('rendert nur bei Aenderungen und nicht, wenn niemand hinsieht', () => {
    // Ohne `frameloop` rendert der Canvas dauerhaft mit 60 Bildern je
    // Sekunde -- auch im Stillstand, ausserhalb des Blickfelds und im
    // Hintergrundtab. `demand` zeichnet nur auf Anforderung; die
    // Kamerafahrt muss sich deshalb selbst Bilder anfordern.
    const source = quelle()

    expect(source).toContain("frameloop={sichtbar ? 'demand' : 'never'}")
    expect(source).toContain('else invalidate()')
    expect(source).toContain("if (frameloop !== 'never') invalidate()")
    expect(source).toContain('IntersectionObserver')
    expect(source).toContain("document.addEventListener('visibilitychange'")
    // Und aufgeraeumt wird auch hier.
    expect(source).toContain('beobachter.disconnect()')
    expect(source).toContain("document.removeEventListener('visibilitychange'")
  })
})

describe('InjectionMapCanvas external assets', () => {
  it('does not use drei Environment presets that fetch remote HDR files', () => {
    const source = readFileSync(new URL('./InjectionMapCanvas.tsx', import.meta.url), 'utf8')

    expect(source).not.toContain('Environment')
    expect(source).not.toContain('preset=')
  })

  it('keeps explicit rear and rim lighting for the back view', () => {
    const source = readFileSync(new URL('./InjectionMapCanvas.tsx', import.meta.url), 'utf8')

    expect(source).toContain('INJECTION_MAP_LIGHTS')
    expect(source).toContain('rearFill')
    expect(source).toContain('rim')
  })

  it('offsets focused injections when a tracker sheet covers the lower map area', () => {
    const source = readFileSync(new URL('./InjectionMapCanvas.tsx', import.meta.url), 'utf8')

    expect(source).toContain('sheetOpen?: boolean')
    expect(source).toContain('SHEET_AWARE_FOCUS_Y_OFFSET')
    expect(source).toContain('focusTargetForRequest')
    expect(source).toContain('focusRequest.sheetOpen')
  })

  it('renders visible history pins with age colors and selected-pin emphasis', () => {
    const source = readFileSync(new URL('./InjectionMapCanvas.tsx', import.meta.url), 'utf8')

    expect(source).toContain('activeLogId')
    expect(source).toContain('getInjectionPinAgeColor(log.logged_at')
    expect(source).toContain('active={log.id === activeLogId}')
    expect(source).toContain('color={getInjectionPinAgeColor(log.logged_at)}')
  })

  it('frames the full torso by default and exposes a reset trigger', () => {
    const source = readFileSync(new URL('./InjectionMapCanvas.tsx', import.meta.url), 'utf8')

    expect(source).toContain('const CAMERA_DISTANCE = 4.85')
    expect(source).toContain('DEFAULT_CAMERA_TARGET_Y')
    expect(source).toContain('resetRequestId')
    expect(source).toContain('resetCameraFrame(camera, controls)')
    expect(source).toContain('maxDistance={7}')
  })
  it('restores deliberate two-finger torso panning without one-finger map shifting', () => {
    const source = readFileSync(new URL('./InjectionMapCanvas.tsx', import.meta.url), 'utf8')

    expect(source).toContain('enablePan enableZoom enableRotate')
    expect(source).toContain('touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}')
    expect(source).toContain('screenSpacePanning')
    expect(source).toContain('frames={1}')
    expect(source).toContain('dpr={[1, 1.35]}')
    expect(source).not.toContain('enablePan={false}')
    expect(source).toContain("touchAction: 'none'")
    expect(source).toContain("overscrollBehavior: 'none'")
    expect(source).toContain("userSelect: 'none'")
  })
})
