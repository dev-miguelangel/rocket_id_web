import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { MEMBER_ROLES, type Member, type MemberRole } from '../../../../shared/domain/providers'
import {
  cancelInvite,
  findPerson,
  getPerson,
  invitePerson,
  removeMember,
  setMemberRole,
  subscribeProviderInvites,
  subscribeTeam,
  type Invite,
  type Person,
} from '../../../../shared/teamsApi'
import { useAuth } from '../auth/AuthProvider'
import { ProviderPicker } from '../courses/ProviderPicker'
import { useCourseProvider } from '../courses/useCourseProvider'
import { Badge, Card, dangerButton, Field, inputClass, primaryButton, secondaryButton } from '../ui/form'
import { TeamIcon } from '../ui/icons'

const ROLES = Object.keys(MEMBER_ROLES) as MemberRole[]

/** Personas con perfil público, cargadas una vez por uid */
function usePeople(uids: string[]) {
  const [map, setMap] = useState<Record<string, Person | null>>({})
  const key = [...new Set(uids)].sort().join(',')
  useEffect(() => {
    if (!key) return
    let alive = true
    Promise.all(key.split(',').map(async (uid) => [uid, await getPerson(uid)] as const)).then((r) => alive && setMap(Object.fromEntries(r)))
    return () => {
      alive = false
    }
  }, [key])
  return map
}

export function TeamPage() {
  const cp = useCourseProvider()
  const { user } = useAuth()
  const navigate = useNavigate()
  const pid = cp.current?.provider.id ?? null
  const isOwner = cp.current?.role === 'owner'
  const isOrg = cp.current?.provider.kind === 'organization'
  const [team, setTeam] = useState<{ pid: string | null; list: Member[] | null }>({ pid: null, list: null })
  const [invites, setInvites] = useState<{ pid: string | null; list: Invite[] }>({ pid: null, list: [] })
  const [busy, setBusy] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    if (!pid) return
    return subscribeTeam(pid, (list) => setTeam({ pid, list }))
  }, [pid])
  useEffect(() => {
    if (!pid || !isOwner || !isOrg) return
    return subscribeProviderInvites(pid, (list) => setInvites({ pid, list }))
  }, [pid, isOwner, isOrg])

  const members = team.pid === pid ? team.list : null
  const pending = invites.pid === pid ? invites.list : []
  const people = usePeople([...(members ?? []).map((m) => m.uid), ...pending.map((i) => i.uid)])
  const owners = (members ?? []).filter((m) => m.role === 'owner').length
  const nameOf = (uid: string) =>
    people[uid]?.displayName ||
    (uid === cp.current?.provider.ownerUid ? cp.current.provider.contact.name : '') ||
    (uid === user?.uid ? (user.displayName ?? '') : '') ||
    'Persona sin perfil público'

  const run = async (key: string, fn: () => Promise<void>, ok: string) => {
    setBusy(key)
    setMsg(null)
    try {
      await fn()
      setMsg({ ok: true, text: ok })
    } catch (e) {
      console.error('team', e)
      setMsg({ ok: false, text: 'No se pudo completar. Revisa tu conexión e inténtalo de nuevo.' })
    } finally {
      setBusy(null)
      setConfirm(null)
    }
  }

  if (cp.loading) return <div className="h-80 animate-pulse rounded-2xl bg-line/60" aria-busy="true" />
  if (!cp.current)
    return (
      <Empty title="Aún no tienes equipo" text="Cuando tu organización esté aprobada podrás invitar a instructores y coordinación por su rocketId o correo." />
    )
  if (!isOrg)
    return (
      <div className="space-y-6">
        <ProviderPicker options={cp.options} current={cp.current} onChoose={cp.choose} />
        <Empty
          title="Los formadores independientes no tienen equipo"
          text="Si diriges una escuela o club, regístrala como organización desde el Inicio para invitar a tu equipo."
        />
      </div>
    )

  return (
    <div className="space-y-6">
      <ProviderPicker options={cp.options} current={cp.current} onChoose={cp.choose} />

      {isOwner && cp.current.provider.status === 'approved' && (
        <InviteForm providerId={cp.current.provider.id} providerName={cp.current.provider.name} members={members ?? []} pending={pending} />
      )}

      <Card
        title={`Equipo${members ? ` · ${members.length}` : ''}`}
        description="Responsables administran el equipo; coordinación gestiona cursos y postulaciones; instructores, las postulaciones de sus cursos. Todos pueden verificar certificaciones."
      >
        {members === null ? (
          <div className="h-32 animate-pulse rounded-xl bg-line/60" aria-busy="true" />
        ) : (
          <ul className="divide-y divide-line">
            {members.map((m) => {
              const me = m.uid === user?.uid
              return (
                <li key={m.uid} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-fg">
                      {nameOf(m.uid)}
                      {me && <span className="font-normal text-muted"> (tú)</span>}
                    </span>
                    <span className="block text-sm text-muted">
                      {people[m.uid]?.rocketId && <span className="font-mono">{people[m.uid]?.rocketId} · </span>}
                      {m.since ? `desde ${m.since.toLocaleDateString('es-CL', { month: 'short', year: 'numeric' })}` : ''}
                    </span>
                  </span>
                  {isOwner && !me ? (
                    <>
                      <label className="sr-only" htmlFor={`role-${m.uid}`}>
                        Rol de {nameOf(m.uid)}
                      </label>
                      <select
                        id={`role-${m.uid}`}
                        value={m.role}
                        disabled={!!busy}
                        onChange={(e) => {
                          const role = e.target.value as MemberRole
                          void run(
                            `role-${m.uid}`,
                            () => setMemberRole(m.providerId, m.uid, role),
                            `${nameOf(m.uid)} ahora es ${MEMBER_ROLES[role].label.toLowerCase()}.`,
                          )
                        }}
                        className="h-10 rounded-lg border border-line-strong bg-card px-3 text-sm text-fg"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {MEMBER_ROLES[r].label}
                          </option>
                        ))}
                      </select>
                      {confirm === m.uid ? (
                        <span className="flex items-center gap-2">
                          <button type="button" onClick={() => setConfirm(null)} className={secondaryButton}>
                            No
                          </button>
                          <button
                            type="button"
                            disabled={!!busy}
                            onClick={() => run(`del-${m.uid}`, () => removeMember(m.providerId, m.uid), `${nameOf(m.uid)} ya no es parte del equipo.`)}
                            className="inline-flex h-11 items-center rounded-xl bg-red-600 px-4 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                          >
                            Quitar
                          </button>
                        </span>
                      ) : (
                        <button type="button" onClick={() => setConfirm(m.uid)} className={dangerButton}>
                          Quitar
                        </button>
                      )}
                    </>
                  ) : (
                    <Badge tone={m.role === 'owner' ? 'success' : 'neutral'}>{MEMBER_ROLES[m.role].label}</Badge>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {cp.current.role !== 'owner' && (
          <div className="mt-6 border-t border-line pt-4">
            {confirm === 'leave' ? (
              <span className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-fg">¿Salir de {cp.current.provider.name}? Para volver necesitarás otra invitación.</span>
                <button type="button" onClick={() => setConfirm(null)} className={secondaryButton}>
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={async () => {
                    if (!user || !cp.current) return
                    await run('leave', () => removeMember(cp.current!.provider.id, user.uid), 'Saliste del equipo.')
                    navigate('/', { replace: true })
                  }}
                  className="inline-flex h-11 items-center rounded-xl bg-red-600 px-4 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  Salir
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirm('leave')} className={dangerButton}>
                Salir del formador
              </button>
            )}
          </div>
        )}
        {isOwner && owners === 1 && (
          <p className="mt-4 text-sm text-muted">Eres el único responsable: para dejar el formador, primero nombra a otra persona como responsable.</p>
        )}
      </Card>

      {isOwner && pending.length > 0 && (
        <Card title={`Invitaciones pendientes · ${pending.length}`}>
          <ul className="divide-y divide-line">
            {pending.map((i) => (
              <li key={i.uid} className="flex flex-wrap items-center gap-3 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-fg">{nameOf(i.uid)}</span>
                  <span className="block text-sm text-muted">
                    {MEMBER_ROLES[i.role].label} · invitada
                    {i.createdAt ? ` el ${i.createdAt.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}` : ''}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => run(`inv-${i.uid}`, () => cancelInvite(i.providerId, i.uid), 'Invitación cancelada.')}
                  className={dangerButton}
                >
                  Cancelar invitación
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {msg && (
        <p role={msg.ok ? 'status' : 'alert'} className={`text-sm ${msg.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
          {msg.ok ? '✓ ' : ''}
          {msg.text}
        </p>
      )}
    </div>
  )
}

function InviteForm({ providerId, providerName, members, pending }: { providerId: string; providerName: string; members: Member[]; pending: Invite[] }) {
  const { user } = useAuth()
  const [q, setQ] = useState('')
  const [role, setRole] = useState<MemberRole>('instructor')
  const [found, setFound] = useState<Person | null>(null)
  const [state, setState] = useState<'idle' | 'searching' | 'sending'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)

  const search = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSent(null)
    setFound(null)
    if (!q.trim()) return
    setState('searching')
    try {
      const p = await findPerson(q)
      if (!p) setError('No encontramos a nadie con ese rocketId o correo. La persona debe tener cuenta en la app de rocketId.')
      else if (members.some((m) => m.uid === p.uid)) setError('Esa persona ya es parte del equipo.')
      else if (pending.some((i) => i.uid === p.uid)) setError('Esa persona ya tiene una invitación pendiente.')
      else setFound(p)
    } catch (err) {
      setError(err === 'format' ? 'Escribe un rocketId (por ejemplo MA-8426) o un correo completo.' : 'No se pudo buscar. Revisa tu conexión.')
    } finally {
      setState('idle')
    }
  }

  const send = async () => {
    if (!found || !user) return
    setState('sending')
    setError(null)
    try {
      await invitePerson(providerId, providerName, { uid: user.uid, name: user.displayName ?? providerName }, found.uid, role)
      setSent(`Invitamos a ${found.displayName || 'la persona'} como ${MEMBER_ROLES[role].label.toLowerCase()}. Verá la invitación en su app.`)
      setFound(null)
      setQ('')
    } catch (e) {
      console.error('invite', e)
      setError('No se pudo enviar la invitación. Revisa tu conexión.')
    } finally {
      setState('idle')
    }
  }

  return (
    <Card title="Invitar al equipo" description="Busca a la persona por su rocketId o el correo de su cuenta. Se suma cuando acepta la invitación.">
      <form onSubmit={search} className="flex flex-wrap items-end gap-3">
        <div className="min-w-64 flex-1">
          <Field label="rocketId o correo" error={error ?? undefined}>
            {(a) => (
              <input
                {...a}
                className={inputClass}
                value={q}
                autoComplete="off"
                placeholder="MA-8426 o nombre@correo.cl"
                onChange={(e) => {
                  setQ(e.target.value)
                  setFound(null)
                  setError(null)
                }}
              />
            )}
          </Field>
        </div>
        <button type="submit" disabled={state !== 'idle' || !q.trim()} className={`${secondaryButton} mb-px`}>
          {state === 'searching' ? 'Buscando…' : 'Buscar'}
        </button>
      </form>

      {found && (
        <div className="mt-5 flex flex-wrap items-center gap-4 rounded-xl bg-surface p-4">
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold text-fg">{found.displayName || 'Persona sin perfil público'}</span>
            {found.rocketId && <span className="block font-mono text-sm text-muted">{found.rocketId}</span>}
          </span>
          <label className="sr-only" htmlFor="invite-role">
            Rol
          </label>
          <select
            id="invite-role"
            value={role}
            onChange={(e) => setRole(e.target.value as MemberRole)}
            className="h-11 rounded-xl border border-line-strong bg-card px-3 text-fg"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {MEMBER_ROLES[r].label}
              </option>
            ))}
          </select>
          <button type="button" onClick={send} disabled={state !== 'idle'} className={primaryButton}>
            {state === 'sending' ? 'Enviando…' : 'Enviar invitación'}
          </button>
        </div>
      )}
      {found && <p className="mt-2 text-sm text-muted">{MEMBER_ROLES[role].description}.</p>}
      {sent && (
        <p role="status" className="mt-4 text-sm text-emerald-700 dark:text-emerald-400">
          ✓ {sent}
        </p>
      )}
    </Card>
  )
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <section className="flex flex-col items-center rounded-2xl border border-dashed border-line-strong px-6 py-20 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary-text">
        <TeamIcon className="size-7" />
      </span>
      <h2 className="mt-5 text-lg font-semibold text-fg">{title}</h2>
      <p className="mt-2 max-w-md text-muted">{text}</p>
    </section>
  )
}
