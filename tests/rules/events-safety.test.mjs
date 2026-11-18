// Eventos: respaldo si el organizador no está — equipo de seguridad (co-organizadores) y acceso de emergencia
// Ejecutar con: npm run test:rules
import { setup } from './helpers.mjs'
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, setDoc, getDoc, updateDoc, writeBatch, collection, serverTimestamp, Timestamp } from 'firebase/firestore'

const { env, t, done } = await setup()
const H = 3600000
const ctx = (u) => env.authenticatedContext(u).firestore()
const org = ctx('org'), pedro = ctx('pedro'), bob = ctx('bob'), eve = ctx('eve'), zoe = ctx('zoe')

const base = (extra = {}) => ({ title: 'Plomo', activity: 'montanismo', description: '', location: 'X', meetingPoint: '', visibility: 'private', capacity: 0, requirements: [], status: 'published', organizerUid: 'org', organizerName: 'Org', organizerRocketId: 'SU-1234', organizerPhoto: null, createdAt: Timestamp.now(), ...extra })
await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore()
  // e1: en curso (empezó hace 1 h, termina en 5 h)
  await setDoc(doc(db, 'events/e1'), base({ startAt: Timestamp.fromMillis(Date.now() - H), endAt: Timestamp.fromMillis(Date.now() + 5 * H) }))
  // e2: dentro de 3 días (fuera de la ventana de emergencia)
  await setDoc(doc(db, 'events/e2'), base({ startAt: Timestamp.fromMillis(Date.now() + 72 * H), endAt: Timestamp.fromMillis(Date.now() + 80 * H) }))
  for (const e of ['e1', 'e2']) {
    await setDoc(doc(db, `events/${e}/participants/org`), { uid: 'org', role: 'organizer', status: 'confirmed', emergencyComplete: true })
    for (const [u, st] of [['pedro', 'confirmed'], ['ana', 'confirmed'], ['bob', 'confirmed'], ['zoe', 'invited']])
      await setDoc(doc(db, `events/${e}/participants/${u}`), { uid: u, role: 'participant', status: st, emergencyComplete: true })
    await setDoc(doc(db, `events/${e}/sensitive/ana`), { fullName: 'Ana', allergies: 'Penicilina' })
  }
})

const notif = (db, to, type, actor, eid = 'e1') => {
  const n = doc(collection(db, 'users', to, 'notifications'))
  return { ref: n, data: { type, eventId: eid, eventTitle: 'Plomo', actorUid: actor, actorName: actor, read: false, createdAt: serverTimestamp() } }
}
const leadView = (db, actor, pid, eid = 'e1') => {
  const n = notif(db, pid, 'sensitive_view', actor, eid)
  const b = writeBatch(db)
  b.set(n.ref, n.data)
  b.set(doc(db, `events/${eid}/viewLog/${pid}`), { viewerUid: actor, lastViewedAt: serverTimestamp(), notifId: n.ref.id })
  return b.commit()
}
const emergency = (db, actor, pid, eid = 'e1', alertTo = ['org', 'pedro']) => {
  const n = notif(db, pid, 'emergency_access', actor, eid)
  const b = writeBatch(db)
  b.set(n.ref, n.data)
  b.set(doc(db, `events/${eid}/viewLog/${pid}`), { viewerUid: actor, lastViewedAt: serverTimestamp(), notifId: n.ref.id, emergency: true })
  for (const to of alertTo.filter((x) => x !== actor)) {
    const a = notif(db, to, 'emergency_alert', actor, eid)
    b.set(a.ref, a.data)
  }
  return b.commit()
}
const readAna = (db, eid = 'e1') => getDoc(doc(db, `events/${eid}/sensitive/ana`))

// ---------- Co-organizadores ----------
await t('Pedro (sin designar) NO puede registrar visualización', () => assertFails(leadView(pedro, 'pedro', 'ana')))
await t('Organizador designa a Pedro como equipo de seguridad (+ aviso)', () => {
  const n = notif(org, 'pedro', 'co_organizer_added', 'org')
  const b = writeBatch(org)
  b.update(doc(org, 'events/e1'), { coOrganizers: ['pedro'] })
  b.set(n.ref, n.data)
  return assertSucceeds(b.commit())
})
await t('Pedro (equipo) ve la ficha de Ana tras notificar', async () => {
  await assertSucceeds(leadView(pedro, 'pedro', 'ana'))
  const s = await assertSucceeds(readAna(pedro))
  if (s.data()?.allergies !== 'Penicilina') throw new Error('sin datos')
})
await t('Pedro (equipo) NO edita el evento', () => assertFails(updateDoc(doc(pedro, 'events/e1'), { title: 'x' })))
await t('Pedro (equipo) NO puede designar a otros', () => assertFails(updateDoc(doc(pedro, 'events/e1'), { coOrganizers: ['pedro', 'bob'] })))
await t('Pedro NO puede enviar el aviso de "designado"', () => {
  const n = notif(pedro, 'bob', 'co_organizer_added', 'pedro')
  return assertFails(setDoc(n.ref, n.data))
})
await t('Más de 2 co-organizadores rechazado', () => assertFails(updateDoc(doc(org, 'events/e1'), { coOrganizers: ['pedro', 'ana', 'bob'] })))
await t('El organizador no puede ser su propio co-organizador', () => assertFails(updateDoc(doc(org, 'events/e1'), { coOrganizers: ['org'] })))
await t('Si Pedro deja de estar confirmado, pierde el acceso', async () => {
  await env.withSecurityRulesDisabled(async (c) => updateDoc(doc(c.firestore(), 'events/e1/participants/pedro'), { status: 'declined' }))
  await assertFails(leadView(pedro, 'pedro', 'ana'))
  await env.withSecurityRulesDisabled(async (c) => updateDoc(doc(c.firestore(), 'events/e1/participants/pedro'), { status: 'confirmed' }))
})

// ---------- Acceso de emergencia ----------
await t('Bob (confirmado) NO lee la ficha sin acceso de emergencia', () => assertFails(readAna(bob)))
await t('Bob usa el acceso de emergencia (avisa a Ana, al organizador y al equipo)', () => assertSucceeds(emergency(bob, 'bob', 'ana')))
await t('…y lee la ficha de Ana', async () => {
  const s = await assertSucceeds(readAna(bob))
  if (s.data()?.allergies !== 'Penicilina') throw new Error('sin datos')
})
await t('Zoe (solo invitada) NO puede usar el acceso de emergencia', () => assertFails(emergency(zoe, 'zoe', 'ana')))
await t('Eve (no participa) NO puede usar el acceso de emergencia', () => assertFails(emergency(eve, 'eve', 'ana')))
await t('Fuera de la ventana (evento en 3 días) rechazado', () => assertFails(emergency(bob, 'bob', 'ana', 'e2')))
await t('Registro de emergencia sin el aviso a la persona rechazado', () =>
  assertFails(setDoc(doc(bob, 'events/e1/viewLog/ana'), { viewerUid: 'bob', lastViewedAt: serverTimestamp(), notifId: 'falso', emergency: true })))
await t('No se puede marcar emergencia con un aviso "vio tu ficha"', () => {
  const n = notif(bob, 'ana', 'sensitive_view', 'bob')
  const b = writeBatch(bob)
  b.set(n.ref, n.data)
  b.set(doc(bob, 'events/e1/viewLog/ana'), { viewerUid: 'bob', lastViewedAt: serverTimestamp(), notifId: n.ref.id, emergency: true })
  return assertFails(b.commit())
})
await t('Alerta de emergencia a alguien que no es del equipo rechazada', () => {
  const a = notif(bob, 'ana', 'emergency_alert', 'bob')
  return assertFails(setDoc(a.ref, a.data))
})
await t('Aviso de emergencia falso de alguien que no participa rechazado', () => {
  const a = notif(eve, 'org', 'emergency_alert', 'eve')
  return assertFails(setDoc(a.ref, a.data))
})
await t('El organizador sigue viendo fichas normalmente', async () => {
  await assertSucceeds(leadView(org, 'org', 'ana'))
  await assertSucceeds(readAna(org))
})
await t('Bob NO puede usar el registro de emergencia del evento futuro para leer', () => assertFails(readAna(bob, 'e2')))
await done()
