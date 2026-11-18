import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { BottomSheet } from '../../components/Sheet'
import { SwipeRow } from '../../components/SwipeRow'
import { useAuth } from '../auth/AuthProvider'
import { timeAgo } from '../events/useMe'
import { deleteNotification, markRead, subscribeNotifications, type AppNotification } from './notificationsApi'

const TEXT: Record<AppNotification['type'], { icon: string; text: (n: AppNotification) => string }> = {
  event_invite: { icon: '📩', text: (n) => `${n.actorName} te invitó a “${n.eventTitle}”` },
  sensitive_view: { icon: '👁️', text: (n) => `${n.actorName} vio tu ficha de emergencia en “${n.eventTitle}”` },
}

/** Campana de notificaciones en la barra superior */
export function NotificationsBell() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState<AppNotification[]>([])
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!user) return
    return subscribeNotifications(user.uid, setItems)
  }, [user])

  const unread = items.filter((n) => !n.read).length

  const go = (n: AppNotification) => {
    if (!user) return
    if (!n.read) markRead(user.uid, n.id).catch(() => {})
    setOpen(false)
    navigate(`/e/${n.eventId}`)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={unread ? `Notificaciones, ${unread} sin leer` : 'Notificaciones'}
        className="relative flex size-10 items-center justify-center rounded-full text-fg active:bg-line/60"
      >
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute top-1 right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white ring-2 ring-surface">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      <BottomSheet open={open} title="Notificaciones" onClose={close}>
        {items.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-4xl" aria-hidden="true">🔔</p>
            <p className="mt-3 font-semibold text-fg">Sin notificaciones</p>
            <p className="mt-1 text-sm text-muted">Aquí verás invitaciones a eventos y cuándo un organizador ve tu ficha de emergencia.</p>
          </div>
        ) : (
          <ul className="-mx-4">
            {items.map((n) => (
              <li key={n.id}>
                <SwipeRow
                  trailing={[{ key: 'del', label: 'Borrar', icon: '🗑', tone: 'danger', onClick: () => user && deleteNotification(user.uid, n.id) }]}
                >
                  <button type="button" onClick={() => go(n)} className="flex w-full items-start gap-3 px-4 py-3 text-left active:bg-line/60">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl" aria-hidden="true">
                      {TEXT[n.type].icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm ${n.read ? 'text-fg-soft' : 'font-semibold text-fg'}`}>{TEXT[n.type].text(n)}</span>
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
    </>
  )
}
