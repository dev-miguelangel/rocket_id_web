import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Botón de "mantener presionado" para acciones críticas (evita toques accidentales).
 * Con teclado, Enter/Espacio confirma directamente (la navegación ya es deliberada).
 */
export function HoldButton({ onConfirm, children, ms = 1500, disabled }: { onConfirm: () => void; children: ReactNode; ms?: number; disabled?: boolean }) {
  const [progress, setProgress] = useState(0)
  const raf = useRef(0)
  const start = useRef(0)
  const fired = useRef(false)

  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  const stop = () => {
    cancelAnimationFrame(raf.current)
    if (!fired.current) setProgress(0)
  }
  const tick = (t: number) => {
    const p = Math.min(1, (t - start.current) / ms)
    setProgress(p)
    if (p >= 1) {
      fired.current = true
      navigator.vibrate?.([20, 40, 20])
      onConfirm()
      return
    }
    raf.current = requestAnimationFrame(tick)
  }
  const begin = () => {
    if (disabled) return
    fired.current = false
    start.current = performance.now()
    navigator.vibrate?.(10)
    raf.current = requestAnimationFrame(tick)
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={begin}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
          e.preventDefault()
          onConfirm()
        }
      }}
      className="relative h-12 w-full touch-none overflow-hidden rounded-xl bg-red-600 text-base font-semibold text-white select-none disabled:opacity-50"
    >
      <span className="absolute inset-y-0 left-0 bg-red-800" style={{ width: `${progress * 100}%` }} aria-hidden="true" />
      <span className="relative">{progress > 0 && progress < 1 ? 'Sigue presionando…' : children}</span>
    </button>
  )
}
