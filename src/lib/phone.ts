/** Teléfonos con código de país. Se guardan como "+56 9 1234 5678". */

export interface Country {
  iso: string
  name: string
  dial: string // sin "+"
  flag: string
  /** Largo del número nacional (sin código de país) */
  min: number
  max: number
  /** Agrupación de dígitos para mostrar, ej. [1, 4, 4] → "9 1234 5678" */
  groups: number[]
}

export const COUNTRIES: Country[] = [
  { iso: 'CL', name: 'Chile', dial: '56', flag: '🇨🇱', min: 9, max: 9, groups: [1, 4, 4] },
  { iso: 'AR', name: 'Argentina', dial: '54', flag: '🇦🇷', min: 10, max: 11, groups: [2, 4, 4] },
  { iso: 'PE', name: 'Perú', dial: '51', flag: '🇵🇪', min: 9, max: 9, groups: [3, 3, 3] },
  { iso: 'BO', name: 'Bolivia', dial: '591', flag: '🇧🇴', min: 8, max: 8, groups: [4, 4] },
  { iso: 'BR', name: 'Brasil', dial: '55', flag: '🇧🇷', min: 10, max: 11, groups: [2, 5, 4] },
  { iso: 'UY', name: 'Uruguay', dial: '598', flag: '🇺🇾', min: 8, max: 9, groups: [2, 3, 3] },
  { iso: 'PY', name: 'Paraguay', dial: '595', flag: '🇵🇾', min: 9, max: 9, groups: [3, 3, 3] },
  { iso: 'CO', name: 'Colombia', dial: '57', flag: '🇨🇴', min: 10, max: 10, groups: [3, 3, 4] },
  { iso: 'EC', name: 'Ecuador', dial: '593', flag: '🇪🇨', min: 9, max: 9, groups: [2, 3, 4] },
  { iso: 'VE', name: 'Venezuela', dial: '58', flag: '🇻🇪', min: 10, max: 10, groups: [3, 3, 4] },
  { iso: 'MX', name: 'México', dial: '52', flag: '🇲🇽', min: 10, max: 10, groups: [2, 4, 4] },
  { iso: 'US', name: 'Estados Unidos / Canadá', dial: '1', flag: '🇺🇸', min: 10, max: 10, groups: [3, 3, 4] },
  { iso: 'ES', name: 'España', dial: '34', flag: '🇪🇸', min: 9, max: 9, groups: [3, 3, 3] },
  { iso: 'FR', name: 'Francia', dial: '33', flag: '🇫🇷', min: 9, max: 9, groups: [1, 2, 2, 2, 2] },
  { iso: 'DE', name: 'Alemania', dial: '49', flag: '🇩🇪', min: 10, max: 11, groups: [3, 4, 4] },
  { iso: 'IT', name: 'Italia', dial: '39', flag: '🇮🇹', min: 9, max: 10, groups: [3, 3, 4] },
  { iso: 'GB', name: 'Reino Unido', dial: '44', flag: '🇬🇧', min: 10, max: 10, groups: [4, 3, 3] },
]

export const DEFAULT_COUNTRY = COUNTRIES[0]

// Para detectar el código, probamos primero los más largos ("591" antes que "59")
const BY_DIAL_LENGTH = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length)

export const countryByIso = (iso: string) => COUNTRIES.find((c) => c.iso === iso) ?? DEFAULT_COUNTRY

export interface ParsedPhone {
  country: Country
  national: string // solo dígitos
}

/**
 * Interpreta lo que venga guardado o desde la agenda:
 * "+56 9 1234 5678", "+56912345678", "0056 9…", "912345678" (sin código → país por defecto).
 */
export function parsePhone(value: string, fallback: Country = DEFAULT_COUNTRY): ParsedPhone {
  const raw = (value ?? '').trim()
  if (!raw) return { country: fallback, national: '' }
  let digits = raw.replace(/\D/g, '')
  const international = raw.startsWith('+') || digits.startsWith('00')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (international) {
    const country = BY_DIAL_LENGTH.find((c) => digits.startsWith(c.dial))
    if (country) return { country, national: digits.slice(country.dial.length) }
  }
  // Número local; en Chile a veces se escribe con el 56 sin "+"
  if (fallback.iso === 'CL' && digits.length === 11 && digits.startsWith('56')) {
    return { country: fallback, national: digits.slice(2) }
  }
  return { country: fallback, national: digits.replace(/^0+/, '') }
}

/** Agrupa los dígitos nacionales para mostrar: "912345678" → "9 1234 5678" */
/** Algunos países agrupan distinto según el tipo de número */
function groupsFor(country: Country, national: string) {
  if (country.iso === 'AR' && national.startsWith('9')) return [1, 2, 4, 4] // móvil: 9 11 2345 6789
  if (country.iso === 'BR' && national.length <= 10) return [2, 4, 4] // fijo: 11 2345 6789
  return country.groups
}

export function groupNational(country: Country, national: string) {
  const out: string[] = []
  let i = 0
  for (const g of groupsFor(country, national)) {
    if (i >= national.length) break
    out.push(national.slice(i, i + g))
    i += g
  }
  if (i < national.length) out.push(national.slice(i))
  return out.join(' ')
}

export function formatPhone(country: Country, national: string) {
  const n = national.replace(/\D/g, '')
  return n ? `+${country.dial} ${groupNational(country, n)}` : ''
}

export type PhoneError = 'length'

export function phoneError(value: string): PhoneError | null {
  const { country, national } = parsePhone(value)
  if (national.length < country.min || national.length > country.max) return 'length'
  return null
}

export function phoneErrorMessage(value: string) {
  const { country } = parsePhone(value)
  const len = country.min === country.max ? `${country.min}` : `${country.min} a ${country.max}`
  return country.iso === 'CL'
    ? 'El número debe tener 9 dígitos. Ej: 9 1234 5678'
    : `Para ${country.name} el número debe tener ${len} dígitos (sin el código de país).`
}

/** Número en formato wa.me / tel: ("56912345678") */
export const toE164Digits = (value: string) => {
  const { country, national } = parsePhone(value)
  return national ? `${country.dial}${national}` : ''
}

/** Normaliza cualquier valor guardado al formato "+56 9 1234 5678" (vacío se mantiene vacío) */
export function normalizePhone(value: string) {
  const { country, national } = parsePhone(value)
  return formatPhone(country, national)
}
