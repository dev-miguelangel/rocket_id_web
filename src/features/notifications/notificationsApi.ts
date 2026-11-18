import { collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'

export type NotificationType = 'event_invite' | 'sensitive_view'

export interface AppNotification {
  id: string
  type: NotificationType
  eventId: string
  eventTitle: string
  actorName: string
  read: boolean
  createdAt: Date | null
}

const col = (uid: string) => collection(db, 'users', uid, 'notifications')

export function subscribeNotifications(uid: string, cb: (n: AppNotification[]) => void) {
  return onSnapshot(
    query(col(uid), orderBy('createdAt', 'desc'), limit(50)),
    (s) =>
      cb(
        s.docs.map((d) => {
          const v = d.data()
          return {
            id: d.id,
            type: v.type === 'sensitive_view' ? 'sensitive_view' : 'event_invite',
            eventId: String(v.eventId ?? ''),
            eventTitle: String(v.eventTitle ?? ''),
            actorName: String(v.actorName ?? ''),
            read: v.read === true,
            createdAt: typeof v.createdAt?.toDate === 'function' ? v.createdAt.toDate() : null,
          }
        }),
      ),
    () => cb([]),
  )
}

export const markRead = (uid: string, id: string) => updateDoc(doc(col(uid), id), { read: true })
export const deleteNotification = (uid: string, id: string) => deleteDoc(doc(col(uid), id))
