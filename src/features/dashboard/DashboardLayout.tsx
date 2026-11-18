import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { RocketIdBadge } from '../../components/RocketIdBadge'
import { toTitleCaseName } from '../../lib/names'
import { useRocketId } from '../auth/useRocketId'
import { useTheme, type ThemePreference } from '../../lib/theme'
import { useAuth } from '../auth/AuthProvider'

const tabs = [
  { to: '/', label: 'Inicio', icon: HomeIcon, end: true },
  { to: '/mis-datos', label: 'Mis datos', icon: UserIcon, end: false },
  { to: '/cursos', label: 'Cursos', icon: CapIcon, end: false },
  { to: '/cordada', label: 'Cordada', icon: PeopleIcon, end: false },
  { to: '/eventos', label: 'Eventos', icon: CalendarIcon, end: false },
] as const

export function DashboardLayout() {
  const { pathname } = useLocation()
  const title = tabs.find((t) => (t.end ? pathname === t.to : pathname.startsWith(t.to)))?.label

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="pt-safe sticky top-0 z-20 border-b border-line/70 bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <h1 className="text-lg font-bold text-fg">{title ?? (pathname.startsWith('/p/') ? 'Perfil' : 'rocketId')}</h1>
          <UserMenu />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-4 pb-28">
        <Outlet />
      </main>

      <nav
        aria-label="Navegación principal"
        className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card"
      >
        <ul className="mx-auto flex h-16 max-w-3xl">
          {tabs.map(({ to, label, icon: Icon, end }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex h-full flex-col items-center justify-center gap-1 text-xs font-medium transition ${
                    isActive ? 'text-primary-text' : 'text-muted'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={`flex h-8 w-12 items-center justify-center rounded-full transition ${
                        isActive ? 'bg-primary/10' : ''
                      }`}
                    >
                      <Icon />
                    </span>
                    {label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

function UserMenu() {
  const rocketId = useRocketId()
  const { user, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Menú de usuario"
        aria-expanded={open}
        className="flex size-10 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-semibold text-white"
      >
        {user?.photoURL ? (
          <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
        ) : (
          (user?.displayName?.[0] ?? '?').toUpperCase()
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-line bg-card p-2 shadow-xl">
          <div className="px-3 py-2">
            <p className="truncate font-semibold text-fg">{toTitleCaseName(user?.displayName)}</p>
            <p className="truncate text-sm text-muted">{user?.email}</p>
            <RocketIdBadge rocketId={rocketId} className="mt-2" />
          </div>
          <ThemeSwitcher />
          <button
            type="button"
            onClick={signOut}
            className="mt-1 h-11 w-full rounded-xl px-3 text-left text-sm font-medium text-red-600 active:bg-red-50 dark:text-red-400 dark:active:bg-red-500/10"
          >
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  )
}

const themeOptions: { value: ThemePreference; label: string; icon: typeof SunIcon }[] = [
  { value: 'system', label: 'Sistema', icon: MonitorIcon },
  { value: 'light', label: 'Claro', icon: SunIcon },
  { value: 'dark', label: 'Oscuro', icon: MoonIcon },
]

function ThemeSwitcher() {
  const { preference, setPreference } = useTheme()
  return (
    <div className="border-t border-line px-3 pt-3 pb-2">
      <p id="theme-label" className="mb-2 text-xs font-medium text-muted">
        Tema
      </p>
      <div role="radiogroup" aria-labelledby="theme-label" className="grid grid-cols-3 gap-1 rounded-xl bg-surface p-1">
        {themeOptions.map(({ value, label, icon: Icon }) => {
          const active = preference === value
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setPreference(value)}
              className={`flex h-14 flex-col items-center justify-center gap-1 rounded-lg text-xs font-medium transition ${
                active ? 'bg-card text-primary-text shadow-sm' : 'text-muted'
              }`}
            >
              <Icon />
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  )
}
function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  )
}
function MonitorIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="4" width="20" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  )
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
    </svg>
  )
}
function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  )
}
function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M17 14c2.6 0 4.5 1.8 4.5 4.5" />
    </svg>
  )
}
function CapIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 9l10-5 10 5-10 5z" />
      <path d="M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5M22 9v6" />
    </svg>
  )
}
function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </svg>
  )
}
