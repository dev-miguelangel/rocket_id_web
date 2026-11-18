import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { BottomSheet } from '../../components/Sheet'
import { SwipeRow } from '../../components/SwipeRow'
import { useAuth } from '../auth/AuthProvider'
import { timeAgo } from '../events/useMe'
import { deleteNotification, markAllRead, markRead, subscribeNotifications, type AppNotification, type NotificationType } from './notificationsApi'

const T: Record<NotificationType, { icon: string; text: (n: AppNotification) => string }> = {
  event_invite: { icon: '📩', text: (n) => `${n.actorName} te invitó a “${n.eventTitle}”` },
  event_updated: { icon: '✏️', text: (n) => `${n.actorName} actualizó “${n.eventTitle}”` },
  event_cancelled: { icon: '🚫', text: (n) => `${n.actorName} canceló “${n.eventTitle}”` },
  participant_confirmed: { icon: '✅', text: (n) => `${n.actorName} confirmó su asistencia a “${n.eventTitle}”` },
  participant_joined: { icon: '🙋', text: (n) => `${n.actorName} se unió a “${n.eventTitle}”` },
  participant_declined: { icon: '👋', text: (n) => `${n.actorName} no podrá ir a “${n.eventTitle}”` },
  sensitive_view: { icon: '👁️', text: (n) => `${n.actorName} vio tu ficha de emergencia en “${n.eventTitle}”` },
}

/** Notificaciones de la persona en sesión, en tiempo real */
export function useNotifications() {
  const { user } = useAuth()
  const [items, setItems] = useState<AppNotification[]>([])
  useEffect(() => {
    if (!user) return
    return subscribeNotifications(user.uid, setItems)
  }, [user])
  return { items, unread: items.filter((n) => !n.read).length }
}

/** Punto/contador rojo sobre el avatar o un ítem de menú */
export function UnreadBadge({ count, className = '' }: { count: number; className?: string }) {
  if (!count) return null
  return (
    <span
      aria-hidden="true"
      className={`flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] leading-none font-bold text-white ring-2 ring-surface ${className}`}
    >
      {count > 9 ? '9+' : count}
    </span>
  )
}

/** Hoja con la lista de notificaciones */
export function NotificationsSheet({ open, onClose, items }: { open: boolean; onClose: () => void; items: AppNotification[] }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const unread = items.filter((n) => !n.read).length

  const go = (n: AppNotification) => {
    if (!user) return
    if (!n.read) markRead(user.uid, n.id).catch(() => {})
    onClose()
    navigate(`/e/${n.eventId}`)
  }

  return (
    <BottomSheet
      open={open}
      title="Notificaciones"
      onClose={onClose}
      right={
        unread > 0 ? (
          <button
            type="button"
            onClick={() => user && markAllRead(user.uid, items)}
            className="h-11 rounded-lg px-3 text-sm font-medium text-primary-text active:opacity-60"
          >
            Marcar leídas
          </button>
        ) : undefined
      }
    >
      {items.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-4xl" aria-hidden="true">🔔</p>
          <p className="mt-3 font-semibold text-fg">Sin notificaciones</p>
          <p className="mt-1 text-sm text-muted">
            Aquí verás invitaciones a eventos, cambios, quién confirmó o no podrá ir, y cuándo un organizador ve tu ficha de emergencia.
          </p>
        </div>
      ) : (
        <ul className="-mx-4">
          {items.map((n) => (
            <li key={n.id}>
              <SwipeRow
                leading={!n.read ? [{ key: 'read', label: 'Leída', icon: '✓', tone: 'primary', onClick: () => user && markRead(user.uid, n.id) }] : []}
                trailing={[{ key: 'del', label: 'Borrar', icon: '🗑', tone: 'danger', onClick: () => user && deleteNotification(user.uid, n.id) }]}
              >
                <button type="button" onClick={() => go(n)} className={`flex w-full items-start gap-3 px-4 py-3 text-left active:bg-line/60 ${n.read ? '' : 'bg-primary/5'}`}>
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl" aria-hidden="true">
                    {T[n.type].icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm ${n.read ? 'text-fg-soft' : 'font-semibold text-fg'}`}>{T[n.type].text(n)}</span>
                    {n.detail && <span className="block text-sm text-muted">{n.detail}</span>}
                    <span className="text-xs text-muted">{timeAgo(n.createdAt)}</span>
                  </span>
                  {!n.read && <span className="mt-2 size-2.5 shrink-0 rounded-full bg-primary" aria-label="Sin leer" />}
                </button>
              </SwipeRow>
            </li>
          ))}
        </ul>
      )}
    </BottomSheet>
  )
}
