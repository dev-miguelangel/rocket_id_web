import { useState } from 'react'
import { COUNTRIES, formatPhone, groupNational, parsePhone, type Country } from '../lib/phone'

interface PhoneInputProps {
  id: string
  value: string
  onChange: (value: string) => void
  'aria-invalid'?: true
  'aria-describedby'?: string
  autoComplete?: string
  placeholder?: string
}

/**
 * Selector de código de país + número nacional.
 * El selector es un <select> nativo (abre la rueda/lista del sistema) cubierto por una etiqueta compacta "🇨🇱 +56".
 */
export function PhoneInput({ id, value, onChange, autoComplete = 'tel-national', placeholder, ...aria }: PhoneInputProps) {
  const parsed = parsePhone(value)
  // El país elegido se recuerda aunque el número esté vacío
  const [country, setCountry] = useState<Country>(parsed.country)
  const active = value ? parsed.country : country
  const invalid = !!aria['aria-invalid']

  const emit = (c: Country, national: string) => onChange(formatPhone(c, national.replace(/\D/g, '').slice(0, c.max)))

  return (
    <div
      className={`mt-1 flex h-12 w-full overflow-hidden rounded-xl border bg-card focus-within:ring-2 ${
        invalid ? 'border-red-500 focus-within:ring-red-500/20' : 'border-line-strong focus-within:border-primary focus-within:ring-primary/20'
      }`}
    >
      <div className="relative flex shrink-0 items-center gap-1 border-r border-line-strong bg-surface pr-2 pl-3 text-base text-fg">
        <span aria-hidden="true">{active.flag}</span>
        <span aria-hidden="true" className="tabular-nums">+{active.dial}</span>
        <span aria-hidden="true" className="text-xs text-muted">▾</span>
        <select
          aria-label="Código de país"
          value={active.iso}
          onChange={(e) => {
            const c = COUNTRIES.find((x) => x.iso === e.target.value) ?? active
            setCountry(c)
            if (parsed.national) emit(c, parsed.national)
          }}
          className="absolute inset-0 cursor-pointer opacity-0"
        >
          {COUNTRIES.map((c) => (
            <option key={c.iso} value={c.iso}>
              {c.flag} {c.name} (+{c.dial})
            </option>
          ))}
        </select>
      </div>
      <input
        id={id}
        {...aria}
        type="tel"
        inputMode="tel"
        autoComplete={autoComplete}
        value={groupNational(active, parsed.national)}
        placeholder={placeholder ?? (active.iso === 'CL' ? '9 1234 5678' : groupNational(active, '123456789012'.slice(0, active.min)))}
        onChange={(e) => {
          const raw = e.target.value
          // Si pegan un número internacional completo, detectamos el país
          if (raw.trim().startsWith('+') || raw.trim().startsWith('00')) {
            const p = parsePhone(raw)
            setCountry(p.country)
            emit(p.country, p.national)
          } else emit(active, raw)
        }}
        className="h-full min-w-0 flex-1 bg-transparent px-3 text-base text-fg tabular-nums outline-none placeholder:text-subtle"
      />
    </div>
  )
}
