import { useMemo } from 'react'
import { toTitleCaseName } from '../../lib/names'
import { useAuth } from '../auth/AuthProvider'
import { useRocketId } from '../auth/useRocketId'

/** Datos públicos de la persona en sesión, para firmar eventos, invitaciones y notificaciones. */
export function useMe() {
  const { user } = useAuth()
  const rocketId = useRocketId()
  return useMemo(
    () =>
      user && rocketId
        ? { uid: user.uid, displayName: toTitleCaseName(user.displayName) || 'Sin nombre', rocketId, photoURL: user.photoURL ?? null }
        : null,
    [user, rocketId],
  )
}

export const timeAgo = (d: Date | null) => {
  if (!d) return ''
  const s = Math.round((Date.now() - d.getTime()) / 1000)
  if (s < 60) return 'ahora'
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`
  if (s < 7 * 86400) return `hace ${Math.floor(s / 86400)} d`
  return d.toLocaleDateString('es', { day: 'numeric', month: 'short' })
}
