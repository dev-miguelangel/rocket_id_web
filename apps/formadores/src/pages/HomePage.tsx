import { useAuth } from '../auth/AuthProvider'

const STEPS = [
  { title: 'Regístrate como formador', text: 'Como organización (escuela, club, centro de formación) o como persona independiente certificada.' },
  {
    title: 'El equipo de rocketId revisa tus datos',
    text: 'Aprobamos a cada formador a mano, para que nadie se haga pasar por otra institución o instructor.',
  },
  { title: 'Publica cursos y gestiona postulaciones', text: 'Desde aquí en el computador, o desde la app de rocketId en el celular.' },
]

export function HomePage() {
  const { user } = useAuth()
  const firstName = user?.displayName?.split(' ')[0]

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xl font-semibold text-fg">Hola{firstName ? `, ${firstName}` : ''} 👋</p>
        <p className="mt-1 text-muted">Este es tu espacio para impartir cursos en rocketId.</p>
      </div>

      <section className="rounded-2xl border border-line bg-card p-6 lg:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold text-fg">Tu cuenta aún no es formadora</h2>
          <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-800 dark:bg-sky-500/15 dark:text-sky-300">Pronto</span>
        </div>
        <p className="mt-2 max-w-2xl text-muted">Estamos preparando el registro de formadores. Así funcionará:</p>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-xl bg-surface p-5">
              <span className="grid size-8 place-items-center rounded-full bg-primary text-sm font-bold text-white">{i + 1}</span>
              <p className="mt-4 font-semibold text-fg">{s.title}</p>
              <p className="mt-1 text-sm text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
