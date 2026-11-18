import { useEffect, useId, useRef, useState, type FormEvent, type PointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const DURATION = 280
/** Arrastre mínimo (px) para cerrar, o velocidad (px/ms) de un deslizamiento rápido */
const CLOSE_DISTANCE = 120
const CLOSE_VELOCITY = 0.6
const AXIS_LOCK = 8

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
  /** Hay cambios sin guardar: al cerrar (arrastre, fondo, Escape, botón) se pide confirmar */
  confirmDiscard?: boolean
  /** Texto del botón izquierdo por defecto ("Cerrar") */
  closeLabel?: string
  children: ReactNode
}

/**
 * Hoja modal estilo nativo (iOS/Android): sube desde abajo, barra superior con título,
 * contenido con scroll propio, barra inferior opcional y bloqueo del scroll de fondo.
 * Se cierra arrastrando hacia abajo: desde el tirador/título, o desde el contenido cuando
 * ya está arriba del todo (si hay contenido por desplazar, el gesto sigue siendo scroll).
 */
export function BottomSheet({ open, title, onClose, left, right, footer, onSubmit, confirmDiscard, closeLabel = 'Cerrar', children }: BottomSheetProps) {
  const titleId = useId()
  const [mounted, setMounted] = useState(open)
  const [visible, setVisible] = useState(false)
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const drag = useRef({ y: 0, t: 0, lastY: 0, lastT: 0, moved: false, pid: -1 })
  const [asking, setAsking] = useState(false)
  /** Cerrar, pero preguntando primero si hay cambios sin guardar */
  const requestClose = () => (confirmDiscard ? setAsking(true) : onClose())
  const requestCloseRef = useRef(requestClose)
  requestCloseRef.current = requestClose

  // Montar → animar entrada; cerrar → animar salida → desmontar
  if (open && !mounted) setMounted(true)

  useEffect(() => {
    if (open) {
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
      return () => cancelAnimationFrame(r)
    }
    setVisible(false)
    setDragY(0)
    setAsking(false)
    const t = setTimeout(() => setMounted(false), DURATION)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!mounted) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && requestCloseRef.current()
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [mounted])

  /** Al soltar: cerrar si se arrastró lo suficiente o rápido; si no, volver a su lugar */
  const release = (dy: number, velocity: number) => {
    setDragging(false)
    if (dy > CLOSE_DISTANCE || (dy > 40 && velocity > CLOSE_VELOCITY)) {
      navigator.vibrate?.(8)
      setDragY(0) // si hay que confirmar, la hoja vuelve a su lugar mientras pregunta
      requestCloseRef.current()
    } else setDragY(0)
  }

  // Arrastre desde el contenido (táctil), solo si está arriba del todo y el gesto es hacia abajo
  useEffect(() => {
    const el = contentRef.current
    if (!mounted || !el) return
    let startY = 0
    let startX = 0
    let startT = 0
    let lastY = 0
    let lastT = 0
    let mode: 'undecided' | 'drag' | 'scroll' = 'undecided'
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0]
      startY = lastY = t.clientY
      startX = t.clientX
      startT = lastT = e.timeStamp
      mode = el.scrollTop <= 0 ? 'undecided' : 'scroll'
    }
    const onMove = (e: TouchEvent) => {
      if (mode === 'scroll') return
      const t = e.touches[0]
      const dy = t.clientY - startY
      const dx = t.clientX - startX
      if (mode === 'undecided') {
        if (Math.abs(dy) < AXIS_LOCK && Math.abs(dx) < AXIS_LOCK) return
        mode = dy > 0 && Math.abs(dy) > Math.abs(dx) ? 'drag' : 'scroll'
        if (mode === 'scroll') return
        setDragging(true)
      }
      e.preventDefault() // evita el rebote/scroll mientras se arrastra la hoja
      lastY = t.clientY
      lastT = e.timeStamp
      setDragY(Math.max(0, dy))
    }
    const onEnd = () => {
      if (mode !== 'drag') return
      const dy = lastY - startY
      const v = dy / Math.max(1, lastT - startT) // velocidad media del gesto (px/ms)
      mode = 'undecided'
      release(dy, v)
    }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onEnd)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
    // release solo usa setters y una ref estable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted])

  if (!mounted) return null

  // Arrastre desde el tirador y la barra del título (táctil y mouse)
  const onHandleDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    drag.current = { y: e.clientY, t: e.timeStamp, lastY: e.clientY, lastT: e.timeStamp, moved: false, pid: e.pointerId }
  }
  const onHandleMove = (e: PointerEvent) => {
    const d = drag.current
    if (d.pid !== e.pointerId) return
    const dy = e.clientY - d.y
    if (!d.moved) {
      if (Math.abs(dy) < AXIS_LOCK) return
      d.moved = true
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      setDragging(true)
    }
    d.lastY = e.clientY
    d.lastT = e.timeStamp
    setDragY(Math.max(0, dy))
  }
  const onHandleUp = (e: PointerEvent) => {
    const d = drag.current
    if (d.pid !== e.pointerId) return
    d.pid = -1
    if (!d.moved) return
    const dy = d.lastY - d.y
    release(dy, dy / Math.max(1, d.lastT - d.t))
  }

  const offset = visible ? dragY : null
  const panelStyle = { transform: offset === null ? 'translate3d(0,100%,0)' : `translate3d(0,${offset}px,0)` }
  const panelClass = `absolute inset-x-0 bottom-0 top-[calc(env(safe-area-inset-top)+0.75rem)] mx-auto flex max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-surface shadow-2xl ${dragging ? '' : 'transition-transform duration-300 ease-out motion-reduce:transition-none'}`
  // El fondo se aclara a medida que la hoja baja
  const backdropOpacity = visible ? Math.max(0, 1 - dragY / 400) : 0

  const inner = (
    <>
      <div
        className="touch-none select-none"
        onPointerDown={onHandleDown}
        onPointerMove={onHandleMove}
        onPointerUp={onHandleUp}
        onPointerCancel={onHandleUp}
        onClickCapture={(e) => {
          // Si fue un arrastre, no activar el botón donde empezó
          if (drag.current.moved) {
            e.preventDefault()
            e.stopPropagation()
            drag.current.moved = false
          }
        }}
      >
        <div className="flex cursor-grab justify-center pt-2 pb-1 active:cursor-grabbing" aria-hidden="true">
          <span className="h-1.5 w-10 rounded-full bg-line-strong" />
        </div>
        <header className="grid grid-cols-[1fr_auto_1fr] items-center border-b border-line px-2 pb-2">
          <div className="justify-self-start">
            {left ?? (
              <button type="button" onClick={requestClose} className="h-11 rounded-lg px-3 text-base text-primary-text active:opacity-60">
                {closeLabel}
              </button>
            )}
          </div>
          <h2 id={titleId} className="max-w-[50vw] truncate text-base font-semibold text-fg">
            {title}
          </h2>
          <div className="justify-self-end">{right}</div>
        </header>
      </div>
      <div ref={contentRef} className={`flex-1 overflow-y-auto overscroll-contain px-4 pt-4 ${footer ? '' : 'pb-safe'}`}>
        <div className="space-y-4 pb-8">{children}</div>
      </div>
      {footer && <div className="pb-safe border-t border-line bg-surface/95 px-4 pt-3 backdrop-blur">{footer}</div>}
      {asking && (
        <DiscardConfirm
          onKeep={() => setAsking(false)}
          onDiscard={() => {
            setAsking(false)
            onClose()
          }}
        />
      )}
    </>
  )

  // Portal a <body>: un ancestro con backdrop-filter/transform encerraría el position: fixed
  return createPortal(
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div
        className={`absolute inset-0 bg-black/40 ${dragging ? '' : 'transition-opacity duration-300 motion-reduce:transition-none'}`}
        style={{ opacity: backdropOpacity }}
        onClick={requestClose}
      />
      {onSubmit ? (
        <form onSubmit={onSubmit} noValidate className={panelClass} style={panelStyle}>
          {inner}
        </form>
      ) : (
        <div className={panelClass} style={panelStyle}>
          {inner}
        </div>
      )}
    </div>,
    document.body,
  )
}

/** "¿Descartar cambios?" dentro de la hoja, al estilo de una hoja de acciones nativa */
function DiscardConfirm({ onKeep, onDiscard }: { onKeep: () => void; onDiscard: () => void }) {
  const id = useId()
  useEffect(() => {
    navigator.vibrate?.(10)
  }, [])
  return (
    <div className="absolute inset-0 z-10 flex items-end bg-black/30 p-3" role="alertdialog" aria-modal="true" aria-labelledby={id} onClick={onKeep}>
      <div className="pb-safe w-full space-y-2" onClick={(e) => e.stopPropagation()}>
        <div className="overflow-hidden rounded-2xl bg-card shadow-xl">
          <div className="px-4 pt-4 pb-3 text-center">
            <p id={id} className="text-base font-semibold text-fg">
              ¿Descartar los cambios?
            </p>
            <p className="mt-1 text-sm text-muted">Perderás lo que editaste y no guardaste.</p>
          </div>
          <button
            type="button"
            onClick={onDiscard}
            className="h-12 w-full border-t border-line text-base font-semibold text-red-600 active:bg-red-50 dark:text-red-400 dark:active:bg-red-500/10"
          >
            Descartar cambios
          </button>
        </div>
        <button
          type="button"
          autoFocus
          onClick={onKeep}
          className="h-12 w-full rounded-2xl bg-card text-base font-semibold text-primary-text shadow-xl active:bg-line/60"
        >
          Seguir editando
        </button>
      </div>
    </div>
  )
}

interface SheetProps {
  open: boolean
  title: string
  onCancel: () => void
  onSubmit: (e: FormEvent) => void
  saving?: boolean
  canSave?: boolean
  /** Hay cambios sin guardar (pide confirmar antes de cerrar) */
  dirty?: boolean
  children: ReactNode
}

/** Hoja de edición: Cancelar · Título · Guardar */
export function Sheet({ open, title, onCancel, onSubmit, saving, canSave = true, dirty = false, children }: SheetProps) {
  return (
    <BottomSheet
      open={open}
      title={title}
      onClose={onCancel}
      onSubmit={onSubmit}
      confirmDiscard={dirty && !saving}
      closeLabel="Cancelar"
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
