import { RocketIdBadge } from '../../components/RocketIdBadge'
import { useRocketId } from '../auth/useRocketId'
import { firstName } from '../../lib/names'
import { Link } from 'react-router'
import { useAuth } from '../auth/AuthProvider'

export function HomePage() {
  const { user } = useAuth()
  const name = firstName(user?.displayName)
  const rocketId = useRocketId()

  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-gradient-to-br from-primary to-accent p-5 text-white shadow-lg shadow-primary/20">
        <p className="text-sm opacity-90">Bienvenido de vuelta</p>
        <h2 className="mt-1 text-2xl font-bold">Hola, {name} 👋</h2>
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-xs tracking-wide uppercase opacity-80">Tu rocketId</span>
          <RocketIdBadge rocketId={rocketId} variant="light" />
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <ShortcutCard to="/mis-datos" title="Mis datos" subtitle="Revisa y edita tu perfil" />
        <ShortcutCard to="/cursos" title="Cursos" subtitle="Fórmate y postula" />
        <ShortcutCard to="/cordada" title="Cordada" subtitle="Tus compañeros de salida" />
        <ShortcutCard to="/eventos" title="Eventos" subtitle="Próximas actividades" />
      </div>
    </div>
  )
}

function ShortcutCard({ to, title, subtitle }: { to: string; title: string; subtitle: string }) {
  return (
    <Link
      to={to}
      className="flex min-h-28 flex-col justify-between rounded-2xl border border-line bg-card p-4 shadow-sm transition active:scale-[0.98]"
    >
      <span className="text-base font-semibold text-fg">{title}</span>
      <span className="text-sm text-muted">{subtitle}</span>
    </Link>
  )
}
