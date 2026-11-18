// Elimina TODOS los datos mock:
//  1. cada ruta listada en _mock/registry
//  2. cualquier documento con _mock.isMock == true en las colecciones conocidas (por si el registro falta)
//  3. verificaciones de usuarios mock (users/mock_*/private/verifications)
//  4. referencias a usuarios mock en cordadas de personas reales (users/*/contacts/mock_*)
//  5. el propio registro
//   npm run mock:purge -- --yes
import { MOCK_COLLECTIONS, MOCK_UID_PREFIX, REGISTRY_PATH, initAdmin, requireConfirmation } from './lib.mjs'

const db = initAdmin()
requireConfirmation('Purgar todos los datos mock')

const toDelete = new Set()
const registry = (await db.doc(REGISTRY_PATH).get()).data()
for (const p of registry?.paths ?? []) toDelete.add(p)

// Respaldo: buscar por marca en cada colección
const mockUids = new Set((registry?.users ?? []).map((u) => u.uid))
for (const col of MOCK_COLLECTIONS) {
  const snap = await db.collection(col).where('_mock.isMock', '==', true).get()
  snap.docs.forEach((d) => {
    toDelete.add(d.ref.path)
    if (col === 'users') mockUids.add(d.id)
  })
}
for (const uid of mockUids) toDelete.add(`users/${uid}/private/verifications`)

// Contactos de personas reales que apuntan a usuarios mock (el id del documento es el uid del contacto)
const contacts = await db.collectionGroup('contacts').get()
contacts.docs.filter((d) => d.id.startsWith(MOCK_UID_PREFIX)).forEach((d) => toDelete.add(d.ref.path))

const paths = [...toDelete]
for (let i = 0; i < paths.length; i += 400) {
  const batch = db.batch()
  paths.slice(i, i + 400).forEach((p) => batch.delete(db.doc(p)))
  await batch.commit()
}
await db.doc(REGISTRY_PATH).delete()

const group = (p) => (p.includes('/contacts/') ? 'users/*/contacts' : p.includes('/private/') ? 'users/*/private' : p.split('/')[0])
const counts = {}
for (const p of paths) counts[group(p)] = (counts[group(p)] ?? 0) + 1
console.log(`  ✓ ${paths.length} documentos eliminados`)
for (const [k, v] of Object.entries(counts)) console.log(`    ${k}: ${v}`)
console.log(`  ✓ registro ${REGISTRY_PATH} eliminado\n`)
process.exit(0)
