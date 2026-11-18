// Contador de visitas de la landing
// Ejecutar con: npm run test:rules
import { setup } from './helpers.mjs'
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, deleteDoc, increment } from 'firebase/firestore'

const { env, t, done } = await setup()
const anon = env.unauthenticatedContext().firestore()
const alice = env.authenticatedContext('alice').firestore()
const ref = (db) => doc(db, 'stats/landing')

await t('Sin sesión crea el contador en 1', () => assertSucceeds(setDoc(ref(anon), { visits: 1 })))
await t('Sin sesión suma una visita', () => assertSucceeds(updateDoc(ref(anon), { visits: increment(1) })))
await t('Con sesión también suma', () => assertSucceeds(updateDoc(ref(alice), { visits: increment(1) })))
await t('Cualquiera lee el contador', async () => {
  const s = await assertSucceeds(getDoc(ref(anon)))
  if (s.data()?.visits !== 3) throw new Error('esperaba 3, hay ' + s.data()?.visits)
})
await t('NO se puede sumar más de 1', () => assertFails(updateDoc(ref(anon), { visits: increment(5) })))
await t('NO se puede restar', () => assertFails(updateDoc(ref(anon), { visits: increment(-1) })))
await t('NO se puede reiniciar', () => assertFails(setDoc(ref(anon), { visits: 1 })))
await t('NO se agregan otros campos', () => assertFails(updateDoc(ref(anon), { visits: increment(1), x: 1 })))
await t('NO se borra', () => assertFails(deleteDoc(ref(alice))))
await t('NO se lee ni escribe otro documento de stats', () => assertFails(setDoc(doc(anon, 'stats/otro'), { visits: 1 })))
await done()
