// Eventos: la ficha del organizador también está disponible en una emergencia (con su consentimiento)
// Ejecutar con: npm run test:rules
import { setup } from './helpers.mjs'
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, setDoc, getDoc, updateDoc, writeBatch, collection, serverTimestamp, Timestamp } from 'firebase/firestore'

const { env, t, done } = await setup()
const H = 3600000
const ctx = (u) => env.authenticatedContext(u).firestore()
const org = ctx('org'), org2 = ctx('org2'), pedro = ctx('pedro'), bob = ctx('bob')
const ficha = { fullName: 'Org', docType: 'rut', docNumber: '1', birthDate: '', phone: '', emergencyName: 'Pareja', emergencyRelationship: 'pareja', emergencyPhone: '+56 9 1', insuranceSystem: 'fonasa', insuranceDetail: '', bloodType: 'A+', allergies: 'Ibuprofeno', conditions: '', medications: '', updatedAt: serverTimestamp() }
const evt = (organizerUid, extra = {}) => ({ title: 'Plomo', activity: 'montanismo', description: '', startAt: Timestamp.fromMillis(Date.now() - H), endAt: Timestamp.fromMillis(Date.now() + 5 * H), location: 'X', meetingPoint: '', visibility: 'private', capacity: 0, requirements: [], status: 'published', organizerUid, organizerName: 'Org', organizerRocketId: 'SU-1234', organizerPhoto: null, createdAt: serverTimestamp(), ...extra })
const orgRow = (uid, consent = true) => ({ uid, displayName: 'Org', rocketId: 'SU-1234', photoURL: null, role: 'organizer', status: 'confirmed', emergencyComplete: true, ...(consent ? { consent: { version: 'v1', acceptedAt: serverTimestamp() } } : {}), updatedAt: serverTimestamp() })

await t('Crear evento compartiendo la ficha del organizador (con consentimiento)', () => {
  const b = writeBatch(org)
  b.set(doc(org, 'events/e1'), evt('org'))
  b.set(doc(org, 'events/e1/participants/org'), orgRow('org'))
  b.set(doc(org, 'events/e1/sensitive/org'), ficha)
  return assertSucceeds(b.commit())
})
await t('Sin consentimiento el organizador NO puede compartir su ficha', async () => {
  const b = writeBatch(org2)
  b.set(doc(org2, 'events/e2'), evt('org2'))
  b.set(doc(org2, 'events/e2/participants/org2'), orgRow('org2', false))
  await b.commit()
  return assertFails(setDoc(doc(org2, 'events/e2/sensitive/org2'), ficha))
})
await t('Organizador de un evento existente comparte su ficha después (consentimiento + ficha)', () => {
  const b = writeBatch(org2)
  b.update(doc(org2, 'events/e2/participants/org2'), { consent: { version: 'v1', acceptedAt: serverTimestamp() }, emergencyComplete: true, updatedAt: serverTimestamp() })
  b.set(doc(org2, 'events/e2/sensitive/org2'), ficha)
  return assertSucceeds(b.commit())
})
await t('El organizador NO puede cambiar su rol ni estado al compartir', () =>
  assertFails(updateDoc(doc(org, 'events/e1/participants/org'), { role: 'participant', consent: { version: 'v1', acceptedAt: serverTimestamp() } })))
await t('El organizador mantiene al día su indicador de ficha', () => assertSucceeds(updateDoc(doc(org, 'events/e1/participants/org'), { emergencyComplete: false, updatedAt: serverTimestamp() })))

await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore()
  for (const u of ['pedro', 'bob']) await setDoc(doc(db, `events/e1/participants/${u}`), { uid: u, role: 'participant', status: 'confirmed', emergencyComplete: true })
  await updateDoc(doc(db, 'events/e1'), { coOrganizers: ['pedro'] })
})
const n = (db, to, type, actor) => ({ ref: doc(collection(db, 'users', to, 'notifications')), data: { type, eventId: 'e1', eventTitle: 'Plomo', actorUid: actor, actorName: actor, read: false, createdAt: serverTimestamp() } })

await t('Pedro (equipo de seguridad) ve la ficha del organizador, avisándole', async () => {
  const x = n(pedro, 'org', 'sensitive_view', 'pedro')
  const b = writeBatch(pedro)
  b.set(x.ref, x.data)
  b.set(doc(pedro, 'events/e1/viewLog/org'), { viewerUid: 'pedro', lastViewedAt: serverTimestamp(), notifId: x.ref.id })
  await assertSucceeds(b.commit())
  const s = await assertSucceeds(getDoc(doc(pedro, 'events/e1/sensitive/org')))
  if (s.data()?.allergies !== 'Ibuprofeno') throw new Error('sin datos')
})
await t('Bob (confirmado) abre la ficha del organizador con acceso de emergencia', async () => {
  const x = n(bob, 'org', 'emergency_access', 'bob')
  const alert = n(bob, 'pedro', 'emergency_alert', 'bob')
  const b = writeBatch(bob)
  b.set(x.ref, x.data)
  b.set(alert.ref, alert.data)
  b.set(doc(bob, 'events/e1/viewLog/org'), { viewerUid: 'bob', lastViewedAt: serverTimestamp(), notifId: x.ref.id, emergency: true })
  await assertSucceeds(b.commit())
  await assertSucceeds(getDoc(doc(bob, 'events/e1/sensitive/org')))
})
await t('Bob NO lee la ficha del organizador sin acceso de emergencia', async () => {
  await env.withSecurityRulesDisabled(async (c) => setDoc(doc(c.firestore(), 'events/e1/viewLog/org'), { viewerUid: 'otro', lastViewedAt: Timestamp.now(), notifId: 'x' }))
  return assertFails(getDoc(doc(bob, 'events/e1/sensitive/org')))
})
await done()
