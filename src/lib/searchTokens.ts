/**
 * Búsqueda aproximada sin backend: cada perfil guarda los prefijos normalizados de su nombre y rocketId
 * (≥ 3 caracteres) y se consulta con `array-contains`.
 * IMPORTANTE: scripts/mock/lib.mjs replica esta misma lógica para los usuarios de prueba.
 */

export const MIN_QUERY = 3
const MAX_PREFIX = 20
const MAX_TOKENS = 100

/** "Muñoz Díaz" → "munoz diaz" */
export const normalizeText = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()

const words = (s: string) => normalizeText(s).split(/[^a-z0-9]+/).filter(Boolean)

/** "MA-8426" → "ma8426" */
export const compactRocketId = (rid: string) => rid.toLowerCase().replace(/[^a-z0-9]/g, '')

const prefixes = (w: string) => {
  const out: string[] = []
  for (let i = MIN_QUERY; i <= Math.min(w.length, MAX_PREFIX); i++) out.push(w.slice(0, i))
  return out
}

export function buildSearchTokens(displayName: string, rocketId: string) {
  const set = new Set<string>()
  for (const w of words(displayName)) if (w.length >= MIN_QUERY) prefixes(w).forEach((p) => set.add(p))
  prefixes(compactRocketId(rocketId)).forEach((p) => set.add(p))
  return [...set].slice(0, MAX_TOKENS)
}

/**
 * Prepara lo que escribe la persona: devuelve el término para la consulta (la palabra más larga)
 * y todas las palabras, para filtrar en el cliente las demás.
 */
export function parseQuery(q: string): { term: string; terms: string[] } | null {
  const raw = q.trim()
  // "ma-84", "MA 842" → como rocketId compacto
  const rid = raw.match(/^([a-zA-Z]{2})[\s-]?(\d{1,4})$/)
  const terms = rid ? [compactRocketId(rid[1] + rid[2])] : words(raw).map((w) => w.slice(0, MAX_PREFIX))
  const valid = terms.filter((t) => t.length >= MIN_QUERY)
  if (!valid.length) return null
  const term = valid.reduce((a, b) => (b.length > a.length ? b : a))
  return { term, terms: terms.filter((t) => t.length > 0) }
}

/** ¿Coinciden todas las palabras escritas con el inicio de alguna palabra del nombre o del rocketId? */
export function matchesAll(terms: string[], displayName: string, rocketId: string) {
  const targets = [...words(displayName), compactRocketId(rocketId)]
  return terms.every((t) => targets.some((w) => w.startsWith(t)))
}
