import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import { LoginPage } from './auth/LoginPage'
import { AppLayout } from './layout/AppLayout'
import { HomePage } from './pages/HomePage'
import { ApplicationsPage } from './applications/ApplicationsPage'
import { VerificationsPage } from './verifications/VerificationsPage'
import { TeamPage } from './team/TeamPage'
import { CourseEditorPage } from './courses/CourseEditorPage'
import { CoursesPage } from './courses/CoursesPage'
import { MyProvidersProvider } from './providers/MyProviders'
import { ProviderFormPage } from './providers/ProviderFormPage'
import { UpdatePrompt } from './ui/UpdatePrompt'
import './index.css'

// Tema del sistema (la app de formadores no tiene selector propio)
const media = matchMedia('(prefers-color-scheme: dark)')
media.addEventListener('change', (e) => {
  document.documentElement.classList.toggle('dark', e.matches)
  document.documentElement.style.colorScheme = e.matches ? 'dark' : 'light'
})

function Root() {
  const { user } = useAuth()
  if (user === undefined)
    return (
      <div className="grid min-h-dvh place-items-center" aria-busy="true">
        <span className="size-8 animate-spin rounded-full border-2 border-line-strong border-t-primary" />
      </div>
    )
  return user ? (
    <MyProvidersProvider>
      <AppLayout />
    </MyProvidersProvider>
  ) : (
    <LoginPage />
  )
}

const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'registro/:tipo', element: <ProviderFormPage /> },
      { path: 'solicitud/:id', element: <ProviderFormPage /> },
      { path: 'cursos', element: <CoursesPage /> },
      { path: 'cursos/nuevo', element: <CourseEditorPage /> },
      { path: 'cursos/:id', element: <CourseEditorPage /> },
      { path: 'postulaciones', element: <ApplicationsPage /> },
      { path: 'verificaciones', element: <VerificationsPage /> },
      { path: 'equipo', element: <TeamPage /> },
      { path: '*', element: <HomePage /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
      <UpdatePrompt />
    </AuthProvider>
  </StrictMode>,
)
