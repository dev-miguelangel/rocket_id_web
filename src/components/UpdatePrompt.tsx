import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

const CHECK_EVERY_MS = 30 * 60 * 1000

/** ¿Hay una hoja/diálogo abierto? (formulario a medio llenar: no recargar todavía) */
const busy = () => !!document.querySelector('[role="dialog"]')

/**
 * Actualización automática de la PWA:
 * - busca versiones nuevas al abrir, al volver a la app y cada 30 minutos;
 * - cuando hay una, la activa y recarga, pero espera a que no haya ninguna hoja abierta
 *   para no perder lo que la persona esté escribiendo.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      const check = () => {
        if (navigator.onLine) registration.update().catch(() => {})
      }
      setInterval(check, CHECK_EVERY_MS)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
    },
  })

  useEffect(() => {
    if (!needRefresh) return
    const apply = () => {
      if (busy()) return false
      updateServiceWorker(true)
      return true
    }
    if (apply()) return
    const t = setInterval(() => apply() && clearInterval(t), 2000)
    return () => clearInterval(t)
  }, [needRefresh, updateServiceWorker])

  return null
}
