/**
 * En la PWA instalada en iOS la app se dibuja bajo la barra de estado (hora, batería),
 * cuyo texto es siempre blanco. Esta franja le da un fondo con contraste en ambos temas.
 * En navegadores y Android su alto es 0 (safe-area-inset-top = 0).
 */
export function StatusBarScrim() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[env(safe-area-inset-top)] bg-primary dark:bg-surface"
    />
  )
}
