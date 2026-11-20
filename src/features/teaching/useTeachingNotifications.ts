import { useEffect, useState } from 'react'
import { subscribeProviderNotifications, type ProviderNotification } from '../../../shared/providerNotificationsApi'
import type { Membership } from '../../../shared/providersApi'
import { useAuth } from '../auth/AuthProvider'

/**
 * Avisos del formador (postulaciones nuevas, retiradas y decisiones del equipo) para "Cursos que dictas".
 * Lo que hizo la propia persona no se le avisa a ella misma.
 */
export function useTeachingNotifications(memberships: Membership[] | null) {
  const { user } = useAuth()
  const key = (memberships ?? []).map((m) => `${m.provider.id}:${m.role}`).join(',')
  const [state, setState] = useState<{ key: string; items: ProviderNotification[] }>({ key: '', items: [] })

  useEffect(() => {
    if (!user || !key || !memberships) return
    return subscribeProviderNotifications(memberships, user.uid, (items) => setState({ key, items }))
    // `memberships` cambia junto con `key`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, key])

  const items = state.key === key ? state.items.filter((n) => n.actorUid !== user?.uid) : []
  const unread = user ? items.filter((n) => !n.readBy[user.uid]).length : 0
  return { items, unread }
}
