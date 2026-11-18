import { useRegisterSW } from 'virtual:pwa-register/react'

/** Aviso cuando hay una nueva versión de la app publicada. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div className="pb-safe fixed inset-x-0 bottom-20 z-30 px-4">
      <div className="mx-auto flex max-w-sm items-center gap-3 rounded-2xl bg-zinc-900 p-3 pl-4 text-sm text-white shadow-xl">
        <span className="flex-1">Hay una nueva versión disponible.</span>
        <button type="button" onClick={() => setNeedRefresh(false)} className="h-10 px-2 text-zinc-400">
          Luego
        </button>
        <button
          type="button"
          onClick={() => updateServiceWorker(true)}
          className="h-10 rounded-xl bg-accent px-4 font-semibold"
        >
          Actualizar
        </button>
      </div>
    </div>
  )
}
