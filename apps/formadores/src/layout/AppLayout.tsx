import { NavLink, Outlet, useLocation } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { NotificationsBell } from '../notifications/NotificationsBell'
import { useMyProviders } from '../providers/MyProviders'
import { BadgeIcon, BookIcon, HomeIcon, InboxIcon, LogoutIcon, TeamIcon } from '../ui/icons'
import { Logo } from '../ui/Logo'
import { MobileNotice } from '../ui/MobileNotice'

export const NAV = [
  { to: '/', label: 'Inicio', icon: HomeIcon, end: true },
  { to: '/cursos', label: 'Cursos', icon: BookIcon, end: false },
  { to: '/postulaciones', label: 'Postulaciones', icon: InboxIcon, end: false },
  { to: '/verificaciones', label: 'Verificaciones', icon: BadgeIcon, end: false },
  { to: '/equipo', label: 'Equipo', icon: TeamIcon, end: false },
]

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition ${
    isActive ? 'bg-primary/10 text-primary-text' : 'text-fg-soft hover:bg-line/60'
  }`

export function AppLayout() {
  const { user, signOut } = useAuth()
  const { pathname } = useLocation()
  const { memberships } = useMyProviders()
  // "Equipo" solo para quien es parte de una organización aprobada (o suspendida)
  const inOrganization = !!memberships?.some(
    (m) => m.provider.kind === 'organization' && (m.provider.status === 'approved' || m.provider.status === 'suspended'),
  )
  const nav = NAV.filter((n) => n.to !== '/equipo' || inOrganization)
  const current = NAV.find((n) => (n.end ? pathname === n.to : pathname.startsWith(n.to)))

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="titlebar" />
      <MobileNotice />
      <div className="flex flex-1">
        {/* Barra lateral: solo íconos en tablet, completa desde 1024 px */}
        <aside className="sticky top-0 hidden h-dvh w-20 shrink-0 flex-col border-r border-line bg-card px-3 py-5 md:flex lg:w-64">
          <div className="flex items-center gap-3 px-1.5">
            <Logo className="size-9 shrink-0" />
            <p className="hidden leading-tight lg:block">
              <span className="block font-semibold tracking-tight text-fg">rocketId</span>
              <span className="block text-sm text-muted">Formadores</span>
            </p>
          </div>
          <nav aria-label="Secciones" className="mt-8 flex flex-col gap-1">
            {nav.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={linkClass} title={label}>
                <Icon className="size-5 shrink-0" />
                <span className="hidden lg:inline">{label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="mt-auto border-t border-line pt-4">
            <div className="flex items-center gap-3 px-1.5">
              <Avatar name={user?.displayName ?? ''} photo={user?.photoURL ?? null} />
              <div className="hidden min-w-0 lg:block">
                <p className="truncate text-sm font-semibold text-fg">{user?.displayName}</p>
                <p className="truncate text-xs text-muted">{user?.email}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={signOut}
              title="Cerrar sesión"
              className="mt-3 flex h-11 w-full items-center gap-3 rounded-xl px-3 text-[15px] font-medium text-fg-soft hover:bg-line/60"
            >
              <LogoutIcon className="size-5 shrink-0" />
              <span className="hidden lg:inline">Cerrar sesión</span>
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* En celular: navegación horizontal arriba */}
          <nav aria-label="Secciones" className="flex gap-1 overflow-x-auto border-b border-line bg-card px-3 py-2 md:hidden">
            {nav.map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end} className={(s) => `${linkClass(s)} shrink-0`}>
                {label}
              </NavLink>
            ))}
          </nav>
          <header className="flex items-center justify-between gap-4 border-b border-line px-6 py-4 lg:px-10">
            <h1 className="text-2xl font-bold tracking-tight text-fg">
              {current?.label ?? (/^\/(registro|solicitud)\//.test(pathname) ? 'Solicitud de formador' : 'rocketId Formadores')}
            </h1>
            <NotificationsBell />
          </header>
          <main className="flex-1 px-6 py-8 lg:px-10">
            <div className="mx-auto max-w-5xl">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

function Avatar({ name, photo }: { name: string; photo: string | null }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
  if (photo) return <img src={photo} alt="" referrerPolicy="no-referrer" className="size-9 shrink-0 rounded-full object-cover" />
  return <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary-text">{initials || '?'}</span>
}
