// Panel admin: métricas solo para la cuenta de administración (hash del correo en las reglas)
// Ejecutar con: ROCKETID_ADMIN_EMAIL=<correo admin> npm run test:rules
// Sin la variable, se prueban solo los rechazos (el correo no se guarda en el repositorio).
import { setup } from './helpers.mjs'
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { collection, collectionGroup, doc, getCountFromServer, getDocs, setDoc, updateDoc, increment, query, where, Timestamp } from 'firebase/firestore'

const { env, t, done } = await setup()
const ADMIN = process.env.ROCKETID_ADMIN_EMAIL
const admin = ADMIN && env.authenticatedContext('admin', { email: ADMIN, email_verified: true }).firestore()
const adminUnverified = ADMIN && env.authenticatedContext('admin2', { email: ADMIN, email_verified: false }).firestore()
const alice = env.authenticatedContext('alice', { email: 'alice@rocketid.test', email_verified: true }).firestore()
const anon = env.unauthenticatedContext().firestore()

await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore()
  await setDoc(doc(db, 'users/alice'), { displayName: 'Alice', createdAt: Timestamp.now() })
  await setDoc(doc(db, 'users/mock_bob'), { displayName: 'Bob', createdAt: Timestamp.now() })
  await setDoc(doc(db, 'users/alice/contacts/bob'), { uid: 'bob' })
  await setDoc(doc(db, 'events/e1'), { visibility: 'private', startAt: Timestamp.now() })
  await setDoc(doc(db, 'events/e1/participants/alice'), { uid: 'alice', status: 'confirmed' })
  await setDoc(doc(db, 'applications/alice_c1'), { uid: 'alice', courseId: 'c1' })
})

const count = (q) => getCountFromServer(q).then((s) => s.data().count)
const queries = (db) => ({
  usuarios: collection(db, 'users'),
  'usuarios nuevos': query(collection(db, 'users'), where('createdAt', '>=', Timestamp.fromMillis(Date.now() - 7 * 86400000))),
  eventos: collection(db, 'events'),
  participaciones: collectionGroup(db, 'participants'),
  cordadas: collectionGroup(db, 'contacts'),
  postulaciones: collection(db, 'applications'),
})

for (const [name, q] of Object.entries(queries(alice))) await t(`Otra cuenta NO cuenta ${name}`, () => assertFails(count(q)))
await t('Sin sesión NO cuenta usuarios', () => assertFails(count(collection(anon, 'users'))))
await t('Otra cuenta NO lista visitas por día', () => assertFails(getDocs(collection(alice, 'stats/landing/days'))))

// Visitas por día: cualquiera suma de a 1, con fecha válida
await t('Sin sesión crea el día en 1', () => assertSucceeds(setDoc(doc(anon, 'stats/landing/days/2026-11-19'), { visits: 1 })))
await t('Sin sesión suma 1 al día', () => assertSucceeds(updateDoc(doc(anon, 'stats/landing/days/2026-11-19'), { visits: increment(1) })))
await t('NO suma más de 1 al día', () => assertFails(updateDoc(doc(anon, 'stats/landing/days/2026-11-19'), { visits: increment(3) })))
await t('NO crea un día con formato inválido', () => assertFails(setDoc(doc(anon, 'stats/landing/days/ayer'), { visits: 1 })))
await t('NO lee un día suelto sin ser admin', () => assertFails(getDocs(query(collection(anon, 'stats/landing/days')))))

if (admin) {
  const expected = { usuarios: 2, 'usuarios nuevos': 2, eventos: 1, participaciones: 1, cordadas: 1, postulaciones: 1 }
  for (const [name, q] of Object.entries(queries(admin)))
    await t(`Admin cuenta ${name}`, async () => {
      const n = await assertSucceeds(count(q))
      if (n !== expected[name]) throw new Error(`esperaba ${expected[name]}, hubo ${n}`)
    })
  await t('Admin lista visitas por día', () => assertSucceeds(getDocs(collection(admin, 'stats/landing/days'))))
  await t('Admin con correo sin verificar NO cuenta', () => assertFails(count(collection(adminUnverified, 'users'))))
  await t('Admin NO lee fichas de salud', () => assertFails(getDocs(collection(admin, 'events/e1/sensitive'))))
} else {
  console.log('  (sin ROCKETID_ADMIN_EMAIL: se omiten las pruebas de acceso admin)')
}
await done()
