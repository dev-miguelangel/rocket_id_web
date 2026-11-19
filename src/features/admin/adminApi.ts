import {
  collection,
  collectionGroup,
  doc,
  documentId,
  getCountFromServer,
  getDoc,
  getDocs,
  query,
  Timestamp,
  where,
  type Query,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'

/** Fecha YYYY-MM-DD en hora de Chile (la misma clave que usa el contador de visitas) */
export const chileDay = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(d)

export interface Metrics {
  users: number | null
  mockUsers: number | null
  new7: number | null
  new30: number | null
  active7: number | null
  onboarded: number | null
  visits: number | null
  daily: { day: string; visits: number }[] | null
  events: number | null
  publicEvents: number | null
  upcomingEvents: number | null
  participants: number | null
  cordada: number | null
  applications: number | null
  at: Date
}

const DAY = 86_400_000
const since = (days: number) => Timestamp.fromMillis(Date.now() - days * DAY)
// Cada conteo es independiente: si uno falla, el resto del panel se muestra igual
const count = (q: Query) =>
  getCountFromServer(q)
    .then((s) => s.data().count)
    .catch((e) => {
      console.warn('admin count', e)
      return null
    })

export const DAILY_RANGE = 14

export async function loadMetrics(): Promise<Metrics> {
  const users = collection(db, 'users')
  const events = collection(db, 'events')
  const days: string[] = []
  for (let i = DAILY_RANGE - 1; i >= 0; i--) days.push(chileDay(new Date(Date.now() - i * DAY)))

  const [usersN, mockUsers, new7, new30, active7, onboarded, landing, daily, eventsN, publicEvents, upcomingEvents, participants, cordada, applications] =
    await Promise.all([
      count(users),
      count(query(users, where(documentId(), '>=', 'mock_'), where(documentId(), '<', 'mock`'))),
      count(query(users, where('createdAt', '>=', since(7)))),
      count(query(users, where('createdAt', '>=', since(30)))),
      count(query(users, where('lastLoginAt', '>=', since(7)))),
      count(query(users, where('onboardedAt', '>', Timestamp.fromMillis(0)))),
      getDoc(doc(db, 'stats', 'landing')).catch(() => null),
      getDocs(query(collection(db, 'stats', 'landing', 'days'), where(documentId(), '>=', days[0])))
        .then((s) => {
          const byDay = new Map(s.docs.map((d) => [d.id, Number(d.data().visits) || 0]))
          return days.map((day) => ({ day, visits: byDay.get(day) ?? 0 }))
        })
        .catch((e) => {
          console.warn('admin daily', e)
          return null
        }),
      count(events),
      count(query(events, where('visibility', '==', 'public'))),
      count(query(events, where('startAt', '>=', Timestamp.now()))),
      count(collectionGroup(db, 'participants')),
      count(collectionGroup(db, 'contacts')),
      count(collection(db, 'applications')),
    ])

  const v = landing?.data()?.visits
  return {
    users: usersN,
    mockUsers,
    new7,
    new30,
    active7,
    onboarded,
    visits: typeof v === 'number' ? v : null,
    daily,
    events: eventsN,
    publicEvents,
    upcomingEvents,
    participants,
    cordada,
    applications,
    at: new Date(),
  }
}
