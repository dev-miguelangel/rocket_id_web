import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { useAuth } from '../auth/AuthProvider'

const tabs = [
  { to: '/', label: 'Inicio', icon: HomeIcon, end: true },
  { to: '/mis-datos', label: 'Mis datos', icon: UserIcon, end: false },
  { to: '/eventos', label: 'Eventos', icon: CalendarIcon, end: false },
] as const

export function DashboardLayout() {
  const { pathname } = useLocation()
  const title = tabs.find((t) => (t.end ? pathname === t.to : pathname.startsWith(t.to)))?.label

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="pt-safe sticky top-0 z-20 border-b border-zinc-200/70 bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <h1 className="text-lg font-bold text-zinc-900">{title ?? 'rocketId'}</h1>
          <UserMenu />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-4 pb-28">
        <Outlet />
      </main>

      <nav
        aria-label="Navegación principal"
        className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white"
      >
        <ul className="mx-auto flex h-16 max-w-3xl">
          {tabs.map(({ to, label, icon: Icon, end }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex h-full flex-col items-center justify-center gap-1 text-xs font-medium transition ${
                    isActive ? 'text-primary' : 'text-zinc-500'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={`flex h-8 w-14 items-center justify-center rounded-full transition ${
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
        <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-zinc-200 bg-white p-2 shadow-xl">
          <div className="px-3 py-2">
            <p className="truncate font-semibold text-zinc-900">{user?.displayName}</p>
            <p className="truncate text-sm text-zinc-500">{user?.email}</p>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="mt-1 h-11 w-full rounded-xl px-3 text-left text-sm font-medium text-red-600 active:bg-red-50"
          >
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
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
function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </svg>
  )
}
