import { collection, getDocs, type Timestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'

export interface AdminUser {
  uid: string
  displayName: string
  photoURL: string | null
  rocketId: string
  email: string
  createdAt: Date | null
  lastLoginAt: Date | null
  isMock: boolean
}

const toDate = (v: unknown) => (v && typeof (v as Timestamp).toDate === 'function' ? (v as Timestamp).toDate() : null)

/** Todas las cuentas (solo la administración puede listarlas: lo exigen las reglas de Firestore) */
export async function fetchUsers(): Promise<AdminUser[]> {
  const snap = await getDocs(collection(db, 'users'))
  return snap.docs.map((d) => {
    const v = d.data()
    return {
      uid: d.id,
      displayName: typeof v.displayName === 'string' ? v.displayName : '',
      photoURL: typeof v.photoURL === 'string' ? v.photoURL : null,
      rocketId: typeof v.rocketId === 'string' ? v.rocketId : '—',
      email: typeof v.email === 'string' ? v.email : '',
      createdAt: toDate(v.createdAt),
      lastLoginAt: toDate(v.lastLoginAt),
      isMock: d.id.startsWith('mock_') || !!v._mock,
    }
  })
}
