import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ageFrom, decideApplication, markApplicationSeen, subscribeProviderApplications, type ProviderApplication } from '../../../shared/applicationsApi'
import { FORMADORES_URL } from '../../../shared/urls'
import { Avatar } from '../../components/Avatar'
import { Segmented, textareaClass } from '../../components/form'
import { BottomSheet } from '../../components/Sheet'
import { useToast } from '../../components/Toast'
import { useAuth } from '../auth/AuthProvider'
import { ApplicationBadge } from '../courses/parts'
import { categoryOf } from '../skills/schema'
import { MEMBER_ROLES } from '../../../shared/domain/providers'
import { acceptInvite, declineInvite, subscribeInstructorApplications, type Invite } from '../../../shared/teamsApi'
import { useTeaching } from './useTeaching'

/** "🎓 Cursos que dictas": postulaciones a los cursos del formador, desde el celular */
export function TeachingPage() {
  const { user } = useAuth()
  const { memberships, invites } = useTeaching()
  const [params, setParams] = useSearchParams()
  const [chosen, setChosen] = useState<string | null>(null)
  const current = memberships?.find((m) => m.provider.id === chosen) ?? memberships?.[0] ?? null
  const pid = current?.provider.id ?? null
  const [state, setState] = useState<{ pid: string | null; list: ProviderApplication[] | null; error: boolean }>({ pid: null, list: null, error: false })
  const course = params.get('curso')
  const [openId, setOpenId] = useState<string | null>(null)
  const toast = useToast()

  // Responsables y coordinación ven todas las postulaciones; un instructor, las de sus cursos asignados
  const seesAll = current?.role === 'owner' || current?.role === 'manager'
  const uid = user?.uid ?? null
  useEffect(() => {
    if (!pid || !uid) return
    const cb = (list: ProviderApplication[] | null, e?: unknown) => setState({ pid, list, error: !!e })
    return seesAll ? subscribeProviderApplications(pid, cb) : subscribeInstructorApplications(pid, uid, cb)
  }, [pid, uid, seesAll])

  const list = state.pid === pid ? state.list : null
  const courses = useMemo(() => {
    const m = new Map<string, { id: string; title: string; total: number; fresh: number; accepted: number }>()
    for (const a of list ?? []) {
      const c = m.get(a.courseId) ?? { id: a.courseId, title: a.courseTitle, total: 0, fresh: 0, accepted: 0 }
      c.total++
      if (a.status === 'sent') c.fresh++
      if (a.status === 'accepted') c.accepted++
      m.set(a.courseId, c)
    }
    return [...m.values()].sort((a, b) => b.fresh - a.fresh || a.title.localeCompare(b.title, 'es'))
  }, [list])
  const selected = courses.find((c) => c.id === course) ?? null
  const people = (list ?? []).filter((a) => a.courseId === course)
  const open = (list ?? []).find((a) => a.id === openId) ?? null

  if (memberships === null) return <div className="h-64 animate-pulse rounded-2xl bg-line/60" aria-busy="true" />
  if (!current && invites.length) return <Invites invites={invites} onDone={toast.show} toast={toast.node} />
  if (!current)
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <span className="text-5xl" aria-hidden="true">
          🎓
        </span>
        <h2 className="text-xl font-bold text-fg">Aún no dictas cursos en rocketId</h2>
        <p className="max-w-sm text-base text-muted">
          Regístrate como formador en el computador. Cuando te aprueben, verás aquí las postulaciones a tus cursos.
        </p>
        <a href={FORMADORES_URL} className="mt-2 flex h-12 items-center rounded-xl bg-primary px-6 text-base font-semibold text-white active:bg-primary-dark">
          Ir a rocketId Formadores
        </a>
      </div>
    )

  return (
    <div className="space-y-5">
      {invites.length > 0 && <Invites invites={invites} onDone={toast.show} />}
      {memberships.length > 1 && (
        <Segmented
          label="Formador"
          value={current.provider.id}
          onChange={(v) => {
            setChosen(v)
            setParams({}, { replace: true })
          }}
          options={memberships.map((m) => ({ value: m.provider.id, label: m.provider.name }))}
        />
      )}

      {selected ? (
        <>
          <div>
            <Link to="/dictas" replace className="text-sm font-medium text-primary-text">
              ‹ Todos los cursos
            </Link>
            <h2 className="mt-2 text-xl font-bold text-fg">{selected.title}</h2>
            <p className="text-sm text-muted">
              {selected.total} {selected.total === 1 ? 'postulación' : 'postulaciones'} · {selected.accepted}{' '}
              {selected.accepted === 1 ? 'aceptada' : 'aceptadas'}
            </p>
          </div>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
            {people.map((a) => (
              <li key={a.id}>
                <button type="button" onClick={() => setOpenId(a.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-line/40">
                  <Avatar name={a.applicant.fullName} photoURL={null} className="size-11 text-base" />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[15px] ${a.status === 'sent' ? 'font-bold' : 'font-semibold'} text-fg`}>
                      {a.applicant.fullName || 'Sin nombre'}
                    </span>
                    <span className="block text-sm text-muted">
                      {a.createdAt ? `Postuló el ${a.createdAt.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}` : 'Postulación'}
                    </span>
                  </span>
                  <ApplicationBadge status={a.status} />
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <div>
            <h2 className="text-xl font-bold text-fg">{current.provider.name}</h2>
            <p className="text-sm text-muted">
              {seesAll ? 'Postulaciones a tus cursos publicados.' : `${MEMBER_ROLES.instructor.label}: postulaciones de los cursos que tienes asignados.`}
            </p>
          </div>
          {current.provider.status === 'suspended' && (
            <p className="rounded-xl bg-zinc-100 p-3 text-sm text-zinc-900 dark:bg-zinc-500/15 dark:text-zinc-100">
              Este formador está suspendido: puedes ver las postulaciones, pero no cambiarlas.
            </p>
          )}
          {state.error && state.pid === pid ? (
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
              No se pudieron cargar las postulaciones. Revisa tu conexión.
            </p>
          ) : list === null ? (
            <div className="h-40 animate-pulse rounded-2xl bg-line/60" aria-busy="true" />
          ) : courses.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center">
              <p className="font-semibold text-fg">Aún no hay postulaciones</p>
              <p className="mt-1 text-sm text-muted">Cuando alguien postule a uno de tus cursos, aparecerá aquí.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {courses.map((c) => (
                <li key={c.id}>
                  <Link
                    to={`/dictas?curso=${encodeURIComponent(c.id)}`}
                    className="flex items-center gap-3 rounded-2xl border border-line bg-card p-4 active:bg-line/40"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-semibold text-fg">{c.title}</span>
                      <span className="block text-sm text-muted">
                        {c.total} {c.total === 1 ? 'postulación' : 'postulaciones'} · {c.accepted} {c.accepted === 1 ? 'aceptada' : 'aceptadas'}
                      </span>
                    </span>
                    {c.fresh > 0 && (
                      <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-white">
                        {c.fresh} {c.fresh === 1 ? 'nueva' : 'nuevas'}
                      </span>
                    )}
                    <span className="text-xl text-muted" aria-hidden="true">
                      ›
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <a
            href={`${FORMADORES_URL}/cursos`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-2xl bg-surface p-4 text-sm text-fg-soft ring-1 ring-line active:bg-line/40"
          >
            <span className="text-xl" aria-hidden="true">
              💻
            </span>
            <span className="flex-1">Para crear o editar cursos, usa rocketId Formadores en el computador.</span>
            <span aria-hidden="true">↗</span>
          </a>
        </>
      )}

      <ApplicationSheet
        a={open}
        providerName={current.provider.name}
        canDecide={current.provider.status === 'approved'}
        onClose={() => setOpenId(null)}
        onDone={(text) => {
          setOpenId(null)
          toast.show(text)
        }}
      />
      {toast.node}
    </div>
  )
}

function ApplicationSheet({
  a,
  providerName,
  canDecide,
  onClose,
  onDone,
}: {
  a: ProviderApplication | null
  providerName: string
  canDecide: boolean
  onClose: () => void
  onDone: (text: string) => void
}) {
  const { user } = useAuth()
  const [deciding, setDeciding] = useState<'accepted' | 'rejected' | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [lastId, setLastId] = useState<string | null>(null)

  // Otra postulación: se reinicia el formulario
  if ((a?.id ?? null) !== lastId) {
    setLastId(a?.id ?? null)
    setDeciding(null)
    setNote(a?.providerNote ?? '')
    setFailed(false)
  }

  // Abrirla la marca como vista
  useEffect(() => {
    if (a && user && canDecide && a.status === 'sent') markApplicationSeen(user.uid, a).catch((e) => console.warn('seen', e))
  }, [a, user, canDecide])

  const decide = async () => {
    if (!a || !user || !deciding) return
    setBusy(true)
    setFailed(false)
    try {
      await decideApplication(user.uid, providerName, a, deciding, note)
      onDone(deciding === 'accepted' ? 'Postulación aceptada' : 'Postulación rechazada')
    } catch (e) {
      console.error('decide', e)
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  const decided = a?.status === 'accepted' || a?.status === 'rejected'
  const footer =
    a && canDecide && a.status !== 'withdrawn' ? (
      <div className="space-y-2">
        {deciding ? (
          <>
            <label htmlFor="teach-note" className="text-sm font-medium text-fg-soft">
              Mensaje para la persona (opcional)
            </label>
            <textarea
              id="teach-note"
              className={textareaClass}
              value={note}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
              placeholder={deciding === 'accepted' ? 'Te esperamos el sábado a las 9:00 en…' : 'El curso se llenó; te avisaremos de la próxima fecha.'}
            />
            <button
              type="button"
              onClick={decide}
              disabled={busy}
              className={`h-12 w-full rounded-xl text-base font-semibold text-white disabled:opacity-60 ${
                deciding === 'accepted' ? 'bg-primary active:bg-primary-dark' : 'bg-red-600 active:bg-red-700'
              }`}
            >
              {busy ? 'Guardando…' : deciding === 'accepted' ? 'Aceptar postulación' : 'Rechazar postulación'}
            </button>
            <button type="button" onClick={() => setDeciding(null)} className="h-11 w-full rounded-xl text-base font-medium text-muted active:bg-line/60">
              Cancelar
            </button>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDeciding('rejected')}
              disabled={a.status === 'rejected'}
              className="h-12 rounded-xl border border-line-strong text-base font-semibold text-fg active:bg-line/60 disabled:opacity-40"
            >
              Rechazar
            </button>
            <button
              type="button"
              onClick={() => setDeciding('accepted')}
              disabled={a.status === 'accepted'}
              className="h-12 rounded-xl bg-primary text-base font-semibold text-white active:bg-primary-dark disabled:opacity-40"
            >
              Aceptar
            </button>
          </div>
        )}
        {failed && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.
          </p>
        )}
      </div>
    ) : undefined

  const p = a?.applicant
  const age = p ? ageFrom(p.birthDate) : null
  return (
    <BottomSheet open={!!a} title="Postulación" onClose={onClose} footer={footer}>
      {a && p && (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <Avatar name={p.fullName} photoURL={null} className="size-14 text-lg" />
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-xl font-bold text-fg">{p.fullName || 'Sin nombre'}</h3>
              <p className="truncate text-sm text-muted">{a.courseTitle}</p>
            </div>
            <ApplicationBadge status={a.status} />
          </div>

          {decided && a.providerNote && (
            <p className="rounded-xl bg-surface p-3 text-sm text-fg-soft ring-1 ring-line">
              <span className="font-semibold">Tu mensaje:</span> {a.providerNote}
            </p>
          )}

          <dl className="divide-y divide-line rounded-2xl border border-line">
            <Row label="Celular" value={p.phone} href={p.phone ? `tel:${p.phone.replace(/\s/g, '')}` : undefined} />
            <Row label="Correo" value={p.contactEmail} href={p.contactEmail ? `mailto:${p.contactEmail}` : undefined} />
            <Row label="Documento" value={[p.docType && p.docType.toUpperCase(), p.docNumber].filter(Boolean).join(' ')} />
            <Row label="Edad" value={age !== null ? `${age} años` : ''} />
            <Row label="rocketId" value={p.rocketId} />
          </dl>

          <div>
            <h4 className="px-1 text-sm font-semibold text-fg-soft">Certificaciones</h4>
            {p.certifications.length === 0 ? (
              <p className="mt-1 px-1 text-sm text-muted">
                {p.hasCertifications === 'no' ? 'Declaró no tener certificaciones.' : 'No compartió certificaciones.'}
              </p>
            ) : (
              <ul className="mt-1 divide-y divide-line rounded-2xl border border-line">
                {p.certifications.map((c) => (
                  <li key={c.certId || c.name} className="flex items-center gap-3 px-4 py-3">
                    <span aria-hidden="true">{categoryOf(c.category)?.icon ?? '🎓'}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-fg">{c.name}</span>
                      <span className="block truncate text-xs text-muted">{[c.issuer, c.year].filter(Boolean).join(' · ')}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="px-1 text-xs text-subtle">Datos compartidos al postular, con su consentimiento. No incluyen su ficha de salud.</p>
          {a.status === 'withdrawn' && <p className="rounded-xl bg-surface p-3 text-sm text-fg-soft ring-1 ring-line">La persona retiró su postulación.</p>}
          {!canDecide && <p className="px-1 text-sm text-muted">El formador está suspendido: no se pueden cambiar las postulaciones.</p>}
        </div>
      )}
    </BottomSheet>
  )
}

function Row({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <dt className="w-24 shrink-0 text-sm text-muted">{label}</dt>
      <dd className="min-w-0 flex-1 truncate text-sm text-fg">
        {!value ? (
          <span className="text-subtle">—</span>
        ) : href ? (
          <a href={href} className="font-medium text-primary-text underline underline-offset-2">
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  )
}

/** Invitaciones a equipos de formadores */
function Invites({ invites, onDone, toast }: { invites: Invite[]; onDone: (text: string) => void; toast?: ReactNode }) {
  const { user } = useAuth()
  const [busy, setBusy] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const act = async (i: Invite, accept: boolean) => {
    if (!user) return
    setBusy(i.providerId)
    setFailed(false)
    try {
      if (accept) await acceptInvite(user.uid, i)
      else await declineInvite(i)
      onDone(accept ? `Ahora eres parte de ${i.providerName}` : 'Invitación rechazada')
    } catch (e) {
      console.error('invite', e)
      setFailed(true)
    } finally {
      setBusy(null)
    }
  }
  return (
    <section aria-label="Invitaciones" className="space-y-2">
      {invites.map((i) => (
        <article key={i.providerId} className="rounded-2xl border border-primary/40 bg-primary/5 p-4">
          <p className="text-base font-semibold text-fg">
            {i.invitedByName || 'Alguien'} te invitó a {i.providerName}
          </p>
          <p className="mt-0.5 text-sm text-muted">
            Rol: {MEMBER_ROLES[i.role].label}. {MEMBER_ROLES[i.role].description}.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => act(i, false)}
              disabled={!!busy}
              className="h-12 rounded-xl border border-line-strong text-base font-semibold text-fg active:bg-line/60 disabled:opacity-50"
            >
              Rechazar
            </button>
            <button
              type="button"
              onClick={() => act(i, true)}
              disabled={!!busy}
              className="h-12 rounded-xl bg-primary text-base font-semibold text-white active:bg-primary-dark disabled:opacity-50"
            >
              {busy === i.providerId ? 'Guardando…' : 'Aceptar'}
            </button>
          </div>
        </article>
      ))}
      {failed && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          No se pudo completar. Revisa tu conexión e inténtalo de nuevo.
        </p>
      )}
      {toast}
    </section>
  )
}
