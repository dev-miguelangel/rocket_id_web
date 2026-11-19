import {
  arrayUnion,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore'
import { MOCK_USERS } from '../../../scripts/mock/users.mjs'
import { db } from '../../lib/firebase'
import { generateRocketId } from '../../lib/rocketId'
import { buildSearchTokens } from '../../lib/searchTokens'

/**
 * Datos de prueba desde el panel admin. Mismo formato que scripts/mock (seed/purge), así ambos caminos
 * son compatibles: uid `mock_*`, correos @rocketid.test, marca `_mock` y registro en `_mock/registry`.
 * Las reglas de Firestore solo permiten a la cuenta admin crear o borrar documentos de prueba.
 */
const SEED_ID = 'mock-users-v1'
const PREFIX = 'mock_'
const DOMAIN = 'rocketid.test'
const registryRef = doc(db, '_mock', 'registry')
const configRef = doc(db, 'config', 'app')

const sha256Hex = async (text: string) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text.trim().toLowerCase()))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const mockUsersQuery = () => query(collection(db, 'users'), where(documentId(), '>=', PREFIX), where(documentId(), '<', 'mock`'))

export interface MockStatus {
  users: number
  total: number
  demoCourses: boolean
}

export async function mockStatus(): Promise<MockStatus> {
  const [users, config] = await Promise.all([getDocs(mockUsersQuery()), getDoc(configRef)])
  return { users: users.size, total: MOCK_USERS.length, demoCourses: config.data()?.demoCourses !== false }
}

/** Crea los usuarios de prueba que falten. Devuelve cuántos creó. */
export async function seedMockUsers(): Promise<number> {
  const existing = new Set((await getDocs(mockUsersQuery())).docs.map((d) => d.id))
  const created: { uid: string; email: string; rocketId: string; displayName: string }[] = []
  const paths: string[] = []

  for (const u of MOCK_USERS) {
    const uid = `${PREFIX}${u.slug}`
    if (existing.has(uid)) continue
    const email = `${u.email}@${DOMAIN}`
    const _mock = { isMock: true, seed: SEED_ID, createdAt: new Date().toISOString() }
    const hasCertifications = u.hasCertifications ?? (u.certs.length ? 'yes' : '')
    const certifications = u.certs.map(({ verifiedBy: _v, ...c }) => c)
    const categories = [...new Set(certifications.map((c) => c.category))]
    const verified = u.certs.filter((c) => c.verifiedBy)
    const emailHash = await sha256Hex(email)

    // Reintenta con otro rocketId si el generado ya está tomado (la regla de create lo rechaza)
    for (let attempt = 0; ; attempt++) {
      const rocketId = generateRocketId()
      if ((await getDoc(doc(db, 'rocketIds', rocketId))).exists()) {
        if (attempt < 8) continue
        throw new Error('No se encontró un rocketId libre')
      }
      const p = [`rocketIds/${rocketId}`, `users/${uid}`, `publicProfiles/${uid}`, `emailIndex/${emailHash}`]
      const batch = writeBatch(db)
      batch.set(doc(db, p[0]), { uid, createdAt: serverTimestamp(), _mock })
      batch.set(doc(db, p[1]), { displayName: u.displayName, fullName: u.displayName, email, photoURL: null, rocketId, discoverable: true, createdAt: serverTimestamp(), _mock })
      batch.set(doc(db, p[2]), {
        uid,
        rocketId,
        displayName: u.displayName,
        photoURL: null,
        skills: { hasCertifications, categories, certifications },
        searchable: true,
        searchTokens: buildSearchTokens(u.displayName, rocketId),
        updatedAt: serverTimestamp(),
        _mock,
      })
      batch.set(doc(db, p[3]), { uid, _mock })
      if (verified.length) {
        p.push(`users/${uid}/private/verifications`)
        batch.set(doc(db, p[4]), {
          certs: Object.fromEntries(
            verified.map((c) => [
              c.id,
              { verifiedBy: c.verifiedBy, verifiedAt: Timestamp.fromDate(new Date('2026-10-15T12:00:00Z')), snapshot: { name: c.name, issuer: c.issuer, year: c.year, expiresAt: c.expiresAt } },
            ]),
          ),
          _mock,
        })
      }
      await batch.commit()
      created.push({ uid, email, rocketId, displayName: u.displayName })
      paths.push(...p)
      break
    }
  }

  if (created.length) {
    await setDoc(
      registryRef,
      {
        seed: SEED_ID,
        note: 'Datos FICTICIOS para pruebas. Purgar desde /admin o con: npm run mock:purge -- --yes',
        updatedAt: serverTimestamp(),
        users: arrayUnion(...created),
        paths: arrayUnion(...paths),
      },
      { merge: true },
    )
  }
  return created.length
}

/** Elimina todos los usuarios de prueba y sus referencias. Devuelve cuántos documentos borró. */
export async function purgeMockUsers(): Promise<number> {
  const [users, registry, contacts] = await Promise.all([getDocs(mockUsersQuery()), getDoc(registryRef), getDocs(collectionGroup(db, 'contacts'))])
  const toDelete = new Set<string>(((registry.data()?.paths as string[] | undefined) ?? []).filter((p) => /mock_|^rocketIds\/|^emailIndex\//.test(p)))
  for (const d of users.docs) {
    const v = d.data()
    toDelete.add(`users/${d.id}`)
    toDelete.add(`publicProfiles/${d.id}`)
    toDelete.add(`users/${d.id}/private/verifications`)
    if (typeof v.rocketId === 'string') toDelete.add(`rocketIds/${v.rocketId}`)
    if (typeof v.email === 'string') toDelete.add(`emailIndex/${await sha256Hex(v.email)}`)
  }
  // Usuarios de prueba agregados a cordadas de personas reales
  contacts.docs.filter((d) => d.id.startsWith(PREFIX)).forEach((d) => toDelete.add(d.ref.path))

  const all = [...toDelete]
  for (let i = 0; i < all.length; i += 400) {
    const batch = writeBatch(db)
    all.slice(i, i + 400).forEach((p) => batch.delete(doc(db, p)))
    await batch.commit()
  }
  await deleteDoc(registryRef)
  return all.length
}

/** Muestra u oculta los cursos de demostración en toda la app */
export const setDemoCourses = (on: boolean) => setDoc(configRef, { demoCourses: on, updatedAt: serverTimestamp() })
