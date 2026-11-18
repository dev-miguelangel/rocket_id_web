// Utilidades compartidas por los scripts de datos de prueba (mock).
// Usan Firebase Admin SDK: requieren una clave de cuenta de servicio (ver scripts/mock/README.md)
// o el emulador (FIRESTORE_EMULATOR_HOST).
import { createHash, randomInt } from 'node:crypto'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { applicationDefault, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

export const PROJECT_ID = 'rocketid-c55d5'

/** Identificador de esta tanda de datos mock. Todo lo creado lo lleva en `_mock.seed`. */
export const SEED_ID = 'mock-users-v1'

/** Prefijo de los uid mock: nunca coincide con un uid real de Firebase Auth */
export const MOCK_UID_PREFIX = 'mock_'

/** Dominio reservado (RFC 2606): ningún correo real termina así */
export const MOCK_EMAIL_DOMAIN = 'rocketid.test'

/** Documento que registra cada ruta creada, para purgar sin buscar */
export const REGISTRY_PATH = '_mock/registry'

/** Colecciones donde puede haber documentos mock (respaldo si se pierde el registro) */
export const MOCK_COLLECTIONS = ['rocketIds', 'publicProfiles', 'emailIndex', 'users']

const DEFAULT_KEY = join(homedir(), '.config', 'rocketid', 'service-account.json')

export const isEmulator = () => !!process.env.FIRESTORE_EMULATOR_HOST

export function initAdmin() {
  if (!isEmulator() && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    if (existsSync(DEFAULT_KEY)) process.env.GOOGLE_APPLICATION_CREDENTIALS = DEFAULT_KEY
    else {
      console.error(
        `\n✗ Falta la clave de cuenta de servicio.\n  Guárdala en ${DEFAULT_KEY}\n  o define GOOGLE_APPLICATION_CREDENTIALS. Ver scripts/mock/README.md\n`,
      )
      process.exit(1)
    }
  }
  initializeApp(isEmulator() ? { projectId: PROJECT_ID } : { projectId: PROJECT_ID, credential: applicationDefault() })
  return getFirestore()
}

/** En producción exige `--yes` para evitar ejecuciones accidentales */
export function requireConfirmation(action) {
  const target = isEmulator() ? `emulador (${process.env.FIRESTORE_EMULATOR_HOST})` : `PRODUCCIÓN (${PROJECT_ID})`
  console.log(`→ ${action} en ${target}`)
  if (!isEmulator() && !process.argv.includes('--yes')) {
    console.error('  Agrega --yes para confirmar. Ej: npm run mock:seed -- --yes\n')
    process.exit(1)
  }
}

export const sha256Hex = (text) => createHash('sha256').update(text.trim().toLowerCase()).digest('hex')

const CONSONANTS = 'BCDFGHJKLMNPQRSTVWXYZ'
const VOWELS = 'AEIOU'
/** Mismo formato que src/lib/rocketId.ts */
export const generateRocketId = () =>
  `${CONSONANTS[randomInt(CONSONANTS.length)]}${VOWELS[randomInt(VOWELS.length)]}-${String(randomInt(10_000)).padStart(4, '0')}`

export const mockMeta = () => ({ isMock: true, seed: SEED_ID, createdAt: new Date().toISOString() })

// Réplica de src/lib/searchTokens.ts (mantener sincronizado)
const normalizeText = (s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
const splitWords = (s) => normalizeText(s).split(/[^a-z0-9]+/).filter(Boolean)
const joinedWords = (s) =>
  normalizeText(s)
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]/g, ''))
    .filter(Boolean)
const wordForms = (s) => [...new Set([...splitWords(s), ...joinedWords(s)])]
const prefixes = (w) => {
  const out = []
  for (let i = 3; i <= Math.min(w.length, 20); i++) out.push(w.slice(0, i))
  return out
}
export function buildSearchTokens(displayName, rocketId) {
  const set = new Set()
  for (const w of wordForms(displayName)) if (w.length >= 3) prefixes(w).forEach((p) => set.add(p))
  prefixes(rocketId.toLowerCase().replace(/[^a-z0-9]/g, '')).forEach((p) => set.add(p))
  return [...set].slice(0, 100)
}
