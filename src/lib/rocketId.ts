import { doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { db } from './firebase'

/**
 * rocketId: identificador público de cada persona. Formato "SU-1234":
 * consonante (sin Ñ) + vocal + guion + 4 dígitos, siempre en mayúscula.
 * 21 × 5 × 10.000 = 1.050.000 combinaciones.
 */
export const CONSONANTS = 'BCDFGHJKLMNPQRSTVWXYZ'
export const VOWELS = 'AEIOU'
export const ROCKET_ID_PATTERN = /^[BCDFGHJKLMNPQRSTVWXYZ][AEIOU]-[0-9]{4}$/

/** Entero aleatorio criptográficamente seguro en [0, max), sin sesgo (rejection sampling). */
function randomInt(max: number) {
  const limit = Math.floor(0x1_0000_0000 / max) * max
  const buf = new Uint32Array(1)
  do crypto.getRandomValues(buf)
  while (buf[0] >= limit)
  return buf[0] % max
}

export function generateRocketId() {
  const c = CONSONANTS[randomInt(CONSONANTS.length)]
  const v = VOWELS[randomInt(VOWELS.length)]
  const n = String(randomInt(10_000)).padStart(4, '0')
  return `${c}${v}-${n}`
}

export const isValidRocketId = (v: unknown): v is string => typeof v === 'string' && ROCKET_ID_PATTERN.test(v)

const MAX_ATTEMPTS = 8

/**
 * Asigna un rocketId único si la persona aún no tiene uno.
 * Reserva el código en rocketIds/{código} y lo escribe en users/{uid} en una sola operación atómica;
 * las reglas rechazan el lote si el código ya existe (colisión) y se reintenta con otro.
 */
export async function ensureRocketId(uid: string): Promise<string | null> {
  const userRef = doc(db, 'users', uid)
  const snap = await getDoc(userRef)
  const current = snap.data()?.rocketId
  if (isValidRocketId(current)) return current
  if (!navigator.onLine) return null // se intentará en el próximo inicio con conexión

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = generateRocketId()
    const batch = writeBatch(db)
    batch.set(doc(db, 'rocketIds', code), { uid, createdAt: serverTimestamp() })
    batch.set(userRef, { rocketId: code }, { merge: true })
    try {
      await batch.commit()
      return code
    } catch (e) {
      if ((e as { code?: string }).code !== 'permission-denied') throw e
      // Colisión, o se asignó en otra pestaña al mismo tiempo: revisamos antes de reintentar
      const again = (await getDoc(userRef)).data()?.rocketId
      if (isValidRocketId(again)) return again
    }
  }
  return null
}
