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
