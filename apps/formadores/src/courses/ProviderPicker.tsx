import { useId } from 'react'
import { MEMBER_ROLES, PROVIDER_KINDS } from '../../../../shared/domain/providers'
import type { Membership } from '../../../../shared/providersApi'
import { inputClass } from '../ui/form'

/** Muestra el formador actual; si la persona es parte de varios, permite cambiarlo */
export function ProviderPicker({ options, current, onChoose }: { options: Membership[]; current: Membership; onChoose: (id: string) => void }) {
  const id = useId()
  const p = current.provider
  if (options.length < 2)
    return (
      <div>
        <p className="text-xl font-semibold text-fg">{p.name}</p>
        <p className="text-sm text-muted">
          {PROVIDER_KINDS[p.kind].icon} {PROVIDER_KINDS[p.kind].label} · Tu rol: {MEMBER_ROLES[current.role].label}
        </p>
      </div>
    )
  return (
    <div className="w-full max-w-sm">
      <label htmlFor={id} className="text-sm font-medium text-fg-soft">
        Formador
      </label>
      <select id={id} value={p.id} onChange={(e) => onChoose(e.target.value)} className={inputClass}>
        {options.map((m) => (
          <option key={m.provider.id} value={m.provider.id}>
            {m.provider.name} · {MEMBER_ROLES[m.role].label}
          </option>
        ))}
      </select>
    </div>
  )
}
