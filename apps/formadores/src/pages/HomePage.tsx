import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'
import {
  credentialExpiry,
  formatMonthYear,
  formatRut,
  independentId,
  MEMBER_ROLES,
  PROVIDER_KINDS,
  PROVIDER_STATUSES,
  type ProviderKind,
} from '../../../../shared/domain/providers'
import { withdrawProvider, type Membership } from '../../../../shared/providersApi'
import { useAuth } from '../auth/AuthProvider'
import { useMyProviders } from '../providers/MyProviders'
import { Badge, dangerButton, primaryButton, secondaryButton } from '../ui/form'

const SLUG: Record<ProviderKind, string> = { organization: 'organizacion', independent: 'independiente' }

const STEPS = [
  { title: 'Regístrate como formador', text: 'Como organización (escuela, club, centro de formación) o como persona independiente certificada.' },
  {
    title: 'La administración de rocketId revisa tus datos',
    text: 'Aprobamos a cada formador a mano, para que nadie se haga pasar por otra institución o instructor.',
  },
  { title: 'Publica cursos y gestiona postulaciones', text: 'Desde aquí en el computador, o desde la app de rocketId en el celular.' },
]

export function HomePage() {
  const { user } = useAuth()
  const { memberships, error } = useMyProviders()
  const { state } = useLocation() as { state: { sent?: boolean } | null }
  const firstName = user?.displayName?.split(' ')[0]
  // El aviso "Solicitud enviada" se muestra una vez: se quita del historial para que no vuelva al recargar
  useEffect(() => {
    if (state?.sent) window.history.replaceState({ ...window.history.state, usr: null }, '')
  }, [state])
  const hasIndependent = !!user && !!memberships?.some((m) => m.provider.id === independentId(user.uid))

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xl font-semibold text-fg">Hola{firstName ? `, ${firstName}` : ''} 👋</p>
        <p className="mt-1 text-muted">Este es tu espacio para impartir cursos en rocketId.</p>
      </div>

      {state?.sent && (
        <p role="status" className="rounded-xl bg-emerald-50 p-4 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200">
          ✓ Solicitud enviada. La administración de rocketId la revisará y verás aquí el resultado.
        </p>
      )}

      {error ? (
        <p role="alert" className="rounded-xl bg-amber-50 p-4 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          No pudimos cargar tus datos de formador. Revisa tu conexión y recarga la página.
        </p>
      ) : memberships === null ? (
        <div className="h-64 animate-pulse rounded-2xl bg-line/60" aria-busy="true" />
      ) : memberships.length === 0 ? (
        <>
          <section className="rounded-2xl border border-line bg-card p-6 lg:p-8">
            <h2 className="text-lg font-semibold text-fg">Regístrate como formador</h2>
            <p className="mt-1 max-w-2xl text-muted">Elige cómo impartes cursos. Es gratis.</p>
            <KindChoices />
          </section>
          <section aria-label="Cómo funciona">
            <ol className="grid gap-4 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={s.title} className="rounded-2xl bg-card p-5 ring-1 ring-line">
                  <span className="grid size-8 place-items-center rounded-full bg-primary text-sm font-bold text-white">{i + 1}</span>
                  <p className="mt-4 font-semibold text-fg">{s.title}</p>
                  <p className="mt-1 text-sm text-muted">{s.text}</p>
                </li>
              ))}
            </ol>
          </section>
        </>
      ) : (
        <>
          <section className="space-y-4" aria-labelledby="mine-title">
            <h2 id="mine-title" className="text-lg font-semibold text-fg">
              {memberships.length === 1 ? 'Tu formador' : 'Tus formadores'}
            </h2>
            {memberships.map((m) => (
              <ProviderCard key={m.provider.id} m={m} />
            ))}
          </section>
          <details className="group rounded-2xl border border-line bg-card p-6">
            <summary className="flex cursor-pointer list-none items-center justify-between font-semibold text-fg">
              Registrar otro formador
              <span aria-hidden="true" className="text-muted transition group-open:rotate-90">
                ›
              </span>
            </summary>
            <p className="mt-2 text-sm text-muted">Por ejemplo, si además de ser independiente diriges una escuela.</p>
            <KindChoices hideIndependent={hasIndependent} />
          </details>
        </>
      )}
    </div>
  )
}

function KindChoices({ hideIndependent }: { hideIndependent?: boolean }) {
  const kinds = (Object.keys(PROVIDER_KINDS) as ProviderKind[]).filter((k) => !(hideIndependent && k === 'independent'))
  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2">
      {kinds.map((k) => (
        <Link
          key={k}
          to={`/registro/${SLUG[k]}`}
          className="group flex items-start gap-4 rounded-xl border border-line-strong p-5 transition hover:border-primary hover:bg-primary/5"
        >
          <span className="text-3xl" aria-hidden="true">
            {PROVIDER_KINDS[k].icon}
          </span>
          <span className="flex-1">
            <span className="block font-semibold text-fg">{PROVIDER_KINDS[k].label}</span>
            <span className="mt-0.5 block text-sm text-muted">{PROVIDER_KINDS[k].hint}</span>
          </span>
          <span aria-hidden="true" className="self-center text-xl text-muted transition group-hover:translate-x-0.5 group-hover:text-primary-text">
            ›
          </span>
        </Link>
      ))}
    </div>
  )
}

function ProviderCard({ m }: { m: Membership }) {
  const { user } = useAuth()
  const { provider: p, role } = m
  const st = PROVIDER_STATUSES[p.status]
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const isOwner = role === 'owner'
  const editable = isOwner && (p.status === 'pending' || p.status === 'rejected')
  const expiry = p.status === 'approved' ? credentialExpiry(p) : null

  const withdraw = async () => {
    if (!user) return
    setBusy(true)
    setFailed(false)
    try {
      await withdrawProvider(user.uid, p.id)
    } catch (e) {
      console.error('withdraw', e)
      setFailed(true)
      setBusy(false)
    }
  }

  return (
    <article className="rounded-2xl border border-line bg-card p-6 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-semibold text-fg">{p.name}</h3>
            <Badge tone={st.tone}>{st.label}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted">
            {PROVIDER_KINDS[p.kind].icon} {PROVIDER_KINDS[p.kind].label} · Tu rol: {MEMBER_ROLES[role].label}
          </p>
        </div>
      </div>

      <dl className="mt-5 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        {p.kind === 'organization' ? (
          <>
            <Item label="Razón social" value={p.legalName} />
            <Item label="RUT" value={formatRut(p.rut)} />
          </>
        ) : (
          <>
            <Item label="Certificación" value={`${p.credential.name} · ${p.credential.issuer}`} />
            <Item label="Vigencia" value={p.credential.expiresAt ? `Hasta ${formatMonthYear(p.credential.expiresAt)}` : 'Sin vencimiento'} />
          </>
        )}
        {p.website && <Item label="Sitio web" value={p.website} />}
      </dl>

      <div className="mt-6 space-y-4">
        {p.status === 'pending' && (
          <p className="rounded-xl bg-sky-50 p-4 text-sky-900 dark:bg-sky-500/10 dark:text-sky-200">
            Tu solicitud está en revisión. Mientras tanto puedes corregirla; el resultado aparecerá aquí.
          </p>
        )}
        {p.status === 'rejected' && (
          <div className="rounded-xl bg-red-50 p-4 text-red-900 dark:bg-red-500/10 dark:text-red-200">
            <p className="font-semibold">La solicitud no fue aprobada</p>
            {p.reviewNote && <p className="mt-1">{p.reviewNote}</p>}
            <p className="mt-2 text-sm">Puedes corregirla y volver a enviarla.</p>
          </div>
        )}
        {p.status === 'approved' && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-emerald-50 p-4 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200">
            <p className="flex-1">✓ Formador aprobado. Ya puedes crear y publicar cursos.</p>
            {(role === 'owner' || role === 'manager') && (
              <Link to="/cursos" className={primaryButton}>
                Ir a Cursos
              </Link>
            )}
          </div>
        )}
        {expiry && (
          <p className="rounded-xl bg-amber-50 p-4 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
            {expiry === 'expired'
              ? 'Tu certificación venció. Renuévala para seguir publicando cursos y verificando.'
              : `Tu certificación vence en ${formatMonthYear(p.credential.expiresAt)}. Renuévala para no interrumpir tus cursos.`}
          </p>
        )}
        {p.status === 'suspended' && (
          <div className="rounded-xl bg-zinc-100 p-4 text-zinc-900 dark:bg-zinc-500/15 dark:text-zinc-100">
            <p className="font-semibold">Formador suspendido</p>
            {p.reviewNote && <p className="mt-1">{p.reviewNote}</p>}
            <p className="mt-2 text-sm">
              Mientras esté suspendido no se publican sus cursos. Si crees que es un error, contacta a la administración de rocketId.
            </p>
          </div>
        )}

        {editable &&
          (confirming ? (
            <div
              role="group"
              aria-label="Confirmar retiro"
              className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 p-4 dark:border-red-500/30"
            >
              <p className="flex-1 text-sm text-fg">¿Retirar la solicitud? Se borran los datos enviados. Puedes registrarte de nuevo cuando quieras.</p>
              <button type="button" onClick={() => setConfirming(false)} disabled={busy} className={secondaryButton}>
                Cancelar
              </button>
              <button
                type="button"
                onClick={withdraw}
                disabled={busy}
                className="inline-flex h-11 items-center rounded-xl bg-red-600 px-5 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {busy ? 'Retirando…' : 'Retirar'}
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              <Link to={`/solicitud/${p.id}`} className={p.status === 'rejected' ? primaryButton : secondaryButton}>
                {p.status === 'rejected' ? 'Corregir y reenviar' : 'Corregir solicitud'}
              </Link>
              <button type="button" onClick={() => setConfirming(true)} className={dangerButton}>
                Retirar solicitud
              </button>
            </div>
          ))}
        {failed && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            No se pudo retirar. Revisa tu conexión e inténtalo de nuevo.
          </p>
        )}
      </div>
    </article>
  )
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted">{label}</dt>
      <dd className="truncate font-medium text-fg">{value || '—'}</dd>
    </div>
  )
}
