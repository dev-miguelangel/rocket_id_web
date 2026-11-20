import { collection, deleteDoc, doc, getDocs, onSnapshot, query, serverTimestamp, setDoc, where, writeBatch, type Unsubscribe } from 'firebase/firestore'
import { db } from './firebase'
import { parseProvider, type Provider } from './domain/providers'
import type { Certification, VerifiedSnapshot } from './domain/skills'

/** Versión del texto de consentimiento al pedir una verificación. Cambiarla si cambia el texto. */
export const VERIFICATION_CONSENT_VERSION = '2026-11-v1'

export type VerificationStatus = 'pending' | 'approved' | 'rejected'

export const VERIFICATION_STATUSES: Record<VerificationStatus, { label: string; tone: 'info' | 'success' | 'danger' }> = {
  pending: { label: 'Pendiente', tone: 'info' },
  approved: { label: 'Verificada', tone: 'success' },
  rejected: { label: 'Rechazada', tone: 'danger' },
}

export interface VerificationApplicant {
  fullName: string
  rocketId: string
  docType: string
  docNumber: string
}

/** Solicitud: verificationRequests/{uid}_{certId} */
export interface VerificationRequest {
  id: string
  uid: string
  certId: string
  providerId: string
  providerName: string
  category: string
  snapshot: VerifiedSnapshot
  applicant: VerificationApplicant
  status: VerificationStatus
  note: string
  createdAt: Date | null
  reviewedAt: Date | null
}

const str = (v: unknown) => (typeof v === 'string' ? v : '')
const date = (v: unknown) => (v && typeof (v as { toDate?: () => Date }).toDate === 'function' ? (v as { toDate: () => Date }).toDate() : null)
const obj = (v: unknown) => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})

export function parseVerificationRequest(id: string, raw: Record<string, unknown>): VerificationRequest {
  const s = obj(raw.snapshot)
  const a = obj(raw.applicant)
  const status = str(raw.status)
  return {
    id,
    uid: str(raw.uid),
    certId: str(raw.certId),
    providerId: str(raw.providerId),
    providerName: str(raw.providerName),
    category: str(raw.category),
    snapshot: { name: str(s.name), issuer: str(s.issuer), year: str(s.year), expiresAt: str(s.expiresAt) },
    applicant: { fullName: str(a.fullName), rocketId: str(a.rocketId), docType: str(a.docType), docNumber: str(a.docNumber) },
    status: status in VERIFICATION_STATUSES ? (status as VerificationStatus) : 'pending',
    note: str(raw.note),
    createdAt: date(raw.createdAt),
    reviewedAt: date(raw.reviewedAt),
  }
}

const requestId = (uid: string, certId: string) => `${uid}_${certId}`
const snapshotOf = (c: Certification): VerifiedSnapshot => ({
  name: c.name.trim().slice(0, 120),
  issuer: c.issuer.trim().slice(0, 120),
  year: c.year,
  expiresAt: c.expiresAt,
})

/** ¿La solicitud corresponde a los datos actuales de la certificación? (si los editó, hay que pedirla de nuevo) */
export const requestMatches = (r: VerificationRequest, c: Certification) => {
  const s = snapshotOf(c)
  return r.snapshot.name === s.name && r.snapshot.issuer === s.issuer && r.snapshot.year === s.year && r.snapshot.expiresAt === s.expiresAt
}

// ---------- Persona ----------

/** Solicitudes de la persona, por id de certificación */
export function subscribeMyVerificationRequests(uid: string, cb: (byCert: Record<string, VerificationRequest>) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'verificationRequests'), where('uid', '==', uid)),
    (s) => cb(Object.fromEntries(s.docs.map((d) => parseVerificationRequest(d.id, d.data())).map((r) => [r.certId, r]))),
    () => cb({}),
  )
}

/** Formadores aprobados (para elegir a quién pedir la verificación) */
export async function listApprovedProviders(): Promise<Provider[]> {
  const s = await getDocs(query(collection(db, 'providers'), where('status', '==', 'approved')))
  return s.docs.map((d) => parseProvider(d.id, d.data())).sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export function requestVerification(uid: string, cert: Certification, provider: Provider, applicant: VerificationApplicant) {
  return setDoc(doc(db, 'verificationRequests', requestId(uid, cert.id)), {
    uid,
    certId: cert.id,
    providerId: provider.id,
    providerName: provider.name,
    category: cert.category,
    snapshot: snapshotOf(cert),
    applicant: {
      fullName: applicant.fullName.slice(0, 120),
      rocketId: applicant.rocketId.slice(0, 10),
      docType: applicant.docType.slice(0, 20),
      docNumber: applicant.docNumber.slice(0, 30),
    },
    status: 'pending',
    consent: { version: VERIFICATION_CONSENT_VERSION, acceptedAt: serverTimestamp() },
    createdAt: serverTimestamp(),
  })
}

export const cancelVerificationRequest = (r: VerificationRequest) => deleteDoc(doc(db, 'verificationRequests', r.id))

// ---------- Formador ----------

export function subscribeProviderVerificationRequests(providerId: string, cb: (list: VerificationRequest[] | null, error?: unknown) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'verificationRequests'), where('providerId', '==', providerId)),
    (s) =>
      cb(
        s.docs
          .map((d) => parseVerificationRequest(d.id, d.data()))
          .sort((a, b) => (b.createdAt?.getTime() ?? Date.now()) - (a.createdAt?.getTime() ?? Date.now())),
      ),
    (e) => cb(null, e),
  )
}

/**
 * Verificar o rechazar. Al verificar, en el mismo lote se escribe la insignia en
 * users/{uid}/private/verifications (las reglas exigen que copie exactamente la solicitud).
 * La persona recibe un aviso en la app.
 */
export async function decideVerification(reviewerUid: string, r: VerificationRequest, status: 'approved' | 'rejected', note: string) {
  const text = note.trim().slice(0, 500)
  const b = writeBatch(db)
  b.update(doc(db, 'verificationRequests', r.id), {
    status,
    ...(text ? { note: text } : {}),
    reviewedBy: reviewerUid,
    reviewedAt: serverTimestamp(),
  })
  if (status === 'approved')
    b.set(
      doc(db, 'users', r.uid, 'private', 'verifications'),
      {
        certs: { [r.certId]: { verifiedBy: r.providerName, providerId: r.providerId, verifiedAt: serverTimestamp(), snapshot: r.snapshot } },
        lastCertId: r.certId,
      },
      { merge: true },
    )
  b.set(doc(collection(db, 'users', r.uid, 'notifications')), {
    type: status === 'approved' ? 'verification_approved' : 'verification_rejected',
    eventId: r.certId,
    eventTitle: r.snapshot.name.slice(0, 100),
    actorUid: reviewerUid,
    actorName: r.providerName.slice(0, 120),
    ...(text ? { detail: text.slice(0, 160) } : {}),
    read: false,
    createdAt: serverTimestamp(),
  })
  await b.commit()
}

/** Para mostrar fechas de solicitud */
export const shortDate = (d: Date | null) => (d ? d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
