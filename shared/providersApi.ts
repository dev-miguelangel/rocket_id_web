import {
  collection,
  collectionGroup,
  deleteField,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'
import {
  independentId,
  parseMember,
  parseProvider,
  providerData,
  type MemberRole,
  type Provider,
  type ProviderForm,
  type ProviderStatus,
} from './domain/providers'

interface Account {
  uid: string
  displayName: string | null
  email: string | null
}

export interface Membership {
  provider: Provider
  role: MemberRole
}

/**
 * Formadores de los que la persona es parte, en vivo.
 * `null` mientras carga. Las reglas solo permiten consultar las propias membresías.
 */
export function subscribeMyProviders(uid: string, cb: (list: Membership[] | null, error?: unknown) => void): Unsubscribe {
  const roles = new Map<string, MemberRole>()
  const providers = new Map<string, Provider | null>()
  const subs = new Map<string, Unsubscribe>()
  const retries = new Map<string, ReturnType<typeof setTimeout>>()
  let membersReady = false
  let closed = false

  const emit = () => {
    if (closed || !membersReady || [...roles.keys()].some((id) => !providers.has(id))) return
    const list = [...roles.entries()]
      .map(([id, role]) => ({ provider: providers.get(id), role }))
      .filter((m): m is Membership => !!m.provider)
      .sort((a, b) => (a.provider.createdAt?.getTime() ?? 0) - (b.provider.createdAt?.getTime() ?? 0))
    cb(list)
  }

  /**
   * El formador se lee con su propio listener. Si el servidor lo rechaza (por ejemplo, porque la escritura
   * del registro aún no llegaba), se reintenta unas veces antes de darlo por inaccesible.
   */
  const watchProvider = (pid: string, attempt = 0) => {
    subs.set(
      pid,
      onSnapshot(
        doc(db, 'providers', pid),
        (p) => {
          providers.set(pid, p.exists() ? parseProvider(p.id, p.data()) : null)
          emit()
        },
        () => {
          subs.delete(pid)
          if (closed || !roles.has(pid)) return
          if (attempt < 3) {
            retries.set(
              pid,
              setTimeout(
                () => {
                  retries.delete(pid)
                  if (!closed && roles.has(pid)) watchProvider(pid, attempt + 1)
                },
                800 * (attempt + 1),
              ),
            )
            return
          }
          providers.set(pid, null)
          emit()
        },
      ),
    )
  }

  const forget = (pid: string) => {
    roles.delete(pid)
    providers.delete(pid)
    subs.get(pid)?.()
    subs.delete(pid)
    clearTimeout(retries.get(pid))
    retries.delete(pid)
  }

  const unsubMembers = onSnapshot(
    query(collectionGroup(db, 'members'), where('uid', '==', uid)),
    // Con metadatos: una membresía recién escrita se considera cuando el servidor la confirma,
    // así el formador (escrito en el mismo lote) ya existe al leerlo.
    { includeMetadataChanges: true },
    (snap) => {
      const seen = new Set<string>()
      for (const d of snap.docs) {
        const pid = d.ref.parent.parent?.id
        if (!pid || d.metadata.hasPendingWrites) continue
        seen.add(pid)
        roles.set(pid, parseMember(pid, d.data()).role)
        if (!subs.has(pid) && !retries.has(pid)) watchProvider(pid)
      }
      // Membresías que ya no existen (solicitud retirada o borrada)
      for (const pid of [...roles.keys()]) if (!seen.has(pid)) forget(pid)
      membersReady = true
      emit()
    },
    (e) => cb(null, e),
  )

  return () => {
    closed = true
    unsubMembers()
    for (const pid of [...roles.keys()]) forget(pid)
    for (const u of subs.values()) u()
  }
}

const contactOf = (a: Account, phone: string) => ({ name: a.displayName ?? '', email: a.email ?? '', phone: phone.trim() })

/** Registro: queda "En revisión" y la persona como responsable */
export async function registerProvider(a: Account, f: ProviderForm) {
  const ref = f.kind === 'independent' ? doc(db, 'providers', independentId(a.uid)) : doc(collection(db, 'providers'))
  const b = writeBatch(db)
  b.set(ref, {
    ...providerData(f),
    contact: contactOf(a, f.phone),
    ownerUid: a.uid,
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  b.set(doc(ref, 'members', a.uid), { uid: a.uid, role: 'owner', addedBy: a.uid, since: serverTimestamp() })
  await b.commit()
  return ref.id
}

/** Corregir una solicitud en revisión o rechazada: siempre vuelve a revisión */
export function resubmitProvider(a: Account, providerId: string, f: ProviderForm) {
  return updateDoc(doc(db, 'providers', providerId), {
    ...providerData(f),
    contact: contactOf(a, f.phone),
    status: 'pending',
    updatedAt: serverTimestamp(),
  })
}

/** Retirar una solicitud no aprobada (con su membresía) */
export async function withdrawProvider(uid: string, providerId: string) {
  const b = writeBatch(db)
  b.delete(doc(db, 'providers', providerId))
  b.delete(doc(db, 'providers', providerId, 'members', uid))
  await b.commit()
}

// ---------- Administración (las reglas exigen isAdmin()) ----------

export async function listAllProviders(): Promise<Provider[]> {
  const snap = await getDocs(collection(db, 'providers'))
  return snap.docs.map((d) => parseProvider(d.id, d.data()))
}

/** Aprobar, rechazar, suspender o reactivar. El motivo se muestra a la persona. */
export function reviewProvider(adminUid: string, providerId: string, status: ProviderStatus, note: string) {
  return updateDoc(doc(db, 'providers', providerId), {
    status,
    reviewNote: note.trim() ? note.trim().slice(0, 500) : deleteField(),
    reviewedAt: serverTimestamp(),
    reviewedBy: adminUid,
    updatedAt: serverTimestamp(),
  })
}

/** "Hacer formador": crea un formador independiente ya aprobado a nombre de un deportista */
export async function makeIndependentProvider(adminUid: string, person: Account, f: ProviderForm) {
  const ref = doc(db, 'providers', independentId(person.uid))
  const b = writeBatch(db)
  b.set(ref, {
    ...providerData({ ...f, kind: 'independent' }),
    contact: contactOf(person, f.phone),
    ownerUid: person.uid,
    status: 'approved',
    reviewedAt: serverTimestamp(),
    reviewedBy: adminUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  b.set(doc(ref, 'members', person.uid), { uid: person.uid, role: 'owner', addedBy: adminUid, since: serverTimestamp() })
  await b.commit()
}
