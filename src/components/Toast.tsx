import { useCallback, useEffect, useState } from 'react'

interface ToastState {
  id: number
  message: string
  action?: { label: string; onClick: () => void }
}

/** Toast sobre la navegación inferior, con acción opcional (ej. "Deshacer"). */
export function useToast(duration = 3500) {
  const [toast, setToast] = useState<ToastState | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), toast.action ? duration + 1500 : duration)
    return () => clearTimeout(t)
  }, [toast, duration])

  const show = useCallback((message: string, action?: ToastState['action']) => setToast({ id: Date.now(), message, action }), [])

  const node = (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 transition-all duration-300 motion-reduce:transition-none ${toast ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
    >
      {toast && (
        <span className="pointer-events-auto flex items-center gap-3 rounded-full bg-zinc-900 py-2 pr-2 pl-4 text-sm font-medium text-white shadow-lg ring-1 ring-white/10">
          <span className={toast.action ? '' : 'pr-2'}>{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              onClick={() => {
                toast.action?.onClick()
                setToast(null)
              }}
              className="h-8 rounded-full bg-white/15 px-3 font-semibold text-accent active:bg-white/25"
            >
              {toast.action.label}
            </button>
          )}
        </span>
      )}
    </div>
  )

  return { show, node }
}
