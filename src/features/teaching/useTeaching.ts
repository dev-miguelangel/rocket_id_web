import { useEffect, useState } from 'react'
import { subscribeMyProviders, type Membership } from '../../../shared/providersApi'
import { subscribeMyInvites, type Invite } from '../../../shared/teamsApi'
import { useAuth } from '../auth/AuthProvider'

/**
 * Formadores en los que la persona participa (aprobados o suspendidos) e invitaciones pendientes.
 * Con esto se muestra "🎓 Cursos que dictas" en el menú del avatar. `null` mientras carga.
 */
export function useTeaching(): { memberships: Membership[] | null; invites: Invite[] } {
  const { user } = useAuth()
  const [state, setState] = useState<{ uid: string; list: Membership[] | null } | null>(null)
  const [inv, setInv] = useState<{ uid: string; list: Invite[] } | null>(null)

  useEffect(() => {
    if (!user) return
    const u1 = subscribeMyProviders(user.uid, (list) =>
      setState({ uid: user.uid, list: (list ?? []).filter((m) => m.provider.status === 'approved' || m.provider.status === 'suspended') }),
    )
    const u2 = subscribeMyInvites(user.uid, (list) => setInv({ uid: user.uid, list }))
    return () => {
      u1()
      u2()
    }
  }, [user])

  return {
    memberships: state && state.uid === user?.uid ? state.list : null,
    invites: inv && inv.uid === user?.uid ? inv.list : [],
  }
}
