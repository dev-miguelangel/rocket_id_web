/**
 * Formadores: organizaciones o personas independientes certificadas para impartir cursos.
 * Ver iadocs/formadores.md. En Firestore:
 *   providers/{providerId}                → Provider
 *   providers/{providerId}/members/{uid}  → Member
 */

export type ProviderKind = 'organization' | 'independent'
export type ProviderStatus = 'pending' | 'approved' | 'suspended'
export type MemberRole = 'owner' | 'manager' | 'instructor'

export const PROVIDER_KINDS: Record<ProviderKind, { label: string; hint: string }> = {
  organization: { label: 'Organización', hint: 'Escuela, club o centro de formación' },
  independent: { label: 'Independiente', hint: 'Persona certificada para impartir cursos' },
}

export const PROVIDER_STATUSES: Record<ProviderStatus, { label: string; tone: 'info' | 'success' | 'danger' }> = {
  pending: { label: 'En revisión', tone: 'info' },
  approved: { label: 'Aprobado', tone: 'success' },
  suspended: { label: 'Suspendido', tone: 'danger' },
}

export const MEMBER_ROLES: Record<MemberRole, { label: string; description: string }> = {
  owner: { label: 'Responsable', description: 'Todo, incluido administrar miembros y los datos del formador' },
  manager: { label: 'Coordinación', description: 'Crear y publicar cursos, gestionar postulaciones y verificar' },
  instructor: { label: 'Instructor', description: 'Gestionar las postulaciones de sus cursos y verificar certificaciones del formador' },
}

export interface Provider {
  id: string
  kind: ProviderKind
  name: string
  status: ProviderStatus
  website: string
  /** Solo organizaciones */
  legalName: string
  rut: string
  logoUrl: string
  createdAt: Date | null
}

export interface Member {
  uid: string
  providerId: string
  role: MemberRole
  /** Copia del estado del formador: las reglas lo usan para ahorrar una lectura */
  providerStatus: ProviderStatus
  addedBy: string
  since: Date | null
}
