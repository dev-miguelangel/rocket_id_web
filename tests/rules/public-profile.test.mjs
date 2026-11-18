// Perfil público, índice de correo, verificaciones y cordada
// Ejecutar con: npm run test:rules
import { setup } from './helpers.mjs'
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { createHash } from 'node:crypto'
import { doc, setDoc, getDoc, getDocs, collection, writeBatch, serverTimestamp, deleteDoc } from 'firebase/firestore'

const { env, t, done } = await setup()
const h = (e) => createHash('sha256').update(e.trim().toLowerCase()).digest('hex')

const ctx = (uid, email) => env.authenticatedContext(uid, { email, email_verified: true }).firestore()
const alice = ctx('alice', 'Alice@Example.cl'), bob = ctx('bob', 'bob@example.cl')
const anon = env.unauthenticatedContext().firestore()

for (const [db, uid, code] of [[alice, 'alice', 'SU-1234'], [bob, 'bob', 'BA-0042']]) {
  await setDoc(doc(db, 'users', uid), { displayName: uid, createdAt: serverTimestamp() })
  const b = writeBatch(db); b.set(doc(db, 'rocketIds', code), { uid, createdAt: serverTimestamp() }); b.set(doc(db, 'users', uid), { rocketId: code }, { merge: true }); await b.commit()
}
const pub = (uid, rid, extra = {}) => ({ uid, rocketId: rid, displayName: 'Alice', photoURL: null, skills: { hasCertifications: 'yes', categories: ['first_aid'], certifications: [] }, updatedAt: serverTimestamp(), ...extra })

await t('Alice publica su perfil', () => assertSucceeds(setDoc(doc(alice, 'publicProfiles/alice'), pub('alice', 'SU-1234'))))
await t('Perfil con rocketId falso rechazado', () => assertFails(setDoc(doc(alice, 'publicProfiles/alice'), pub('alice', 'BA-0042'))))
await t('Perfil con campo extra (teléfono) rechazado', () => assertFails(setDoc(doc(alice, 'publicProfiles/alice'), pub('alice', 'SU-1234', { phone: '+56 9' }))))
await t('Bob NO puede escribir el perfil de Alice', () => assertFails(setDoc(doc(bob, 'publicProfiles/alice'), pub('alice', 'SU-1234'))))
await t('Bob lee el perfil de Alice (get)', () => assertSucceeds(getDoc(doc(bob, 'publicProfiles/alice'))))
await t('Bob NO puede listar perfiles', () => assertFails(getDocs(collection(bob, 'publicProfiles'))))
await t('Sin sesión SÍ se lee un perfil (enlace público)', () => assertSucceeds(getDoc(doc(anon, 'publicProfiles/alice'))))
await t('Sin sesión NO se listan perfiles', () => assertFails(getDocs(collection(anon, 'publicProfiles'))))
await t('Sin sesión NO se lee la cordada', () => assertFails(getDocs(collection(anon, 'users/bob/contacts'))))
await t('Sin sesión NO se lee salud', () => assertFails(getDoc(doc(anon, 'users/alice/private/emergency'))))
await t('Sin sesión NO se lee el índice de correos listado', () => assertFails(getDocs(collection(anon, 'emailIndex'))))

await t('Alice indexa SU correo (hash sha256, mayúsculas normalizadas)', () => assertSucceeds(setDoc(doc(alice, 'emailIndex', h('alice@example.cl')), { uid: 'alice' })))
await t('Bob NO puede indexar el correo de Alice', () => assertFails(setDoc(doc(bob, 'emailIndex', h('alice@example.cl')), { uid: 'bob' })))
await t('Bob NO puede indexar su correo apuntando a Alice', () => assertFails(setDoc(doc(bob, 'emailIndex', h('bob@example.cl')), { uid: 'alice' })))
const unverified = env.authenticatedContext('eve', { email: 'eve@x.cl', email_verified: false }).firestore()
await t('Correo NO verificado no se indexa', () => assertFails(setDoc(doc(unverified, 'emailIndex', h('eve@x.cl')), { uid: 'eve' })))
await t('Bob encuentra a Alice por correo exacto', async () => { const s = await assertSucceeds(getDoc(doc(bob, 'emailIndex', h('ALICE@example.cl ')))); if (s.data()?.uid !== 'alice') throw new Error('uid') })
await t('Bob NO puede listar el índice de correos', () => assertFails(getDocs(collection(bob, 'emailIndex'))))
await t('Bob encuentra a Alice por rocketId', async () => { const s = await assertSucceeds(getDoc(doc(bob, 'rocketIds/SU-1234'))); if (s.data()?.uid !== 'alice') throw new Error('uid') })
await t('Bob NO puede listar rocketIds', () => assertFails(getDocs(collection(bob, 'rocketIds'))))

await t('Bob lee verificaciones de Alice (para insignias)', () => assertSucceeds(getDoc(doc(bob, 'users/alice/private/verifications'))))
await t('Bob NO lee datos de salud de Alice', () => assertFails(getDoc(doc(bob, 'users/alice/private/emergency'))))
await t('Bob NO lee el perfil privado de Alice', () => assertFails(getDoc(doc(bob, 'users/alice'))))
await t('Bob NO escribe verificaciones', () => assertFails(setDoc(doc(bob, 'users/bob/private/verifications'), { certs: {} })))

const contact = { uid: 'alice', rocketId: 'SU-1234', displayName: 'Alice', photoURL: null, addedAt: serverTimestamp() }
await t('Bob agrega a Alice a su cordada', () => assertSucceeds(setDoc(doc(bob, 'users/bob/contacts/alice'), contact)))
await t('Bob NO puede agregarse a sí mismo', () => assertFails(setDoc(doc(bob, 'users/bob/contacts/bob'), { ...contact, uid: 'bob' })))
await t('Bob NO agrega a alguien sin perfil público', () => assertFails(setDoc(doc(bob, 'users/bob/contacts/zoe'), { ...contact, uid: 'zoe' })))
await t('Alice NO ve la cordada de Bob', () => assertFails(getDocs(collection(alice, 'users/bob/contacts'))))
await t('Bob lista su cordada', () => assertSucceeds(getDocs(collection(bob, 'users/bob/contacts'))))
await t('Bob quita a Alice de su cordada', () => assertSucceeds(deleteDoc(doc(bob, 'users/bob/contacts/alice'))))

await t('Alice se oculta (discoverable=false)', () => assertSucceeds(setDoc(doc(alice, 'users/alice'), { discoverable: false }, { merge: true })))
await t('Alice borra su perfil público', () => assertSucceeds(deleteDoc(doc(alice, 'publicProfiles/alice'))))
await t('Alice borra su índice de correo', () => assertSucceeds(deleteDoc(doc(alice, 'emailIndex', h('alice@example.cl')))))
await t('Bob NO borra el índice de Alice', async () => { await setDoc(doc(alice, 'emailIndex', h('alice@example.cl')), { uid: 'alice' }); return assertFails(deleteDoc(doc(bob, 'emailIndex', h('alice@example.cl')))) })
await t('discoverable no booleano rechazado', () => assertFails(setDoc(doc(alice, 'users/alice'), { discoverable: 'si' }, { merge: true })))

await done()
