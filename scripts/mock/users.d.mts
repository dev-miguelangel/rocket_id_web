// Tipos de scripts/mock/users.mjs (los usa también el panel admin: src/features/admin/mockData.ts)
export interface MockCert {
  id: string
  category: string
  name: string
  issuer: string
  year: string
  expiresAt: string
  status: string
  verifiedBy: string | null
}
export interface MockUser {
  slug: string
  displayName: string
  email: string
  hasCertifications?: 'yes' | 'no' | ''
  certs: MockCert[]
}
export declare const MOCK_USERS: MockUser[]
