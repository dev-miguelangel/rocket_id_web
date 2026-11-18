import { StrictMode } from 'react'
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
import { CoursesPage } from './features/courses/CoursesPage'
import { EventDetailPage } from './features/events/EventDetailPage'
import { EventsPage } from './features/events/EventsPage'
import { HomePage } from './features/dashboard/HomePage'
import { MyDataPage } from './features/dashboard/MyDataPage'

const router = createBrowserRouter([
  // Perfil público de deportista: se ve sin sesión, como página independiente
  { path: '/p/:rocketId', element: <PublicProfilePage /> },
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
