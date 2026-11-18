import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { BottomSheet } from '../../components/Sheet'
import { SwipeRow } from '../../components/SwipeRow'
import { useAuth } from '../auth/AuthProvider'
import { timeAgo } from '../events/useMe'
import { deleteNotification, markAllRead, markRead, subscribeNotifications, type AppNotification, type NotificationType } from './notificationsApi'

/** Texto, ícono y contexto (estado o motivo) de cada tipo de notificación */
const T: Record<NotificationType, { icon: string; tone: string; text: (n: AppNotification) => string; context: string }> = {
  event_invite: {
    icon: '📩',
    tone: 'bg-sky-100 dark:bg-sky-500/15',
    text: (n) => `${n.actorName} te invitó a “${n.eventTitle}”`,
    context: 'Invitación pendiente · toca para confirmar o rechazar',
  },
  event_updated: {
    icon: '✏️',
    tone: 'bg-amber-100 dark:bg-amber-500/15',
    text: (n) => `${n.actorName} actualizó “${n.eventTitle}”`,
    context: 'Revisa los cambios del evento',
  },
  event_cancelled: {
    icon: '🚫',
    tone: 'bg-red-100 dark:bg-red-500/15',
    text: (n) => `${n.actorName} canceló “${n.eventTitle}”`,
    context: 'El evento ya no se realizará',
  },
  participant_confirmed: {
    icon: '✅',
    tone: 'bg-emerald-100 dark:bg-emerald-500/15',
    text: (n) => `${n.actorName} confirmó su asistencia a “${n.eventTitle}”`,
    context: 'Invitación aceptada · compartió su ficha de emergencia contigo',
  },
  participant_joined: {
    icon: '🙋',
    tone: 'bg-emerald-100 dark:bg-emerald-500/15',
    text: (n) => `${n.actorName} se unió a “${n.eventTitle}”`,
    context: 'Se unió con el enlace o desde Explorar · compartió su ficha contigo',
  },
  participant_declined: {
    icon: '👋',
    tone: 'bg-zinc-200 dark:bg-zinc-500/20',
    text: (n) => `${n.actorName} no podrá ir a “${n.eventTitle}”`,
    context: 'Invitación rechazada o canceló su asistencia · su ficha ya no está disponible',
  },
  sensitive_view: {
    icon: '👁️',
    tone: 'bg-violet-100 dark:bg-violet-500/15',
    text: (n) => `${n.actorName} vio tu ficha de emergencia en “${n.eventTitle}”`,
    context: 'El organizador revisó tus datos de salud y contacto de emergencia',
  },
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
                  <span className={`flex size-11 shrink-0 items-center justify-center rounded-full text-xl ${T[n.type].tone}`} aria-hidden="true">
                    {T[n.type].icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm ${n.read ? 'text-fg-soft' : 'font-semibold text-fg'}`}>{T[n.type].text(n)}</span>
                    <span className="block text-sm text-muted">{n.detail || T[n.type].context}</span>
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

/** Campana de la barra superior: contador de no leídas y hoja con la lista */
export function NotificationsButton() {
  const { items, unread } = useNotifications()
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={unread ? `Notificaciones, ${unread} sin leer` : 'Notificaciones'}
        className="relative flex size-11 items-center justify-center rounded-full text-fg active:bg-line/60"
      >
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0" />
        </svg>
        <UnreadBadge count={unread} className="absolute top-0.5 right-0.5" />
      </button>
      <NotificationsSheet open={open} onClose={close} items={items} />
    </>
  )
}
