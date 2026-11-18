// rocketId: unicidad, formato e inmutabilidad
// Ejecutar con: npm run test:rules
import { setup } from './helpers.mjs'
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, setDoc, getDoc, writeBatch, serverTimestamp, updateDoc, deleteDoc } from 'firebase/firestore'

const { env, t, done } = await setup()

const alice = env.authenticatedContext('alice').firestore()
const bob = env.authenticatedContext('bob').firestore()
// Perfiles base como los crea la app en el primer login
await assertSucceeds(setDoc(doc(alice, 'users/alice'), { displayName: 'Alice', email: 'a@x.cl', photoURL: null, createdAt: serverTimestamp(), lastLoginAt: serverTimestamp() }))
await assertSucceeds(setDoc(doc(bob, 'users/bob'), { displayName: 'Bob', email: 'b@x.cl', photoURL: null, createdAt: serverTimestamp(), lastLoginAt: serverTimestamp() }))

const assign = (db, uid, code) => {
  const b = writeBatch(db)
  b.set(doc(db, 'rocketIds', code), { uid, createdAt: serverTimestamp() })
  b.set(doc(db, 'users', uid), { rocketId: code }, { merge: true })
  return b.commit()
}

await t('Alice obtiene SU-1234', () => assertSucceeds(assign(alice, 'alice', 'SU-1234')))
await t('Bob NO puede tomar SU-1234 (colisión)', () => assertFails(assign(bob, 'bob', 'SU-1234')))
await t('Bob obtiene otro código BA-0042', () => assertSucceeds(assign(bob, 'bob', 'BA-0042')))
await t('Alice NO puede obtener un segundo rocketId', () => assertFails(assign(alice, 'alice', 'TE-9999')))
await t('Alice NO puede cambiar su rocketId directamente', () => assertFails(setDoc(doc(alice, 'users/alice'), { rocketId: 'BA-0042' }, { merge: true })))
await t('Alice NO puede borrar su rocketId', () => assertFails(setDoc(doc(alice, 'users/alice'), { displayName: 'Alice' })))
await t('Alice SÍ puede editar su perfil (conserva rocketId)', () => assertSucceeds(setDoc(doc(alice, 'users/alice'), { fullName: 'Alice Pérez', phone: '+56 9 1234 5678' }, { merge: true })))
await t('Alice NO puede borrar la reserva', () => assertFails(deleteDoc(doc(alice, 'rocketIds/SU-1234'))))
await t('Alice NO puede editar la reserva', () => assertFails(updateDoc(doc(alice, 'rocketIds/SU-1234'), { uid: 'alice' })))
await t('Bob SÍ obtiene la reserva de Alice por código exacto (búsqueda)', () => assertSucceeds(getDoc(doc(bob, 'rocketIds/SU-1234'))))
await t('Alice SÍ lee su reserva', () => assertSucceeds(getDoc(doc(alice, 'rocketIds/SU-1234'))))

const carol = env.authenticatedContext('carol').firestore()
await setDoc(doc(carol, 'users/carol'), { displayName: 'Carol' })
await t('Formato inválido (vocal primero) rechazado', () => assertFails(assign(carol, 'carol', 'AS-1234')))
await t('Formato inválido (Ñ) rechazado', () => assertFails(assign(carol, 'carol', 'ÑA-1234')))
await t('Formato inválido (minúsculas) rechazado', () => assertFails(assign(carol, 'carol', 'su-1235')))
await t('Reserva sin escribir el perfil rechazada', () => assertFails(setDoc(doc(carol, 'rocketIds/KO-1111'), { uid: 'carol', createdAt: serverTimestamp() })))
await t('Perfil apuntando a reserva ajena rechazado', () => assertFails(setDoc(doc(carol, 'users/carol'), { rocketId: 'BA-0042' }, { merge: true })))
await t('Reserva a nombre de otra persona rechazada', () => {
  const b = writeBatch(carol)
  b.set(doc(carol, 'rocketIds/PI-2222'), { uid: 'bob', createdAt: serverTimestamp() })
  b.set(doc(carol, 'users/carol'), { rocketId: 'PI-2222' }, { merge: true })
  return assertFails(b.commit())
})
await t('Carol obtiene ZU-0001 válido', () => assertSucceeds(assign(carol, 'carol', 'ZU-0001')))

// Las demás reglas siguen funcionando
await t('Postulación propia sigue permitida', () => assertSucceeds(setDoc(doc(alice, 'applications/alice_demo-x'), {
  uid: 'alice', courseId: 'demo-x', courseTitle: 'X', providerName: 'Y', status: 'sent', createdAt: serverTimestamp(),
  consent: { version: 'v1', acceptedAt: serverTimestamp() }, applicant: { certifications: [] } })))
await t('Postulación duplicada rechazada', () => assertFails(setDoc(doc(alice, 'applications/alice_demo-x'), {
  uid: 'alice', courseId: 'demo-x', courseTitle: 'X', providerName: 'Y', status: 'sent', createdAt: serverTimestamp(),
  consent: { version: 'v1', acceptedAt: serverTimestamp() }, applicant: { certifications: [] } })))
await t('Verificaciones no escribibles por la persona', () => assertFails(setDoc(doc(alice, 'users/alice/private/verifications'), { certs: {} })))

await t('La persona marca que terminó el recorrido de primer uso', () => assertSucceeds(setDoc(doc(alice, 'users/alice'), { onboardedAt: serverTimestamp() }, { merge: true })))
await t('onboardedAt que no es fecha rechazado', () => assertFails(setDoc(doc(alice, 'users/alice'), { onboardedAt: 'ayer' }, { merge: true })))
await t('Otra persona NO marca el recorrido ajeno', () => assertFails(setDoc(doc(bob, 'users/alice'), { onboardedAt: serverTimestamp() }, { merge: true })))
await done()
