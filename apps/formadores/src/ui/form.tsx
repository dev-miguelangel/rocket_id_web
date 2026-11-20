import { useId, type ReactNode } from 'react'

export const inputClass =
  'mt-1.5 h-11 w-full rounded-xl border border-field bg-card px-3 text-base text-fg outline-none placeholder:text-subtle focus:border-primary focus:ring-2 focus:ring-primary/20 aria-invalid:border-red-500 aria-invalid:ring-red-500/20'

export const textareaClass = inputClass.replace('h-11', 'min-h-28 py-2.5')

interface FieldProps {
  label: string
  optional?: boolean
  hint?: string
  error?: string
  children: (props: { id: string; 'aria-invalid'?: true; 'aria-describedby'?: string }) => ReactNode
}

/** Etiqueta + control + ayuda/error con los atributos de accesibilidad conectados */
export function Field({ label, optional, hint, error, children }: FieldProps) {
  const id = useId()
  const descId = `${id}-desc`
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="text-sm font-medium text-fg-soft">
        {label}
        {optional && <span className="font-normal text-subtle"> (opcional)</span>}
      </label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': error || hint ? descId : undefined })}
      {(error || hint) && (
        <p id={descId} className={`mt-1.5 text-sm ${error ? 'text-red-600 dark:text-red-400' : 'text-muted'}`}>
          {error ?? hint}
        </p>
      )}
    </div>
  )
}

export function Card({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-card p-6 lg:p-8">
      <h2 className="text-lg font-semibold text-fg">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className="mt-6">{children}</div>
    </section>
  )
}

const tones = {
  info: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
  success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  danger: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300',
  neutral: 'bg-zinc-200 text-zinc-800 dark:bg-zinc-500/20 dark:text-zinc-200',
  warning: 'bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200',
}

export function Badge({ tone, children }: { tone: keyof typeof tones; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>
}

export const primaryButton =
  'inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 font-semibold text-white transition hover:bg-primary-dark disabled:opacity-60'
export const secondaryButton =
  'inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line-strong bg-card px-5 font-semibold text-fg transition hover:bg-surface disabled:opacity-60'
export const dangerButton =
  'inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60 dark:text-red-300 dark:hover:bg-red-500/10'
