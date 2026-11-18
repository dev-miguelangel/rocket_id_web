/** Modelo y validaciones de la ficha personal. Todos los valores se guardan como string. */

export const DOC_TYPES = [
  { value: 'rut', label: 'RUT' },
  { value: 'dni', label: 'DNI' },
  { value: 'passport', label: 'Pasaporte' },
] as const

export const INSURANCE_SYSTEMS = [
  { value: 'fonasa', label: 'Fonasa' },
  { value: 'isapre', label: 'Isapre' },
  { value: 'private', label: 'Seguro privado' },
  { value: 'other', label: 'Otro' },
  { value: 'none', label: 'Sin previsión' },
] as const

export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown'] as const

/** Documento users/{uid} */
export interface IdentityData {
  fullName: string
  docType: string
  docNumber: string
  birthDate: string // YYYY-MM-DD
  phone: string
  contactEmail: string
}

/** Documento users/{uid}/private/emergency (datos sensibles) */
export interface EmergencyData {
  emergencyName: string
  emergencyRelationship: string
  emergencyPhone: string
  insuranceSystem: string
  insuranceDetail: string
  bloodType: string
  allergies: string
  conditions: string
  medications: string
}

export type ProfileForm = IdentityData & EmergencyData

export const IDENTITY_KEYS = ['fullName', 'docType', 'docNumber', 'birthDate', 'phone', 'contactEmail'] as const
export const EMERGENCY_KEYS = [
  'emergencyName',
  'emergencyRelationship',
  'emergencyPhone',
  'insuranceSystem',
  'insuranceDetail',
  'bloodType',
  'allergies',
  'conditions',
  'medications',
] as const

export const emptyProfile: ProfileForm = {
  fullName: '',
  docType: 'rut',
  docNumber: '',
  birthDate: '',
  phone: '',
  contactEmail: '',
  emergencyName: '',
  emergencyRelationship: '',
  emergencyPhone: '',
  insuranceSystem: '',
  insuranceDetail: '',
  bloodType: '',
  allergies: '',
  conditions: '',
  medications: '',
}

/** Límites de largo; deben coincidir con firestore.rules */
export const MAX_LEN = { short: 120, long: 1000 } as const

// ---------- RUT chileno ----------

export function cleanRut(v: string) {
  return v.replace(/[^0-9kK]/g, '').toUpperCase()
}

export function isValidRut(v: string) {
  const rut = cleanRut(v)
  if (rut.length < 2) return false
  const body = rut.slice(0, -1)
  const dv = rut.slice(-1)
  if (!/^\d+$/.test(body)) return false
  let sum = 0
  let mul = 2
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * mul
    mul = mul === 7 ? 2 : mul + 1
  }
  const res = 11 - (sum % 11)
  const expected = res === 11 ? '0' : res === 10 ? 'K' : String(res)
  return dv === expected
}

export function formatRut(v: string) {
  const rut = cleanRut(v)
  if (rut.length < 2) return rut
  const body = rut.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${body}-${rut.slice(-1)}`
}

// ---------- Otros formatos ----------

export function isValidPhone(v: string) {
  const digits = v.replace(/[^\d]/g, '')
  return digits.length >= 8 && digits.length <= 15 && /^\+?[\d\s()-]+$/.test(v.trim())
}

export function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

export function ageFrom(birthDate: string): number | null {
  if (!birthDate) return null
  const b = new Date(`${birthDate}T00:00:00`)
  if (Number.isNaN(b.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - b.getFullYear()
  const m = now.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--
  return age
}

const samePhone = (a: string, b: string) => a.replace(/\D/g, '').slice(-8) === b.replace(/\D/g, '').slice(-8)

export type ProfileErrors = Partial<Record<keyof ProfileForm, string>>

/** Errores de formato: bloquean el guardado. Los campos vacíos se permiten (guardado parcial). */
export function validate(f: ProfileForm): ProfileErrors {
  const e: ProfileErrors = {}
  if (f.docNumber && f.docType === 'rut' && !isValidRut(f.docNumber)) e.docNumber = 'RUT inválido. Revisa el dígito verificador.'
  if (f.birthDate) {
    const age = ageFrom(f.birthDate)
    if (age === null || age < 0 || age > 110) e.birthDate = 'Fecha no válida.'
  }
  if (f.phone && !isValidPhone(f.phone)) e.phone = 'Número no válido. Ej: +56 9 1234 5678'
  if (f.contactEmail && !isValidEmail(f.contactEmail)) e.contactEmail = 'Correo no válido.'
  if (f.emergencyPhone && !isValidPhone(f.emergencyPhone)) e.emergencyPhone = 'Número no válido.'
  else if (f.emergencyPhone && f.phone && samePhone(f.phone, f.emergencyPhone))
    e.emergencyPhone = 'Debe ser el teléfono de otra persona, no el tuyo.'
  return e
}

/** Campos críticos que conviene completar antes de una salida */
export const CRITICAL_FIELDS: { key: keyof ProfileForm; label: string }[] = [
  { key: 'fullName', label: 'Nombre completo' },
  { key: 'docNumber', label: 'Documento' },
  { key: 'birthDate', label: 'Fecha de nacimiento' },
  { key: 'phone', label: 'Teléfono' },
  { key: 'emergencyName', label: 'Contacto de emergencia' },
  { key: 'emergencyPhone', label: 'Teléfono de emergencia' },
  { key: 'insuranceSystem', label: 'Previsión de salud' },
  { key: 'bloodType', label: 'Grupo sanguíneo' },
]
