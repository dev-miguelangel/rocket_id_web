import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { subscribeMyProviders, type Membership } from '../../../../shared/providersApi'
import { useAuth } from '../auth/AuthProvider'

interface Value {
  /** null mientras carga */
  memberships: Membership[] | null
  error: boolean
}

const Ctx = createContext<Value>({ memberships: null, error: false })

/** Formadores de los que la persona es parte (una sola suscripción para toda la app) */
export function MyProvidersProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [state, setState] = useState<Value & { uid: string | null }>({ memberships: null, error: false, uid: null })

  useEffect(() => {
    if (!user) return
    return subscribeMyProviders(user.uid, (memberships, e) => {
      if (e) console.error('providers', e)
      setState({ memberships, error: !!e, uid: user.uid })
    })
  }, [user])

  const value = state.uid === user?.uid ? state : { memberships: null, error: false }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useMyProviders = () => useContext(Ctx)
