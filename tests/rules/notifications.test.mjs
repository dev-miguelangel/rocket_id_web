// Notificaciones entre organizador y participantes
// Ejecutar con: npm run test:rules
import { setup } from './helpers.mjs'
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, setDoc, collection, writeBatch, serverTimestamp, Timestamp } from 'firebase/firestore'
const { env, t, done } = await setup()
const ctx = (u) => env.authenticatedContext(u).firestore()
const org = ctx('org'), ana = ctx('ana'), eve = ctx('eve')
const day = 86400000
const many = Array.from({ length: 30 }, (_, i) => `p${i}`)
await env.withSecurityRulesDisabled(async (c) => { const db = c.firestore()
  await setDoc(doc(db, 'events/e1'), { title: 'Plomo', organizerUid: 'org', status: 'published', visibility: 'private', startAt: Timestamp.fromMillis(Date.now() + day), endAt: Timestamp.fromMillis(Date.now() + 2 * day) })
  for (const u of ['org', 'ana', 'bob', ...many]) await setDoc(doc(db, 'events/e1/participants', u), { uid: u, role: u === 'org' ? 'organizer' : 'participant', status: 'confirmed' }) })
const n = (type, actor, extra = {}) => ({ type, eventId: 'e1', eventTitle: 'Plomo', actorUid: actor, actorName: actor, read: false, createdAt: serverTimestamp(), ...extra })
const send = (db, to, data) => setDoc(doc(collection(db, 'users', to, 'notifications')), data)

await t('Org → Ana: evento editado (con detalle)', () => assertSucceeds(send(org, 'ana', n('event_updated', 'org', { detail: 'Cambió: fecha u hora' }))))
await t('Org → Ana: evento cancelado', () => assertSucceeds(send(org, 'ana', n('event_cancelled', 'org'))))
await t('Ana → Org: confirmó', () => assertSucceeds(send(ana, 'org', n('participant_confirmed', 'ana'))))
await t('Ana → Org: no podrá ir', () => assertSucceeds(send(ana, 'org', n('participant_declined', 'ana'))))
await t('Ana → Bob (no organizador): confirmó rechazado', () => assertFails(send(ana, 'bob', n('participant_confirmed', 'ana'))))
await t('Ana → Bob: evento editado rechazado (no es organizadora)', () => assertFails(send(ana, 'bob', n('event_updated', 'ana'))))
await t('Eve (no participa) → Org: se unió rechazado', () => assertFails(send(eve, 'org', n('participant_joined', 'eve'))))
await t('Org → Eve (no participa): editado rechazado', () => assertFails(send(org, 'eve', n('event_updated', 'org'))))
await t('Notificarse a sí mismo rechazado', () => assertFails(send(org, 'org', n('event_updated', 'org'))))
await t('Suplantar actor rechazado', () => assertFails(send(ana, 'org', n('participant_confirmed', 'bob'))))
await t('Tipo desconocido rechazado', () => assertFails(send(org, 'ana', n('promo', 'org'))))
await t('Detalle demasiado largo rechazado', () => assertFails(send(org, 'ana', n('event_updated', 'org', { detail: 'x'.repeat(200) }))))
await t('Org → 15 participantes en un lote (límite de lecturas)', () => { const b = writeBatch(org); many.slice(0, 15).forEach((u) => b.set(doc(collection(org, 'users', u, 'notifications')), n('event_updated', 'org'))); return assertSucceeds(b.commit()) })
await t('Org → otros 15 en un segundo lote', () => { const b = writeBatch(org); many.slice(15, 30).forEach((u) => b.set(doc(collection(org, 'users', u, 'notifications')), n('event_updated', 'org'))); return assertSucceeds(b.commit()) })
// Unirse con enlace + notificación al organizador en el mismo lote (como confirmAttendance)
await env.withSecurityRulesDisabled(async (c) => setDoc(doc(c.firestore(), 'publicProfiles/zoe'), { uid: 'zoe' }))
const zoe = ctx('zoe')
await t('Zoe se une por enlace y avisa al organizador (mismo lote)', () => { const b = writeBatch(zoe)
  b.set(doc(zoe, 'events/e1/participants/zoe'), { uid: 'zoe', displayName: 'Zoe', rocketId: 'x', photoURL: null, role: 'participant', status: 'confirmed', emergencyComplete: true, consent: { version: 'v1', acceptedAt: serverTimestamp() }, updatedAt: serverTimestamp() })
  b.set(doc(collection(zoe, 'users', 'org', 'notifications')), n('participant_joined', 'zoe'))
  return assertSucceeds(b.commit()) })
await done()
