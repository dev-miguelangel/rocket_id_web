import { Navigate, Outlet } from 'react-router'
import { SplashScreen } from '../../components/SplashScreen'
import { useAuth } from './AuthProvider'

export function ProtectedRoute() {
  const { user } = useAuth()
  if (user === undefined) return <SplashScreen />
  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}

export function PublicOnlyRoute() {
  const { user } = useAuth()
  if (user === undefined) return <SplashScreen />
  if (user) return <Navigate to="/" replace />
  return <Outlet />
}
