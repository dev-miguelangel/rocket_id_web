import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'
import { MEMBER_ROLES, parseMember, type Member, type MemberRole } from './domain/providers'
import { parseProviderApplication, type ProviderApplication } from './applicationsApi'
import { parseCourse } from './domain/courses'

const str = (v: unknown) => (typeof v === 'string' ? v : '')
const date = (v: unknown) => (v && typeof (v as { toDate?: () => Date }).toDate === 'function' ? (v as { toDate: () => Date }).toDate() : null)

// ---------- Personas (perfil público) ----------

export interface Person {
  uid: string
  displayName: string
  rocketId: string
  photoURL: string | null
}

const people = new Map<string, Promise<Person | null>>()

/** Nombre, rocketId y foto desde el perfil público (null si la persona no tiene) */
export function getPerson(uid: string): Promise<Person | null> {
  if (!people.has(uid))
    people.set(
      uid,
      getDoc(doc(db, 'publicProfiles', uid))
        .then((s) => {
          const v = s.data()
          return v ? { uid, displayName: str(v.displayName), rocketId: str(v.rocketId), photoURL: typeof v.photoURL === 'string' ? v.photoURL : null } : null
        })
        .catch(() => null),
    )
  return people.get(uid)!
}

const ROCKET_ID = /^[BCDFGHJKLMNPQRSTVWXYZ][AEIOU]-\d{4}$/
const normalizeRocketId = (q: string) => {
  const m = q
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .match(/^([A-Z])([A-Z])-?(\d{4})$/)
  const code = m ? `${m[1]}${m[2]}-${m[3]}` : ''
  return ROCKET_ID.test(code) ? code : null
}
const looksLikeEmail = (q: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q.trim())
async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Busca a una persona de rocketId por su rocketId o su correo exacto. Lanza 'format' si no es ninguno. */
export async function findPerson(text: string): Promise<Person | null> {
  let uid: unknown
  if (looksLikeEmail(text)) uid = (await getDoc(doc(db, 'emailIndex', await sha256Hex(text.trim().toLowerCase())))).data()?.uid
  else {
    const code = normalizeRocketId(text)
    if (!code) throw 'format'
    uid = (await getDoc(doc(db, 'rocketIds', code))).data()?.uid
  }
  if (typeof uid !== 'string') return null
  return (await getPerson(uid)) ?? { uid, displayName: '', rocketId: '', photoURL: null }
}

// ---------- Invitaciones ----------

export interface Invite {
  providerId: string
  uid: string
  role: MemberRole
  providerName: string
  invitedBy: string
  invitedByName: string
  createdAt: Date | null
}

function parseInvite(providerId: string, raw: Record<string, unknown>): Invite {
  const role = str(raw.role)
  return {
    providerId,
    uid: str(raw.uid),
    role: role in MEMBER_ROLES ? (role as MemberRole) : 'instructor',
    providerName: str(raw.providerName),
    invitedBy: str(raw.invitedBy),
    invitedByName: str(raw.invitedByName),
    createdAt: date(raw.createdAt),
  }
}

/** Invitaciones pendientes de la persona (consulta de grupo por uid) */
export function subscribeMyInvites(uid: string, cb: (list: Invite[]) => void): Unsubscribe {
  return onSnapshot(
    query(collectionGroup(db, 'invites'), where('uid', '==', uid)),
    (s) => cb(s.docs.map((d) => parseInvite(d.ref.parent.parent?.id ?? '', d.data())).filter((i) => i.providerId)),
    () => cb([]),
  )
}

/** Aceptar: la persona crea su membresía con el rol invitado y borra la invitación (las reglas lo exigen así) */
export async function acceptInvite(uid: string, inv: Invite) {
  const b = writeBatch(db)
  b.set(doc(db, 'providers', inv.providerId, 'members', uid), { uid, role: inv.role, addedBy: inv.invitedBy, since: serverTimestamp() })
  b.delete(doc(db, 'providers', inv.providerId, 'invites', uid))
  await b.commit()
}

export const declineInvite = (inv: Invite) => deleteDoc(doc(db, 'providers', inv.providerId, 'invites', inv.uid))

/** Invitaciones pendientes de un formador (solo su responsable o la administración) */
export function subscribeProviderInvites(providerId: string, cb: (list: Invite[]) => void): Unsubscribe {
  return onSnapshot(
    collection(db, 'providers', providerId, 'invites'),
    (s) => cb(s.docs.map((d) => parseInvite(providerId, d.data()))),
    () => cb([]),
  )
}

/** Invitar a una persona al equipo; recibe un aviso en la app */
export async function invitePerson(providerId: string, providerName: string, inviter: { uid: string; name: string }, personUid: string, role: MemberRole) {
  const b = writeBatch(db)
  b.set(doc(db, 'providers', providerId, 'invites', personUid), {
    uid: personUid,
    role,
    providerName,
    invitedBy: inviter.uid,
    invitedByName: inviter.name.slice(0, 120),
    createdAt: serverTimestamp(),
  })
  b.set(doc(collection(db, 'users', personUid, 'notifications')), {
    type: 'provider_invite',
    eventId: providerId,
    eventTitle: providerName.slice(0, 100),
    actorUid: inviter.uid,
    actorName: inviter.name.slice(0, 120),
    detail: `Rol: ${MEMBER_ROLES[role].label}`,
    read: false,
    createdAt: serverTimestamp(),
  })
  await b.commit()
}

export const cancelInvite = (providerId: string, uid: string) => deleteDoc(doc(db, 'providers', providerId, 'invites', uid))

// ---------- Equipo ----------

export function subscribeTeam(providerId: string, cb: (list: Member[] | null, error?: unknown) => void): Unsubscribe {
  return onSnapshot(
    collection(db, 'providers', providerId, 'members'),
    (s) => cb(s.docs.map((d) => parseMember(providerId, d.data()))),
    (e) => cb(null, e),
  )
}

export const setMemberRole = (providerId: string, uid: string, role: MemberRole) => updateDoc(doc(db, 'providers', providerId, 'members', uid), { role })

/** Quitar a alguien (responsable) o salir del equipo (la propia persona) */
export const removeMember = (providerId: string, uid: string) => deleteDoc(doc(db, 'providers', providerId, 'members', uid))

/** Instructores asignados a un curso (responsable o coordinación) */
export const setCourseInstructors = (courseId: string, uids: string[]) =>
  updateDoc(doc(db, 'courses', courseId), { instructorUids: [...new Set(uids)].slice(0, 20), updatedAt: serverTimestamp() })

// ---------- Instructores: postulaciones de sus cursos ----------

/**
 * Postulaciones de los cursos asignados al instructor. Las reglas solo permiten consultarlas curso por curso
 * (where courseId == …), así que hay un listener por curso asignado.
 */
export function subscribeInstructorApplications(
  providerId: string,
  uid: string,
  cb: (list: ProviderApplication[] | null, error?: unknown) => void,
): Unsubscribe {
  const perCourse = new Map<string, ProviderApplication[]>()
  const subs = new Map<string, Unsubscribe>()
  let coursesReady = false
  const emit = () => {
    if (!coursesReady || [...subs.keys()].some((id) => !perCourse.has(id))) return
    cb([...perCourse.values()].flat().sort((a, b) => (b.createdAt?.getTime() ?? Date.now()) - (a.createdAt?.getTime() ?? Date.now())))
  }
  const unsubCourses = onSnapshot(
    query(collection(db, 'courses'), where('providerId', '==', providerId)),
    (s) => {
      const mine = new Set(
        s.docs
          .map((d) => parseCourse(d.id, d.data()))
          .filter((c) => c.instructorUids.includes(uid))
          .map((c) => c.id),
      )
      for (const [id, u] of subs)
        if (!mine.has(id)) {
          u()
          subs.delete(id)
          perCourse.delete(id)
        }
      for (const id of mine)
        if (!subs.has(id))
          subs.set(
            id,
            onSnapshot(
              query(collection(db, 'applications'), where('courseId', '==', id)),
              (a) => {
                perCourse.set(
                  id,
                  a.docs.map((d) => parseProviderApplication(d.id, d.data())),
                )
                emit()
              },
              () => {
                perCourse.set(id, [])
                emit()
              },
            ),
          )
      coursesReady = true
      emit()
    },
    (e) => cb(null, e),
  )
  return () => {
    unsubCourses()
    for (const u of subs.values()) u()
  }
}
