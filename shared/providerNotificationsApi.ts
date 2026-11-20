import { collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where, writeBatch, type Unsubscribe } from 'firebase/firestore'
import { db } from './firebase'
import { parseCourse } from './domain/courses'
import type { Membership } from './providersApi'

/**
 * Avisos del formador: providers/{pid}/notifications/{nid}.
 * Los escribe quien postula (nueva, retirada) o quien decide en el equipo (aceptada, rechazada),
 * siempre en el mismo lote que la postulación. Cada persona del equipo marca su propia lectura (readBy).
 */
export type ProviderNotificationType = 'application_new' | 'application_withdrawn' | 'application_accepted' | 'application_rejected'

export interface ProviderNotification {
  id: string
  providerId: string
  providerName: string
  type: ProviderNotificationType
  applicationId: string
  courseId: string
  courseTitle: string
  personName: string
  actorUid: string
  actorName: string
  readBy: Record<string, boolean>
  createdAt: Date | null
}

const TYPES: ProviderNotificationType[] = ['application_new', 'application_withdrawn', 'application_accepted', 'application_rejected']
const str = (v: unknown) => (typeof v === 'string' ? v : '')

/** Datos del aviso para agregar al lote de la postulación */
export function providerNotificationData(
  type: ProviderNotificationType,
  a: { applicationId: string; courseId: string; courseTitle: string; personName: string },
  actor: { uid: string; name: string },
) {
  return {
    type,
    applicationId: a.applicationId,
    courseId: a.courseId,
    courseTitle: a.courseTitle.slice(0, 100),
    personName: a.personName.slice(0, 120),
    actorUid: actor.uid,
    actorName: actor.name.slice(0, 120),
    readBy: {},
    createdAt: serverTimestamp(),
  }
}

export const newProviderNotificationRef = (providerId: string) => doc(collection(db, 'providers', providerId, 'notifications'))

function parse(providerId: string, providerName: string, id: string, raw: Record<string, unknown>): ProviderNotification | null {
  const type = str(raw.type) as ProviderNotificationType
  if (!TYPES.includes(type)) return null
  const at = raw.createdAt as { toDate?: () => Date } | undefined
  return {
    id,
    providerId,
    providerName,
    type,
    applicationId: str(raw.applicationId),
    courseId: str(raw.courseId),
    courseTitle: str(raw.courseTitle),
    personName: str(raw.personName),
    actorUid: str(raw.actorUid),
    actorName: str(raw.actorName),
    readBy: raw.readBy && typeof raw.readBy === 'object' ? (raw.readBy as Record<string, boolean>) : {},
    createdAt: typeof at?.toDate === 'function' ? at.toDate() : null,
  }
}

const MAX = 50

/**
 * Avisos de todos los formadores de la persona, más recientes primero.
 * Responsables y coordinación ven todos; un instructor, solo los de sus cursos asignados
 * (las reglas exigen consultarlos curso por curso).
 */
export function subscribeProviderNotifications(memberships: Membership[], uid: string, cb: (list: ProviderNotification[]) => void): Unsubscribe {
  const buckets = new Map<string, ProviderNotification[]>()
  const subs: Unsubscribe[] = []
  const emit = () =>
    cb(
      [...buckets.values()]
        .flat()
        .sort((a, b) => (b.createdAt?.getTime() ?? Date.now()) - (a.createdAt?.getTime() ?? Date.now()))
        .slice(0, MAX),
    )
  const watch = (key: string, q: ReturnType<typeof query>, pid: string, name: string) =>
    onSnapshot(
      q,
      (s) => {
        buckets.set(
          key,
          s.docs.map((d) => parse(pid, name, d.id, d.data() as Record<string, unknown>)).filter((n): n is ProviderNotification => !!n),
        )
        emit()
      },
      () => {
        buckets.set(key, [])
        emit()
      },
    )

  for (const m of memberships) {
    const pid = m.provider.id
    const name = m.provider.name
    const col = collection(db, 'providers', pid, 'notifications')
    if (m.role === 'owner' || m.role === 'manager') {
      subs.push(watch(pid, query(col, orderBy('createdAt', 'desc'), limit(MAX)), pid, name))
      continue
    }
    // Instructor: un listener por curso asignado
    const perCourse = new Map<string, Unsubscribe>()
    subs.push(
      onSnapshot(
        query(collection(db, 'courses'), where('providerId', '==', pid)),
        (s) => {
          const mine = new Set(
            s.docs
              .map((d) => parseCourse(d.id, d.data()))
              .filter((c) => c.instructorUids.includes(uid))
              .map((c) => c.id),
          )
          for (const [cid, u] of perCourse)
            if (!mine.has(cid)) {
              u()
              perCourse.delete(cid)
              buckets.delete(`${pid}:${cid}`)
            }
          for (const cid of mine) if (!perCourse.has(cid)) perCourse.set(cid, watch(`${pid}:${cid}`, query(col, where('courseId', '==', cid)), pid, name))
          emit()
        },
        () => emit(),
      ),
      () => perCourse.forEach((u) => u()),
    )
  }
  if (!memberships.length) cb([])
  return () => subs.forEach((u) => u())
}

export const markProviderNotificationRead = (n: ProviderNotification, uid: string) =>
  updateDoc(doc(db, 'providers', n.providerId, 'notifications', n.id), { [`readBy.${uid}`]: true })

export async function markAllProviderNotificationsRead(list: ProviderNotification[], uid: string) {
  const unread = list.filter((n) => !n.readBy[uid])
  if (!unread.length) return
  const b = writeBatch(db)
  for (const n of unread) b.update(doc(db, 'providers', n.providerId, 'notifications', n.id), { [`readBy.${uid}`]: true })
  await b.commit()
}
