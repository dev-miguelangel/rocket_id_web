/**
 * Formadores: organizaciones o personas independientes certificadas para impartir cursos.
 * Ver iadocs/formadores.md. En Firestore:
 *   providers/{providerId}                → Provider  (independiente: id ind_{uid})
 *   providers/{providerId}/members/{uid}  → Member
 * Las reglas validan lo mismo que validateProvider (firestore.rules → validProvider).
 */

export type ProviderKind = 'organization' | 'independent'
export type ProviderStatus = 'pending' | 'approved' | 'rejected' | 'suspended'
export type MemberRole = 'owner' | 'manager' | 'instructor'

export const PROVIDER_KINDS: Record<ProviderKind, { label: string; hint: string; icon: string }> = {
  organization: { label: 'Organización', hint: 'Escuela, club o centro de formación', icon: '🏫' },
  independent: { label: 'Independiente', hint: 'Persona certificada para impartir cursos', icon: '🧑‍🏫' },
}

export const PROVIDER_STATUSES: Record<ProviderStatus, { label: string; tone: 'info' | 'success' | 'danger' | 'neutral' }> = {
  pending: { label: 'En revisión', tone: 'info' },
  approved: { label: 'Aprobado', tone: 'success' },
  rejected: { label: 'Rechazado', tone: 'danger' },
  suspended: { label: 'Suspendido', tone: 'neutral' },
}

export const MEMBER_ROLES: Record<MemberRole, { label: string; description: string }> = {
  owner: { label: 'Responsable', description: 'Todo, incluido administrar miembros y los datos del formador' },
  manager: { label: 'Coordinación', description: 'Crear y publicar cursos, gestionar postulaciones y verificar' },
  instructor: { label: 'Instructor', description: 'Gestionar las postulaciones de sus cursos y verificar certificaciones del formador' },
}

/** Certificación que habilita a un independiente para impartir cursos */
export interface ProviderCredential {
  name: string
  issuer: string
  number: string
  expiresAt: string // YYYY-MM, '' = sin vencimiento
  evidenceUrl: string
}

export interface ProviderContact {
  name: string
  email: string
  phone: string
}

/** Datos que la persona completa al registrarse */
export interface ProviderForm {
  kind: ProviderKind
  name: string
  website: string
  about: string
  legalName: string
  rut: string
  credential: ProviderCredential
  phone: string
}

export interface Provider extends Omit<ProviderForm, 'phone'> {
  id: string
  ownerUid: string
  contact: ProviderContact
  status: ProviderStatus
  reviewNote: string
  reviewedAt: Date | null
  createdAt: Date | null
  updatedAt: Date | null
}

export interface Member {
  uid: string
  providerId: string
  role: MemberRole
  addedBy: string
  since: Date | null
}

export const independentId = (uid: string) => `ind_${uid}`

export const emptyCredential = (): ProviderCredential => ({ name: '', issuer: '', number: '', expiresAt: '', evidenceUrl: '' })

export const emptyProviderForm = (kind: ProviderKind, name = ''): ProviderForm => ({
  kind,
  name,
  website: '',
  about: '',
  legalName: '',
  rut: '',
  credential: emptyCredential(),
  phone: '',
})

export const providerToForm = (p: Provider): ProviderForm => ({
  kind: p.kind,
  name: p.name,
  website: p.website,
  about: p.about,
  legalName: p.legalName,
  rut: p.rut,
  credential: { ...p.credential },
  phone: p.contact.phone,
})

// ---------- RUT chileno ----------

/** "76.123.456-k" → "76123456-K" (formato que guardan las reglas) */
export function normalizeRut(v: string) {
  const clean = v.toUpperCase().replace(/[^0-9K]/g, '')
  if (clean.length < 2) return clean
  return `${clean.slice(0, -1)}-${clean.slice(-1)}`
}

/** Dígito verificador (módulo 11) */
export function isValidRut(v: string) {
  const rut = normalizeRut(v)
  const m = rut.match(/^(\d{7,8})-([\dK])$/)
  if (!m) return false
  let sum = 0
  let mul = 2
  for (const d of m[1].split('').reverse()) {
    sum += Number(d) * mul
    mul = mul === 7 ? 2 : mul + 1
  }
  const r = 11 - (sum % 11)
  const dv = r === 11 ? '0' : r === 10 ? 'K' : String(r)
  return dv === m[2]
}

/** "76123456-K" → "76.123.456-K" */
export function formatRut(v: string) {
  const rut = normalizeRut(v)
  const [body, dv] = rut.split('-')
  if (!dv) return v
  return `${body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${dv}`
}

// ---------- Validación ----------

/** credName = nombre de la certificación (name ya es el nombre visible del formador) */
export type ProviderErrors = Partial<
  Record<'name' | 'website' | 'about' | 'legalName' | 'rut' | 'phone' | 'credName' | Exclude<keyof ProviderCredential, 'name'>, string>
>

const isUrl = (v: string) => /^https?:\/\/[^\s.]+\.[^\s]+$/i.test(v)
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/

export function validateProvider(f: ProviderForm): ProviderErrors {
  const e: ProviderErrors = {}
  const name = f.name.trim()
  if (name.length < 2) e.name = 'Escribe el nombre que verá la comunidad.'
  else if (name.length > 80) e.name = 'Máximo 80 caracteres.'
  if (f.website.trim() && !isUrl(f.website.trim())) e.website = 'Escribe una dirección completa, por ejemplo https://tusitio.cl'
  else if (f.website.length > 200) e.website = 'Máximo 200 caracteres.'
  if (f.about.length > 500) e.about = 'Máximo 500 caracteres.'
  if (f.phone.length > 30) e.phone = 'Máximo 30 caracteres.'

  if (f.kind === 'organization') {
    const legal = f.legalName.trim()
    if (legal.length < 2) e.legalName = 'Escribe la razón social.'
    else if (legal.length > 120) e.legalName = 'Máximo 120 caracteres.'
    if (!f.rut.trim()) e.rut = 'Escribe el RUT de la organización.'
    else if (!isValidRut(f.rut)) e.rut = 'El RUT no es válido. Revisa el dígito verificador.'
  } else {
    const c = f.credential
    if (c.name.trim().length < 2 || c.name.length > 100) e.credName = 'Escribe la certificación que te habilita.'
    if (c.issuer.trim().length < 2 || c.issuer.length > 100) e.issuer = 'Escribe quién la emitió.'
    if (c.number.length > 60) e.number = 'Máximo 60 caracteres.'
    if (c.expiresAt && !MONTH.test(c.expiresAt)) e.expiresAt = 'Elige mes y año.'
    if (c.evidenceUrl.trim() && !isUrl(c.evidenceUrl.trim())) e.evidenceUrl = 'Pega un enlace completo, por ejemplo https://…'
    else if (c.evidenceUrl.length > 300) e.evidenceUrl = 'Máximo 300 caracteres.'
  }
  return e
}

export const hasProviderErrors = (e: ProviderErrors) => Object.keys(e).length > 0

/** Datos limpios para Firestore (sin los campos que no corresponden al tipo) */
export function providerData(f: ProviderForm) {
  const base = { kind: f.kind, name: f.name.trim(), website: f.website.trim(), about: f.about.trim() }
  if (f.kind === 'organization') return { ...base, legalName: f.legalName.trim(), rut: normalizeRut(f.rut) }
  const c = f.credential
  return {
    ...base,
    credential: { name: c.name.trim(), issuer: c.issuer.trim(), number: c.number.trim(), expiresAt: c.expiresAt, evidenceUrl: c.evidenceUrl.trim() },
  }
}

// ---------- Lectura ----------

const str = (v: unknown) => (typeof v === 'string' ? v : '')
const date = (v: unknown) => (v && typeof (v as { toDate?: () => Date }).toDate === 'function' ? (v as { toDate: () => Date }).toDate() : null)

export function parseProvider(id: string, raw: Record<string, unknown>): Provider {
  const c = (raw.credential && typeof raw.credential === 'object' ? raw.credential : {}) as Record<string, unknown>
  const ct = (raw.contact && typeof raw.contact === 'object' ? raw.contact : {}) as Record<string, unknown>
  const status = str(raw.status)
  return {
    id,
    kind: raw.kind === 'organization' ? 'organization' : 'independent',
    name: str(raw.name),
    website: str(raw.website),
    about: str(raw.about),
    legalName: str(raw.legalName),
    rut: str(raw.rut),
    credential: { name: str(c.name), issuer: str(c.issuer), number: str(c.number), expiresAt: str(c.expiresAt), evidenceUrl: str(c.evidenceUrl) },
    contact: { name: str(ct.name), email: str(ct.email), phone: str(ct.phone) },
    ownerUid: str(raw.ownerUid),
    status: status in PROVIDER_STATUSES ? (status as ProviderStatus) : 'pending',
    reviewNote: str(raw.reviewNote),
    reviewedAt: date(raw.reviewedAt),
    createdAt: date(raw.createdAt),
    updatedAt: date(raw.updatedAt),
  }
}

export function parseMember(providerId: string, raw: Record<string, unknown>): Member {
  const role = str(raw.role)
  return {
    uid: str(raw.uid),
    providerId,
    role: role in MEMBER_ROLES ? (role as MemberRole) : 'instructor',
    addedBy: str(raw.addedBy),
    since: date(raw.since),
  }
}

// ---------- Vigencia de la certificación (independientes) ----------

const thisMonth = () => new Date().toISOString().slice(0, 7)

/** 'expired' | 'soon' (≤ 30 días) | null */
export function credentialExpiry(p: Pick<Provider, 'kind' | 'credential'>): 'expired' | 'soon' | null {
  const exp = p.kind === 'independent' ? p.credential.expiresAt : ''
  if (!exp) return null
  if (exp < thisMonth()) return 'expired'
  // Vence a fin de ese mes
  const [y, m] = exp.split('-').map(Number)
  const end = new Date(y, m, 0, 23, 59)
  return end.getTime() - Date.now() <= 30 * 86400000 ? 'soon' : null
}

export function formatMonthYear(v: string) {
  if (!MONTH.test(v)) return v
  const [y, m] = v.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })
}
