import { useEffect, useState } from 'react'
import { isAdminEmail } from '../../../shared/admin'
import { useAuth } from '../auth/AuthProvider'

/** ¿La sesión actual es la cuenta de administración? (null mientras se calcula) */
export function useIsAdmin() {
  const { user } = useAuth()
  const email = user?.emailVerified ? user.email : null
  const [result, setResult] = useState<{ email: string | null; ok: boolean } | null>(null)
  useEffect(() => {
    let alive = true
    isAdminEmail(email).then((ok) => alive && setResult({ email, ok }))
    return () => {
      alive = false
    }
  }, [email])
  return result && result.email === email ? result.ok : null
}
