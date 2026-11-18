/** Conocimientos y certificaciones outdoor. Documento: users/{uid}/private/skills */

export const SKILL_CATEGORIES = [
  {
    id: 'first_aid',
    label: 'Primeros auxilios y medicina remota',
    short: 'Primeros auxilios',
    icon: '🩹',
    suggestions: [
      'WFA (Wilderness First Aid)',
      'WAFA (Wilderness Advanced First Aid)',
      'WFR (Wilderness First Responder)',
      'RCP básico',
      'Soporte vital básico (BLS)',
    ],
  },
  {
    id: 'rescue',
    label: 'Rescate y seguridad en terreno',
    short: 'Rescate',
    icon: '🧗',
    suggestions: [
      'Autorrescate en roca',
      'Autorrescate en montaña',
      'Rescate en avalanchas AIARE 1',
      'Rescate en avalanchas AIARE 2',
      'Manejo de cuerdas y nudos',
      'Rescate en aguas blancas',
    ],
  },
  {
    id: 'navigation',
    label: 'Orientación y navegación',
    short: 'Navegación',
    icon: '🧭',
    suggestions: [
      'Lectura de mapas y brújula',
      'Navegación con GPS',
      'Aplicaciones cartográficas (Gaia GPS, Wikiloc, Garmin)',
      'Meteorología de montaña',
    ],
  },
  {
    id: 'technical',
    label: 'Formación técnica outdoor',
    short: 'Formación técnica',
    icon: '🎒',
    suggestions: [
      'Curso básico de montaña',
      'Iniciación a la escalada',
      'Escalada deportiva',
      'Escalada tradicional',
      'Escalada en hielo',
      'Alta montaña / técnica de glaciar',
      'Esquí de montaña (randonée)',
      'Kayak de río',
      'Kayak de mar',
      'Rafting',
      'Buceo Open Water',
      'Buceo Advanced',
      'Ciclismo de montaña (MTB)',
    ],
  },
  {
    id: 'guiding',
    label: 'Guía y liderazgo outdoor',
    short: 'Guía',
    icon: '🥾',
    suggestions: [
      'Monitor de trekking',
      'Guía de trekking',
      'Guía de montaña',
      'Monitor de escalada',
      'Guía de ciclismo',
    ],
  },
  {
    id: 'ethics',
    label: 'Liderazgo y ética ambiental',
    short: 'Ética ambiental',
    icon: '🌱',
    suggestions: ['No Deje Rastro (Leave No Trace)', 'Leave No Trace Trainer'],
  },
] as const

export type CategoryId = (typeof SKILL_CATEGORIES)[number]['id']

export const ISSUER_SUGGESTIONS = [
  'Cruz Roja',
  'NOLS',
  'Ecomed',
  'WMI (Wilderness Medical Institute)',
  'Wilderness Medical Associates',
  'AIARE',
  'ENAM',
  'Federación de Andinismo de Chile',
  'Leave No Trace',
  'PADI',
  'SSI',
]

export const CERT_STATUSES = [
  { value: 'active', label: 'Vigente', tone: 'success' },
  { value: 'expired', label: 'Vencido', tone: 'warning' },
  { value: 'in_progress', label: 'En curso', tone: 'info' },
] as const

export type CertStatus = (typeof CERT_STATUSES)[number]['value']

export interface Certification {
  id: string
  category: CategoryId | ''
  name: string
  issuer: string
  year: string // YYYY
  expiresAt: string // YYYY-MM (opcional)
  status: CertStatus | ''
}

export interface SkillsData {
  hasCertifications: 'yes' | 'no' | ''
  categories: CategoryId[]
  certifications: Certification[]
}

export const emptySkills: SkillsData = { hasCertifications: '', categories: [], certifications: [] }

export const MAX_CERTS = 20

export const categoryOf = (id: string) => SKILL_CATEGORIES.find((c) => c.id === id)
export const statusOf = (v: string) => CERT_STATUSES.find((s) => s.value === v)

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

export const emptyCert = (category: CategoryId | '' = ''): Certification => ({
  id: newId(),
  category,
  name: '',
  issuer: '',
  year: '',
  expiresAt: '',
  status: '',
})

const currentMonth = () => new Date().toISOString().slice(0, 7)

/** true si la fecha de vencimiento (YYYY-MM) ya pasó */
export const isPastExpiry = (expiresAt: string) => !!expiresAt && expiresAt < currentMonth()

export function formatMonth(v: string) {
  if (!/^\d{4}-\d{2}$/.test(v)) return v
  const d = new Date(`${v}-01T00:00:00`)
  return d.toLocaleDateString('es', { month: 'short', year: 'numeric' }).replace('.', '')
}

export type CertErrors = Partial<Record<keyof Certification, string>>
export interface SkillsErrors {
  general?: string
  certs: Record<string, CertErrors>
}

export function validateSkills(s: SkillsData): SkillsErrors {
  const errors: SkillsErrors = { certs: {} }
  if (s.hasCertifications !== 'yes') return errors
  if (s.certifications.length === 0) errors.general = 'Agrega al menos una certificación o responde “No”.'
  const thisYear = new Date().getFullYear()
  for (const c of s.certifications) {
    const e: CertErrors = {}
    if (!c.category) e.category = 'Elige un área.'
    if (!c.name.trim()) e.name = 'Indica el nombre del curso.'
    if (!c.issuer.trim()) e.issuer = 'Indica quién lo emitió.'
    if (!c.status) e.status = 'Indica el estado.'
    if (c.status !== 'in_progress' && !c.year) e.year = 'Indica el año.'
    if (c.year && (Number(c.year) < 1950 || Number(c.year) > thisYear)) e.year = 'Año no válido.'
    if (c.expiresAt && c.year && c.expiresAt.slice(0, 4) < c.year) e.expiresAt = 'No puede vencer antes de obtenerse.'
    if (c.status === 'active' && isPastExpiry(c.expiresAt))
      e.status = 'Según la fecha ya venció. Marca “Vencido” o actualiza el vencimiento.'
    if (Object.keys(e).length) errors.certs[c.id] = e
  }
  return errors
}

export const hasSkillsErrors = (e: SkillsErrors) => !!e.general || Object.keys(e.certs).length > 0

/** Limpia antes de guardar: con "No" se descartan las certificaciones. */
export function normalizeSkills(s: SkillsData): SkillsData {
  if (s.hasCertifications !== 'yes') return { hasCertifications: s.hasCertifications, categories: [], certifications: [] }
  const certifications = s.certifications.slice(0, MAX_CERTS).map((c) => ({
    ...c,
    name: c.name.trim().slice(0, 120),
    issuer: c.issuer.trim().slice(0, 120),
  }))
  // Toda área usada por una certificación queda marcada
  const categories = [...new Set([...s.categories, ...certifications.map((c) => c.category).filter(Boolean)])] as CategoryId[]
  return { hasCertifications: 'yes', categories, certifications }
}

/** Convierte lo que venga de Firestore a un SkillsData seguro */
export function parseSkills(raw: Record<string, unknown> | undefined): SkillsData {
  if (!raw) return emptySkills
  const has = raw.hasCertifications === 'yes' || raw.hasCertifications === 'no' ? raw.hasCertifications : ''
  const validCat = (v: unknown): v is CategoryId => typeof v === 'string' && !!categoryOf(v)
  const categories = Array.isArray(raw.categories) ? raw.categories.filter(validCat) : []
  const str = (v: unknown) => (typeof v === 'string' ? v : '')
  const certifications = Array.isArray(raw.certifications)
    ? raw.certifications
        .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
        .map((c): Certification => ({
          id: str(c.id) || newId(),
          category: validCat(c.category) ? c.category : '',
          name: str(c.name),
          issuer: str(c.issuer),
          year: str(c.year),
          expiresAt: str(c.expiresAt),
          status: (statusOf(str(c.status))?.value ?? '') as CertStatus | '',
        }))
    : []
  return { hasCertifications: has, categories, certifications }
}

// ---------- Verificación por la institución emisora ----------
// Documento users/{uid}/private/verifications — solo lectura para la persona.
// Lo escribirá la app de instituciones (por ahora: consola de Firebase / Admin SDK).

/** Datos de la certificación tal como fueron verificados */
export interface VerifiedSnapshot {
  name: string
  issuer: string
  year: string
  expiresAt: string
}

export interface Verification {
  verifiedBy: string // nombre de la institución que verificó
  verifiedAt: Date | null
  snapshot: VerifiedSnapshot
}

export type Verifications = Record<string, Verification>

const norm = (v: string) => v.trim().toLocaleLowerCase('es').replace(/\s+/g, ' ')

/**
 * Una certificación está verificada solo si sus datos coinciden con lo que verificó la institución.
 * Si la persona edita nombre, institución, año o vencimiento, la verificación deja de aplicar.
 */
export function verificationFor(cert: Certification, all: Verifications): Verification | null {
  const v = all[cert.id]
  if (!v) return null
  const s = v.snapshot
  const same =
    norm(s.name) === norm(cert.name) &&
    norm(s.issuer) === norm(cert.issuer) &&
    s.year === cert.year &&
    s.expiresAt === cert.expiresAt
  return same ? v : null
}

export function parseVerifications(raw: Record<string, unknown> | undefined): Verifications {
  const certs = raw?.certs
  if (!certs || typeof certs !== 'object') return {}
  const str = (v: unknown) => (typeof v === 'string' ? v : '')
  const out: Verifications = {}
  for (const [id, value] of Object.entries(certs as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue
    const v = value as Record<string, unknown>
    const snap = (v.snapshot && typeof v.snapshot === 'object' ? v.snapshot : {}) as Record<string, unknown>
    const at = v.verifiedAt as { toDate?: () => Date } | undefined
    out[id] = {
      verifiedBy: str(v.verifiedBy),
      verifiedAt: typeof at?.toDate === 'function' ? at.toDate() : null,
      snapshot: { name: str(snap.name), issuer: str(snap.issuer), year: str(snap.year), expiresAt: str(snap.expiresAt) },
    }
  }
  return out
}
