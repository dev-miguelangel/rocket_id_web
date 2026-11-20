import { useEffect, useState } from 'react'
import { MEMBER_ROLES } from '../../../../shared/domain/providers'
import { acceptInvite, declineInvite, subscribeMyInvites, type Invite } from '../../../../shared/teamsApi'
import { useAuth } from '../auth/AuthProvider'
import { primaryButton, secondaryButton } from '../ui/form'

/** Invitaciones a equipos de formadores, para aceptar o rechazar */
export function InvitesCard() {
  const { user } = useAuth()
  const [list, setList] = useState<{ uid: string; items: Invite[] } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!user) return
    return subscribeMyInvites(user.uid, (items) => setList({ uid: user.uid, items }))
  }, [user])

  const items = list && list.uid === user?.uid ? list.items : []
  if (!items.length || !user) return null

  const act = async (inv: Invite, accept: boolean) => {
    setBusy(inv.providerId)
    setFailed(false)
    try {
      if (accept) await acceptInvite(user.uid, inv)
      else await declineInvite(inv)
    } catch (e) {
      console.error('invite', e)
      setFailed(true)
    } finally {
      setBusy(null)
    }
  }

  return (
    <section aria-labelledby="inv-title" className="space-y-3">
      <h2 id="inv-title" className="text-lg font-semibold text-fg">
        {items.length === 1 ? 'Tienes una invitación' : `Tienes ${items.length} invitaciones`}
      </h2>
      {items.map((i) => (
        <article key={i.providerId} className="flex flex-wrap items-center gap-4 rounded-2xl border border-primary/40 bg-primary/5 p-5">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-fg">
              {i.invitedByName || 'Alguien'} te invitó a <span className="whitespace-nowrap">{i.providerName}</span>
            </p>
            <p className="mt-0.5 text-sm text-muted">
              Rol: {MEMBER_ROLES[i.role].label} · {MEMBER_ROLES[i.role].description}
            </p>
          </div>
          <button type="button" onClick={() => act(i, false)} disabled={!!busy} className={secondaryButton}>
            Rechazar
          </button>
          <button type="button" onClick={() => act(i, true)} disabled={!!busy} className={primaryButton}>
            {busy === i.providerId ? 'Guardando…' : 'Aceptar'}
          </button>
        </article>
      ))}
      {failed && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          No se pudo completar. Revisa tu conexión e inténtalo de nuevo.
        </p>
      )}
    </section>
  )
}
