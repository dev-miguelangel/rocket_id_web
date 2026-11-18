import { collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import type { PublicProfile } from './publicProfile'

/** Persona en "Mi cordada" (copia de su perfil público al agregarla) */
export interface Contact {
  uid: string
  rocketId: string
  displayName: string
  photoURL: string | null
  addedAt: Date | null
}

const contactsCol = (uid: string) => collection(db, 'users', uid, 'contacts')

export function subscribeContacts(uid: string, cb: (c: Contact[]) => void) {
  return onSnapshot(
    query(contactsCol(uid), orderBy('displayName')),
    (snap) =>
      cb(
        snap.docs.map((d) => {
          const v = d.data()
          return {
            uid: d.id,
            rocketId: String(v.rocketId ?? ''),
            displayName: String(v.displayName ?? ''),
            photoURL: typeof v.photoURL === 'string' ? v.photoURL : null,
            addedAt: typeof v.addedAt?.toDate === 'function' ? v.addedAt.toDate() : null,
          }
        }),
      ),
    () => cb([]),
  )
}

export function addContact(uid: string, p: PublicProfile) {
  return setDoc(doc(contactsCol(uid), p.uid), {
    uid: p.uid,
    rocketId: p.rocketId,
    displayName: p.displayName,
    photoURL: p.photoURL,
    addedAt: serverTimestamp(),
  })
}

export function removeContact(uid: string, contactUid: string) {
  return deleteDoc(doc(contactsCol(uid), contactUid))
}
