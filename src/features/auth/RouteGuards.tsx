import { Navigate, Outlet, useLocation } from 'react-router'
import { SplashScreen } from '../../components/SplashScreen'
import { LandingPage } from '../landing/LandingPage'
import { useAuth } from './AuthProvider'

// Ruta a la que volver tras iniciar sesión (ej. un enlace compartido /p/SU-1234).
// Se guarda en sessionStorage porque el login por redirect (móvil) recarga la página.
const RETURN_KEY = 'rocketid-return-to'

export function ProtectedRoute() {
  const { user } = useAuth()
  const location = useLocation()
  if (user === undefined) return <SplashScreen />
  if (!user) {
    // Quien llega a la raíz sin sesión ve la landing en vez de ir directo al login
    if (location.pathname === '/') return <LandingPage />
    try {
      sessionStorage.setItem(RETURN_KEY, location.pathname + location.search)
    } catch {
      /* almacenamiento bloqueado */
    }
    return <Navigate to="/login" replace />
  }
  return <Outlet />
}

export function PublicOnlyRoute() {
  const { user } = useAuth()
  if (user === undefined) return <SplashScreen />
  if (user) {
    let to = '/'
    try {
      const saved = sessionStorage.getItem(RETURN_KEY)
      sessionStorage.removeItem(RETURN_KEY)
      // Solo rutas internas
      if (saved && saved.startsWith('/') && !saved.startsWith('//')) to = saved
    } catch {
      /* almacenamiento bloqueado */
    }
    return <Navigate to={to} replace />
  }
  return <Outlet />
}
