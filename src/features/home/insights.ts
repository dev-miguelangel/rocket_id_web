/**
 * Estadísticas y recomendaciones del Inicio. Lógica pura (sin Firebase) para poder probarla.
 * Todo se calcula en el dispositivo con datos que la persona ya puede leer.
 */
import type { Course } from '../courses/schema'
import type { EventDoc, Participant } from '../events/schema'
import { CRITICAL_FIELDS, type ProfileForm } from '../profile/schema'
import { categoryOf, isPastExpiry, verificationFor, type CategoryId, type Certification, type SkillsData, type Verifications } from '../skills/schema'

const DAY = 86_400_000
/** Ventana para avisar que una certificación está por vencer */
export const EXPIRY_WARNING_DAYS = 120

/** Áreas críticas para la seguridad de un grupo en terreno */
const SAFETY_CATEGORIES: CategoryId[] = ['first_aid', 'rescue', 'navigation']

/** Qué áreas de formación se relacionan con cada actividad */
const ACTIVITY_CATEGORIES: Record<string, CategoryId[]> = {
  trekking: ['navigation', 'first_aid', 'ethics'],
  montanismo: ['technical', 'rescue', 'navigation'],
  escalada: ['technical', 'rescue'],
  kayak: ['technical', 'rescue'],
  ciclismo: ['first_aid', 'navigation'],
  nieve: ['rescue', 'technical'],
  buceo: ['technical', 'first_aid'],
  otro: ['first_aid'],
}

// ---------- Certificaciones ----------

/** Fin del mes de vencimiento ("2027-03" → 31 mar 2027) */
const expiryDate = (expiresAt: string) => {
  const [y, m] = expiresAt.split('-').map(Number)
  return new Date(y, m, 0, 23, 59)
}

export const isActiveCert = (c: Certification) => c.status === 'active' && !isPastExpiry(c.expiresAt)

export function expiringSoon(c: Certification, now = Date.now()) {
  if (!c.expiresAt || c.status !== 'active' || isPastExpiry(c.expiresAt)) return false
  return expiryDate(c.expiresAt).getTime() - now <= EXPIRY_WARNING_DAYS * DAY
}

export const isExpired = (c: Certification) => c.status === 'expired' || (c.status === 'active' && isPastExpiry(c.expiresAt))

const certsOf = (s: SkillsData | null | undefined) => (s?.hasCertifications === 'yes' ? s.certifications : [])

/** Áreas con al menos una certificación vigente */
export const activeCategories = (s: SkillsData | null | undefined) => new Set(certsOf(s).filter(isActiveCert).map((c) => c.category).filter(Boolean) as CategoryId[])

// ---------- Estadísticas ----------

export interface MyEventRow {
  event: EventDoc
  me: Participant
}

export interface Stats {
  profilePct: number
  missingFields: string[]
  certsActive: number
  certsVerified: number
  certsExpiring: Certification[]
  certsExpired: Certification[]
  eventsUpcoming: number
  eventsPendingInvites: MyEventRow[]
  eventsOrganizing: number
  eventsAttended: number
  cordadaSize: number
  cordadaFirstAid: number
  applications: number
}

export function computeStats(input: {
  profile: ProfileForm | null
  skills: SkillsData | null
  verifications: Verifications
  myEvents: MyEventRow[]
  cordada: { skills: SkillsData }[]
  cordadaSize: number
  applications: number
  now?: number
}): Stats {
  const now = input.now ?? Date.now()
  const missing = input.profile ? CRITICAL_FIELDS.filter(({ key }) => !input.profile![key].trim()) : CRITICAL_FIELDS
  const certs = certsOf(input.skills)
  const live = input.myEvents.filter((r) => r.event.status === 'published' && r.event.endAt.getTime() >= now)
  return {
    profilePct: Math.round(((CRITICAL_FIELDS.length - missing.length) / CRITICAL_FIELDS.length) * 100),
    missingFields: missing.map((m) => m.label),
    certsActive: certs.filter(isActiveCert).length,
    certsVerified: certs.filter((c) => verificationFor(c, input.verifications)).length,
    certsExpiring: certs.filter((c) => expiringSoon(c, now)),
    certsExpired: certs.filter(isExpired),
    eventsUpcoming: live.filter((r) => r.me.status === 'confirmed').length,
    eventsPendingInvites: live.filter((r) => r.me.status === 'invited'),
    eventsOrganizing: live.filter((r) => r.me.role === 'organizer').length,
    eventsAttended: input.myEvents.filter((r) => r.me.status === 'confirmed' && r.event.endAt.getTime() < now && r.event.status === 'published').length,
    cordadaSize: input.cordadaSize,
    cordadaFirstAid: input.cordada.filter((c) => activeCategories(c.skills).has('first_aid')).length,
    applications: input.applications,
  }
}

// ---------- Recomendaciones ----------

export interface Recommendation<T> {
  item: T
  score: number
  /** Motivo principal, visible para la persona */
  reason: string
}

const monthLabel = (expiresAt: string) =>
  expiryDate(expiresAt).toLocaleDateString('es', { month: 'short', year: 'numeric' }).replace('.', '')

interface RecoContext {
  skills: SkillsData | null
  myEvents: MyEventRow[]
  /** Perfiles públicos de la cordada */
  cordada: { uid: string; displayName: string; skills: SkillsData }[]
  appliedCourseIds: Set<string>
  now?: number
}

/** Cursos ordenados por utilidad para la persona y su cordada */
export function recommendCourses(courses: Course[], ctx: RecoContext, max = 3): Recommendation<Course>[] {
  const now = ctx.now ?? Date.now()
  const mine = certsOf(ctx.skills)
  const myActive = activeCategories(ctx.skills)
  const myAreas = new Set([...(ctx.skills?.categories ?? []), ...mine.map((c) => c.category)].filter(Boolean))
  const groupActive = new Set([...myActive, ...ctx.cordada.flatMap((c) => [...activeCategories(c.skills)])])
  const upcoming = ctx.myEvents.filter((r) => r.me.status !== 'declined' && r.event.status === 'published' && r.event.endAt.getTime() >= now)

  const out: Recommendation<Course>[] = []
  for (const course of courses) {
    if (ctx.appliedCourseIds.has(course.id)) continue
    if (new Date(`${course.startDate}T00:00:00`).getTime() < now - DAY) continue
    const cat = course.category
    const area = categoryOf(cat)?.short.toLowerCase() ?? 'esta área'
    const signals: { score: number; reason: string }[] = []

    // 1) Renovar: certificación del área vencida o por vencer
    const renew = mine.find((c) => c.category === cat && (isExpired(c) || expiringSoon(c, now)))
    if (renew) signals.push({ score: 5, reason: isExpired(renew) ? `Renueva tu “${renew.name}”, ya venció` : `Tu “${renew.name}” vence en ${monthLabel(renew.expiresAt)}` })

    // 2) Requisito de un evento al que vas y que no cumples
    const needed = upcoming.find((r) => r.event.requirements.some((q) => q.category === cat) && !myActive.has(cat))
    if (needed) signals.push({ score: 4, reason: `Requisito de “${needed.event.title}”` })

    // 3) Brecha de seguridad del grupo
    if (SAFETY_CATEGORIES.includes(cat) && ctx.cordada.length > 0 && !groupActive.has(cat))
      signals.push({ score: 3, reason: `Nadie en tu cordada tiene ${area} vigente` })

    // 4) Afinidad con lo que ya haces
    const myActivities = upcoming.concat(ctx.myEvents).map((r) => r.event.activity)
    if (myAreas.has(cat)) signals.push({ score: 1.5, reason: `Profundiza en ${area}` })
    else if (myActivities.some((a) => ACTIVITY_CATEGORIES[a]?.includes(cat))) signals.push({ score: 1.5, reason: `Útil para tus salidas` })

    // 5) Lo que se repite en la cordada
    const peers = ctx.cordada.filter((c) => activeCategories(c.skills).has(cat))
    if (peers.length >= 2 && !myActive.has(cat)) signals.push({ score: 1, reason: `${peers.length} de tu cordada ya tienen ${area}` })

    // 6) Primer paso
    if (mine.length === 0 && course.level === 'Inicial') signals.push({ score: 1, reason: 'Ideal para comenzar tu formación' })

    if (!signals.length) continue
    const top = signals.reduce((a, b) => (b.score > a.score ? b : a))
    const soon = new Date(`${course.startDate}T00:00:00`).getTime() - now < 60 * DAY ? 0.5 : 0
    out.push({ item: course, score: signals.reduce((s, x) => s + x.score, 0) + soon, reason: top.reason })
  }
  return out.sort((a, b) => b.score - a.score || a.item.startDate.localeCompare(b.item.startDate)).slice(0, max)
}

/** Eventos públicos ordenados por afinidad con la persona y su cordada */
export function recommendEvents(publicEvents: EventDoc[], ctx: RecoContext & { myUid: string }, max = 3): Recommendation<EventDoc>[] {
  const now = ctx.now ?? Date.now()
  const joined = new Set(ctx.myEvents.map((r) => r.event.id))
  const myActive = activeCategories(ctx.skills)
  const myAreas = new Set(certsOf(ctx.skills).map((c) => c.category))
  const activityCount = ctx.myEvents.reduce<Record<string, number>>((acc, r) => {
    if (r.me.status === 'confirmed') acc[r.event.activity] = (acc[r.event.activity] ?? 0) + 1
    return acc
  }, {})
  const cordadaByUid = new Map(ctx.cordada.map((c) => [c.uid, c]))

  const out: Recommendation<EventDoc>[] = []
  for (const e of publicEvents) {
    if (joined.has(e.id) || e.organizerUid === ctx.myUid || e.status !== 'published' || e.startAt.getTime() < now) continue
    const signals: { score: number; reason: string }[] = []

    const organizer = cordadaByUid.get(e.organizerUid)
    if (organizer) signals.push({ score: 5, reason: `Organiza ${organizer.displayName.split(' ')[0]}, de tu cordada` })

    const times = activityCount[e.activity] ?? 0
    if (times > 0) signals.push({ score: 2 + Math.min(times, 3) * 0.5, reason: `Ya fuiste a ${activityLabel(e.activity)}` })

    if (e.requirements.length) {
      const meets = e.requirements.every((r) => myActive.has(r.category))
      if (meets) signals.push({ score: 2, reason: 'Cumples los requisitos' })
      else signals.push({ score: -1.5, reason: '' })
    }

    if ((ACTIVITY_CATEGORIES[e.activity] ?? []).some((c) => myAreas.has(c))) signals.push({ score: 1, reason: 'Afín a tu formación' })

    const days = (e.startAt.getTime() - now) / DAY
    if (days <= 14) signals.push({ score: 1, reason: days <= 7 ? 'Es esta semana' : 'Es pronto' })

    const score = signals.reduce((s, x) => s + x.score, 0)
    const best = signals.filter((s) => s.reason).reduce<{ score: number; reason: string } | null>((a, b) => (!a || b.score > a.score ? b : a), null)
    if (score <= 0 || !best) continue
    out.push({ item: e, score, reason: best.reason })
  }
  return out.sort((a, b) => b.score - a.score || a.item.startAt.getTime() - b.item.startAt.getTime()).slice(0, max)
}

const ACTIVITY_LABELS: Record<string, string> = {
  trekking: 'trekking',
  montanismo: 'montañismo',
  escalada: 'escalada',
  kayak: 'kayak',
  ciclismo: 'ciclismo',
  nieve: 'nieve',
  buceo: 'buceo',
  otro: 'salidas',
}
const activityLabel = (a: string) => ACTIVITY_LABELS[a] ?? 'salidas'
