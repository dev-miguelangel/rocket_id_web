// Eventos: la ficha compartida se mantiene al día mientras la persona sigue confirmada
// Ejecutar con: npm run test:rules
import { setup } from './helpers.mjs'
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, setDoc, getDoc, updateDoc, writeBatch, collection, serverTimestamp, Timestamp } from 'firebase/firestore'

const { env, t, done } = await setup()
const day = 86400000
const org = env.authenticatedContext('org').firestore()
const ana = env.authenticatedContext('ana').firestore()
const bob = env.authenticatedContext('bob').firestore()

await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore()
  await setDoc(doc(db, 'events/e1'), { title: 'Plomo', organizerUid: 'org', status: 'published', visibility: 'private', startAt: Timestamp.fromMillis(Date.now() + day), endAt: Timestamp.fromMillis(Date.now() + 2 * day) })
  await setDoc(doc(db, 'events/e1/participants/org'), { uid: 'org', role: 'organizer', status: 'confirmed', emergencyComplete: false })
  await setDoc(doc(db, 'events/e1/participants/ana'), { uid: 'ana', role: 'participant', status: 'confirmed', emergencyComplete: false, consent: { version: 'v1', acceptedAt: Timestamp.now() } })
  await setDoc(doc(db, 'events/e1/participants/bob'), { uid: 'bob', role: 'participant', status: 'invited', emergencyComplete: false })
  await setDoc(doc(db, 'events/e1/sensitive/ana'), { fullName: 'Ana', allergies: '', updatedAt: Timestamp.now() })
})

const ficha = (extra = {}) => ({ fullName: 'Ana', docType: 'rut', docNumber: '1', birthDate: '', phone: '', emergencyName: 'Mamá', emergencyRelationship: 'madre', emergencyPhone: '+56 9 1111 2222', insuranceSystem: 'fonasa', insuranceDetail: '', bloodType: 'O+', allergies: 'Penicilina', conditions: '', medications: '', updatedAt: serverTimestamp(), ...extra })
// mismo lote que refreshSharedFichas() de la app
const refresh = (db, uid, complete = true) => {
  const b = writeBatch(db)
  b.set(doc(db, 'events/e1/sensitive', uid), ficha())
  b.update(doc(db, 'events/e1/participants', uid), { emergencyComplete: complete, updatedAt: serverTimestamp() })
  return b.commit()
}

await t('Ana (confirmada) actualiza su ficha compartida e indicador', () => assertSucceeds(refresh(ana, 'ana')))
await t('El organizador ve la ficha nueva tras notificar', async () => {
  const n = doc(collection(org, 'users', 'ana', 'notifications'))
  const b = writeBatch(org)
  b.set(n, { type: 'sensitive_view', eventId: 'e1', eventTitle: 'Plomo', actorUid: 'org', actorName: 'Org', read: false, createdAt: serverTimestamp() })
  b.set(doc(org, 'events/e1/viewLog/ana'), { viewerUid: 'org', lastViewedAt: serverTimestamp(), notifId: n.id })
  await b.commit()
  const s = await getDoc(doc(org, 'events/e1/sensitive/ana'))
  if (s.data()?.allergies !== 'Penicilina' || s.data()?.emergencyName !== 'Mamá') throw new Error('ficha desactualizada')
})
await t('No puede falsificar el consentimiento con una fecha antigua', () =>
  assertFails(updateDoc(doc(ana, 'events/e1/participants/ana'), { emergencyComplete: true, consent: { version: 'v1', acceptedAt: Timestamp.fromMillis(0) } })))
await t('Indicador no booleano rechazado', () => assertFails(updateDoc(doc(ana, 'events/e1/participants/ana'), { emergencyComplete: 'si' })))
await t('Indicador no booleano rechazado también al pasar a "No va"', () =>
  assertFails(updateDoc(doc(ana, 'events/e1/participants/ana'), { emergencyComplete: 'si', status: 'declined' })))
await t('No puede volverse organizadora con la excusa del indicador', () =>
  assertFails(updateDoc(doc(ana, 'events/e1/participants/ana'), { emergencyComplete: true, role: 'organizer' })))
await t('Bob (solo invitado) NO comparte ficha sin confirmar', () => assertFails(refresh(bob, 'bob')))
await t('Bob (invitado) NO marca el indicador sin confirmar', () =>
  assertFails(updateDoc(doc(bob, 'events/e1/participants/bob'), { emergencyComplete: true, updatedAt: serverTimestamp() })))
await t('Bob NO puede escribir la ficha de Ana', () => assertFails(setDoc(doc(bob, 'events/e1/sensitive/ana'), ficha())))
await t('El organizador NO puede escribir la ficha de Ana', () => assertFails(setDoc(doc(org, 'events/e1/sensitive/ana'), ficha())))

// ---------- Guardar fichas sin conexión ----------
await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore()
  for (let i = 0; i < 8; i++) {
    await setDoc(doc(db, 'events/e1/participants', `p${i}`), { uid: `p${i}`, role: 'participant', status: 'confirmed', emergencyComplete: true })
    await setDoc(doc(db, 'events/e1/sensitive', `p${i}`), { fullName: `P${i}`, allergies: 'Ninguna' })
  }
})
const saveBatch = (db, actor, pids, type = 'sensitive_saved') => {
  const b = writeBatch(db)
  for (const pid of pids) {
    const n = doc(collection(db, 'users', pid, 'notifications'))
    b.set(n, { type, eventId: 'e1', eventTitle: 'Plomo', actorUid: actor, actorName: actor, read: false, createdAt: serverTimestamp() })
    b.set(doc(db, 'events/e1/viewLog', pid), { viewerUid: actor, lastViewedAt: serverTimestamp(), notifId: n.id })
  }
  return b.commit()
}
const eight = Array.from({ length: 8 }, (_, i) => `p${i}`)
await t('Organizador guarda 8 fichas en un lote (aviso "guardó tu ficha")', () => assertSucceeds(saveBatch(org, 'org', eight)))
await t('…y puede descargarlas para guardarlas en el teléfono', async () => {
  const s = await getDoc(doc(org, 'events/e1/sensitive/p7'))
  if (s.data()?.allergies !== 'Ninguna') throw new Error('sin datos')
})
await t('Cada participante recibió el aviso de ficha guardada', async () => {
  let found = false
  await env.withSecurityRulesDisabled(async (c) => {
    const { getDocs } = await import('firebase/firestore')
    const s = await getDocs(collection(c.firestore(), 'users/p3/notifications'))
    found = s.docs.some((d) => d.data().type === 'sensitive_saved')
  })
  if (!found) throw new Error('sin aviso')
})
await t('Un participante NO puede usar el aviso "guardó" para leer fichas ajenas', () => assertFails(saveBatch(bob, 'bob', ['p1'])))
await t('Aviso "guardó tu ficha" falso de alguien que no organiza rechazado', () =>
  assertFails(setDoc(doc(collection(bob, 'users', 'p1', 'notifications')), { type: 'sensitive_saved', eventId: 'e1', eventTitle: 'Plomo', actorUid: 'bob', actorName: 'Bob', read: false, createdAt: serverTimestamp() })))
await done()
