import { Logo } from './Logo'

export function SplashScreen() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-surface">
      <Logo className="size-16 animate-pulse" />
      <span className="sr-only">Cargando…</span>
    </div>
  )
}
