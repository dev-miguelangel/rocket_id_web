import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { markAllProviderNotificationsRead, markProviderNotificationRead, type ProviderNotification } from '../../../../shared/providerNotificationsApi'
import { useAuth } from '../auth/AuthProvider'
import { BellIcon } from '../ui/icons'
import { useProviderNotifications } from './useProviderNotifications'

const TEXT: Record<ProviderNotification['type'], { icon: string; text: (n: ProviderNotification) => string }> = {
  application_new: { icon: '📥', text: (n) => `${n.personName || 'Alguien'} postuló a “${n.courseTitle}”` },
  application_withdrawn: { icon: '↩️', text: (n) => `${n.personName || 'Alguien'} retiró su postulación a “${n.courseTitle}”` },
  application_accepted: { icon: '✅', text: (n) => `${n.actorName || 'Alguien del equipo'} aceptó a ${n.personName || 'una persona'} en “${n.courseTitle}”` },
  application_rejected: { icon: '✖️', text: (n) => `${n.actorName || 'Alguien del equipo'} rechazó a ${n.personName || 'una persona'} en “${n.courseTitle}”` },
}

function timeAgo(d: Date | null) {
  if (!d) return 'ahora'
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000)
  if (s < 60) return 'ahora'
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`
  if (s < 7 * 86400) return `hace ${Math.floor(s / 86400)} d`
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
}

/** Campana de avisos del formador: postulaciones nuevas, retiradas y decisiones del equipo */
export function NotificationsBell() {
  const { user } = useAuth()
  const { items, unread } = useProviderNotifications()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const multi = new Set(items.map((n) => n.providerId)).size > 1

  // Contador en la pestaña del navegador / ventana de la PWA
  useEffect(() => {
    document.title = unread ? `(${unread}) rocketId Formadores` : 'rocketId Formadores'
  }, [unread])

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const go = (n: ProviderNotification) => {
    if (user && !n.readBy[user.uid]) markProviderNotificationRead(n, user.uid).catch(() => {})
    setOpen(false)
    navigate(`/postulaciones?f=${encodeURIComponent(n.providerId)}&p=${encodeURIComponent(n.applicationId)}`)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={unread ? `Avisos, ${unread} sin leer` : 'Avisos'}
        className="relative grid size-11 place-items-center rounded-full text-fg transition hover:bg-line/60"
      >
        <BellIcon className="size-6" />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute top-1 right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white ring-2 ring-surface"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Avisos"
          className="absolute right-0 z-40 mt-2 w-[min(26rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-line bg-card shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="font-semibold text-fg">Avisos</p>
            {unread > 0 && user && (
              <button
                type="button"
                onClick={() => markAllProviderNotificationsRead(items, user.uid).catch(() => {})}
                className="h-9 rounded-lg px-2 text-sm font-medium text-primary-text hover:bg-line/60"
              >
                Marcar todas como leídas
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <p className="font-semibold text-fg">Sin avisos</p>
              <p className="mt-1 text-sm text-muted">Aquí verás las postulaciones nuevas, las que se retiren y las decisiones de tu equipo.</p>
            </div>
          ) : (
            <ul className="max-h-[28rem] divide-y divide-line overflow-y-auto">
              {items.map((n) => {
                const read = !!user && !!n.readBy[user.uid]
                return (
                  <li key={`${n.providerId}/${n.id}`}>
                    <button
                      type="button"
                      onClick={() => go(n)}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-surface ${read ? '' : 'bg-primary/5'}`}
                    >
                      <span className="mt-0.5 text-lg" aria-hidden="true">
                        {TEXT[n.type].icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-sm ${read ? 'text-fg-soft' : 'font-semibold text-fg'}`}>{TEXT[n.type].text(n)}</span>
                        <span className="block text-xs text-muted">
                          {timeAgo(n.createdAt)}
                          {multi ? ` · ${n.providerName}` : ''}
                        </span>
                      </span>
                      {!read && <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-primary" aria-label="Sin leer" />}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
