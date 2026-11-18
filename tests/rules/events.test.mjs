// Eventos: crear, invitar, confirmar y acceso a fichas de emergencia
// Ejecutar con: npm run test:rules
import { setup } from './helpers.mjs'
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, collection, collectionGroup, query, where, limit, writeBatch, serverTimestamp, Timestamp } from 'firebase/firestore'
const { env, t, done } = await setup()
const ctx = (uid) => env.authenticatedContext(uid, { email: `${uid}@x.cl`, email_verified: true }).firestore()
const org = ctx('org'), ana = ctx('ana'), bob = ctx('bob'), eve = ctx('eve')
await env.withSecurityRulesDisabled(async (c) => {
  for (const u of ['org', 'ana', 'bob', 'eve']) await setDoc(doc(c.firestore(), 'publicProfiles', u), { uid: u, displayName: u })
})
const day = 86400000
const evt = (extra = {}) => ({ title: 'Plomo', activity: 'montanismo', description: '', startAt: Timestamp.fromMillis(Date.now() + day), endAt: Timestamp.fromMillis(Date.now() + 2 * day),
  location: 'Cajón', meetingPoint: 'Plaza', visibility: 'private', capacity: 10, requirements: [], status: 'published', organizerUid: 'org', organizerName: 'Org', organizerRocketId: 'SU-1234', organizerPhoto: null, createdAt: serverTimestamp(), ...extra })
const orgRow = { uid: 'org', displayName: 'Org', rocketId: 'SU-1234', photoURL: null, role: 'organizer', status: 'confirmed', emergencyComplete: false, updatedAt: serverTimestamp() }
const create = (db, id, e, row = orgRow) => { const b = writeBatch(db); b.set(doc(db, 'events', id), e); b.set(doc(db, 'events', id, 'participants', row.uid), row); return b.commit() }

await t('Organizador crea evento privado', () => assertSucceeds(create(org, 'e1', evt())))
await t('Evento público SIN aceptar responsabilidades rechazado', () => assertFails(create(org, 'e2', evt({ visibility: 'public' }))))
await t('Evento público con alerta aceptada', () => assertSucceeds(create(org, 'e3', evt({ visibility: 'public', publicAck: { version: 'v1', acceptedAt: serverTimestamp() } }))))
await t('Crear evento a nombre de otro rechazado', () => assertFails(create(ana, 'e4', evt(), { ...orgRow })))
await t('Fin antes que inicio rechazado', () => assertFails(create(org, 'e5', evt({ endAt: Timestamp.fromMillis(Date.now()) }))))
await t('Cualquiera con enlace ve el evento privado (get)', () => assertSucceeds(getDoc(doc(eve, 'events/e1'))))
await t('Listar públicos OK', async () => { const s = await assertSucceeds(getDocs(query(collection(eve, 'events'), where('visibility', '==', 'public'), limit(50)))); if (s.size !== 1) throw new Error('size ' + s.size) })
await t('Listar todos (incl. privados) rechazado', () => assertFails(getDocs(query(collection(eve, 'events'), limit(50)))))
await t('No organizador NO edita el evento', () => assertFails(updateDoc(doc(ana, 'events/e1'), { title: 'Hack' })))
await t('Organizador cancela el evento', () => assertSucceeds(updateDoc(doc(org, 'events/e3'), { status: 'cancelled' })))

const invite = (db, eid, pid) => { const b = writeBatch(db)
  b.set(doc(db, 'events', eid, 'participants', pid), { uid: pid, displayName: pid, rocketId: 'XX', photoURL: null, role: 'participant', status: 'invited', emergencyComplete: false, invitedBy: 'org', updatedAt: serverTimestamp() })
  b.set(doc(collection(db, 'users', pid, 'notifications')), { type: 'event_invite', eventId: eid, eventTitle: 'Plomo', actorUid: 'org', actorName: 'Org', read: false, createdAt: serverTimestamp() })
  return b.commit() }
await t('Organizador invita a Ana (con notificación)', () => assertSucceeds(invite(org, 'e1', 'ana')))
await t('Ana NO puede invitar a Bob', () => assertFails((() => { const b = writeBatch(ana); b.set(doc(ana, 'events/e1/participants/bob'), { uid: 'bob', displayName: 'b', rocketId: 'x', photoURL: null, role: 'participant', status: 'invited', emergencyComplete: false, invitedBy: 'ana', updatedAt: serverTimestamp() }); return b.commit() })()))
await t('Notificación falsa (no organizador) rechazada', () => assertFails(setDoc(doc(collection(eve, 'users', 'ana', 'notifications')), { type: 'sensitive_view', eventId: 'e1', eventTitle: 'x', actorUid: 'eve', actorName: 'Eve', read: false, createdAt: serverTimestamp() })))
await t('Ana ve sus notificaciones', async () => { const s = await assertSucceeds(getDocs(collection(ana, 'users/ana/notifications'))); if (s.size !== 1) throw new Error('size') })
await t('Bob NO ve notificaciones de Ana', () => assertFails(getDocs(collection(bob, 'users/ana/notifications'))))

const sens = { fullName: 'Ana', docType: 'rut', docNumber: '1', birthDate: '', phone: '', emergencyName: 'Mamá', emergencyRelationship: '', emergencyPhone: '+56 9', insuranceSystem: 'fonasa', insuranceDetail: '', bloodType: 'O+', allergies: 'Penicilina', conditions: '', medications: '', updatedAt: serverTimestamp() }
const confirm = (db, eid, uid, existing) => { const b = writeBatch(db)
  const base = { status: 'confirmed', emergencyComplete: true, consent: { version: 'v1', acceptedAt: serverTimestamp() }, updatedAt: serverTimestamp() }
  if (existing) b.update(doc(db, 'events', eid, 'participants', uid), base)
  else b.set(doc(db, 'events', eid, 'participants', uid), { uid, displayName: uid, rocketId: 'x', photoURL: null, role: 'participant', ...base })
  b.set(doc(db, 'events', eid, 'sensitive', uid), sens); return b.commit() }
await t('Ana confirma con consentimiento y comparte ficha', () => assertSucceeds(confirm(ana, 'e1', 'ana', true)))
await t('Ana NO puede volverse organizadora', () => assertFails(updateDoc(doc(ana, 'events/e1/participants/ana'), { role: 'organizer' })))
await t('Bob se une con el enlace (privado)', () => assertSucceeds(confirm(bob, 'e1', 'bob', false)))
await t('Eve NO comparte ficha sin confirmar', () => assertFails(setDoc(doc(eve, 'events/e1/sensitive/eve'), sens)))
await t('Ana ve la lista de participantes', () => assertSucceeds(getDocs(collection(ana, 'events/e1/participants'))))
await t('Eve (no participa) NO ve participantes', () => assertFails(getDocs(collection(eve, 'events/e1/participants'))))
await t('"Mis eventos" de Ana (collection group)', async () => { const s = await assertSucceeds(getDocs(query(collectionGroup(ana, 'participants'), where('uid', '==', 'ana')))); if (s.size !== 1) throw new Error('size ' + s.size) })

await t('Organizador NO lee la ficha sin registrar/notificar', () => assertFails(getDoc(doc(org, 'events/e1/sensitive/ana'))))
await t('viewLog sin notificación rechazado', () => assertFails(setDoc(doc(org, 'events/e1/viewLog/ana'), { viewerUid: 'org', lastViewedAt: serverTimestamp(), notifId: 'nope' })))
const view = (db, eid, pid, actor = 'org') => { const n = doc(collection(db, 'users', pid, 'notifications')); const b = writeBatch(db)
  b.set(n, { type: 'sensitive_view', eventId: eid, eventTitle: 'Plomo', actorUid: actor, actorName: 'Org', read: false, createdAt: serverTimestamp() })
  b.set(doc(db, 'events', eid, 'viewLog', pid), { viewerUid: actor, lastViewedAt: serverTimestamp(), notifId: n.id }); return b.commit() }
await t('Organizador registra visualización + notifica a Ana', () => assertSucceeds(view(org, 'e1', 'ana')))
await t('…y ahora SÍ lee la ficha de Ana', async () => { const s = await assertSucceeds(getDoc(doc(org, 'events/e1/sensitive/ana'))); if (s.data()?.allergies !== 'Penicilina') throw new Error('data') })
await t('Ana recibió la notificación de visualización', async () => { const s = await getDocs(collection(ana, 'users/ana/notifications')); if (!s.docs.some((d) => d.data().type === 'sensitive_view')) throw new Error('no') })
await t('Organizador NO lee la ficha de Bob (no registró)', () => assertFails(getDoc(doc(org, 'events/e1/sensitive/bob'))))
await t('Bob (participante) NO lee la ficha de Ana', () => assertFails(getDoc(doc(bob, 'events/e1/sensitive/ana'))))
await t('Eve NO puede registrar visualización', () => assertFails(view(eve, 'e1', 'ana', 'eve')))
await t('Ana marca su notificación como leída', async () => { const s = await getDocs(collection(ana, 'users/ana/notifications')); return assertSucceeds(updateDoc(s.docs[0].ref, { read: true })) })
await t('Ana NO altera el contenido de la notificación', async () => { const s = await getDocs(collection(ana, 'users/ana/notifications')); return assertFails(updateDoc(s.docs[0].ref, { actorName: 'x' })) })

// Evento terminado hace 3 días: el acceso a fichas se cierra
await env.withSecurityRulesDisabled(async (c) => { const db = c.firestore()
  await setDoc(doc(db, 'events/old'), { ...evt(), startAt: Timestamp.fromMillis(Date.now() - 5 * day), endAt: Timestamp.fromMillis(Date.now() - 3 * day), createdAt: Timestamp.now() })
  await setDoc(doc(db, 'events/old/participants/org'), { ...orgRow, updatedAt: Timestamp.now() })
  await setDoc(doc(db, 'events/old/participants/ana'), { uid: 'ana', displayName: 'ana', rocketId: 'x', photoURL: null, role: 'participant', status: 'confirmed', emergencyComplete: true, updatedAt: Timestamp.now() })
  await setDoc(doc(db, 'events/old/sensitive/ana'), { ...sens, updatedAt: Timestamp.now() }) })
await view(org, 'old', 'ana')
await t('Evento terminado hace 3 días: ficha ya NO legible', () => assertFails(getDoc(doc(org, 'events/old/sensitive/ana'))))

await t('Ana rechaza/sale y borra su ficha', () => { const b = writeBatch(ana); b.update(doc(ana, 'events/e1/participants/ana'), { status: 'declined', updatedAt: serverTimestamp() }); b.delete(doc(ana, 'events/e1/sensitive/ana')); return assertSucceeds(b.commit()) })
await t('Organizador quita a Bob', () => assertSucceeds(deleteDoc(doc(org, 'events/e1/participants/bob'))))
await t('Organizador NO se quita a sí mismo', () => assertFails(deleteDoc(doc(org, 'events/e1/participants/org'))))
await t('Unirse a evento cancelado rechazado', () => assertFails(confirm(eve, 'e3', 'eve', false)))
await done()
