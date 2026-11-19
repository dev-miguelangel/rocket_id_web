import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'

/** sha256 del correo de administración (las reglas de Firestore validan lo mismo: el correo no queda en el código) */
const ADMIN_EMAIL_HASH = '4505f00c6a3f199d9f1a7b6a32b492291441f41fd8510826e44a76c0c306c6e4'

export async function isAdminEmail(email: string | null | undefined) {
  if (!email) return false
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email.trim().toLowerCase()))
  const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
  return hex === ADMIN_EMAIL_HASH
}

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
