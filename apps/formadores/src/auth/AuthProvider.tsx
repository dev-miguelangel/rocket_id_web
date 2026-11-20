import { getRedirectResult, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut as fbSignOut, type User } from 'firebase/auth'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { auth, googleProvider } from '../../../../shared/firebase'

interface AuthContextValue {
  /** undefined = verificando sesión, null = sin sesión */
  user: User | null | undefined
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  error: string | null
}

const AuthContext = createContext<AuthContextValue | null>(null)

function friendlyError(e: unknown): string | null {
  const code = (e as { code?: string })?.code ?? ''
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return null
  if (code === 'auth/network-request-failed') return 'Sin conexión. Revisa tu red e inténtalo de nuevo.'
  if (code === 'auth/unauthorized-domain') return 'Este dominio aún no está autorizado para iniciar sesión.'
  return 'No pudimos iniciar sesión. Inténtalo de nuevo.'
}

/** En el escritorio usamos popup; en celulares, redirect (los popups son poco fiables) */
const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getRedirectResult(auth).catch((e) => setError(friendlyError(e)))
    return onAuthStateChanged(auth, setUser)
  }, [])

  const signInWithGoogle = async () => {
    setError(null)
    try {
      if (isMobile()) await signInWithRedirect(auth, googleProvider)
      else await signInWithPopup(auth, googleProvider)
    } catch (e) {
      if ((e as { code?: string })?.code === 'auth/popup-blocked') return signInWithRedirect(auth, googleProvider)
      setError(friendlyError(e))
    }
  }

  return <AuthContext.Provider value={{ user, signInWithGoogle, signOut: () => fbSignOut(auth), error }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
