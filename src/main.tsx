import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router'
import './index.css'
import { UpdatePrompt } from './components/UpdatePrompt'
import { AuthProvider } from './features/auth/AuthProvider'
import { LoginPage } from './features/auth/LoginPage'
import { ProtectedRoute, PublicOnlyRoute } from './features/auth/RouteGuards'
import { DashboardLayout } from './features/dashboard/DashboardLayout'
import { EventsPage } from './features/dashboard/EventsPage'
import { HomePage } from './features/dashboard/HomePage'
import { MyDataPage } from './features/dashboard/MyDataPage'

const router = createBrowserRouter([
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
          { path: 'eventos', element: <EventsPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
      <UpdatePrompt />
    </AuthProvider>
  </StrictMode>,
)
