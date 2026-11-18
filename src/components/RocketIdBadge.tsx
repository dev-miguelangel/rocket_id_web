import { useEffect, useState } from 'react'

interface Props {
  rocketId: string | null
  /** "light" para usar sobre fondos de color (tarjeta de Inicio) */
  variant?: 'default' | 'light'
  className?: string
}

/** Muestra el rocketId con botón para copiarlo. */
export function RocketIdBadge({ rocketId, variant = 'default', className = '' }: Props) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(t)
  }, [copied])

  const styles =
    variant === 'light'
      ? 'bg-white/15 text-white ring-white/25 active:bg-white/25'
      : 'bg-primary/10 text-primary-text ring-primary/20 active:bg-primary/20'

  if (!rocketId) {
    return (
      <span className={`inline-flex h-9 items-center rounded-full px-3 text-sm ring-1 ${styles} ${className}`} aria-busy="true">
        <span className="h-3 w-20 animate-pulse rounded bg-current opacity-30" />
      </span>
    )
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(rocketId)
      navigator.vibrate?.(10)
      setCopied(true)
    } catch {
      /* portapapeles no disponible */
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Tu rocketId es ${rocketId.split('').join(' ')}. Tocar para copiar`}
      className={`inline-flex h-9 items-center gap-2 rounded-full px-3 font-mono text-sm font-bold tracking-wider ring-1 transition ${styles} ${className}`}
    >
      <span aria-hidden="true">🚀</span>
      {rocketId}
      <span aria-hidden="true" className="text-xs font-sans font-medium opacity-80">
        {copied ? '✓ Copiado' : '⧉'}
      </span>
    </button>
  )
}
