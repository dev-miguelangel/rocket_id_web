import {
  Timestamp,
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { subscribeProfile } from '../profile/profileApi'
import { CRITICAL_FIELDS, type ProfileForm } from '../profile/schema'
import type { PublicProfile } from '../contacts/publicProfile'
import {
  EVENT_CONSENT_VERSION,
  PUBLIC_ACK_VERSION,
  activityOf,
  type EventDoc,
  type Participant,
  type ParticipantStatus,
  type Requirement,
  type Visibility,
} from './schema'

const eventsCol = collection(db, 'events')
const eventRef = (id: string) => doc(db, 'events', id)
const participantRef = (eid: string, uid: string) => doc(db, 'events', eid, 'participants', uid)
const sensitiveRef = (eid: string, uid: string) => doc(db, 'events', eid, 'sensitive', uid)
const viewLogRef = (eid: string, uid: string) => doc(db, 'events', eid, 'viewLog', uid)

const str = (v: unknown) => (typeof v === 'string' ? v : '')
const toDate = (v: unknown) => (v && typeof (v as Timestamp).toDate === 'function' ? (v as Timestamp).toDate() : new Date(0))

function parseEvent(id: string, v: Record<string, unknown>): EventDoc {
  return {
    id,
    title: str(v.title),
    activity: activityOf(str(v.activity)).id,
    description: str(v.description),
    startAt: toDate(v.startAt),
    endAt: toDate(v.endAt),
    location: str(v.location),
    meetingPoint: str(v.meetingPoint),
    visibility: v.visibility === 'public' ? 'public' : 'private',
    capacity: typeof v.capacity === 'number' ? v.capacity : 0,
    requirements: Array.isArray(v.requirements) ? (v.requirements as Requirement[]) : [],
    status: v.status === 'cancelled' ? 'cancelled' : 'published',
    organizerUid: str(v.organizerUid),
    organizerName: str(v.organizerName),
    organizerRocketId: str(v.organizerRocketId),
    organizerPhoto: typeof v.organizerPhoto === 'string' ? v.organizerPhoto : null,
  }
}

function parseParticipant(uid: string, v: Record<string, unknown>): Participant {
  return {
    uid,
    displayName: str(v.displayName),
    rocketId: str(v.rocketId),
    photoURL: typeof v.photoURL === 'string' ? v.photoURL : null,
    role: v.role === 'organizer' ? 'organizer' : 'participant',
    status: (['invited', 'confirmed', 'declined'].includes(str(v.status)) ? v.status : 'invited') as ParticipantStatus,
    emergencyComplete: v.emergencyComplete === true,
  }
}

// ---------- Lectura ----------

export function subscribeEvent(id: string, cb: (e: EventDoc | null) => void) {
  return onSnapshot(
    eventRef(id),
    (s) => cb(s.exists() ? parseEvent(s.id, s.data()) : null),
    () => cb(null),
  )
}

export function subscribeParticipants(eid: string, cb: (p: Participant[] | null) => void) {
  return onSnapshot(
    collection(db, 'events', eid, 'participants'),
    (s) => cb(s.docs.map((d) => parseParticipant(d.id, d.data()))),
    () => cb(null), // sin permiso: no es participante
  )
}

/** Eventos donde participo (cualquier estado), con mi estado */
export async function fetchMyEvents(uid: string): Promise<{ event: EventDoc; me: Participant }[]> {
  const snap = await getDocs(query(collectionGroup(db, 'participants'), where('uid', '==', uid), limit(100)))
  const rows = await Promise.all(
    snap.docs.map(async (d) => {
      const eid = d.ref.parent.parent?.id
      if (!eid) return null
      const e = await getDoc(eventRef(eid))
      return e.exists() ? { event: parseEvent(e.id, e.data()), me: parseParticipant(d.id, d.data()) } : null
    }),
  )
  return rows.filter((r): r is NonNullable<typeof r> => !!r).sort((a, b) => a.event.startAt.getTime() - b.event.startAt.getTime())
}

/** Eventos públicos próximos */
export async function fetchPublicEvents(): Promise<EventDoc[]> {
  const snap = await getDocs(
    query(eventsCol, where('visibility', '==', 'public'), where('startAt', '>=', Timestamp.fromDate(new Date(Date.now() - 86_400_000))), orderBy('startAt'), limit(50)),
  )
  return snap.docs.map((d) => parseEvent(d.id, d.data())).filter((e) => e.status === 'published')
}

// ---------- Escritura ----------

export interface EventInput {
  title: string
  activity: string
  description: string
  startAt: Date
  endAt: Date
  location: string
  meetingPoint: string
  visibility: Visibility
  capacity: number
  requirements: Requirement[]
  /** true si aceptó la alerta de responsabilidades (obligatorio si es público) */
  publicAck: boolean
}

type Me = Pick<PublicProfile, 'uid' | 'displayName' | 'rocketId' | 'photoURL'>

const eventFields = (input: EventInput) => ({
  title: input.title.trim().slice(0, 100),
  activity: input.activity,
  description: input.description.trim().slice(0, 2000),
  startAt: Timestamp.fromDate(input.startAt),
  endAt: Timestamp.fromDate(input.endAt),
  location: input.location.trim().slice(0, 150),
  meetingPoint: input.meetingPoint.trim().slice(0, 200),
  visibility: input.visibility,
  capacity: Math.max(0, Math.min(500, Math.floor(input.capacity || 0))),
  requirements: input.requirements.slice(0, 10).map((r) => ({ category: r.category, label: r.label.trim().slice(0, 80) })),
  ...(input.visibility === 'public' && input.publicAck
    ? { publicAck: { version: PUBLIC_ACK_VERSION, acceptedAt: serverTimestamp() } }
    : {}),
})

export async function createEvent(me: Me, input: EventInput) {
  const ref = doc(eventsCol)
  const batch = writeBatch(db)
  batch.set(ref, {
    ...eventFields(input),
    status: 'published',
    organizerUid: me.uid,
    organizerName: me.displayName,
    organizerRocketId: me.rocketId,
    organizerPhoto: me.photoURL,
    createdAt: serverTimestamp(),
  })
  batch.set(participantRef(ref.id, me.uid), {
    uid: me.uid,
    displayName: me.displayName,
    rocketId: me.rocketId,
    photoURL: me.photoURL,
    role: 'organizer',
    status: 'confirmed',
    emergencyComplete: false,
    updatedAt: serverTimestamp(),
  })
  await batch.commit()
  return ref.id
}

/** Editar (solo organizador). Conserva organizador, estado y fecha de creación. */
export async function updateEvent(eid: string, input: EventInput) {
  const batch = writeBatch(db)
  batch.update(eventRef(eid), eventFields(input))
  await batch.commit()
}

export async function cancelEvent(eid: string) {
  const batch = writeBatch(db)
  batch.update(eventRef(eid), { status: 'cancelled' })
  await batch.commit()
}

/** El organizador invita a alguien de su cordada (y le llega una notificación) */
export async function invite(event: EventDoc, actor: Me, p: Me) {
  const batch = writeBatch(db)
  batch.set(participantRef(event.id, p.uid), {
    uid: p.uid,
    displayName: p.displayName,
    rocketId: p.rocketId,
    photoURL: p.photoURL,
    role: 'participant',
    status: 'invited',
    emergencyComplete: false,
    invitedBy: actor.uid,
    updatedAt: serverTimestamp(),
  })
  batch.set(doc(collection(db, 'users', p.uid, 'notifications')), {
    type: 'event_invite',
    eventId: event.id,
    eventTitle: event.title,
    actorUid: actor.uid,
    actorName: actor.displayName,
    read: false,
    createdAt: serverTimestamp(),
  })
  await batch.commit()
}

export function removeParticipant(eid: string, uid: string) {
  const batch = writeBatch(db)
  batch.delete(participantRef(eid, uid))
  batch.delete(sensitiveRef(eid, uid))
  return batch.commit()
}

/** Lee una vez la ficha completa propia (identidad + emergencia) */
function loadOwnProfile(uid: string) {
  return new Promise<ProfileForm>((resolve) => {
    const unsub = subscribeProfile(uid, (p) => {
      resolve(p)
      setTimeout(unsub, 0)
    })
  })
}

/**
 * Confirmar asistencia (o unirse a un evento público / por enlace) con consentimiento:
 * guarda el estado y una copia de la ficha de emergencia que solo el organizador puede ver.
 */
export async function confirmAttendance(eid: string, me: Me, alreadyParticipant: boolean) {
  const p = await loadOwnProfile(me.uid)
  const emergencyComplete = CRITICAL_FIELDS.every(({ key }) => !!p[key].trim())
  const batch = writeBatch(db)
  const base = {
    status: 'confirmed',
    emergencyComplete,
    consent: { version: EVENT_CONSENT_VERSION, acceptedAt: serverTimestamp() },
    updatedAt: serverTimestamp(),
  }
  if (alreadyParticipant) batch.update(participantRef(eid, me.uid), base)
  else
    batch.set(participantRef(eid, me.uid), {
      uid: me.uid,
      displayName: me.displayName,
      rocketId: me.rocketId,
      photoURL: me.photoURL,
      role: 'participant',
      ...base,
    })
  batch.set(sensitiveRef(eid, me.uid), {
    fullName: p.fullName,
    docType: p.docType,
    docNumber: p.docNumber,
    birthDate: p.birthDate,
    phone: p.phone,
    emergencyName: p.emergencyName,
    emergencyRelationship: p.emergencyRelationship,
    emergencyPhone: p.emergencyPhone,
    insuranceSystem: p.insuranceSystem,
    insuranceDetail: p.insuranceDetail,
    bloodType: p.bloodType,
    allergies: p.allergies,
    conditions: p.conditions,
    medications: p.medications,
    updatedAt: serverTimestamp(),
  })
  await batch.commit()
}

/** Rechazar invitación o salir del evento: también se borra la ficha compartida */
export async function declineAttendance(eid: string, uid: string) {
  const batch = writeBatch(db)
  batch.update(participantRef(eid, uid), { status: 'declined', updatedAt: serverTimestamp() })
  batch.delete(sensitiveRef(eid, uid))
  await batch.commit()
}

export interface SensitiveData {
  fullName: string
  docType: string
  docNumber: string
  birthDate: string
  phone: string
  emergencyName: string
  emergencyRelationship: string
  emergencyPhone: string
  insuranceSystem: string
  insuranceDetail: string
  bloodType: string
  allergies: string
  conditions: string
  medications: string
}

/**
 * El organizador ve la ficha de emergencia de un participante.
 * Primero registra la visualización y notifica a la persona (las reglas lo exigen); luego lee.
 */
export async function viewSensitive(event: EventDoc, actor: Me, pid: string): Promise<SensitiveData | null> {
  const notifRef = doc(collection(db, 'users', pid, 'notifications'))
  const batch = writeBatch(db)
  batch.set(notifRef, {
    type: 'sensitive_view',
    eventId: event.id,
    eventTitle: event.title,
    actorUid: actor.uid,
    actorName: actor.displayName,
    read: false,
    createdAt: serverTimestamp(),
  })
  batch.set(viewLogRef(event.id, pid), { viewerUid: actor.uid, lastViewedAt: serverTimestamp(), notifId: notifRef.id })
  await batch.commit()
  const snap = await getDoc(sensitiveRef(event.id, pid))
  if (!snap.exists()) return null
  const v = snap.data()
  return Object.fromEntries(Object.entries(v).map(([k, val]) => [k, str(val)])) as unknown as SensitiveData
}
