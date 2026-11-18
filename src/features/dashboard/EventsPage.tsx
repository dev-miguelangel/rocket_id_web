export function EventsPage() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-accent/10 text-2xl">📅</div>
      <h2 className="mt-4 text-lg font-semibold text-zinc-900">Aún no hay eventos</h2>
      <p className="mt-1 max-w-xs text-sm text-zinc-500">
        Cuando haya actividades disponibles aparecerán aquí.
      </p>
    </div>
  )
}
