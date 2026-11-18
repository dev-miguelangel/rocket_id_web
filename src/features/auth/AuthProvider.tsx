import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { auth, googleProvider } from '../../lib/firebase'
import { upsertUserProfile } from './userProfile'

interface AuthContextValue {
  /** undefined = verificando sesión, null = sin sesión */
  user: User | null | undefined
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  error: string | null
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** En móvil y en la PWA instalada los popups son poco fiables: usamos redirect. */
function shouldUseRedirect() {
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  return standalone || mobile
}

function friendlyError(e: unknown): string | null {
  const code = (e as { code?: string })?.code ?? ''
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return null
  if (code === 'auth/network-request-failed') return 'Sin conexión. Revisa tu red e inténtalo de nuevo.'
  if (code === 'auth/unauthorized-domain') return 'Este dominio no está autorizado en Firebase.'
  return 'No pudimos iniciar sesión. Inténtalo de nuevo.'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getRedirectResult(auth).catch((e) => setError(friendlyError(e)))
    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      if (u) upsertUserProfile(u).catch((e) => console.error('upsertUserProfile', e))
    })
  }, [])

  const signInWithGoogle = async () => {
    setError(null)
    try {
      if (shouldUseRedirect()) await signInWithRedirect(auth, googleProvider)
      else await signInWithPopup(auth, googleProvider)
    } catch (e) {
      const code = (e as { code?: string })?.code
      // Si el navegador bloquea el popup, caemos a redirect
      if (code === 'auth/popup-blocked') return signInWithRedirect(auth, googleProvider)
      setError(friendlyError(e))
    }
  }

  const signOut = () => fbSignOut(auth)

  return (
    <AuthContext.Provider value={{ user, signInWithGoogle, signOut, error }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
