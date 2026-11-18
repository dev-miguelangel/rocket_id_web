import { collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, updateDoc, writeBatch } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import type { NotificationType } from '../events/eventsApi'

export type { NotificationType }

export interface AppNotification {
  id: string
  type: NotificationType
  eventId: string
  eventTitle: string
  actorName: string
  detail: string
  read: boolean
  createdAt: Date | null
}

const TYPES: NotificationType[] = [
  'event_invite',
  'sensitive_view',
  'event_updated',
  'event_cancelled',
  'participant_confirmed',
  'participant_joined',
  'participant_declined',
  'sensitive_saved',
]

const col = (uid: string) => collection(db, 'users', uid, 'notifications')

export function subscribeNotifications(uid: string, cb: (n: AppNotification[]) => void) {
  return onSnapshot(
    query(col(uid), orderBy('createdAt', 'desc'), limit(50)),
    (s) =>
      cb(
        s.docs
          .map((d) => {
            const v = d.data()
            return {
              id: d.id,
              type: v.type as NotificationType,
              eventId: String(v.eventId ?? ''),
              eventTitle: String(v.eventTitle ?? ''),
              actorName: String(v.actorName ?? ''),
              detail: String(v.detail ?? ''),
              read: v.read === true,
              createdAt: typeof v.createdAt?.toDate === 'function' ? v.createdAt.toDate() : null,
            }
          })
          .filter((n) => TYPES.includes(n.type)),
      ),
    () => cb([]),
  )
}

export const markRead = (uid: string, id: string) => updateDoc(doc(col(uid), id), { read: true })
export const deleteNotification = (uid: string, id: string) => deleteDoc(doc(col(uid), id))

export async function markAllRead(uid: string, items: AppNotification[]) {
  const unread = items.filter((n) => !n.read)
  for (let i = 0; i < unread.length; i += 400) {
    const batch = writeBatch(db)
    unread.slice(i, i + 400).forEach((n) => batch.update(doc(col(uid), n.id), { read: true }))
    await batch.commit()
  }
}
