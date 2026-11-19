// Panel admin: crear/purgar datos de prueba y mostrar/ocultar cursos de demostración
// Ejecutar con: ROCKETID_ADMIN_EMAIL=<correo admin> npm run test:rules (sin la variable solo se prueban rechazos)
import { setup } from './helpers.mjs'
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { collectionGroup, deleteDoc, doc, getDoc, getDocs, setDoc, serverTimestamp, writeBatch } from 'firebase/firestore'

const { env, t, done } = await setup()
const ADMIN = process.env.ROCKETID_ADMIN_EMAIL
const admin = ADMIN && env.authenticatedContext('admin', { email: ADMIN, email_verified: true }).firestore()
const alice = env.authenticatedContext('alice', { email: 'alice@rocketid.test', email_verified: true }).firestore()
const anon = env.unauthenticatedContext().firestore()
const _mock = { isMock: true, seed: 'mock-users-v1', createdAt: new Date().toISOString() }

const seedBatch = (db, uid, rid, hash, mark = _mock) => {
  const b = writeBatch(db)
  b.set(doc(db, `rocketIds/${rid}`), { uid, createdAt: serverTimestamp(), _mock: mark })
  b.set(doc(db, `users/${uid}`), { displayName: 'Prueba', email: 'p@rocketid.test', rocketId: rid, _mock: mark })
  b.set(doc(db, `publicProfiles/${uid}`), { uid, rocketId: rid, displayName: 'Prueba', photoURL: null, skills: { categories: [], certifications: [] }, searchable: true, searchTokens: [], _mock: mark })
  b.set(doc(db, `emailIndex/${hash}`), { uid, _mock: mark })
  b.set(doc(db, `users/${uid}/private/verifications`), { certs: {}, _mock: mark })
  return b.commit()
}

// Rechazos (siempre)
await t('Otra cuenta NO crea usuarios de prueba', () => assertFails(seedBatch(alice, 'mock_x', 'BA-0001', 'h1')))
await t('Otra cuenta NO borra usuarios de prueba', async () => {
  await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'users/mock_y'), { _mock }))
  return assertFails(deleteDoc(doc(alice, 'users/mock_y')))
})
await t('Otra cuenta NO lee el registro de prueba', () => assertFails(getDoc(doc(alice, '_mock/registry'))))
await t('Otra cuenta NO cambia la configuración', () => assertFails(setDoc(doc(alice, 'config/app'), { demoCourses: false })))
await t('Sin sesión SÍ lee la configuración', () => assertSucceeds(getDoc(doc(anon, 'config/app'))))

if (admin) {
  await t('Admin crea un usuario de prueba completo', () => assertSucceeds(seedBatch(admin, 'mock_camila', 'CA-1234', 'hash1')))
  await t('Admin NO crea un usuario real (sin prefijo mock_)', () => assertFails(seedBatch(admin, 'realuser', 'RE-1111', 'hash2')))
  await t('Admin NO crea un usuario de prueba sin la marca _mock', () => assertFails(seedBatch(admin, 'mock_sin', 'SI-2222', 'hash3', { isMock: false })))
  await t('Admin NO crea un rocketId para un uid real', () => assertFails(setDoc(doc(admin, 'rocketIds/RE-3333'), { uid: 'alice', _mock })))
  await t('Admin escribe el registro de prueba', () => assertSucceeds(setDoc(doc(admin, '_mock/registry'), { seed: 'mock-users-v1', paths: [] }, { merge: true })))

  // Purga
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore()
    await setDoc(doc(db, 'users/alice'), { displayName: 'Alice' })
    await setDoc(doc(db, 'users/alice/contacts/mock_camila'), { uid: 'mock_camila' })
    await setDoc(doc(db, 'users/alice/contacts/bob'), { uid: 'bob' })
    await setDoc(doc(db, 'rocketIds/AL-0001'), { uid: 'alice' })
    await setDoc(doc(db, 'emailIndex/realhash'), { uid: 'alice' })
  })
  await t('Admin lista cordadas para encontrar referencias de prueba', () => assertSucceeds(getDocs(collectionGroup(admin, 'contacts'))))
  await t('Admin purga todo lo de prueba en un lote', () => {
    const b = writeBatch(admin)
    for (const p of ['rocketIds/CA-1234', 'users/mock_camila', 'publicProfiles/mock_camila', 'emailIndex/hash1', 'users/mock_camila/private/verifications', 'users/alice/contacts/mock_camila', 'rocketIds/NO-0000'])
      b.delete(doc(admin, p))
    return assertSucceeds(b.commit())
  })
  await t('Admin NO borra un usuario real', () => assertFails(deleteDoc(doc(admin, 'users/alice'))))
  await t('Admin NO borra un contacto real de una cordada', () => assertFails(deleteDoc(doc(admin, 'users/alice/contacts/bob'))))
  await t('Admin NO borra el rocketId de una persona real', () => assertFails(deleteDoc(doc(admin, 'rocketIds/AL-0001'))))
  await t('Admin NO borra el correo indexado de una persona real', () => assertFails(deleteDoc(doc(admin, 'emailIndex/realhash'))))
  await t('Admin borra el registro de prueba', () => assertSucceeds(deleteDoc(doc(admin, '_mock/registry'))))

  // Cursos de demostración
  await t('Admin oculta los cursos de demostración', () => assertSucceeds(setDoc(doc(admin, 'config/app'), { demoCourses: false, updatedAt: serverTimestamp() })))
  await t('Admin los vuelve a mostrar', () => assertSucceeds(setDoc(doc(admin, 'config/app'), { demoCourses: true, updatedAt: serverTimestamp() })))
  await t('Configuración con campos extra rechazada', () => assertFails(setDoc(doc(admin, 'config/app'), { demoCourses: true, x: 1 })))
  await t('demoCourses que no es booleano rechazado', () => assertFails(setDoc(doc(admin, 'config/app'), { demoCourses: 'no' })))
} else {
  console.log('  (sin ROCKETID_ADMIN_EMAIL: se omiten las pruebas de acceso admin)')
}
await done()
