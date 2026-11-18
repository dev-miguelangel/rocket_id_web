// Búsqueda aproximada: listado limitado y perfiles "solo exactas"
// Ejecutar con: npm run test:rules
import { setup } from './helpers.mjs'
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, setDoc, getDocs, collection, query, where, limit, writeBatch, serverTimestamp } from 'firebase/firestore'
const { env, t, done } = await setup()
const mk = async (uid, code) => {
  const db = env.authenticatedContext(uid, { email: `${uid}@x.cl`, email_verified: true }).firestore()
  await setDoc(doc(db, 'users', uid), { displayName: uid })
  const b = writeBatch(db); b.set(doc(db, 'rocketIds', code), { uid, createdAt: serverTimestamp() }); b.set(doc(db, 'users', uid), { rocketId: code }, { merge: true }); await b.commit()
  return db
}
const alice = await mk('alice', 'SU-1234'), bob = await mk('bob', 'BA-0042')
const pub = (uid, rid, name, searchable, tokens) => ({ uid, rocketId: rid, displayName: name, photoURL: null, skills: { hasCertifications: '', categories: [], certifications: [] }, searchable, searchTokens: tokens, updatedAt: serverTimestamp() })

await t('Alice publica perfil buscable con tokens', () => assertSucceeds(setDoc(doc(alice, 'publicProfiles/alice'), pub('alice', 'SU-1234', 'Alicia Pérez', true, ['ali', 'alic', 'alici', 'alicia', 'per', 'pere', 'perez', 'su1', 'su12', 'su123', 'su1234']))))
await t('Bob publica perfil "solo exactas" (sin tokens)', () => assertSucceeds(setDoc(doc(bob, 'publicProfiles/bob'), pub('bob', 'BA-0042', 'Alberto Bob', false, []))))
await t('"Solo exactas" con tokens rechazado', () => assertFails(setDoc(doc(bob, 'publicProfiles/bob'), pub('bob', 'BA-0042', 'Alberto Bob', false, ['alb']))))
await t('Más de 100 tokens rechazado', () => assertFails(setDoc(doc(alice, 'publicProfiles/alice'), pub('alice', 'SU-1234', 'Alicia', true, Array.from({ length: 101 }, (_, i) => 't' + i)))))
await t('exactOnly no booleano rechazado', () => assertFails(setDoc(doc(alice, 'users/alice'), { exactOnly: 'si' }, { merge: true })))
await t('exactOnly booleano permitido', () => assertSucceeds(setDoc(doc(bob, 'users/bob'), { exactOnly: true }, { merge: true })))

const q = (db, term, lim = 10, withSearchable = true) =>
  getDocs(query(collection(db, 'publicProfiles'), ...(withSearchable ? [where('searchable', '==', true)] : []), where('searchTokens', 'array-contains', term), limit(lim)))
await t('Bob encuentra a Alicia escribiendo "ali"', async () => { const s = await assertSucceeds(q(bob, 'ali')); if (s.docs.map((d) => d.id).join() !== 'alice') throw new Error(s.docs.map((d) => d.id).join()) })
await t('Bob encuentra a Alicia por "su12"', async () => { const s = await assertSucceeds(q(bob, 'su12')); if (s.size !== 1) throw new Error('size ' + s.size) })
await t('Perfil "solo exactas" nunca aparece', async () => { const s = await assertSucceeds(q(alice, 'alb')); if (s.size !== 0) throw new Error('aparece') })
await t('Listar sin filtro searchable rechazado', () => assertFails(q(bob, 'ali', 10, false)))
await t('Listar con límite > 10 rechazado', () => assertFails(q(bob, 'ali', 50)))
await t('Listar todo sin filtros rechazado', () => assertFails(getDocs(collection(bob, 'publicProfiles'))))
await t('Sin sesión no se lista', () => assertFails(q(env.unauthenticatedContext().firestore(), 'ali')))
await done()
