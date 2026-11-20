import type { ComponentType } from 'react'

/** Secciones que llegan en las siguientes fases (ver iadocs/formadores.md) */
export function SoonPage({ icon: Icon, title, text }: { icon: ComponentType<{ className?: string }>; title: string; text: string }) {
  return (
    <section className="flex flex-col items-center rounded-2xl border border-dashed border-line-strong px-6 py-20 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary-text">
        <Icon className="size-7" />
      </span>
      <h2 className="mt-5 text-lg font-semibold text-fg">{title}</h2>
      <p className="mt-2 max-w-md text-muted">{text}</p>
      <p className="mt-4 text-sm text-subtle">Disponible cuando tu cuenta de formador esté aprobada.</p>
    </section>
  )
}
