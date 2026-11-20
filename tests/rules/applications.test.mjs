// Postulaciones a cursos reales: el formador las ve, cambia el estado y avisa a la persona
import { setup } from './helpers.mjs'
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch, Timestamp } from 'firebase/firestore'

const { env, t, done } = await setup()
const ctx = (uid) => env.authenticatedContext(uid, { email: `${uid}@rocketid.test`, email_verified: true }).firestore()
const owner = ctx('owner') // responsable de org1 (aprobado)
const mgr = ctx('mgr') // coordinación de org1
const ins = ctx('ins') // instructor de org1
const other = ctx('other') // responsable de org2 (otro formador)
const alice = ctx('alice') // deportista
const bob = ctx('bob') // deportista

const course = (providerId, providerName, status = 'published', title = 'WFA de invierno') => ({
  providerId,
  providerName,
  providerKind: 'organization',
  title,
  status,
  startDate: '2027-01-10',
  endDate: '2027-01-11',
})

await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore()
  const now = Timestamp.now()
  const prov = (id, name, ownerUid, status = 'approved') => setDoc(doc(db, `providers/${id}`), { kind: 'organization', name, status, ownerUid })
  const member = (pid, uid, role) => setDoc(doc(db, `providers/${pid}/members/${uid}`), { uid, role, addedBy: 'owner', since: now })
  await prov('org1', 'Escuela Andina', 'owner')
  await prov('org2', 'Otra Escuela', 'other')
  await prov('org3', 'Escuela Suspendida', 'owner', 'suspended')
  await member('org1', 'owner', 'owner')
  await member('org1', 'mgr', 'manager')
  await member('org1', 'ins', 'instructor')
  await member('org2', 'other', 'owner')
  await member('org3', 'owner', 'owner')
  await setDoc(doc(db, 'courses/c1'), course('org1', 'Escuela Andina'))
  await setDoc(doc(db, 'courses/draft'), course('org1', 'Escuela Andina', 'draft'))
  await setDoc(doc(db, 'courses/closed'), course('org1', 'Escuela Andina', 'closed'))
  await setDoc(doc(db, 'courses/s1'), course('org3', 'Escuela Suspendida'))
  // Postulación ya existente a un curso del formador suspendido
  await setDoc(doc(db, 'applications/bob_s1'), {
    ...application('bob', 's1', 'org3', 'Escuela Suspendida'),
    createdAt: now,
    consent: { version: 'v', acceptedAt: now },
  })
})

function application(uid, courseId, providerId = 'org1', providerName = 'Escuela Andina', extra = {}) {
  return {
    uid,
    courseId,
    courseTitle: 'WFA de invierno',
    ...(providerId ? { providerId } : {}),
    providerName,
    status: 'sent',
    createdAt: serverTimestamp(),
    consent: { version: '2026-11-v1', acceptedAt: serverTimestamp() },
    applicant: { fullName: uid, rocketId: 'BA-1234', certifications: [] },
    ...extra,
  }
}

// ---------- Postular ----------
await t('Postula a un curso publicado de un formador aprobado', () => assertSucceeds(setDoc(doc(alice, 'applications/alice_c1'), application('alice', 'c1'))))
await t('Postula a un curso de demostración (sin formador)', () =>
  assertSucceeds(setDoc(doc(alice, 'applications/alice_demo-x'), application('alice', 'demo-x', null, 'Demo'))),
)
await t('NO postula a un curso real sin indicar el formador', () => assertFails(setDoc(doc(bob, 'applications/bob_c1'), application('bob', 'c1', null))))
await t('NO postula con un formador distinto al del curso', () =>
  assertFails(setDoc(doc(bob, 'applications/bob_c1'), application('bob', 'c1', 'org2', 'Otra Escuela'))),
)
await t('NO postula con otro nombre de formador', () => assertFails(setDoc(doc(bob, 'applications/bob_c1'), application('bob', 'c1', 'org1', 'Cruz Roja'))))
await t('NO postula a un borrador', () => assertFails(setDoc(doc(bob, 'applications/bob_draft'), application('bob', 'draft'))))
await t('NO postula a un curso cerrado', () => assertFails(setDoc(doc(bob, 'applications/bob_closed'), application('bob', 'closed'))))
await t('NO postula a un curso de un formador suspendido', () =>
  assertFails(setDoc(doc(alice, 'applications/alice_s1'), application('alice', 's1', 'org3', 'Escuela Suspendida'))),
)
await t('NO postula a un curso que no existe', () => assertFails(setDoc(doc(bob, 'applications/bob_nope'), application('bob', 'nope'))))

// ---------- Ver ----------
await t('El formador ve las postulaciones a sus cursos', () =>
  assertSucceeds(getDocs(query(collection(owner, 'applications'), where('providerId', '==', 'org1')))),
)
await t('Coordinación ve las postulaciones', () => assertSucceeds(getDoc(doc(mgr, 'applications/alice_c1'))))
await t('Instructor NO ve postulaciones (aún sin cursos asignados)', () => assertFails(getDoc(doc(ins, 'applications/alice_c1'))))
await t('Otro formador NO ve las postulaciones ajenas', () => assertFails(getDocs(query(collection(other, 'applications'), where('providerId', '==', 'org1')))))
await t('Otro formador NO lee una postulación ajena', () => assertFails(getDoc(doc(other, 'applications/alice_c1'))))
await t('Otra persona NO lee la postulación', () => assertFails(getDoc(doc(bob, 'applications/alice_c1'))))
await t('La persona lee su postulación', () => assertSucceeds(getDoc(doc(alice, 'applications/alice_c1'))))
await t('Quien postuló lee el curso aunque se cierre', async () => {
  await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'applications/bob_closed'), { uid: 'bob', courseId: 'closed', providerId: 'org1' }))
  await assertSucceeds(getDoc(doc(bob, 'courses/closed')))
})
await t('Quien no postuló NO lee un curso cerrado', () => assertFails(getDoc(doc(alice, 'courses/closed'))))
await t('Formador suspendido aún ve sus postulaciones', () => assertSucceeds(getDoc(doc(owner, 'applications/bob_s1'))))

// ---------- Cambiar el estado ----------
const review = (uid, status, extra = {}) => ({ status, reviewedBy: uid, reviewedAt: serverTimestamp(), ...extra })
await t('El formador la marca como vista', () => assertSucceeds(updateDoc(doc(owner, 'applications/alice_c1'), review('owner', 'seen'))))
await t('Coordinación la acepta con un mensaje', () =>
  assertSucceeds(updateDoc(doc(mgr, 'applications/alice_c1'), review('mgr', 'accepted', { providerNote: 'Te esperamos el 10 a las 9:00.' }))),
)
await t('NO vuelve a "Enviada"', () => assertFails(updateDoc(doc(owner, 'applications/alice_c1'), review('owner', 'sent'))))
await t('NO cambia los datos de la persona', () =>
  assertFails(updateDoc(doc(owner, 'applications/alice_c1'), { ...review('owner', 'accepted'), 'applicant.fullName': 'Otro' })),
)
await t('NO firma a nombre de otra persona', () => assertFails(updateDoc(doc(owner, 'applications/alice_c1'), review('mgr', 'rejected'))))
await t('NO deja un mensaje de más de 500 caracteres', () =>
  assertFails(updateDoc(doc(owner, 'applications/alice_c1'), review('owner', 'rejected', { providerNote: 'x'.repeat(501) }))),
)
await t('Instructor NO cambia el estado', () => assertFails(updateDoc(doc(ins, 'applications/alice_c1'), review('ins', 'rejected'))))
await t('Otro formador NO cambia el estado', () => assertFails(updateDoc(doc(other, 'applications/alice_c1'), review('other', 'rejected'))))
await t('La persona NO cambia su propio estado', () => assertFails(updateDoc(doc(alice, 'applications/alice_c1'), review('alice', 'accepted'))))
await t('Formador suspendido NO cambia el estado', () => assertFails(updateDoc(doc(owner, 'applications/bob_s1'), review('owner', 'accepted'))))
await t('NO cambia el estado de una postulación de demostración', () =>
  assertFails(updateDoc(doc(owner, 'applications/alice_demo-x'), review('owner', 'accepted'))),
)

// ---------- Aviso a la persona ----------
const notif = (type, actorUid, actorName = 'Escuela Andina', eventId = 'c1') => ({
  type,
  eventId,
  eventTitle: 'WFA de invierno',
  actorUid,
  actorName,
  detail: 'Te esperamos el 10 a las 9:00.',
  read: false,
  createdAt: serverTimestamp(),
})
await t('Rechaza y avisa en el mismo lote', async () => {
  const b = writeBatch(owner)
  b.update(doc(owner, 'applications/alice_c1'), review('owner', 'rejected'))
  b.set(doc(owner, 'users/alice/notifications/n1'), notif('application_rejected', 'owner'))
  await assertSucceeds(b.commit())
})
await t('NO avisa "aceptada" si la postulación quedó rechazada', () =>
  assertFails(setDoc(doc(owner, 'users/alice/notifications/n2'), notif('application_accepted', 'owner'))),
)
await t('NO avisa con otro nombre de formador', () =>
  assertFails(setDoc(doc(owner, 'users/alice/notifications/n3'), notif('application_rejected', 'owner', 'Cruz Roja'))),
)
await t('Otro formador NO envía avisos de postulación', () =>
  assertFails(setDoc(doc(other, 'users/alice/notifications/n4'), notif('application_rejected', 'other', 'Escuela Andina'))),
)
await t('NO avisa a quien no postuló', () => assertFails(setDoc(doc(owner, 'users/bob/notifications/n5'), notif('application_rejected', 'owner'))))
await t('La persona lee el aviso', () => assertSucceeds(getDoc(doc(alice, 'users/alice/notifications/n1'))))

// ---------- La persona declina su postulación ----------
await t('La persona declina una postulación aceptada', async () => {
  await env.withSecurityRulesDisabled((c) => updateDoc(doc(c.firestore(), 'applications/alice_c1'), { status: 'accepted' }))
  await assertSucceeds(updateDoc(doc(alice, 'applications/alice_c1'), { status: 'withdrawn', withdrawnAt: serverTimestamp() }))
})
await t('Otra persona NO declina por ella', async () => {
  await env.withSecurityRulesDisabled((c) =>
    setDoc(doc(c.firestore(), 'applications/bob_c1'), {
      ...application('bob', 'c1'),
      status: 'sent',
      createdAt: Timestamp.now(),
      consent: { version: 'v', acceptedAt: Timestamp.now() },
    }),
  )
  await assertFails(updateDoc(doc(alice, 'applications/bob_c1'), { status: 'withdrawn', withdrawnAt: serverTimestamp() }))
})
await t('NO declina una postulación rechazada', async () => {
  await env.withSecurityRulesDisabled((c) => updateDoc(doc(c.firestore(), 'applications/bob_c1'), { status: 'rejected' }))
  await assertFails(updateDoc(doc(bob, 'applications/bob_c1'), { status: 'withdrawn', withdrawnAt: serverTimestamp() }))
})
await t('Al declinar NO cambia otros datos', async () => {
  await env.withSecurityRulesDisabled((c) => updateDoc(doc(c.firestore(), 'applications/bob_c1'), { status: 'sent' }))
  await assertFails(updateDoc(doc(bob, 'applications/bob_c1'), { status: 'withdrawn', withdrawnAt: serverTimestamp(), courseTitle: 'Otro' }))
})
await t('La persona NO se acepta a sí misma', () =>
  assertFails(updateDoc(doc(bob, 'applications/bob_c1'), { status: 'accepted', withdrawnAt: serverTimestamp() })),
)
await t('El formador NO cambia una postulación retirada', () =>
  assertFails(updateDoc(doc(owner, 'applications/alice_c1'), { status: 'accepted', reviewedBy: 'owner', reviewedAt: serverTimestamp() })),
)
await t('El formador ve la postulación retirada', () => assertSucceeds(getDoc(doc(owner, 'applications/alice_c1'))))
await t('Vuelve a postular tras retirarla', () => assertSucceeds(setDoc(doc(alice, 'applications/alice_c1'), application('alice', 'c1'))))
await t('NO vuelve a postular "aceptada"', async () => {
  await env.withSecurityRulesDisabled((c) => updateDoc(doc(c.firestore(), 'applications/alice_c1'), { status: 'withdrawn' }))
  await assertFails(setDoc(doc(alice, 'applications/alice_c1'), application('alice', 'c1', 'org1', 'Escuela Andina', { status: 'accepted' })))
})

await done()
