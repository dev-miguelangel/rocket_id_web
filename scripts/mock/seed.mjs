// Crea usuarios FICTICIOS buscables en Cordada.
//   npm run mock:seed              → emulador (si FIRESTORE_EMULATOR_HOST está definido)
//   npm run mock:seed -- --yes     → producción
// Todo lo creado queda registrado en _mock/registry y marcado con `_mock`, para purgarlo con `npm run mock:purge`.
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import {
  MOCK_EMAIL_DOMAIN,
  MOCK_UID_PREFIX,
  REGISTRY_PATH,
  SEED_ID,
  generateRocketId,
  initAdmin,
  mockMeta,
  requireConfirmation,
  sha256Hex,
} from './lib.mjs'
import { MOCK_USERS } from './users.mjs'

const db = initAdmin()
requireConfirmation(`Crear ${MOCK_USERS.length} usuarios mock (${SEED_ID})`)

const registryRef = db.doc(REGISTRY_PATH)
const registry = (await registryRef.get()).data()
const already = new Set((registry?.users ?? []).map((u) => u.uid))

const created = []
for (const u of MOCK_USERS) {
  const uid = `${MOCK_UID_PREFIX}${u.slug}`
  if (already.has(uid)) {
    console.log(`  · ${u.displayName} ya existe, se omite`)
    continue
  }
  const email = `${u.email}@${MOCK_EMAIL_DOMAIN}`
  const _mock = mockMeta()
  const hasCertifications = u.hasCertifications ?? (u.certs.length ? 'yes' : '')
  const certifications = u.certs.map(({ verifiedBy: _v, ...c }) => c)
  const categories = [...new Set(certifications.map((c) => c.category))]
  const verified = u.certs.filter((c) => c.verifiedBy)

  // Reintenta si el rocketId generado ya existe (create() falla si el documento existe)
  for (let attempt = 0; ; attempt++) {
    const rocketId = generateRocketId()
    const paths = [
      `rocketIds/${rocketId}`,
      `users/${uid}`,
      `publicProfiles/${uid}`,
      `emailIndex/${sha256Hex(email)}`,
      ...(verified.length ? [`users/${uid}/private/verifications`] : []),
    ]
    const batch = db.batch()
    batch.create(db.doc(paths[0]), { uid, createdAt: FieldValue.serverTimestamp(), _mock })
    batch.create(db.doc(paths[1]), {
      displayName: u.displayName,
      fullName: u.displayName,
      email,
      photoURL: null,
      rocketId,
      discoverable: true,
      createdAt: FieldValue.serverTimestamp(),
      _mock,
    })
    batch.create(db.doc(paths[2]), {
      uid,
      rocketId,
      displayName: u.displayName,
      photoURL: null,
      skills: { hasCertifications, categories, certifications },
      updatedAt: FieldValue.serverTimestamp(),
      _mock,
    })
    batch.create(db.doc(paths[3]), { uid, _mock })
    if (verified.length) {
      batch.create(db.doc(paths[4]), {
        certs: Object.fromEntries(
          verified.map((c) => [
            c.id,
            {
              verifiedBy: c.verifiedBy,
              verifiedAt: Timestamp.fromDate(new Date('2026-10-15T12:00:00Z')),
              snapshot: { name: c.name, issuer: c.issuer, year: c.year, expiresAt: c.expiresAt },
            },
          ]),
        ),
        _mock,
      })
    }
    try {
      await batch.commit()
      created.push({ uid, email, rocketId, displayName: u.displayName, paths })
      console.log(`  ✓ ${u.displayName.padEnd(26)} ${rocketId}  ${email}`)
      break
    } catch (e) {
      if (e.code === 6 /* ALREADY_EXISTS */ && attempt < 8) continue
      throw e
    }
  }
}

if (created.length) {
  await registryRef.set(
    {
      seed: SEED_ID,
      note: 'Datos FICTICIOS para pruebas. Purgar con: npm run mock:purge -- --yes',
      updatedAt: FieldValue.serverTimestamp(),
      users: FieldValue.arrayUnion(...created.map(({ paths: _p, ...u }) => u)),
      paths: FieldValue.arrayUnion(...created.flatMap((c) => c.paths)),
    },
    { merge: true },
  )
}
console.log(`\n${created.length} creados. Registro: ${REGISTRY_PATH}\n`)
process.exit(0)
