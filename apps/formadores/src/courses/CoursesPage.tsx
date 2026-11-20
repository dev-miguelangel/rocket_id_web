import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { COURSE_STATUSES, formatDateRange, formatPrice, type CourseStatus, type ProviderCourse } from '../../../../shared/domain/courses'
import { categoryOf } from '../../../../shared/domain/skills'
import { canPublish, subscribeProviderCourses } from '../../../../shared/coursesApi'
import { Badge, primaryButton } from '../ui/form'
import { BookIcon } from '../ui/icons'
import { ProviderPicker } from './ProviderPicker'
import { useCourseProvider } from './useCourseProvider'

type Filter = 'all' | CourseStatus

export function CoursesPage() {
  const cp = useCourseProvider()
  const navigate = useNavigate()
  const pid = cp.current?.provider.id ?? null
  const [state, setState] = useState<{ pid: string | null; list: ProviderCourse[] | null; error: boolean }>({ pid: null, list: null, error: false })
  const [filter, setFilter] = useState<Filter>('all')

  useEffect(() => {
    if (!pid) return
    return subscribeProviderCourses(pid, (list, e) => {
      if (e) console.error('courses', e)
      setState({ pid, list, error: !!e })
    })
  }, [pid])

  const list = state.pid === pid ? state.list : null
  const counts = useMemo(() => {
    const c = { all: 0, draft: 0, published: 0, closed: 0 }
    for (const x of list ?? []) {
      c.all++
      c[x.status]++
    }
    return c
  }, [list])
  const shown = (list ?? []).filter((c) => filter === 'all' || c.status === filter)

  if (cp.loading) return <div className="h-80 animate-pulse rounded-2xl bg-line/60" aria-busy="true" />
  if (!cp.current) return <NoApprovedProvider pending={cp.memberships.some((m) => m.provider.status === 'pending' || m.provider.status === 'rejected')} />

  const p = cp.current.provider
  const publishable = canPublish(p)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <ProviderPicker options={cp.options} current={cp.current} onChoose={cp.choose} />
        {cp.canEdit && publishable && (
          <Link to={`/cursos/nuevo?f=${p.id}`} className={primaryButton}>
            <span aria-hidden="true">＋</span> Nuevo curso
          </Link>
        )}
      </div>

      {p.status === 'suspended' && (
        <p className="rounded-xl bg-zinc-100 p-4 text-zinc-900 dark:bg-zinc-500/15 dark:text-zinc-100">
          Este formador está suspendido: sus cursos no se muestran a la comunidad y no se pueden editar.
        </p>
      )}
      {p.status === 'approved' && !publishable && (
        <p className="rounded-xl bg-amber-50 p-4 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          Tu certificación venció: tus cursos no se muestran hasta que la renueves. Escribe a la administración de rocketId con el nuevo respaldo.
        </p>
      )}
      {!cp.canEdit && p.status === 'approved' && (
        <p className="rounded-xl bg-sky-50 p-4 text-sky-900 dark:bg-sky-500/10 dark:text-sky-200">
          Como instructor puedes ver los cursos. Crearlos y editarlos lo hacen responsables y coordinación.
        </p>
      )}

      <div role="tablist" aria-label="Filtrar cursos" className="flex flex-wrap gap-2">
        {(['all', 'published', 'draft', 'closed'] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={`h-10 rounded-full px-4 text-sm font-medium transition ${
              filter === f ? 'bg-primary text-white' : 'bg-card text-fg-soft ring-1 ring-line hover:bg-surface'
            }`}
          >
            {f === 'all' ? 'Todos' : COURSE_STATUSES[f].label + (f === 'draft' ? 'es' : 's')} · {counts[f]}
          </button>
        ))}
      </div>

      {state.error && state.pid === pid ? (
        <p role="alert" className="rounded-xl bg-amber-50 p-4 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          No pudimos cargar los cursos. Revisa tu conexión y recarga la página.
        </p>
      ) : list === null ? (
        <div className="h-64 animate-pulse rounded-2xl bg-line/60" aria-busy="true" />
      ) : shown.length === 0 ? (
        <section className="flex flex-col items-center rounded-2xl border border-dashed border-line-strong px-6 py-16 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary-text">
            <BookIcon className="size-7" />
          </span>
          <h2 className="mt-5 text-lg font-semibold text-fg">{list.length === 0 ? 'Aún no tienes cursos' : 'No hay cursos con este estado'}</h2>
          {list.length === 0 && (
            <p className="mt-2 max-w-md text-muted">
              Crea tu primer curso: puedes guardarlo como borrador y publicarlo cuando esté listo. Al publicarlo aparece en la app de rocketId.
            </p>
          )}
        </section>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-card">
          <table className="w-full min-w-[46rem] text-left text-sm">
            <thead className="border-b border-line text-muted">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">
                  Curso
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Fechas
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Lugar
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Cupos
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Valor
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((c) => (
                <tr key={c.id} onClick={() => navigate(`/cursos/${c.id}`)} className="cursor-pointer transition hover:bg-surface">
                  <td className="px-5 py-3.5">
                    <Link to={`/cursos/${c.id}`} className="flex items-center gap-3 font-semibold text-fg" onClick={(e) => e.stopPropagation()}>
                      <span className="text-xl" aria-hidden="true">
                        {categoryOf(c.category)?.icon}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate">{c.title}</span>
                        <span className="block text-xs font-normal text-muted">{categoryOf(c.category)?.short}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap text-fg-soft">{formatDateRange(c.startDate, c.endDate)}</td>
                  <td className="max-w-48 truncate px-4 py-3.5 text-fg-soft">{c.modality === 'online' ? 'Online' : c.location}</td>
                  <td className="px-4 py-3.5 text-right text-fg-soft tabular-nums">{c.spots}</td>
                  <td className="px-4 py-3.5 text-right whitespace-nowrap text-fg-soft tabular-nums">{formatPrice(c.priceCLP)}</td>
                  <td className="px-5 py-3.5">
                    <Badge tone={COURSE_STATUSES[c.status].tone}>{COURSE_STATUSES[c.status].label}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function NoApprovedProvider({ pending }: { pending: boolean }) {
  return (
    <section className="flex flex-col items-center rounded-2xl border border-dashed border-line-strong px-6 py-20 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary-text">
        <BookIcon className="size-7" />
      </span>
      <h2 className="mt-5 text-lg font-semibold text-fg">{pending ? 'Tu solicitud aún no está aprobada' : 'Primero regístrate como formador'}</h2>
      <p className="mt-2 max-w-md text-muted">
        {pending
          ? 'Podrás crear y publicar cursos cuando la administración de rocketId apruebe tu solicitud.'
          : 'Para publicar cursos necesitas un registro de formador aprobado por la administración de rocketId.'}
      </p>
      <Link to="/" className={`${primaryButton} mt-6`}>
        {pending ? 'Ver mi solicitud' : 'Registrarme como formador'}
      </Link>
    </section>
  )
}
