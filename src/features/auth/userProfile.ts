import type { User } from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc, type Timestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'

export interface UserProfile {
  displayName: string
  email: string
  photoURL: string | null
  phone?: string
  bio?: string
  createdAt?: Timestamp
  lastLoginAt?: Timestamp
}

export const userDocRef = (uid: string) => doc(db, 'users', uid)

/** Crea el documento del usuario en el primer login y actualiza lastLoginAt en los siguientes. */
export async function upsertUserProfile(user: User) {
  const ref = userDocRef(user.uid)
  const snap = await getDoc(ref)
  const base = {
    displayName: user.displayName ?? '',
    email: user.email ?? '',
    photoURL: user.photoURL ?? null,
    lastLoginAt: serverTimestamp(),
  }
  if (snap.exists()) {
    await setDoc(ref, { lastLoginAt: base.lastLoginAt }, { merge: true })
  } else {
    await setDoc(ref, { ...base, createdAt: serverTimestamp() })
  }
}
