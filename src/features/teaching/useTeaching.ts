import { useEffect, useState } from 'react'
import { subscribeMyProviders, type Membership } from '../../../shared/providersApi'
import { useAuth } from '../auth/AuthProvider'

/**
 * Formadores en los que la persona gestiona postulaciones (responsable o coordinación).
 * Con esto se muestra "🎓 Cursos que dictas" en el menú del avatar. `null` mientras carga.
 */
export function useTeachingProviders(): Membership[] | null {
  const { user } = useAuth()
  const [state, setState] = useState<{ uid: string; list: Membership[] | null } | null>(null)

  useEffect(() => {
    if (!user) return
    return subscribeMyProviders(user.uid, (list) =>
      setState({
        uid: user.uid,
        list: (list ?? []).filter(
          (m) => (m.role === 'owner' || m.role === 'manager') && (m.provider.status === 'approved' || m.provider.status === 'suspended'),
        ),
      }),
    )
  }, [user])

  return state && state.uid === user?.uid ? state.list : null
}
