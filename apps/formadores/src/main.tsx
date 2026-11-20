import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import { LoginPage } from './auth/LoginPage'
import { AppLayout } from './layout/AppLayout'
import { HomePage } from './pages/HomePage'
import { CourseEditorPage } from './courses/CourseEditorPage'
import { CoursesPage } from './courses/CoursesPage'
import { MyProvidersProvider } from './providers/MyProviders'
import { ProviderFormPage } from './providers/ProviderFormPage'
import { SoonPage } from './pages/SoonPage'
import { BadgeIcon, InboxIcon, TeamIcon } from './ui/icons'
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
      {
        path: 'postulaciones',
        element: <SoonPage icon={InboxIcon} title="Postulaciones" text="Revisa quién postula a cada curso, con los datos que compartió, y acepta o rechaza." />,
      },
      {
        path: 'verificaciones',
        element: (
          <SoonPage icon={BadgeIcon} title="Verificaciones" text="Confirma las certificaciones que emitiste para que lleven la insignia ✓ con tu nombre." />
        ),
      },
      {
        path: 'equipo',
        element: (
          <SoonPage icon={TeamIcon} title="Tu equipo" text="Invita a instructores y coordinación por su rocketId o correo, y define el rol de cada uno." />
        ),
      },
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
