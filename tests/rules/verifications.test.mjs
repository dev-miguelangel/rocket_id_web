// Verificación de certificaciones por formadores: solicitud → decisión → insignia en private/verifications
import { setup } from './helpers.mjs'
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch, Timestamp } from 'firebase/firestore'

const { env, t, done } = await setup()
const ctx = (uid) => env.authenticatedContext(uid, { email: `${uid}@rocketid.test`, email_verified: true }).firestore()
const owner = ctx('owner') // responsable de org1 (aprobado)
const ins = ctx('ins') // instructor de org1: también verifica (decisión 5)
const other = ctx('other') // responsable de org2
const sus = ctx('sus') // responsable de org3 (suspendido)
const alice = ctx('alice')
const bob = ctx('bob')
const anon = env.unauthenticatedContext().firestore()

await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore()
  const now = Timestamp.now()
  const prov = (id, name, ownerUid, status = 'approved') => setDoc(doc(db, `providers/${id}`), { kind: 'organization', name, status, ownerUid })
  const member = (pid, uid, role) => setDoc(doc(db, `providers/${pid}/members/${uid}`), { uid, role, addedBy: 'owner', since: now })
  await prov('org1', 'Escuela Andina', 'owner')
  await prov('org2', 'Otra Escuela', 'other')
  await prov('org3', 'Escuela Suspendida', 'sus', 'suspended')
  await prov('pend', 'Escuela Pendiente', 'x', 'pending')
  await member('org1', 'owner', 'owner')
  await member('org1', 'ins', 'instructor')
  await member('org2', 'other', 'owner')
  await member('org3', 'sus', 'owner')
  // Verificación previa de otra certificación (debe conservarse)
  await setDoc(doc(db, 'users/alice/private/verifications'), {
    certs: { old: { verifiedBy: 'Cruz Roja', verifiedAt: now, snapshot: { name: 'RCP', issuer: 'Cruz Roja', year: '2024', expiresAt: '' } } },
  })
  await setDoc(doc(db, 'verificationRequests/bob_c9'), {
    ...request('bob', 'c9', 'org3', 'Escuela Suspendida'),
    createdAt: now,
    consent: { version: 'v', acceptedAt: now },
  })
})

function request(uid, certId, providerId = 'org1', providerName = 'Escuela Andina', extra = {}) {
  return {
    uid,
    certId,
    providerId,
    providerName,
    category: 'first_aid',
    snapshot: { name: 'WFA', issuer: 'Escuela Andina', year: '2025', expiresAt: '2027-06' },
    applicant: { fullName: 'Alice Andes', rocketId: 'BA-1234', docType: 'rut', docNumber: '12.345.678-5' },
    status: 'pending',
    consent: { version: '2026-11-v1', acceptedAt: serverTimestamp() },
    createdAt: serverTimestamp(),
    ...extra,
  }
}
const SNAP = { name: 'WFA', issuer: 'Escuela Andina', year: '2025', expiresAt: '2027-06' }
const entry = (extra = {}) => ({ verifiedBy: 'Escuela Andina', providerId: 'org1', verifiedAt: serverTimestamp(), snapshot: SNAP, ...extra })
const decision = (uid, status, extra = {}) => ({ status, reviewedBy: uid, reviewedAt: serverTimestamp(), ...extra })

// ---------- Solicitar ----------
await t('Pide verificación a un formador aprobado', () => assertSucceeds(setDoc(doc(alice, 'verificationRequests/alice_c1'), request('alice', 'c1'))))
await t('NO pide a nombre de otra persona', () => assertFails(setDoc(doc(bob, 'verificationRequests/alice_c2'), request('alice', 'c2'))))
await t('NO usa un id distinto de {uid}_{certId}', () => assertFails(setDoc(doc(alice, 'verificationRequests/otro'), request('alice', 'c2'))))
await t('NO pide a un formador en revisión', () =>
  assertFails(setDoc(doc(alice, 'verificationRequests/alice_c2'), request('alice', 'c2', 'pend', 'Escuela Pendiente'))),
)
await t('NO pide a un formador suspendido', () =>
  assertFails(setDoc(doc(alice, 'verificationRequests/alice_c2'), request('alice', 'c2', 'org3', 'Escuela Suspendida'))),
)
await t('NO inventa el nombre del formador', () =>
  assertFails(setDoc(doc(alice, 'verificationRequests/alice_c2'), request('alice', 'c2', 'org1', 'Cruz Roja'))),
)
await t('NO llega ya aprobada', () =>
  assertFails(setDoc(doc(alice, 'verificationRequests/alice_c2'), request('alice', 'c2', 'org1', 'Escuela Andina', { status: 'approved' }))),
)
await t('NO agrega datos de salud ni campos desconocidos', () =>
  assertFails(
    setDoc(doc(alice, 'verificationRequests/alice_c2'), request('alice', 'c2', 'org1', 'Escuela Andina', { applicant: { fullName: 'A', bloodType: 'O+' } })),
  ),
)
await t('Sin sesión NO pide verificación', () => assertFails(setDoc(doc(anon, 'verificationRequests/x_c1'), request('x', 'c1'))))

// ---------- Ver ----------
await t('La persona lee su solicitud', () => assertSucceeds(getDoc(doc(alice, 'verificationRequests/alice_c1'))))
await t('El formador lista sus solicitudes', () => assertSucceeds(getDocs(query(collection(owner, 'verificationRequests'), where('providerId', '==', 'org1')))))
await t('Instructor lee las solicitudes de su formador', () => assertSucceeds(getDoc(doc(ins, 'verificationRequests/alice_c1'))))
await t('Otro formador NO ve solicitudes ajenas', () =>
  assertFails(getDocs(query(collection(other, 'verificationRequests'), where('providerId', '==', 'org1')))),
)
await t('Otra persona NO lee la solicitud', () => assertFails(getDoc(doc(bob, 'verificationRequests/alice_c1'))))

// ---------- Decidir y escribir la verificación ----------
await t('La persona NO se aprueba a sí misma', () => assertFails(updateDoc(doc(alice, 'verificationRequests/alice_c1'), decision('alice', 'approved'))))
await t('Otro formador NO decide', () => assertFails(updateDoc(doc(other, 'verificationRequests/alice_c1'), decision('other', 'approved'))))
await t('NO escribe la verificación sin aprobar la solicitud', () =>
  assertFails(setDoc(doc(owner, 'users/alice/private/verifications'), { certs: { c1: entry() }, lastCertId: 'c1' }, { merge: true })),
)
await t('NO escribe la verificación a nombre de otro formador', async () => {
  const b = writeBatch(owner)
  b.update(doc(owner, 'verificationRequests/alice_c1'), decision('owner', 'approved'))
  b.set(doc(owner, 'users/alice/private/verifications'), { certs: { c1: entry({ verifiedBy: 'Cruz Roja' }) }, lastCertId: 'c1' }, { merge: true })
  await assertFails(b.commit())
})
await t('NO copia otros datos de la certificación', async () => {
  const b = writeBatch(owner)
  b.update(doc(owner, 'verificationRequests/alice_c1'), decision('owner', 'approved'))
  b.set(doc(owner, 'users/alice/private/verifications'), { certs: { c1: entry({ snapshot: { ...SNAP, year: '2020' } }) }, lastCertId: 'c1' }, { merge: true })
  await assertFails(b.commit())
})
await t('NO toca otras verificaciones de la persona', async () => {
  const b = writeBatch(owner)
  b.update(doc(owner, 'verificationRequests/alice_c1'), decision('owner', 'approved'))
  b.set(doc(owner, 'users/alice/private/verifications'), { certs: { c1: entry(), old: entry() }, lastCertId: 'c1' }, { merge: true })
  await assertFails(b.commit())
})
await t('Instructor verifica: solicitud aprobada + insignia en el mismo lote', async () => {
  const b = writeBatch(ins)
  b.update(doc(ins, 'verificationRequests/alice_c1'), decision('ins', 'approved'))
  b.set(doc(ins, 'users/alice/private/verifications'), { certs: { c1: entry() }, lastCertId: 'c1' }, { merge: true })
  b.set(doc(ins, 'users/alice/notifications/n1'), {
    type: 'verification_approved',
    eventId: 'c1',
    eventTitle: 'WFA',
    actorUid: 'ins',
    actorName: 'Escuela Andina',
    read: false,
    createdAt: serverTimestamp(),
  })
  await assertSucceeds(b.commit())
})
await t('La verificación anterior se conserva', async () => {
  let certs = {}
  await env.withSecurityRulesDisabled(async (c) => {
    certs = (await getDoc(doc(c.firestore(), 'users/alice/private/verifications'))).data().certs
  })
  if (!certs.old || !certs.c1) throw new Error('faltan verificaciones')
})
await t('NO cambia una solicitud ya decidida', () => assertFails(updateDoc(doc(owner, 'verificationRequests/alice_c1'), decision('owner', 'rejected'))))
await t('Cualquiera lee la insignia (perfil público)', () => assertSucceeds(getDoc(doc(anon, 'users/alice/private/verifications'))))

// Rechazo con nota, y la persona vuelve a pedirla
await t('Rechaza con motivo y avisa', async () => {
  await setDoc(doc(alice, 'verificationRequests/alice_c3'), request('alice', 'c3'))
  const b = writeBatch(owner)
  b.update(doc(owner, 'verificationRequests/alice_c3'), decision('owner', 'rejected', { note: 'No encontramos tu registro.' }))
  b.set(doc(owner, 'users/alice/notifications/n2'), {
    type: 'verification_rejected',
    eventId: 'c3',
    eventTitle: 'WFA',
    actorUid: 'owner',
    actorName: 'Escuela Andina',
    detail: 'No encontramos tu registro.',
    read: false,
    createdAt: serverTimestamp(),
  })
  await assertSucceeds(b.commit())
})
await t('NO escribe la insignia de una solicitud rechazada', () =>
  assertFails(setDoc(doc(owner, 'users/alice/private/verifications'), { certs: { c3: entry() }, lastCertId: 'c3' }, { merge: true })),
)
await t('NO avisa "verificada" si fue rechazada', () =>
  assertFails(
    setDoc(doc(owner, 'users/alice/notifications/n3'), {
      type: 'verification_approved',
      eventId: 'c3',
      eventTitle: 'WFA',
      actorUid: 'owner',
      actorName: 'Escuela Andina',
      read: false,
      createdAt: serverTimestamp(),
    }),
  ),
)
await t('La persona la pide de nuevo (vuelve a pendiente)', () => assertSucceeds(setDoc(doc(alice, 'verificationRequests/alice_c3'), request('alice', 'c3'))))
await t('La persona retira su solicitud', () => assertSucceeds(deleteDoc(doc(alice, 'verificationRequests/alice_c3'))))
await t('Otra persona NO la retira', () => assertFails(deleteDoc(doc(bob, 'verificationRequests/alice_c1'))))

// Formador suspendido
await t('Formador suspendido NO verifica', async () => {
  const b = writeBatch(sus)
  b.update(doc(sus, 'verificationRequests/bob_c9'), decision('sus', 'approved'))
  b.set(
    doc(sus, 'users/bob/private/verifications'),
    { certs: { c9: entry({ verifiedBy: 'Escuela Suspendida', providerId: 'org3' }) }, lastCertId: 'c9' },
    { merge: true },
  )
  await assertFails(b.commit())
})

await done()
