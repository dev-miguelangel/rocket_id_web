// Avisos del formador (providers/{pid}/notifications): postulaciones nuevas, retiradas y decisiones del equipo
import { setup } from './helpers.mjs'
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch, Timestamp } from 'firebase/firestore'

const { env, t, done } = await setup()
const ctx = (uid) => env.authenticatedContext(uid, { email: `${uid}@rocketid.test`, email_verified: true }).firestore()
const owner = ctx('owner') // responsable de org1
const mgr = ctx('mgr') // coordinación de org1
const ins = ctx('ins') // instructor asignado a cA
const other = ctx('other') // responsable de org2
const alice = ctx('alice')
const bob = ctx('bob')

await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore()
  const now = Timestamp.now()
  const prov = (id, name, ownerUid) => setDoc(doc(db, `providers/${id}`), { kind: 'organization', name, status: 'approved', ownerUid })
  const member = (pid, uid, role) => setDoc(doc(db, `providers/${pid}/members/${uid}`), { uid, role, addedBy: 'owner', since: now })
  await prov('org1', 'Escuela Andina', 'owner')
  await prov('org2', 'Otra Escuela', 'other')
  await member('org1', 'owner', 'owner')
  await member('org1', 'mgr', 'manager')
  await member('org1', 'ins', 'instructor')
  await member('org2', 'other', 'owner')
  const course = (id, providerId, instructorUids = []) =>
    setDoc(doc(db, `courses/${id}`), {
      providerId,
      providerName: providerId === 'org1' ? 'Escuela Andina' : 'Otra Escuela',
      title: id,
      status: 'published',
      instructorUids,
    })
  await course('cA', 'org1', ['ins'])
  await course('cB', 'org1')
  await course('cX', 'org2')
})

const application = (uid, courseId, providerId = 'org1', providerName = 'Escuela Andina') => ({
  uid,
  courseId,
  courseTitle: courseId,
  providerId,
  providerName,
  status: 'sent',
  createdAt: serverTimestamp(),
  consent: { version: '2026-11-v1', acceptedAt: serverTimestamp() },
  applicant: { fullName: uid, rocketId: 'BA-1234', certifications: [] },
})
const notif = (type, applicationId, courseId, actorUid, extra = {}) => ({
  type,
  applicationId,
  courseId,
  courseTitle: courseId,
  personName: 'Alice Andes',
  actorUid,
  actorName: actorUid,
  readBy: {},
  createdAt: serverTimestamp(),
  ...extra,
})
const ref = (db, pid, id) => doc(db, `providers/${pid}/notifications/${id}`)

// ---------- Quien postula ----------
await t('Postula y avisa al formador en el mismo lote', async () => {
  const b = writeBatch(alice)
  b.set(doc(alice, 'applications/alice_cA'), application('alice', 'cA'))
  b.set(ref(alice, 'org1', 'n1'), notif('application_new', 'alice_cA', 'cA', 'alice'))
  await assertSucceeds(b.commit())
})
await t('Postula a un curso sin instructor y avisa', async () => {
  const b = writeBatch(alice)
  b.set(doc(alice, 'applications/alice_cB'), application('alice', 'cB'))
  b.set(ref(alice, 'org1', 'n2'), notif('application_new', 'alice_cB', 'cB', 'alice'))
  await assertSucceeds(b.commit())
})
await t('NO avisa de una postulación que no existe', () => assertFails(setDoc(ref(bob, 'org1', 'n3'), notif('application_new', 'bob_cA', 'cA', 'bob'))))
await t('NO avisa a nombre de otra persona', () => assertFails(setDoc(ref(bob, 'org1', 'n4'), notif('application_new', 'alice_cA', 'cA', 'bob'))))
await t('NO avisa a otro formador', () => assertFails(setDoc(ref(alice, 'org2', 'n5'), notif('application_new', 'alice_cA', 'cA', 'alice'))))
await t('NO avisa "retirada" si sigue enviada', () => assertFails(setDoc(ref(alice, 'org1', 'n6'), notif('application_withdrawn', 'alice_cA', 'cA', 'alice'))))
await t('NO crea el aviso ya leído', () =>
  assertFails(setDoc(ref(alice, 'org1', 'n7'), notif('application_new', 'alice_cA', 'cA', 'alice', { readBy: { owner: true } }))),
)
await t('Retira y avisa en el mismo lote', async () => {
  const b = writeBatch(alice)
  b.update(doc(alice, 'applications/alice_cB'), { status: 'withdrawn', withdrawnAt: serverTimestamp() })
  b.set(ref(alice, 'org1', 'n8'), notif('application_withdrawn', 'alice_cB', 'cB', 'alice'))
  await assertSucceeds(b.commit())
})

// ---------- Quién los ve ----------
await t('El responsable lista los avisos', () => assertSucceeds(getDocs(collection(owner, 'providers/org1/notifications'))))
await t('Coordinación lista los avisos', () => assertSucceeds(getDocs(collection(mgr, 'providers/org1/notifications'))))
await t('Instructor ve los avisos de su curso', () =>
  assertSucceeds(getDocs(query(collection(ins, 'providers/org1/notifications'), where('courseId', '==', 'cA')))),
)
await t('Instructor NO ve avisos de otros cursos', () =>
  assertFails(getDocs(query(collection(ins, 'providers/org1/notifications'), where('courseId', '==', 'cB')))),
)
await t('Instructor NO lista todos los avisos', () => assertFails(getDocs(collection(ins, 'providers/org1/notifications'))))
await t('Otro formador NO ve los avisos', () => assertFails(getDocs(collection(other, 'providers/org1/notifications'))))
await t('Quien postula NO lee los avisos del formador', () => assertFails(getDoc(ref(alice, 'org1', 'n1'))))

// ---------- Decisiones del equipo ----------
await t('Coordinación acepta y avisa al equipo', async () => {
  const b = writeBatch(mgr)
  b.update(doc(mgr, 'applications/alice_cA'), { status: 'accepted', reviewedBy: 'mgr', reviewedAt: serverTimestamp() })
  b.set(ref(mgr, 'org1', 'n9'), notif('application_accepted', 'alice_cA', 'cA', 'mgr'))
  await assertSucceeds(b.commit())
})
await t('NO avisa "rechazada" si quedó aceptada', () => assertFails(setDoc(ref(mgr, 'org1', 'n10'), notif('application_rejected', 'alice_cA', 'cA', 'mgr'))))
await t('Otro formador NO avisa decisiones', () => assertFails(setDoc(ref(other, 'org1', 'n11'), notif('application_accepted', 'alice_cA', 'cA', 'other'))))
await t('Quien postula NO avisa "aceptada"', () => assertFails(setDoc(ref(alice, 'org1', 'n12'), notif('application_accepted', 'alice_cA', 'cA', 'alice'))))

// ---------- Leído ----------
await t('Cada persona marca su lectura', () => assertSucceeds(updateDoc(ref(owner, 'org1', 'n1'), { 'readBy.owner': true })))
await t('NO marca la lectura de otra persona', () => assertFails(updateDoc(ref(owner, 'org1', 'n1'), { 'readBy.mgr': true })))
await t('NO cambia el contenido del aviso', () => assertFails(updateDoc(ref(owner, 'org1', 'n1'), { personName: 'Otro' })))
await t('Instructor marca la lectura de su curso', () => assertSucceeds(updateDoc(ref(ins, 'org1', 'n1'), { 'readBy.ins': true })))
await t('Instructor NO marca avisos de otros cursos', () => assertFails(updateDoc(ref(ins, 'org1', 'n2'), { 'readBy.ins': true })))

await done()
