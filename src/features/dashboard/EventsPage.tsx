export function EventsPage() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong bg-card px-6 py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-accent/10 text-2xl">📅</div>
      <h2 className="mt-4 text-lg font-semibold text-fg">Aún no hay eventos</h2>
      <p className="mt-1 max-w-xs text-sm text-muted">
        Cuando haya actividades disponibles aparecerán aquí.
      </p>
    </div>
  )
}
