import { useState } from 'react'
import { Logo } from '../../components/Logo'
import { isFirebaseConfigured } from '../../lib/firebase'
import { useAuth } from './AuthProvider'

export function LoginPage() {
  const { signInWithGoogle, error } = useAuth()
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setLoading(true)
    await signInWithGoogle()
    setLoading(false)
  }

  return (
    <main className="pt-safe pb-safe flex min-h-dvh flex-col bg-surface px-6">
      <section className="flex flex-1 flex-col items-center justify-center text-center">
        <Logo className="size-20 shadow-lg shadow-primary/30 rounded-2xl" />
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-fg">rocketId</h1>
        <p className="mt-2 max-w-xs text-base text-muted">
          Inicia sesión para acceder a tu cuenta.
        </p>
      </section>

      <section className="mx-auto w-full max-w-sm pb-10">
        {!isFirebaseConfigured && (
          <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            Falta configurar Firebase. Copia <code>.env.example</code> a <code>.env.local</code>.
          </p>
        )}
        {error && (
          <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={handleLogin}
          disabled={loading}
          className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl border border-line bg-card text-base font-semibold text-fg shadow-sm transition active:scale-[0.98] disabled:opacity-60"
        >
          {loading ? (
            <span className="size-5 animate-spin rounded-full border-2 border-line-strong border-t-primary" />
          ) : (
            <GoogleIcon />
          )}
          Continuar con Google
        </button>
        <p className="mt-4 text-center text-xs text-subtle">
          Al continuar aceptas los términos de uso y la política de privacidad.
        </p>
      </section>
    </main>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}
