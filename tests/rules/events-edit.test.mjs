// Eventos: edición por el organizador
// Ejecutar con: npm run test:rules
import { setup } from './helpers.mjs'
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, updateDoc, writeBatch, serverTimestamp, Timestamp } from 'firebase/firestore'
const { env, t, done } = await setup()
const org = env.authenticatedContext('org').firestore(), ana = env.authenticatedContext('ana').firestore()
const day = 86400000
const b = writeBatch(org)
b.set(doc(org, 'events/e1'), { title: 'Plomo', activity: 'montanismo', description: '', startAt: Timestamp.fromMillis(Date.now() + day), endAt: Timestamp.fromMillis(Date.now() + 2 * day), location: 'Cajón', meetingPoint: '', visibility: 'private', capacity: 0, requirements: [], status: 'published', organizerUid: 'org', organizerName: 'Org', organizerRocketId: 'SU-1234', organizerPhoto: null, createdAt: serverTimestamp() })
b.set(doc(org, 'events/e1/participants/org'), { uid: 'org', displayName: 'Org', rocketId: 'SU-1234', photoURL: null, role: 'organizer', status: 'confirmed', emergencyComplete: false, updatedAt: serverTimestamp() })
await b.commit()
// mismo payload que eventFields() de la app
const fields = (extra = {}) => ({ title: 'Plomo (nuevo horario)', activity: 'trekking', description: 'Salimos temprano', startAt: Timestamp.fromMillis(Date.now() + 3 * day), endAt: Timestamp.fromMillis(Date.now() + 3 * day + 3600000), location: 'Cajón del Maipo', meetingPoint: 'Plaza', visibility: 'private', capacity: 12, requirements: [{ category: 'first_aid', label: 'WFA' }], ...extra })
await t('Organizador edita todos los campos', () => assertSucceeds(updateDoc(doc(org, 'events/e1'), fields())))
await t('Pasar a público SIN aceptar responsabilidades rechazado', () => assertFails(updateDoc(doc(org, 'events/e1'), fields({ visibility: 'public' }))))
await t('Pasar a público aceptando responsabilidades', () => assertSucceeds(updateDoc(doc(org, 'events/e1'), fields({ visibility: 'public', publicAck: { version: 'v1', acceptedAt: serverTimestamp() } }))))
await t('Volver a privado', () => assertSucceeds(updateDoc(doc(org, 'events/e1'), fields())))
await t('Otra persona NO puede editar', () => assertFails(updateDoc(doc(ana, 'events/e1'), fields())))
await t('No se puede cambiar el organizador', () => assertFails(updateDoc(doc(org, 'events/e1'), { organizerUid: 'ana' })))
await t('Fin antes que inicio rechazado', () => assertFails(updateDoc(doc(org, 'events/e1'), fields({ endAt: Timestamp.fromMillis(Date.now()) }))))
await done()
