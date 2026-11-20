import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router'
import './index.css'
import { StatusBarScrim } from './components/StatusBarScrim'
import { UpdatePrompt } from './components/UpdatePrompt'
import { useTheme } from './lib/theme'
import { AuthProvider } from './features/auth/AuthProvider'
import { LoginPage } from './features/auth/LoginPage'
import { ProtectedRoute, PublicOnlyRoute } from './features/auth/RouteGuards'
import { DashboardLayout } from './features/dashboard/DashboardLayout'
import { ContactsPage } from './features/contacts/ContactsPage'
import { ProfileLinkPage } from './features/contacts/ProfileLinkPage'
import { PublicProfilePage } from './features/contacts/PublicProfilePage'
import { LandingPage } from './features/landing/LandingPage'
import { SosPage } from './features/sos/SosPage'
import { CoursesPage } from './features/courses/CoursesPage'
import { EventDetailPage } from './features/events/EventDetailPage'
import { EventsPage } from './features/events/EventsPage'
import { HomePage } from './features/dashboard/HomePage'
import { MyDataPage } from './features/dashboard/MyDataPage'

// Panel de administración: se carga aparte (solo lo usa una cuenta)
const AdminPage = lazy(() => import('./features/admin/AdminPage').then((m) => ({ default: m.AdminPage })))
// "Cursos que dictas": solo formadores (se abre desde el menú del avatar)
const TeachingPage = lazy(() => import('./features/teaching/TeachingPage').then((m) => ({ default: m.TeachingPage })))

const router = createBrowserRouter([
  // Perfil público de deportista: se ve sin sesión, como página independiente
  { path: '/p/:rocketId', element: <PublicProfilePage /> },
  // Landing para promocionar la app (también se ve en "/" sin sesión)
  { path: '/conoce', element: <LandingPage /> },
  // Página de emergencia del QR: datos en el fragmento (#), sin sesión ni servidor
  { path: '/sos', element: <SosPage /> },
  {
    element: <PublicOnlyRoute />,
    children: [{ path: '/login', element: <LoginPage /> }],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'mis-datos', element: <MyDataPage /> },
          { path: 'cursos', element: <CoursesPage /> },
          { path: 'cordada', element: <ContactsPage /> },
          { path: 'perfil/:rocketId', element: <ProfileLinkPage /> },
          { path: 'eventos', element: <EventsPage /> },
          { path: 'e/:eventId', element: <EventDetailPage /> },
          {
            path: 'dictas',
            element: (
              <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-line/60" />}>
                <TeachingPage />
              </Suspense>
            ),
          },
          // Administración: solo la cuenta admin (se abre desde el menú del avatar)
          {
            path: 'admin',
            element: (
              <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-line/60" />}>
                <AdminPage />
              </Suspense>
            ),
          },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])

/** Mantiene el tema aplicado y escucha cambios del sistema */
function ThemeSync() {
  useTheme()
  return null
}

document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeSync />
    <StatusBarScrim />
    <AuthProvider>
      <RouterProvider router={router} />
      <UpdatePrompt />
    </AuthProvider>
  </StrictMode>,
)
