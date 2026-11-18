import type { User } from 'firebase/auth'
import { collection, doc, getDoc, getDocs, limit, query, serverTimestamp, setDoc, where } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { toTitleCaseName } from '../../lib/names'
import { ROCKET_ID_PATTERN, isValidRocketId } from '../../lib/rocketId'
import { buildSearchTokens, matchesAll, parseQuery } from '../../lib/searchTokens'
import { parseSkills, parseVerifications, type SkillsData, type Verifications } from '../skills/schema'

/**
 * Perfil público: lo único que otras personas pueden ver al buscarte.
 * Nunca incluye documento, teléfono, fecha de nacimiento, correo ni datos de salud.
 */
export interface PublicProfile {
  uid: string
  rocketId: string
  displayName: string
  photoURL: string | null
  skills: SkillsData
  /** Usuario ficticio creado por scripts/mock (se purga con npm run mock:purge) */
  isMock: boolean
}

const publicRef = (uid: string) => doc(db, 'publicProfiles', uid)
const emailRef = (hash: string) => doc(db, 'emailIndex', hash)

export async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const emailKey = (email: string) => sha256Hex(email.trim().toLowerCase())

/**
 * Publica el perfil público. Con "solo búsquedas exactas" activado (exactOnly) el perfil sigue
 * existiendo para quien tenga tu correo, rocketId o enlace, pero no aparece en la búsqueda aproximada.
 */
export async function syncPublicProfile(user: User) {
  const u = (await getDoc(doc(db, 'users', user.uid))).data() ?? {}
  const rocketId = u.rocketId
  if (!isValidRocketId(rocketId)) return
  const email = user.email
  const searchable = u.exactOnly !== true
  const displayName = toTitleCaseName(String(u.fullName || u.displayName || '')).slice(0, 120)

  const skills = parseSkills((await getDoc(doc(db, 'users', user.uid, 'private', 'skills'))).data())
  const pub = skills.hasCertifications === 'yes' ? skills : { ...skills, categories: [], certifications: [] }
  await setDoc(publicRef(user.uid), {
    uid: user.uid,
    rocketId,
    displayName,
    photoURL: typeof u.photoURL === 'string' ? u.photoURL.slice(0, 500) : null,
    skills: {
      hasCertifications: pub.hasCertifications,
      categories: pub.categories,
      certifications: pub.certifications.map(({ id, category, name, issuer, year, expiresAt, status }) => ({
        id,
        category,
        name,
        issuer,
        year,
        expiresAt,
        status,
      })),
    },
    searchable,
    searchTokens: searchable ? buildSearchTokens(displayName, rocketId) : [],
    updatedAt: serverTimestamp(),
  })
  // Índice por correo (hash): solo permite encontrarte si alguien escribe tu correo exacto
  if (email) await setDoc(emailRef(await emailKey(email)), { uid: user.uid }).catch((e) => console.warn('emailIndex', e))
}

export async function setExactOnly(user: User, exactOnly: boolean) {
  await setDoc(doc(db, 'users', user.uid), { exactOnly }, { merge: true })
  await syncPublicProfile(user)
}

// ---------- Búsqueda ----------

/** "su1234", "SU 1234", "su-1234" → "SU-1234" (o null si no tiene forma de rocketId) */
export function normalizeRocketIdInput(q: string) {
  const m = q.trim().toUpperCase().replace(/\s+/g, '').match(/^([A-Z])([A-Z])-?(\d{4})$/)
  if (!m) return null
  const code = `${m[1]}${m[2]}-${m[3]}`
  return ROCKET_ID_PATTERN.test(code) ? code : null
}

export const looksLikeEmail = (q: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q.trim())

export type SearchError = 'format'

export interface SearchResult {
  profile: PublicProfile
  verifications: Verifications
}

function parsePublic(uid: string, raw: Record<string, unknown>): PublicProfile {
  return {
    uid,
    rocketId: String(raw.rocketId ?? ''),
    displayName: String(raw.displayName ?? ''),
    photoURL: typeof raw.photoURL === 'string' ? raw.photoURL : null,
    skills: parseSkills(raw.skills as Record<string, unknown> | undefined),
    isMock: !!(raw._mock as { isMock?: boolean } | undefined)?.isMock,
  }
}

export async function getPublicProfile(uid: string): Promise<SearchResult | null> {
  const snap = await getDoc(publicRef(uid))
  if (!snap.exists()) return null
  const v = await getDoc(doc(db, 'users', uid, 'private', 'verifications')).catch(() => null)
  return { profile: parsePublic(uid, snap.data()), verifications: parseVerifications(v?.data()) }
}

/** Busca por correo exacto o por rocketId. Lanza 'format' si el texto no es ninguno de los dos. */
export async function findPerson(query: string): Promise<SearchResult | null> {
  let uid: unknown
  if (looksLikeEmail(query)) {
    uid = (await getDoc(emailRef(await emailKey(query)))).data()?.uid
  } else {
    const code = normalizeRocketIdInput(query)
    if (!code) throw 'format' satisfies SearchError
    uid = (await getDoc(doc(db, 'rocketIds', code))).data()?.uid
  }
  return typeof uid === 'string' ? getPublicProfile(uid) : null
}

/** Búsqueda aproximada por nombre o rocketId (≥ 3 caracteres). Solo perfiles con búsqueda aproximada activa. */
export async function searchApprox(text: string, max = 10): Promise<PublicProfile[]> {
  const q = parseQuery(text)
  if (!q) return []
  const snap = await getDocs(
    query(collection(db, 'publicProfiles'), where('searchable', '==', true), where('searchTokens', 'array-contains', q.term), limit(max)),
  )
  return snap.docs
    .map((d) => parsePublic(d.id, d.data()))
    .filter((p) => matchesAll(q.terms, p.displayName, p.rocketId))
}
