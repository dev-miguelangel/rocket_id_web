import { collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where, writeBatch, type Unsubscribe } from 'firebase/firestore'
import { db } from './firebase'
import { newProviderNotificationRef, providerNotificationData } from './providerNotificationsApi'
import { APPLICATION_STATUSES, type ApplicantSnapshot, type ApplicationStatus, type SharedCertification } from './domain/courses'

/** Postulación vista por el formador (incluye los datos que la persona compartió con consentimiento) */
export interface ProviderApplication {
  id: string
  uid: string
  courseId: string
  courseTitle: string
  providerId: string
  status: ApplicationStatus
  createdAt: Date | null
  reviewedAt: Date | null
  providerNote: string
  applicant: ApplicantSnapshot
}

const str = (v: unknown) => (typeof v === 'string' ? v : '')
const date = (v: unknown) => (v && typeof (v as { toDate?: () => Date }).toDate === 'function' ? (v as { toDate: () => Date }).toDate() : null)

function parseApplicant(raw: unknown): ApplicantSnapshot {
  const a = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const certs = Array.isArray(a.certifications) ? a.certifications : []
  return {
    rocketId: str(a.rocketId),
    fullName: str(a.fullName),
    docType: str(a.docType),
    docNumber: str(a.docNumber),
    birthDate: str(a.birthDate),
    phone: str(a.phone),
    contactEmail: str(a.contactEmail),
    hasCertifications: str(a.hasCertifications),
    certifications: certs
      .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
      .map((c): SharedCertification => ({
        certId: str(c.certId),
        category: str(c.category),
        name: str(c.name),
        issuer: str(c.issuer),
        year: str(c.year),
        expiresAt: str(c.expiresAt),
        status: str(c.status),
      })),
  }
}

export function parseProviderApplication(id: string, raw: Record<string, unknown>): ProviderApplication {
  const status = str(raw.status)
  return {
    id,
    uid: str(raw.uid),
    courseId: str(raw.courseId),
    courseTitle: str(raw.courseTitle),
    providerId: str(raw.providerId),
    status: status in APPLICATION_STATUSES ? (status as ApplicationStatus) : 'sent',
    createdAt: date(raw.createdAt),
    reviewedAt: date(raw.reviewedAt),
    providerNote: str(raw.providerNote),
    applicant: parseApplicant(raw.applicant),
  }
}

/** Postulaciones a los cursos de un formador, más recientes primero */
export function subscribeProviderApplications(providerId: string, cb: (list: ProviderApplication[] | null, error?: unknown) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'applications'), where('providerId', '==', providerId)),
    (s) =>
      cb(
        s.docs
          .map((d) => parseProviderApplication(d.id, d.data()))
          .sort((a, b) => (b.createdAt?.getTime() ?? Date.now()) - (a.createdAt?.getTime() ?? Date.now())),
      ),
    (e) => cb(null, e),
  )
}

/** Al abrir una postulación nueva queda como "Vista" (la persona lo ve en su app) */
export function markApplicationSeen(reviewerUid: string, a: ProviderApplication) {
  if (a.status !== 'sent') return Promise.resolve()
  return updateDoc(doc(db, 'applications', a.id), { status: 'seen', reviewedBy: reviewerUid, reviewedAt: serverTimestamp() })
}

/**
 * Aceptar o rechazar, con un mensaje opcional. La persona recibe un aviso en la app,
 * y el resto del equipo ve la decisión en sus avisos de formador.
 */
export async function decideApplication(
  reviewerUid: string,
  providerName: string,
  a: ProviderApplication,
  status: 'accepted' | 'rejected',
  note: string,
  reviewerName = '',
) {
  const text = note.trim().slice(0, 500)
  const b = writeBatch(db)
  b.update(doc(db, 'applications', a.id), {
    status,
    providerNote: text,
    reviewedBy: reviewerUid,
    reviewedAt: serverTimestamp(),
  })
  b.set(doc(collection(db, 'users', a.uid, 'notifications')), {
    type: status === 'accepted' ? 'application_accepted' : 'application_rejected',
    eventId: a.courseId,
    eventTitle: a.courseTitle.slice(0, 100),
    actorUid: reviewerUid,
    actorName: providerName.slice(0, 120),
    ...(text ? { detail: text.slice(0, 160) } : {}),
    read: false,
    createdAt: serverTimestamp(),
  })
  if (a.providerId)
    b.set(
      newProviderNotificationRef(a.providerId),
      providerNotificationData(
        status === 'accepted' ? 'application_accepted' : 'application_rejected',
        { applicationId: a.id, courseId: a.courseId, courseTitle: a.courseTitle, personName: a.applicant.fullName },
        { uid: reviewerUid, name: reviewerName || providerName },
      ),
    )
  await b.commit()
}

/** Edad a partir de YYYY-MM-DD (para mostrar junto a la fecha de nacimiento) */
export function ageFrom(birthDate: string) {
  const m = birthDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const now = new Date()
  let age = now.getFullYear() - Number(m[1])
  if (now.getMonth() + 1 < Number(m[2]) || (now.getMonth() + 1 === Number(m[2]) && now.getDate() < Number(m[3]))) age--
  return age >= 0 && age < 120 ? age : null
}
