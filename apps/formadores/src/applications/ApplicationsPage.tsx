import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ageFrom, decideApplication, markApplicationSeen, subscribeProviderApplications, type ProviderApplication } from '../../../../shared/applicationsApi'
import { APPLICATION_STATUSES, type ApplicationStatus } from '../../../../shared/domain/courses'
import { categoryOf } from '../../../../shared/domain/skills'
import { useAuth } from '../auth/AuthProvider'
import { ProviderPicker } from '../courses/ProviderPicker'
import { useCourseProvider } from '../courses/useCourseProvider'
import { Badge, primaryButton, secondaryButton, textareaClass } from '../ui/form'
import { InboxIcon } from '../ui/icons'

type Filter = 'all' | ApplicationStatus
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'sent', label: 'Nuevas' },
  { value: 'seen', label: 'Vistas' },
  { value: 'accepted', label: 'Aceptadas' },
  { value: 'rejected', label: 'Rechazadas' },
  { value: 'all', label: 'Todas' },
]
const short = (d: Date | null) => (d ? d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }) : '—')

export function ApplicationsPage() {
  const cp = useCourseProvider()
  const [params, setParams] = useSearchParams()
  const pid = cp.current?.provider.id ?? null
  const canSee = !!cp.current && (cp.current.role === 'owner' || cp.current.role === 'manager')
  const [state, setState] = useState<{ pid: string | null; list: ProviderApplication[] | null; error: boolean }>({ pid: null, list: null, error: false })
  const [filter, setFilter] = useState<Filter>('sent')
  const course = params.get('curso') ?? 'all'
  const openId = params.get('p')

  useEffect(() => {
    if (!pid || !canSee) return
    return subscribeProviderApplications(pid, (list, e) => {
      if (e) console.error('applications', e)
      setState({ pid, list, error: !!e })
    })
  }, [pid, canSee])

  const list = state.pid === pid ? state.list : null
  const courses = useMemo(() => {
    const m = new Map<string, { title: string; count: number; fresh: number }>()
    for (const a of list ?? []) {
      const c = m.get(a.courseId) ?? { title: a.courseTitle, count: 0, fresh: 0 }
      c.count++
      if (a.status === 'sent') c.fresh++
      m.set(a.courseId, c)
    }
    return [...m.entries()].sort((a, b) => a[1].title.localeCompare(b[1].title, 'es'))
  }, [list])
  const inCourse = (list ?? []).filter((a) => course === 'all' || a.courseId === course)
  const counts = Object.fromEntries(FILTERS.map((f) => [f.value, inCourse.filter((a) => f.value === 'all' || a.status === f.value).length]))
  const shown = inCourse.filter((a) => filter === 'all' || a.status === filter)
  const open = (list ?? []).find((a) => a.id === openId) ?? null

  const setParam = (k: string, v: string | null) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p)
        if (v === null) n.delete(k)
        else n.set(k, v)
        return n
      },
      { replace: true },
    )

  if (cp.loading) return <div className="h-80 animate-pulse rounded-2xl bg-line/60" aria-busy="true" />
  if (!cp.current)
    return (
      <Empty
        title="Aún no tienes postulaciones"
        text="Cuando tu registro de formador esté aprobado y publiques cursos, aquí verás quién postula."
        action={
          <Link to="/" className={`${primaryButton} mt-6`}>
            Ir al inicio
          </Link>
        }
      />
    )

  return (
    <div className="space-y-6">
      <ProviderPicker options={cp.options} current={cp.current} onChoose={cp.choose} />

      {!canSee ? (
        <Empty title="Sin acceso a postulaciones" text="Las postulaciones las gestionan responsables y coordinación del formador." />
      ) : state.error && state.pid === pid ? (
        <p role="alert" className="rounded-xl bg-amber-50 p-4 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          No pudimos cargar las postulaciones. Revisa tu conexión y recarga la página.
        </p>
      ) : list === null ? (
        <div className="h-80 animate-pulse rounded-2xl bg-line/60" aria-busy="true" />
      ) : list.length === 0 ? (
        <Empty
          title="Aún no hay postulaciones"
          text="Cuando alguien postule a uno de tus cursos publicados, aparecerá aquí con los datos que compartió."
          action={
            <Link to="/cursos" className={`${secondaryButton} mt-6`}>
              Ver mis cursos
            </Link>
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <label className="sr-only" htmlFor="app-course">
              Curso
            </label>
            <select
              id="app-course"
              value={course}
              onChange={(e) => setParam('curso', e.target.value === 'all' ? null : e.target.value)}
              className="h-10 max-w-80 rounded-full border border-line-strong bg-card px-4 text-sm font-medium text-fg"
            >
              <option value="all">Todos los cursos · {list.length}</option>
              {courses.map(([id, c]) => (
                <option key={id} value={id}>
                  {c.title} · {c.count}
                  {c.fresh ? ` (${c.fresh} nuevas)` : ''}
                </option>
              ))}
            </select>
            <div role="tablist" aria-label="Estado" className="flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  role="tab"
                  aria-selected={filter === f.value}
                  onClick={() => setFilter(f.value)}
                  className={`h-10 rounded-full px-4 text-sm font-medium transition ${
                    filter === f.value ? 'bg-primary text-white' : 'bg-card text-fg-soft ring-1 ring-line hover:bg-surface'
                  }`}
                >
                  {f.label} · {counts[f.value]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
            <section aria-label="Postulaciones" className="overflow-hidden rounded-2xl border border-line bg-card lg:self-start">
              {shown.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-muted">No hay postulaciones con este filtro.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {shown.map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => setParam('p', a.id)}
                        aria-current={a.id === openId ? 'true' : undefined}
                        className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition hover:bg-surface ${a.id === openId ? 'bg-primary/10' : ''}`}
                      >
                        {a.status === 'sent' ? (
                          <span className="mt-2 size-2.5 shrink-0 rounded-full bg-primary" aria-label="Nueva" />
                        ) : (
                          <span className="mt-2 size-2.5 shrink-0" aria-hidden="true" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className={`block truncate ${a.status === 'sent' ? 'font-semibold text-fg' : 'font-medium text-fg'}`}>
                            {a.applicant.fullName || 'Sin nombre'}
                          </span>
                          <span className="block truncate text-sm text-muted">{a.courseTitle}</span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          <span className="text-xs text-subtle">{short(a.createdAt)}</span>
                          <Badge tone={APPLICATION_STATUSES[a.status].tone}>{APPLICATION_STATUSES[a.status].label}</Badge>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {open ? (
              <ApplicationDetail key={open.id} a={open} providerName={cp.current.provider.name} canDecide={cp.current.provider.status === 'approved'} />
            ) : (
              <div className="hidden items-center justify-center rounded-2xl border border-dashed border-line-strong p-10 text-center text-muted lg:flex">
                Elige una postulación para ver los datos de la persona.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function ApplicationDetail({ a, providerName, canDecide }: { a: ProviderApplication; providerName: string; canDecide: boolean }) {
  const { user } = useAuth()
  const [deciding, setDeciding] = useState<'accepted' | 'rejected' | null>(null)
  const [note, setNote] = useState(a.providerNote)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const p = a.applicant
  const age = ageFrom(p.birthDate)
  const decided = a.status === 'accepted' || a.status === 'rejected'

  // Abrirla la marca como vista (la persona ve "Vista" en su app)
  useEffect(() => {
    if (user && canDecide && a.status === 'sent') markApplicationSeen(user.uid, a).catch((e) => console.warn('seen', e))
  }, [user, canDecide, a])

  const decide = async () => {
    if (!user || !deciding) return
    setBusy(true)
    setMsg(null)
    try {
      await decideApplication(user.uid, providerName, a, deciding, note)
      setMsg({ ok: true, text: deciding === 'accepted' ? 'Postulación aceptada. Le avisamos en su app.' : 'Postulación rechazada. Le avisamos en su app.' })
      setDeciding(null)
    } catch (e) {
      console.error('decide', e)
      setMsg({ ok: false, text: 'No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <article aria-label={`Postulación de ${p.fullName}`} className="rounded-2xl border border-line bg-card p-6 lg:self-start">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-fg">{p.fullName || 'Sin nombre'}</h2>
          <p className="mt-0.5 text-sm text-muted">
            {p.rocketId && <span className="font-mono">{p.rocketId}</span>}
            {p.rocketId && ' · '}
            Postuló el {a.createdAt ? a.createdAt.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
          </p>
          <p className="mt-1 text-sm font-medium text-fg-soft">{a.courseTitle}</p>
        </div>
        <Badge tone={APPLICATION_STATUSES[a.status].tone}>{APPLICATION_STATUSES[a.status].label}</Badge>
      </div>

      <dl className="mt-6 grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
        <Item label="Correo" value={p.contactEmail} href={p.contactEmail ? `mailto:${p.contactEmail}` : undefined} />
        <Item label="Celular" value={p.phone} href={p.phone ? `tel:${p.phone.replace(/\s/g, '')}` : undefined} />
        <Item label="Documento" value={[p.docType && p.docType.toUpperCase(), p.docNumber].filter(Boolean).join(' ')} />
        <Item
          label="Fecha de nacimiento"
          value={p.birthDate ? `${new Date(`${p.birthDate}T00:00:00`).toLocaleDateString('es-CL')}${age !== null ? ` · ${age} años` : ''}` : ''}
        />
      </dl>

      <h3 className="mt-6 text-sm font-semibold text-fg-soft">Certificaciones que declaró</h3>
      {p.certifications.length === 0 ? (
        <p className="mt-1 text-sm text-muted">{p.hasCertifications === 'no' ? 'Declaró no tener certificaciones.' : 'No compartió certificaciones.'}</p>
      ) : (
        <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
          {p.certifications.map((c) => (
            <li key={c.certId || c.name} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span aria-hidden="true">{categoryOf(c.category)?.icon ?? '🎓'}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-fg">{c.name}</span>
                <span className="block truncate text-muted">{[c.issuer, c.year, c.expiresAt && `vence ${c.expiresAt}`].filter(Boolean).join(' · ')}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-subtle">
        Datos compartidos por la persona al postular, con su consentimiento. Úsalos solo para gestionar este curso. No incluyen su ficha de salud.
      </p>

      <div className="mt-6 space-y-4 border-t border-line pt-6">
        {decided && a.providerNote && !deciding && (
          <p className="rounded-xl bg-surface p-3 text-sm text-fg-soft">
            <span className="font-semibold">Tu mensaje:</span> {a.providerNote}
          </p>
        )}
        {!canDecide ? (
          <p className="text-sm text-muted">El formador no está aprobado: no se pueden cambiar las postulaciones.</p>
        ) : deciding ? (
          <div className="space-y-3">
            <label htmlFor="app-note" className="text-sm font-medium text-fg-soft">
              Mensaje para la persona <span className="font-normal text-subtle">(opcional)</span>
            </label>
            <textarea
              id="app-note"
              className={textareaClass}
              value={note}
              maxLength={500}
              autoFocus
              placeholder={
                deciding === 'accepted'
                  ? 'Por ejemplo: te esperamos el sábado a las 9:00 en…'
                  : 'Por ejemplo: el curso se llenó; te avisaremos de la próxima fecha.'
              }
              onChange={(e) => setNote(e.target.value)}
            />
            <p className="text-xs text-subtle">Lo verá en su app junto al estado de la postulación.</p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={decide}
                disabled={busy}
                className={
                  deciding === 'accepted'
                    ? primaryButton
                    : 'inline-flex h-11 items-center justify-center rounded-xl bg-red-600 px-5 font-semibold text-white hover:bg-red-700 disabled:opacity-60'
                }
              >
                {busy ? 'Guardando…' : deciding === 'accepted' ? 'Aceptar postulación' : 'Rechazar postulación'}
              </button>
              <button type="button" onClick={() => setDeciding(null)} disabled={busy} className={secondaryButton}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {a.status !== 'accepted' && (
              <button type="button" onClick={() => setDeciding('accepted')} className={primaryButton}>
                {decided ? 'Cambiar a aceptada' : 'Aceptar'}
              </button>
            )}
            {a.status !== 'rejected' && (
              <button type="button" onClick={() => setDeciding('rejected')} className={secondaryButton}>
                {decided ? 'Cambiar a rechazada' : 'Rechazar'}
              </button>
            )}
          </div>
        )}
        {msg && (
          <p role={msg.ok ? 'status' : 'alert'} className={`text-sm ${msg.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {msg.ok ? '✓ ' : ''}
            {msg.text}
          </p>
        )}
      </div>
    </article>
  )
}

function Item({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted">{label}</dt>
      <dd className="truncate font-medium text-fg">
        {!value ? (
          <span className="text-subtle">—</span>
        ) : href ? (
          <a href={href} className="text-primary-text underline underline-offset-2">
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  )
}

function Empty({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <section className="flex flex-col items-center rounded-2xl border border-dashed border-line-strong px-6 py-20 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary-text">
        <InboxIcon className="size-7" />
      </span>
      <h2 className="mt-5 text-lg font-semibold text-fg">{title}</h2>
      <p className="mt-2 max-w-md text-muted">{text}</p>
      {action}
    </section>
  )
}
