import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { toTitleCaseName } from '../../lib/names'
import type { ProfileForm } from '../profile/schema'
import type { SkillsData } from '../skills/schema'
import {
  APPLICATION_STATUSES,
  CONSENT_VERSION,
  applicationId,
  type ApplicantSnapshot,
  type Application,
  type ApplicationStatus,
  type Course,
} from './schema'

const applications = collection(db, 'applications')

/** Postulaciones de la persona, en tiempo real */
export function subscribeMyApplications(uid: string, cb: (apps: Application[]) => void) {
  return onSnapshot(
    query(applications, where('uid', '==', uid)),
    (snap) =>
      cb(
        snap.docs.map((d) => {
          const v = d.data()
          const status = (v.status in APPLICATION_STATUSES ? v.status : 'sent') as ApplicationStatus
          return {
            id: d.id,
            courseId: String(v.courseId ?? ''),
            courseTitle: String(v.courseTitle ?? ''),
            providerName: String(v.providerName ?? ''),
            status,
            createdAt: typeof v.createdAt?.toDate === 'function' ? v.createdAt.toDate() : null,
            providerNote: typeof v.providerNote === 'string' ? v.providerNote : '',
          }
        }),
      ),
    () => cb([]),
  )
}

/** Solo identificación, contacto y conocimientos. Nunca salud ni contacto de emergencia. */
export function buildApplicantSnapshot(p: ProfileForm, s: SkillsData, rocketId: string | null): ApplicantSnapshot {
  return {
    rocketId: rocketId ?? '',
    fullName: toTitleCaseName(p.fullName),
    docType: p.docType,
    docNumber: p.docNumber,
    birthDate: p.birthDate,
    phone: p.phone,
    contactEmail: p.contactEmail,
    hasCertifications: s.hasCertifications,
    certifications:
      s.hasCertifications === 'yes'
        ? s.certifications.map((c) => ({
            certId: c.id,
            category: c.category,
            name: c.name,
            issuer: c.issuer,
            year: c.year,
            expiresAt: c.expiresAt,
            status: c.status,
          }))
        : [],
  }
}

/** Datos mínimos para que la institución pueda contactar a la persona */
export const REQUIRED_FOR_APPLY: { key: keyof ProfileForm; label: string }[] = [
  { key: 'fullName', label: 'Nombre completo' },
  { key: 'docNumber', label: 'Documento de identidad' },
  { key: 'phone', label: 'Celular' },
  { key: 'contactEmail', label: 'Correo electrónico' },
]

/** Declinar: la postulación queda como "Retirada" (el formador la sigue viendo así) */
export const withdrawApplication = (uid: string, courseId: string) =>
  updateDoc(doc(applications, applicationId(uid, courseId)), { status: 'withdrawn', withdrawnAt: serverTimestamp() })

export function submitApplication(uid: string, course: Course, applicant: ApplicantSnapshot) {
  return setDoc(doc(applications, applicationId(uid, course.id)), {
    uid,
    courseId: course.id,
    courseTitle: course.title,
    // Cursos de formadores: las reglas exigen que coincida con el curso publicado
    ...(course.providerId ? { providerId: course.providerId } : {}),
    providerName: course.provider.name,
    status: 'sent',
    createdAt: serverTimestamp(),
    consent: { version: CONSENT_VERSION, acceptedAt: serverTimestamp() },
    applicant,
  })
}
