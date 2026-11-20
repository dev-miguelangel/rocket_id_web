import { SKILL_CATEGORIES, type CategoryId } from './skills'

export type Modality = 'presencial' | 'online' | 'mixto'

export interface CourseProvider {
  name: string
  kind: 'institution' | 'instructor'
  verified: boolean
}

export interface Course {
  id: string
  /** Cursos de formadores reales (Firestore). Los de demostración no lo tienen. */
  providerId?: string
  /** Curso ficticio de demostración (se ocultan desde el panel admin) */
  demo?: boolean
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

// ---------- Cursos de formadores (Firestore: courses/{courseId}) ----------

export type CourseStatus = 'draft' | 'published' | 'closed'
export type CourseLevel = Course['level']

export const COURSE_STATUSES: Record<CourseStatus, { label: string; tone: 'neutral' | 'success' | 'info' }> = {
  draft: { label: 'Borrador', tone: 'neutral' },
  published: { label: 'Publicado', tone: 'success' },
  closed: { label: 'Cerrado', tone: 'info' },
}

export const MODALITIES: { value: Modality; label: string }[] = [
  { value: 'presencial', label: 'Presencial' },
  { value: 'online', label: 'Online' },
  { value: 'mixto', label: 'Mixto' },
]
export const LEVELS: CourseLevel[] = ['Inicial', 'Intermedio', 'Avanzado']

/** Curso tal como lo administra el formador */
export interface ProviderCourse extends Course {
  providerId: string
  status: CourseStatus
  instructorUids: string[]
  createdAt: Date | null
  updatedAt: Date | null
}

/** Campos que se editan en el formulario (como texto, para no perder lo que se escribe) */
export interface CourseForm {
  title: string
  category: CategoryId | ''
  summary: string
  description: string
  location: string
  modality: Modality
  startDate: string
  endDate: string
  duration: string
  price: string
  spots: string
  level: CourseLevel
  requirements: string // uno por línea
  certification: string
}

export const COURSE_LIMITS = {
  title: 100,
  summary: 160,
  description: 2000,
  location: 150,
  duration: 60,
  certification: 120,
  requirement: 120,
  requirements: 10,
  maxPrice: 10_000_000,
  maxSpots: 500,
} as const

export const emptyCourseForm = (): CourseForm => ({
  title: '',
  category: '',
  summary: '',
  description: '',
  location: '',
  modality: 'presencial',
  startDate: '',
  endDate: '',
  duration: '',
  price: '',
  spots: '',
  level: 'Inicial',
  requirements: '',
  certification: '',
})

export const courseToForm = (c: Course): CourseForm => ({
  title: c.title,
  category: c.category,
  summary: c.summary,
  description: c.description,
  location: c.location,
  modality: c.modality,
  startDate: c.startDate,
  endDate: c.endDate,
  duration: c.duration,
  price: String(c.priceCLP),
  spots: String(c.spots),
  level: c.level,
  requirements: c.requirements.join('\n'),
  certification: c.certification,
})

export type CourseErrors = Partial<Record<keyof CourseForm, string>>

const DATE = /^\d{4}-\d{2}-\d{2}$/
const splitLines = (v: string) =>
  v
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
const intOf = (v: string) => (/^\d+$/.test(v.trim()) ? Number(v.trim()) : NaN)

/** Hoy en Chile (YYYY-MM-DD) */
export const todayCL = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date())

/** `forPublish`: además exige que el curso no haya terminado */
export function validateCourse(f: CourseForm, forPublish = false): CourseErrors {
  const e: CourseErrors = {}
  const L = COURSE_LIMITS
  if (f.title.trim().length < 3) e.title = 'Escribe el nombre del curso.'
  else if (f.title.length > L.title) e.title = `Máximo ${L.title} caracteres.`
  if (!f.category) e.category = 'Elige una categoría.'
  if (f.summary.trim().length < 10) e.summary = 'Escribe un resumen de una línea.'
  else if (f.summary.length > L.summary) e.summary = `Máximo ${L.summary} caracteres.`
  if (f.description.length > L.description) e.description = `Máximo ${L.description} caracteres.`
  if (f.location.trim().length < 2) e.location = f.modality === 'online' ? 'Escribe la plataforma, por ejemplo Zoom.' : 'Escribe el lugar.'
  else if (f.location.length > L.location) e.location = `Máximo ${L.location} caracteres.`
  if (!DATE.test(f.startDate)) e.startDate = 'Elige la fecha de inicio.'
  if (!DATE.test(f.endDate)) e.endDate = 'Elige la fecha de término.'
  else if (DATE.test(f.startDate) && f.endDate < f.startDate) e.endDate = 'Debe ser igual o posterior al inicio.'
  else if (forPublish && f.endDate < todayCL()) e.endDate = 'El curso ya terminó: cambia las fechas para publicarlo.'
  if (f.duration.length > L.duration) e.duration = `Máximo ${L.duration} caracteres.`
  const price = f.price.trim() === '' ? 0 : intOf(f.price.replace(/\./g, ''))
  if (Number.isNaN(price) || price > L.maxPrice) e.price = 'Escribe el valor en pesos, sin decimales (0 si es gratuito).'
  const spots = intOf(f.spots)
  if (Number.isNaN(spots) || spots < 1 || spots > L.maxSpots) e.spots = `Entre 1 y ${L.maxSpots} cupos.`
  const reqs = splitLines(f.requirements)
  if (reqs.length > L.requirements) e.requirements = `Máximo ${L.requirements} requisitos.`
  else if (reqs.some((r) => r.length > L.requirement)) e.requirements = `Cada requisito puede tener hasta ${L.requirement} caracteres.`
  if (f.certification.length > L.certification) e.certification = `Máximo ${L.certification} caracteres.`
  return e
}

export const hasCourseErrors = (e: CourseErrors) => Object.keys(e).length > 0

/** Datos limpios para Firestore (las reglas validan lo mismo: firestore.rules → validCourse) */
export function courseData(f: CourseForm) {
  return {
    title: f.title.trim(),
    category: f.category,
    summary: f.summary.trim(),
    description: f.description.trim(),
    location: f.location.trim(),
    modality: f.modality,
    startDate: f.startDate,
    endDate: f.endDate,
    duration: f.duration.trim(),
    priceCLP: f.price.trim() === '' ? 0 : Number(f.price.replace(/\./g, '').trim()),
    spots: Number(f.spots.trim()),
    level: f.level,
    requirements: splitLines(f.requirements),
    certification: f.certification.trim(),
  }
}

const str = (v: unknown) => (typeof v === 'string' ? v : '')
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const date = (v: unknown) => (v && typeof (v as { toDate?: () => Date }).toDate === 'function' ? (v as { toDate: () => Date }).toDate() : null)
const CATEGORY_IDS = new Set<string>(SKILL_CATEGORIES.map((c) => c.id))

export function parseCourse(id: string, raw: Record<string, unknown>): ProviderCourse {
  const status = str(raw.status)
  const modality = str(raw.modality)
  const level = str(raw.level)
  const category = str(raw.category)
  return {
    id,
    providerId: str(raw.providerId),
    title: str(raw.title),
    category: (CATEGORY_IDS.has(category) ? category : 'technical') as CategoryId,
    provider: { name: str(raw.providerName), kind: raw.providerKind === 'organization' ? 'institution' : 'instructor', verified: true },
    summary: str(raw.summary),
    description: str(raw.description),
    location: str(raw.location),
    modality: (MODALITIES.some((m) => m.value === modality) ? modality : 'presencial') as Modality,
    startDate: str(raw.startDate),
    endDate: str(raw.endDate),
    duration: str(raw.duration),
    priceCLP: num(raw.priceCLP),
    spots: num(raw.spots),
    level: (LEVELS as string[]).includes(level) ? (level as CourseLevel) : 'Inicial',
    requirements: Array.isArray(raw.requirements) ? raw.requirements.filter((r): r is string => typeof r === 'string') : [],
    certification: str(raw.certification),
    status: status in COURSE_STATUSES ? (status as CourseStatus) : 'draft',
    instructorUids: Array.isArray(raw.instructorUids) ? raw.instructorUids.filter((r): r is string => typeof r === 'string') : [],
    createdAt: date(raw.createdAt),
    updatedAt: date(raw.updatedAt),
  }
}
