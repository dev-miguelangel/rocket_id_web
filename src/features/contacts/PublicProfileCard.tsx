import type { ReactNode } from 'react'
import { Avatar } from '../../components/Avatar'
import { VerifiedBadge } from '../../components/VerifiedBadge'
import { StatusBadge } from '../skills/SkillsSection'
import { categoryOf, verificationFor } from '../skills/schema'
import type { SearchResult } from './publicProfile'

interface Props {
  result: SearchResult
  /** Máximo de certificaciones a mostrar (resto se resume) */
  maxCerts?: number
  action?: ReactNode
}

/** Tarjeta de perfil público: avatar, nombre, rocketId y resumen de conocimientos. */
export function PublicProfileCard({ result, maxCerts = 3, action }: Props) {
  const { profile: p, verifications } = result
  const certs = p.skills.hasCertifications === 'yes' ? p.skills.certifications : []
  const verifiedCount = certs.filter((c) => verificationFor(c, verifications)).length
  const shown = certs.slice(0, maxCerts)

  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
      <header className="flex items-center gap-4 p-4">
        <Avatar name={p.displayName} photoURL={p.photoURL} className="size-16 text-xl" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-bold text-fg">{p.displayName || 'Sin nombre'}</h3>
          {p.isMock && (
            <span className="mb-0.5 inline-block rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-800 dark:bg-sky-500/15 dark:text-sky-300">
              🧪 Perfil de prueba
            </span>
          )}
          <p className="font-mono text-sm font-bold tracking-wider text-primary-text">🚀 {p.rocketId}</p>
          {certs.length > 0 && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
              {certs.length} {certs.length === 1 ? 'certificación' : 'certificaciones'}
              {verifiedCount > 0 && (
                <>
                  {' · '}
                  <VerifiedBadge className="size-3.5" />
                  {verifiedCount} {verifiedCount === 1 ? 'verificada' : 'verificadas'}
                </>
              )}
            </p>
          )}
        </div>
      </header>

      <div className="border-t border-line px-4 py-3">
        <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Conocimientos y experiencia</p>
        {certs.length === 0 ? (
          <p className="text-sm text-subtle italic">
            {p.skills.hasCertifications === 'no' ? 'No declara certificaciones' : 'Sin información'}
          </p>
        ) : (
          <>
            {p.skills.categories.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {p.skills.categories.map((id) => {
                  const c = categoryOf(id)
                  return (
                    c && (
                      <span key={id} className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary-text">
                        {c.icon} {c.short}
                      </span>
                    )
                  )
                })}
              </div>
            )}
            <ul className="space-y-2">
              {shown.map((c) => {
                const v = verificationFor(c, verifications)
                return (
                  <li key={c.id} className="flex items-start gap-2">
                    <span aria-hidden="true">{categoryOf(c.category)?.icon ?? '📄'}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium break-words text-fg">
                        {c.name}
                        {v && <VerifiedBadge className="ml-1 size-3.5 -translate-y-px align-middle" />}
                      </span>
                      <span className="block text-xs text-muted">{[c.issuer, c.year].filter(Boolean).join(' · ')}</span>
                    </span>
                    <StatusBadge status={c.status} />
                  </li>
                )
              })}
            </ul>
            {certs.length > shown.length && (
              <p className="mt-2 text-xs text-muted">+ {certs.length - shown.length} más</p>
            )}
          </>
        )}
      </div>

      {action && <footer className="border-t border-line p-3">{action}</footer>}
    </article>
  )
}
