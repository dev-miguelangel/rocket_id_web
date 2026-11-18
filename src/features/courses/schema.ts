import type { CategoryId } from '../skills/schema'

export type Modality = 'presencial' | 'online' | 'mixto'

export interface CourseProvider {
  name: string
  kind: 'institution' | 'instructor'
  verified: boolean
}

export interface Course {
  id: string
  title: string
  category: CategoryId
  provider: CourseProvider
  summary: string
  description: string
  location: string
  modality: Modality
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
  duration: string
  priceCLP: number // 0 = gratuito
  spots: number
  level: 'Inicial' | 'Intermedio' | 'Avanzado'
  requirements: string[]
  certification: string
}

// ---------- Postulaciones ----------

export const APPLICATION_STATUSES = {
  sent: { label: 'Enviada', tone: 'info' },
  seen: { label: 'Vista', tone: 'neutral' },
  accepted: { label: 'Aceptada', tone: 'success' },
  rejected: { label: 'Rechazada', tone: 'danger' },
} as const

export type ApplicationStatus = keyof typeof APPLICATION_STATUSES

/** Versión del texto de consentimiento que la persona aceptó. Cambiarla si cambia el texto. */
export const CONSENT_VERSION = '2026-11-v1'

export interface SharedCertification {
  certId: string
  category: string
  name: string
  issuer: string
  year: string
  expiresAt: string
  status: string
}

/** Datos que se comparten con la institución (copia al momento de postular) */
export interface ApplicantSnapshot {
  rocketId: string
  fullName: string
  docType: string
  docNumber: string
  birthDate: string
  phone: string
  contactEmail: string
  hasCertifications: string
  certifications: SharedCertification[]
}

export interface Application {
  id: string
  courseId: string
  courseTitle: string
  providerName: string
  status: ApplicationStatus
  createdAt: Date | null
}

export const applicationId = (uid: string, courseId: string) => `${uid}_${courseId}`

// ---------- Formato ----------

const clp = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
export const formatPrice = (n: number) => (n === 0 ? 'Gratuito' : clp.format(n))

const d = (v: string) => new Date(`${v}T00:00:00`)

export function formatDateRange(start: string, end: string) {
  const s = d(start)
  const e = d(end)
  const day = (x: Date) => x.toLocaleDateString('es', { day: 'numeric' })
  const month = (x: Date) => x.toLocaleDateString('es', { month: 'short' }).replace('.', '')
  if (start === end) return `${day(s)} ${month(s)} ${s.getFullYear()}`
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) return `${day(s)}–${day(e)} ${month(e)} ${e.getFullYear()}`
  return `${day(s)} ${month(s)} – ${day(e)} ${month(e)} ${e.getFullYear()}`
}
