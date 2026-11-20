import { useState } from 'react'
import { isFirebaseConfigured } from '../../../../shared/firebase'
import { APP_URL } from '../../../../shared/urls'
import { Logo } from '../ui/Logo'
import { MobileNotice } from '../ui/MobileNotice'
import { useAuth } from './AuthProvider'

const POINTS = [
  { title: 'Publica tus cursos', text: 'Fechas, cupos, requisitos y precio, visibles para toda la comunidad outdoor.' },
  { title: 'Gestiona postulaciones', text: 'Revisa quién postula y acepta o rechaza, también desde el celular.' },
  { title: 'Verifica certificaciones', text: 'Tu nombre en la insignia ✓ de quienes formaste.' },
]

export function LoginPage() {
  const { signInWithGoogle, error } = useAuth()
  const [loading, setLoading] = useState(false)

  const login = async () => {
    setLoading(true)
    await signInWithGoogle()
    setLoading(false)
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="titlebar" />
      <MobileNotice />
      <main className="grid flex-1 lg:grid-cols-[1.1fr_1fr]">
        <section className="relative hidden overflow-hidden bg-[linear-gradient(165deg,#0a3f3b_0%,#0f766e_55%,#0d9488_100%)] p-14 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="pointer-events-none absolute -top-40 -right-40 size-[38rem] rounded-full bg-emerald-400/25 blur-3xl" />
          <div className="relative flex items-center gap-3">
            <Logo className="size-11" />
            <p className="text-lg font-semibold tracking-tight">
              rocketId <span className="font-normal text-white/75">Formadores</span>
            </p>
          </div>
          <div className="relative max-w-md">
            <h2 className="text-4xl leading-tight font-bold tracking-tight">Forma a la comunidad outdoor.</h2>
            <ul className="mt-10 space-y-6">
              {POINTS.map((p) => (
                <li key={p.title} className="flex gap-4">
                  <span className="mt-1 size-2.5 shrink-0 rounded-full bg-emerald-300" aria-hidden="true" />
                  <div>
                    <p className="font-semibold">{p.title}</p>
                    <p className="mt-1 text-white/80">{p.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <p className="relative text-sm text-white/70">Gratis para formadores durante el lanzamiento.</p>
        </section>

        <section className="flex items-center justify-center px-6 py-16">
          <div className="w-full max-w-sm">
            <Logo className="size-14 lg:hidden" />
            <h1 className="mt-6 text-3xl font-bold tracking-tight text-fg lg:mt-0">Inicia sesión</h1>
            <p className="mt-2 text-muted">Usa la misma cuenta de Google con la que entras a rocketId.</p>

            {!isFirebaseConfigured && (
              <p className="mt-6 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                Falta configurar Firebase. Copia <code>.env.example</code> a <code>.env.local</code> en la raíz del repositorio.
              </p>
            )}
            {error && (
              <p role="alert" className="mt-6 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={login}
              disabled={loading}
              className="mt-8 flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-line-strong bg-card font-semibold text-fg shadow-sm transition hover:bg-surface disabled:opacity-60"
            >
              {loading ? <span className="size-5 animate-spin rounded-full border-2 border-line-strong border-t-primary" /> : <GoogleIcon />}
              Continuar con Google
            </button>
            <p className="mt-4 text-xs text-subtle">Al continuar aceptas los términos de uso y la política de privacidad.</p>
            <p className="mt-10 border-t border-line pt-6 text-sm text-muted">
              ¿Buscas tu ficha o tus cursos como deportista?{' '}
              <a href={APP_URL} className="font-semibold text-primary-text hover:underline">
                Ir a rocketId
              </a>
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}
