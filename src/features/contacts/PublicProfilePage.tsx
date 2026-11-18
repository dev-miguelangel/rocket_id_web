import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Avatar } from '../../components/Avatar'
import { Logo } from '../../components/Logo'
import { VerifiedBadge } from '../../components/VerifiedBadge'
import { StatusBadge } from '../skills/SkillsSection'
import { categoryOf, formatMonth, isPastExpiry, verificationFor } from '../skills/schema'
import { findPerson, normalizeRocketIdInput, type SearchResult } from './publicProfile'
import { profileUrl } from './ShareProfile'

/**
 * Perfil público de deportista: /p/SU-1234
 * Página independiente (sin barra de la app ni sesión). "Abrir en rocketId" lleva al perfil
 * dentro de la app (/perfil/SU-1234), pasando por el login si hace falta.
 */
export function PublicProfilePage() {
  const { rocketId: param = '' } = useParams()
  const code = normalizeRocketIdInput(param)
  const [result, setResult] = useState<SearchResult | null | undefined>(code ? undefined : null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!code) return
    let alive = true
    findPerson(code)
      .then((r) => alive && setResult(r))
      .catch(() => alive && setResult(null))
    return () => {
      alive = false
    }
  }, [code])

  useEffect(() => {
    if (result?.profile.displayName) document.title = `${result.profile.displayName} · rocketId`
    return () => {
      document.title = 'rocketId'
    }
  }, [result])

  const share = async () => {
    if (!code) return
    const url = profileUrl(code)
    const title = result ? `${result.profile.displayName} en rocketId` : 'Perfil en rocketId'
    try {
      if (typeof navigator.share === 'function') await navigator.share({ title, url })
      else {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 1800)
      }
    } catch {
      /* cancelado */
    }
  }

  const p = result?.profile
  const certs = p?.skills.hasCertifications === 'yes' ? p.skills.certifications : []
  const verified = result ? certs.filter((c) => verificationFor(c, result.verifications)) : []
  const active = certs.filter((c) => c.status === 'active' && !isPastExpiry(c.expiresAt))
  // Primero vigentes y verificadas, luego en curso, luego vencidas
  const order = (c: (typeof certs)[number]) =>
    (c.status === 'active' && !isPastExpiry(c.expiresAt) ? 0 : c.status === 'in_progress' ? 1 : 2) -
    (result && verificationFor(c, result.verifications) ? 0.5 : 0)
  const sorted = [...certs].sort((a, b) => order(a) - order(b))

  return (
    <div className="min-h-dvh bg-surface pb-[calc(7rem+env(safe-area-inset-bottom))]">
      {/* Portada */}
      <header className="pt-safe relative overflow-hidden bg-gradient-to-br from-primary-dark to-primary">
        <div className="mx-auto flex h-14 max-w-md items-center gap-2 px-4">
          <Logo className="size-8 rounded-lg ring-1 ring-white/30" />
          <span className="text-lg font-bold tracking-tight text-white">rocketId</span>
        </div>
        <div className="h-28" />
        {/* Silueta de montañas */}
        <svg viewBox="0 0 400 80" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-20 w-full" aria-hidden="true">
          <path d="M0 80 L0 55 L60 25 L95 48 L150 8 L205 50 L250 30 L300 58 L345 20 L400 50 L400 80 Z" fill="white" opacity="0.12" />
          <path d="M0 80 L0 65 L70 45 L120 62 L185 35 L240 66 L300 48 L360 70 L400 60 L400 80 Z" fill="var(--surface)" />
        </svg>
      </header>

      <main className="relative mx-auto -mt-16 max-w-md px-4">
        {result === undefined ? (
          <Skeleton />
        ) : !p ? (
          <NotFound code={param.toUpperCase()} />
        ) : (
          <>
            {/* Identidad */}
            <section className="flex flex-col items-center text-center">
              <Avatar name={p.displayName} photoURL={p.photoURL} className="size-28 text-3xl shadow-xl ring-4 ring-surface" />
              <h1 className="mt-3 flex items-center gap-1.5 text-2xl font-extrabold tracking-tight text-fg">
                {p.displayName}
                {verified.length > 0 && <VerifiedBadge className="size-6" label="Tiene certificaciones verificadas" />}
              </h1>
              <p className="mt-1 rounded-full bg-primary/10 px-3 py-1 font-mono text-sm font-bold tracking-wider whitespace-nowrap text-primary-text">
                🚀 {p.rocketId}
              </p>
              {p.isMock && (
                <span className="mt-2 rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-800 dark:bg-sky-500/15 dark:text-sky-300">
                  🧪 Perfil de prueba
                </span>
              )}
            </section>

            {/* Estadísticas */}
            <section className="mt-5 grid grid-cols-3 divide-x divide-line rounded-2xl border border-line bg-card py-3 text-center shadow-sm">
              <Stat value={active.length} label={active.length === 1 ? 'Vigente' : 'Vigentes'} />
              <Stat value={verified.length} label={verified.length === 1 ? 'Verificada' : 'Verificadas'} />
              <Stat value={p.skills.categories.length} label={p.skills.categories.length === 1 ? 'Área' : 'Áreas'} />
            </section>

            {/* Disciplinas */}
            {p.skills.categories.length > 0 && (
              <section className="mt-6">
                <h2 className="mb-2 px-1 text-xs font-bold tracking-widest text-muted uppercase">Disciplinas</h2>
                <div className="flex flex-wrap gap-2">
                  {p.skills.categories.map((id) => {
                    const c = categoryOf(id)
                    return (
                      c && (
                        <span key={id} className="flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1.5 text-sm font-medium text-fg shadow-sm">
                          <span aria-hidden="true">{c.icon}</span>
                          {c.short}
                        </span>
                      )
                    )
                  })}
                </div>
              </section>
            )}

            {/* Certificaciones */}
            <section className="mt-6">
              <h2 className="mb-2 px-1 text-xs font-bold tracking-widest text-muted uppercase">Certificaciones y formación</h2>
              {sorted.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-line-strong bg-card px-6 py-8 text-center">
                  <p className="text-3xl" aria-hidden="true">🧭</p>
                  <p className="mt-2 text-sm text-muted">
                    {p.skills.hasCertifications === 'no' ? 'Aún no declara certificaciones.' : 'Este perfil todavía no tiene información de formación.'}
                  </p>
                </div>
              ) : (
                <ol className="relative space-y-3 border-l-2 border-line pl-5">
                  {sorted.map((c) => {
                    const v = verificationFor(c, result.verifications)
                    const cat = categoryOf(c.category)
                    return (
                      <li key={c.id} className="relative">
                        <span
                          className={`absolute top-4 -left-[1.95rem] flex size-6 items-center justify-center rounded-full text-xs ring-4 ring-surface ${v ? 'bg-blue-500 text-white' : 'bg-card text-muted ring-offset-0'}`}
                          aria-hidden="true"
                        >
                          {v ? '✓' : '•'}
                        </span>
                        <article className="rounded-2xl border border-line bg-card p-4 shadow-sm">
                          <div className="flex items-start gap-3">
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xl" aria-hidden="true">
                              {cat?.icon ?? '📄'}
                            </span>
                            <div className="min-w-0 flex-1">
                              <h3 className="text-base leading-snug font-semibold break-words text-fg">
                                {c.name}
                                {v && <VerifiedBadge className="ml-1 size-4 -translate-y-px align-middle" />}
                              </h3>
                              <p className="text-sm text-muted">{[c.issuer, c.year].filter(Boolean).join(' · ')}</p>
                            </div>
                            <StatusBadge status={c.status} />
                          </div>
                          {(v || c.expiresAt) && (
                            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-line pt-2.5 text-xs">
                              {v && (
                                <span className="font-medium text-blue-600 dark:text-blue-400">
                                  Verificado por {v.verifiedBy}
                                </span>
                              )}
                              {c.expiresAt && (
                                <span className={isPastExpiry(c.expiresAt) ? 'text-amber-700 dark:text-amber-300' : 'text-muted'}>
                                  {isPastExpiry(c.expiresAt) ? 'Venció' : 'Vence'} {formatMonth(c.expiresAt)}
                                </span>
                              )}
                            </div>
                          )}
                        </article>
                      </li>
                    )
                  })}
                </ol>
              )}
            </section>

            <p className="mt-8 text-center text-xs text-subtle">
              Las verificaciones las otorgan las instituciones emisoras. <br />
              rocketId · Tu identidad outdoor
            </p>
          </>
        )}
      </main>

      {/* Llamado a la acción fijo */}
      {p && (
        <div className="pb-safe fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface/95 backdrop-blur">
          <div className="mx-auto flex max-w-md items-center gap-2 px-4 py-3">
            <Link
              to={`/perfil/${p.rocketId}`}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-white shadow-lg shadow-primary/25 active:bg-primary-dark"
            >
              <Logo className="size-6 rounded-md ring-1 ring-white/40" />
              Abrir en rocketId
            </Link>
            <button
              type="button"
              onClick={share}
              aria-label="Compartir perfil"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-line-strong bg-card text-fg active:bg-line/60"
            >
              {copied ? '✓' : <ShareIcon />}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="px-2">
      <p className="text-2xl leading-none font-extrabold text-fg tabular-nums">{value}</p>
      <p className="mt-1 text-xs font-medium text-muted">{label}</p>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="flex flex-col items-center" aria-busy="true" aria-label="Cargando perfil">
      <div className="size-28 animate-pulse rounded-full bg-line ring-4 ring-surface" />
      <div className="mt-4 h-6 w-48 animate-pulse rounded bg-line" />
      <div className="mt-2 h-5 w-24 animate-pulse rounded-full bg-line" />
      <div className="mt-6 h-16 w-full animate-pulse rounded-2xl bg-line" />
      <div className="mt-6 h-28 w-full animate-pulse rounded-2xl bg-line" />
    </div>
  )
}

function NotFound({ code }: { code: string }) {
  return (
    <div className="mt-20 rounded-2xl border border-line bg-card px-6 py-10 text-center shadow-sm">
      <p className="text-4xl" aria-hidden="true">🔗</p>
      <p className="mt-3 text-lg font-bold text-fg">Perfil no encontrado</p>
      <p className="mt-1 text-sm text-muted">No existe un perfil público con el rocketId {code}.</p>
      <Link to="/" className="mt-5 inline-flex h-11 items-center rounded-xl bg-primary px-5 font-semibold text-white active:bg-primary-dark">
        Ir a rocketId
      </Link>
    </div>
  )
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
    </svg>
  )
}
