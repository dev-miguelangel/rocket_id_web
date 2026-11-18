import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const DURATION = 280

interface BottomSheetProps {
  open: boolean
  title: string
  onClose: () => void
  /** Botón a la izquierda del título (por defecto: "Cerrar") */
  left?: ReactNode
  /** Botón a la derecha del título */
  right?: ReactNode
  /** Barra fija inferior (ej. botón de acción principal) */
  footer?: ReactNode
  /** Si se entrega, la hoja es un <form> */
  onSubmit?: (e: FormEvent) => void
  children: ReactNode
}

/**
 * Hoja modal estilo nativo (iOS/Android): sube desde abajo, barra superior con título,
 * contenido con scroll propio, barra inferior opcional y bloqueo del scroll de fondo.
 */
export function BottomSheet({ open, title, onClose, left, right, footer, onSubmit, children }: BottomSheetProps) {
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
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [mounted, onClose])

  if (!mounted) return null

  const panelClass = `absolute inset-x-0 bottom-0 top-[calc(env(safe-area-inset-top)+0.75rem)] mx-auto flex max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-surface shadow-2xl transition-transform duration-300 ease-out motion-reduce:transition-none ${visible ? 'translate-y-0' : 'translate-y-full'}`

  const inner = (
    <>
      <div className="flex justify-center pt-2" aria-hidden="true">
        <span className="h-1.5 w-10 rounded-full bg-line-strong" />
      </div>
      <header className="grid grid-cols-[1fr_auto_1fr] items-center border-b border-line px-2 pb-2">
        <div className="justify-self-start">
          {left ?? (
            <button type="button" onClick={onClose} className="h-11 rounded-lg px-3 text-base text-primary-text active:opacity-60">
              Cerrar
            </button>
          )}
        </div>
        <h2 id={titleId} className="max-w-[50vw] truncate text-base font-semibold text-fg">
          {title}
        </h2>
        <div className="justify-self-end">{right}</div>
      </header>
      <div className={`flex-1 overflow-y-auto overscroll-contain px-4 pt-4 ${footer ? '' : 'pb-safe'}`}>
        <div className="space-y-4 pb-8">{children}</div>
      </div>
      {footer && <div className="pb-safe border-t border-line bg-surface/95 px-4 pt-3 backdrop-blur">{footer}</div>}
    </>
  )

  // Portal a <body>: un ancestro con backdrop-filter/transform encerraría el position: fixed
  return createPortal(
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-300 motion-reduce:transition-none ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      {onSubmit ? (
        <form onSubmit={onSubmit} noValidate className={panelClass}>
          {inner}
        </form>
      ) : (
        <div className={panelClass}>{inner}</div>
      )}
    </div>,
    document.body,
  )
}

interface SheetProps {
  open: boolean
  title: string
  onCancel: () => void
  onSubmit: (e: FormEvent) => void
  saving?: boolean
  canSave?: boolean
  children: ReactNode
}

/** Hoja de edición: Cancelar · Título · Guardar */
export function Sheet({ open, title, onCancel, onSubmit, saving, canSave = true, children }: SheetProps) {
  return (
    <BottomSheet
      open={open}
      title={title}
      onClose={onCancel}
      onSubmit={onSubmit}
      left={
        <button type="button" onClick={onCancel} className="h-11 rounded-lg px-3 text-base text-primary-text active:opacity-60">
          Cancelar
        </button>
      }
      right={
        <button
          type="submit"
          disabled={saving || !canSave}
          className="h-11 rounded-lg px-3 text-base font-semibold text-primary-text active:opacity-60 disabled:opacity-40"
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      }
    >
      {children}
    </BottomSheet>
  )
}
