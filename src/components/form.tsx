import { useId, type ReactNode } from 'react'

export const inputClass =
  'mt-1 h-12 w-full rounded-xl border border-line-strong bg-card px-3 text-base text-fg outline-none placeholder:text-subtle focus:border-primary focus:ring-2 focus:ring-primary/20 aria-invalid:border-red-500 aria-invalid:ring-red-500/20'

export const dateInputClass = `${inputClass} date-input`

export const textareaClass = inputClass.replace('h-12', 'min-h-24 py-3')

interface FieldProps {
  label: string
  hint?: string
  error?: string
  success?: string
  children: (props: { id: string; 'aria-invalid'?: true; 'aria-describedby'?: string }) => ReactNode
}

/** Etiqueta + control + ayuda/error con los atributos de accesibilidad conectados. */
export function Field({ label, hint, error, success, children }: FieldProps) {
  const id = useId()
  const descId = `${id}-desc`
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="text-sm font-medium text-fg-soft">
        {label}
      </label>
      {children({
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': error || success || hint ? descId : undefined,
      })}
      {(error || success || hint) && (
        <p
          id={descId}
          className={`mt-1 text-xs ${error ? 'text-red-600 dark:text-red-400' : success ? 'font-medium text-emerald-700 dark:text-emerald-400' : 'text-muted'}`}
        >
          {error ?? success ?? hint}
        </p>
      )}
    </div>
  )
}

export function FormSection({ title, description, icon, children }: { title: string; description?: string; icon: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      <header className="mb-4 flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xl" aria-hidden="true">
          {icon}
        </span>
        <div>
          <h2 className="font-semibold text-fg">{title}</h2>
          {description && <p className="text-sm text-muted">{description}</p>}
        </div>
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

interface SegmentedProps<T extends string> {
  label: string
  value: T | ''
  options: readonly { value: T; label: string }[]
  onChange: (v: T) => void
  error?: string
}

/** Control segmentado nativo (iOS UISegmentedControl / Android SegmentedButton) */
export function Segmented<T extends string>({ label, value, options, onChange, error }: SegmentedProps<T>) {
  const id = useId()
  return (
    <div className="min-w-0">
      <p id={id} className="text-sm font-medium text-fg-soft">
        {label}
      </p>
      <div
        role="radiogroup"
        aria-labelledby={id}
        aria-invalid={error ? true : undefined}
        className={`mt-1 grid gap-1 rounded-xl bg-surface p-1 ring-1 ${error ? 'ring-red-500' : 'ring-line'}`}
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((o) => {
          const active = value === o.value
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.value)}
              className={`h-10 truncate rounded-lg px-2 text-sm font-medium transition ${
                active ? 'bg-card text-primary-text shadow-sm ring-1 ring-line' : 'text-muted active:bg-line/60'
              }`}
            >
              {o.label}
            </button>
          )
        })}
      </div>
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}
