import { useRegisterSW } from 'virtual:pwa-register/react'

const CHECK_EVERY_MS = 30 * 60 * 1000

/**
 * En el escritorio la app suele quedar abierta por días: buscamos versiones nuevas cada 30 minutos
 * y al volver a la ventana, y avisamos para que la persona elija cuándo recargar.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      const check = () => navigator.onLine && registration.update().catch(() => {})
      setInterval(check, CHECK_EVERY_MS)
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check())
    },
  })

  if (!needRefresh) return null
  return (
    <div role="status" className="fixed right-6 bottom-6 z-50 flex items-center gap-4 rounded-2xl border border-line bg-card py-3 pr-3 pl-5 shadow-lg">
      <p className="text-sm text-fg">Hay una nueva versión disponible.</p>
      <button type="button" onClick={() => setNeedRefresh(false)} className="h-11 rounded-xl px-3 text-sm font-medium text-muted hover:bg-line/60">
        Más tarde
      </button>
      <button
        type="button"
        onClick={() => updateServiceWorker(true)}
        className="h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-dark"
      >
        Actualizar
      </button>
    </div>
  )
}
