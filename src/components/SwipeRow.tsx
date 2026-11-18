import { useEffect, useId, useRef, useState, type PointerEvent, type ReactNode } from 'react'

export interface SwipeAction {
  key: string
  label: string
  icon?: ReactNode
  tone: 'primary' | 'success' | 'danger' | 'neutral' | 'whatsapp'
  onClick: () => void
}

const TONES: Record<SwipeAction['tone'], string> = {
  primary: 'bg-primary',
  success: 'bg-emerald-600',
  danger: 'bg-red-600',
  neutral: 'bg-zinc-500',
  whatsapp: 'bg-[#25D366]',
}

const ACTION_W = 80
const AXIS_LOCK = 8 // px antes de decidir si el gesto es horizontal o vertical

// Solo una fila abierta a la vez en toda la app
const openListeners = new Set<(id: string) => void>()
const announceOpen = (id: string) => openListeners.forEach((l) => l(id))

interface Props {
  /** Acciones que aparecen a la izquierda al deslizar hacia la derecha (positivas) */
  leading?: SwipeAction[]
  /** Acciones que aparecen a la derecha al deslizar hacia la izquierda (destructivas) */
  trailing?: SwipeAction[]
  /** Fondo opaco de la fila (debe tapar las acciones): ej. "bg-surface" o "bg-card" */
  bg?: string
  /** Clases extra del contenedor (ej. "rounded-2xl" para tarjetas) */
  className?: string
  children: ReactNode
}

/**
 * Fila deslizable estilo iOS/Android.
 * Deslizar → revela `leading`; ← revela `trailing`. Tocar fuera o la fila abierta la cierra.
 * El scroll vertical no se bloquea: el gesto se asigna a un eje tras unos píxeles.
 */
export function SwipeRow({ leading = [], trailing = [], bg = 'bg-surface', className = '', children }: Props) {
  const id = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const g = useRef({ x: 0, y: 0, start: 0, axis: null as 'x' | 'y' | null, moved: false, pid: -1, haptic: false })

  const maxRight = leading.length * ACTION_W
  const maxLeft = trailing.length * ACTION_W
  const isOpen = offset !== 0 && !dragging

  // Cerrar si se abre otra fila
  useEffect(() => {
    const l = (other: string) => other !== id && setOffset(0)
    openListeners.add(l)
    return () => {
      openListeners.delete(l)
    }
  }, [id])

  // Cerrar al tocar fuera
  useEffect(() => {
    if (!isOpen) return
    const onDown = (e: globalThis.PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOffset(0)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [isOpen])

  if (!leading.length && !trailing.length) return <>{children}</>

  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    g.current = { x: e.clientX, y: e.clientY, start: offset, axis: null, moved: false, pid: e.pointerId, haptic: false }
  }

  const onPointerMove = (e: PointerEvent) => {
    const s = g.current
    if (s.pid !== e.pointerId) return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    if (!s.axis) {
      if (Math.abs(dx) < AXIS_LOCK && Math.abs(dy) < AXIS_LOCK) return
      s.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      if (s.axis === 'x') {
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        setDragging(true)
      }
    }
    if (s.axis !== 'x') return
    s.moved = true
    let next = s.start + dx
    // Resistencia elástica al pasar el límite (o si no hay acciones en ese lado)
    if (next > maxRight) next = maxRight + (next - maxRight) * 0.25
    if (next < -maxLeft) next = -maxLeft + (next + maxLeft) * 0.25
    // Vibración suave al cruzar el umbral de apertura
    const past = next > maxRight / 2 || next < -maxLeft / 2
    if (past !== s.haptic) {
      s.haptic = past
      if (past) navigator.vibrate?.(8)
    }
    setOffset(next)
  }

  const onPointerUp = (e: PointerEvent) => {
    const s = g.current
    if (s.pid !== e.pointerId) return
    s.pid = -1
    if (s.axis !== 'x') return
    setDragging(false)
    if (maxRight && offset > maxRight / 2) {
      setOffset(maxRight)
      announceOpen(id)
    } else if (maxLeft && offset < -maxLeft / 2) {
      setOffset(-maxLeft)
      announceOpen(id)
    } else setOffset(0)
  }

  const run = (a: SwipeAction) => {
    setOffset(0)
    a.onClick()
  }

  return (
    <div ref={rootRef} className={`relative overflow-hidden ${className}`}>
      {/* Acciones de la izquierda (deslizar →) */}
      <div className="absolute inset-y-0 left-0 flex" style={{ width: maxRight }} aria-hidden={offset <= 0}>
        {leading.map((a) => (
          <ActionButton key={a.key} action={a} visible={offset > 4} onRun={run} />
        ))}
      </div>
      {/* Acciones de la derecha (← deslizar) */}
      <div className="absolute inset-y-0 right-0 flex" style={{ width: maxLeft }} aria-hidden={offset >= 0}>
        {trailing.map((a) => (
          <ActionButton key={a.key} action={a} visible={offset < -4} onRun={run} />
        ))}
      </div>

      <div
        className={`relative touch-pan-y select-none ${bg} ${dragging ? '' : 'transition-transform duration-250 ease-out motion-reduce:transition-none'}`}
        style={{ transform: `translate3d(${offset}px,0,0)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={(e) => {
          // Tras arrastrar, o con la fila abierta, el toque cierra en vez de abrir el elemento
          if (g.current.moved || offset !== 0) {
            e.preventDefault()
            e.stopPropagation()
            g.current.moved = false
            setOffset(0)
          }
        }}
      >
        {children}
      </div>
    </div>
  )
}

function ActionButton({ action: a, visible, onRun }: { action: SwipeAction; visible: boolean; onRun: (a: SwipeAction) => void }) {
  return (
    <button
      type="button"
      tabIndex={visible ? 0 : -1}
      onClick={() => onRun(a)}
      className={`flex h-full flex-col items-center justify-center gap-1 text-xs font-semibold text-white transition-opacity active:brightness-90 ${TONES[a.tone]} ${visible ? 'opacity-100' : 'opacity-0'}`}
      style={{ width: ACTION_W }}
    >
      {a.icon && <span className="text-lg leading-none" aria-hidden="true">{a.icon}</span>}
      {a.label}
    </button>
  )
}
