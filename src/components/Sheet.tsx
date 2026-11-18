import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react'

interface SheetProps {
  open: boolean
  title: string
  onCancel: () => void
  onSubmit: (e: FormEvent) => void
  saving?: boolean
  canSave?: boolean
  children: ReactNode
}

const DURATION = 280

/**
 * Hoja modal estilo nativo (iOS/Android): sube desde abajo, barra Cancelar · Título · Guardar,
 * contenido con scroll propio y bloqueo del scroll de fondo.
 */
export function Sheet({ open, title, onCancel, onSubmit, saving, canSave = true, children }: SheetProps) {
  const titleId = useId()
  const [mounted, setMounted] = useState(open)
  const [visible, setVisible] = useState(false)

  // Montar → animar entrada; cerrar → animar salida → desmontar
  if (open && !mounted) setMounted(true)

  useEffect(() => {
    if (open) {
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
      return () => cancelAnimationFrame(r)
    }
    setVisible(false)
    const t = setTimeout(() => setMounted(false), DURATION)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!mounted) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel()
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [mounted, onCancel])

  if (!mounted) return null

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-300 motion-reduce:transition-none ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={onCancel}
      />
      <form
        onSubmit={onSubmit}
        noValidate
        className={`absolute inset-x-0 bottom-0 top-[calc(env(safe-area-inset-top)+0.75rem)] mx-auto flex max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-surface shadow-2xl transition-transform duration-300 ease-out motion-reduce:transition-none ${visible ? 'translate-y-0' : 'translate-y-full'}`}
      >
        <div className="flex justify-center pt-2" aria-hidden="true">
          <span className="h-1.5 w-10 rounded-full bg-line-strong" />
        </div>
        <header className="grid grid-cols-[1fr_auto_1fr] items-center border-b border-line px-2 pb-2">
          <button type="button" onClick={onCancel} className="h-11 justify-self-start rounded-lg px-3 text-base text-primary-text active:opacity-60">
            Cancelar
          </button>
          <h2 id={titleId} className="truncate text-base font-semibold text-fg">
            {title}
          </h2>
          <button
            type="submit"
            disabled={saving || !canSave}
            className="h-11 justify-self-end rounded-lg px-3 text-base font-semibold text-primary-text active:opacity-60 disabled:opacity-40"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </header>
        <div className="pb-safe flex-1 overflow-y-auto overscroll-contain px-4 pt-4">
          <div className="space-y-4 pb-8">{children}</div>
        </div>
      </form>
    </div>
  )
}
