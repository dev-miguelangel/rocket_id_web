import { doc, onSnapshot, serverTimestamp, writeBatch } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { normalizePhone } from '../../lib/phone'
import { EMERGENCY_KEYS, IDENTITY_KEYS, emptyProfile, normalizeInsurance, type ProfileForm } from './schema'

const identityRef = (uid: string) => doc(db, 'users', uid)
const emergencyRef = (uid: string) => doc(db, 'users', uid, 'private', 'emergency')

const pick = <K extends keyof ProfileForm>(f: ProfileForm, keys: readonly K[]) =>
  Object.fromEntries(keys.map((k) => [k, f[k].trim()])) as Pick<ProfileForm, K>

/**
 * Escucha ambos documentos y entrega la ficha combinada.
 * `onLoad` se llama cuando ambos snapshots llegaron al menos una vez.
 */
export function subscribeProfile(
  uid: string,
  onLoad: (profile: ProfileForm, defaults: { email: string; name: string }) => void,
) {
  let identity: Record<string, unknown> | undefined
  let emergency: Record<string, unknown> | undefined
  const emit = () => {
    if (identity === undefined || emergency === undefined) return
    const merged = { ...emptyProfile }
    for (const k of [...IDENTITY_KEYS, ...EMERGENCY_KEYS]) {
      const v = (k in emergency ? emergency : identity)[k]
      if (typeof v === 'string') merged[k] = v
    }
    merged.insuranceSystem = normalizeInsurance(merged.insuranceSystem)
    // Teléfonos antiguos sin código de país ("912345678") → "+56 9 1234 5678"
    merged.phone = normalizePhone(merged.phone)
    merged.emergencyPhone = normalizePhone(merged.emergencyPhone)
    onLoad(merged, {
      email: typeof identity.email === 'string' ? identity.email : '',
      name: typeof identity.displayName === 'string' ? identity.displayName : '',
    })
  }
  const u1 = onSnapshot(identityRef(uid), (s) => {
    identity = s.data() ?? {}
    emit()
  })
  const u2 = onSnapshot(emergencyRef(uid), (s) => {
    emergency = s.data() ?? {}
    emit()
  })
  return () => {
    u1()
    u2()
  }
}

/** Guarda ambos documentos de forma atómica. Offline, queda en cola y se sincroniza al volver la red. */
export function saveProfile(uid: string, f: ProfileForm) {
  const batch = writeBatch(db)
  batch.set(identityRef(uid), { ...pick(f, IDENTITY_KEYS), updatedAt: serverTimestamp() }, { merge: true })
  batch.set(emergencyRef(uid), { ...pick(f, EMERGENCY_KEYS), updatedAt: serverTimestamp() }, { merge: true })
  return batch.commit()
}
