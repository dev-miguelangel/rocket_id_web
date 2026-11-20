import { useEffect, useMemo, useState } from 'react'
import { subscribeProviderNotifications, type ProviderNotification } from '../../../../shared/providerNotificationsApi'
import { useAuth } from '../auth/AuthProvider'
import { useMyProviders } from '../providers/MyProviders'

/** Avisos de todos los formadores de la persona (aprobados o suspendidos) */
export function useProviderNotifications() {
  const { user } = useAuth()
  const { memberships } = useMyProviders()
  const active = useMemo(() => (memberships ?? []).filter((m) => m.provider.status === 'approved' || m.provider.status === 'suspended'), [memberships])
  // Una clave estable para no volver a suscribirse en cada render
  const key = active.map((m) => `${m.provider.id}:${m.role}`).join(',')
  const [state, setState] = useState<{ key: string; items: ProviderNotification[] }>({ key: '', items: [] })

  useEffect(() => {
    if (!user || !key) return
    return subscribeProviderNotifications(active, user.uid, (items) => setState({ key, items }))
    // `active` cambia junto con `key`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, key])

  // Lo que hizo la propia persona (por ejemplo, aceptar una postulación) no se le avisa a ella misma
  const items = state.key === key ? state.items.filter((n) => n.actorUid !== user?.uid) : []
  const unread = user ? items.filter((n) => !n.readBy[user.uid]).length : 0
  return { items, unread }
}
