import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import {
  COURSE_LIMITS,
  COURSE_STATUSES,
  courseToForm,
  emptyCourseForm,
  formatDateRange,
  formatPrice,
  hasCourseErrors,
  LEVELS,
  MODALITIES,
  validateCourse,
  type CourseForm,
  type CourseStatus,
  type ProviderCourse,
} from '../../../../shared/domain/courses'
import { categoryOf, SKILL_CATEGORIES } from '../../../../shared/domain/skills'
import { canPublish, createCourse, deleteCourse, newCourseId, setCourseStatus, subscribeCourse, updateCourse } from '../../../../shared/coursesApi'
import type { Membership } from '../../../../shared/providersApi'
import { useAuth } from '../auth/AuthProvider'
import { useMyProviders } from '../providers/MyProviders'
import { Badge, Card, dangerButton, Field, inputClass, primaryButton, secondaryButton, textareaClass } from '../ui/form'

/** /cursos/nuevo?f={providerId} y /cursos/{id} */
export function CourseEditorPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const { memberships } = useMyProviders()
  const [loaded, setLoaded] = useState<{ id: string; course: ProviderCourse | null } | null>(null)

  useEffect(() => {
    if (!id) return
    return subscribeCourse(id, (course) => setLoaded({ id, course }))
  }, [id])

  if (memberships === null || (id && loaded?.id !== id)) return <div className="h-96 animate-pulse rounded-2xl bg-line/60" aria-busy="true" />

  const course = id ? (loaded?.course ?? null) : null
  const pid = course?.providerId ?? params.get('f')
  const membership = memberships.find((m) => m.provider.id === pid)

  if ((id && !course) || !membership) {
    return (
      <div className="rounded-2xl border border-line bg-card p-8 text-center">
        <p className="font-semibold text-fg">No encontramos este curso</p>
        <p className="mt-1 text-muted">Puede que se haya eliminado o que pertenezca a otro formador.</p>
        <Link to="/cursos" className={`${secondaryButton} mt-6`}>
          Volver a Cursos
        </Link>
      </div>
    )
  }

  // Al llegar el curso por primera vez se monta el formulario con sus datos (key)
  return <Editor key={course?.id ?? 'new'} membership={membership} course={course} />
}

function Editor({ membership, course }: { membership: Membership; course: ProviderCourse | null }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const p = membership.provider
  const editable = (membership.role === 'owner' || membership.role === 'manager') && p.status === 'approved'
  const publishable = editable && canPublish(p)
  const initial = course ? courseToForm(course) : emptyCourseForm()
  const [f, setF] = useState<CourseForm>(initial)
  const [newId] = useState(newCourseId)
  const [tried, setTried] = useState<'draft' | 'publish' | null>(null)
  const [saving, setSaving] = useState<CourseStatus | 'delete' | null>(null)
  const { state: navState } = useLocation() as { state: { msg?: string } | null }
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(navState?.msg ? { ok: true, text: navState.msg } : null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const status: CourseStatus = course?.status ?? 'draft'
  const dirty = JSON.stringify(f) !== JSON.stringify(initial)

  // Aviso del navegador al cerrar con cambios sin guardar
  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  const errors = tried ? validateCourse(f, tried === 'publish') : {}
  const set = <K extends keyof CourseForm>(k: K, v: CourseForm[K]) => {
    setF((x) => ({ ...x, [k]: v }))
    setMsg(null)
  }

  const save = async (next: CourseStatus) => {
    const forPublish = next === 'published'
    setTried(forPublish ? 'publish' : 'draft')
    if (hasCourseErrors(validateCourse(f, forPublish)) || !user) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      return
    }
    setSaving(next)
    setMsg(null)
    try {
      if (course) await updateCourse(p, course.id, f, next)
      else await createCourse(user.uid, p, newId, f, next)
      const text =
        next === 'published' && status !== 'published'
          ? 'Curso publicado: ya aparece en la app de rocketId.'
          : next === 'closed' && status !== 'closed'
            ? 'Curso cerrado: ya no aparece en la app.'
            : next === 'draft' && !course
              ? 'Borrador guardado.'
              : 'Cambios guardados.'
      if (!course) navigate(`/cursos/${newId}`, { replace: true, state: { msg: text } })
      else setMsg({ ok: true, text })
    } catch (e) {
      console.error('save course', e)
      setMsg({ ok: false, text: 'No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.' })
    } finally {
      setSaving(null)
    }
  }

  const changeStatus = async (next: CourseStatus, text: string) => {
    if (!course) return
    if (next === 'published' && hasCourseErrors(validateCourse(courseToForm(course), true))) {
      setTried('publish')
      setMsg({ ok: false, text: 'Revisa los datos marcados antes de publicar.' })
      return
    }
    setSaving(next)
    try {
      await setCourseStatus(course.id, next)
      setMsg({ ok: true, text })
    } catch (e) {
      console.error('course status', e)
      setMsg({ ok: false, text: 'No se pudo actualizar. Revisa tu conexión e inténtalo de nuevo.' })
    } finally {
      setSaving(null)
    }
  }

  const remove = async () => {
    if (!course) return
    setSaving('delete')
    try {
      await deleteCourse(course.id)
      navigate('/cursos', { replace: true })
    } catch (e) {
      console.error('delete course', e)
      setMsg({ ok: false, text: 'No se pudo eliminar. Revisa tu conexión e inténtalo de nuevo.' })
      setSaving(null)
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    void save(status === 'draft' ? 'draft' : status)
  }

  const cat = f.category ? categoryOf(f.category) : null
  const L = COURSE_LIMITS
  const lock = !editable || !!saving

  return (
    <form onSubmit={submit} noValidate className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-6">
        <div>
          <Link to="/cursos" className="text-sm font-medium text-primary-text hover:underline">
            ‹ Volver a Cursos
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight text-fg">{course ? course.title || 'Curso sin título' : 'Nuevo curso'}</h2>
            {course && <Badge tone={COURSE_STATUSES[status].tone}>{COURSE_STATUSES[status].label}</Badge>}
          </div>
          <p className="mt-1 text-muted">{p.name}</p>
        </div>

        {!editable && (
          <p className="rounded-xl bg-sky-50 p-4 text-sky-900 dark:bg-sky-500/10 dark:text-sky-200">
            {p.status !== 'approved'
              ? 'Este formador no está aprobado: el curso se muestra en solo lectura.'
              : 'Solo lectura: crear y editar cursos lo hacen responsables y coordinación.'}
          </p>
        )}

        <fieldset disabled={lock} className="space-y-6">
          <Card title="El curso" description="Lo que verá la comunidad en el catálogo de la app.">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <Field label="Nombre del curso" hint="Por ejemplo: Primeros Auxilios en Áreas Remotas (WFA)" error={errors.title}>
                  {(a) => <input {...a} className={inputClass} value={f.title} maxLength={L.title} onChange={(e) => set('title', e.target.value)} />}
                </Field>
              </div>
              <Field label="Categoría" error={errors.category}>
                {(a) => (
                  <select {...a} className={inputClass} value={f.category} onChange={(e) => set('category', e.target.value as CourseForm['category'])}>
                    <option value="">Elige una categoría</option>
                    {SKILL_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.icon} {c.label}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label="Nivel">
                {(a) => (
                  <select {...a} className={inputClass} value={f.level} onChange={(e) => set('level', e.target.value as CourseForm['level'])}>
                    {LEVELS.map((l) => (
                      <option key={l}>{l}</option>
                    ))}
                  </select>
                )}
              </Field>
              <div className="md:col-span-2">
                <Field label="Resumen" hint={`${f.summary.length}/${L.summary} · Una línea que aparece en la tarjeta del curso`} error={errors.summary}>
                  {(a) => <input {...a} className={inputClass} value={f.summary} maxLength={L.summary} onChange={(e) => set('summary', e.target.value)} />}
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field
                  label="Descripción"
                  optional
                  hint={`${f.description.length}/${L.description} · Contenidos, metodología y qué aprenderán`}
                  error={errors.description}
                >
                  {(a) => (
                    <textarea
                      {...a}
                      className={`${textareaClass} min-h-40`}
                      value={f.description}
                      maxLength={L.description}
                      onChange={(e) => set('description', e.target.value)}
                    />
                  )}
                </Field>
              </div>
            </div>
          </Card>

          <Card title="Fechas y lugar">
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Inicio" error={errors.startDate}>
                {(a) => <input {...a} type="date" className={inputClass} value={f.startDate} onChange={(e) => set('startDate', e.target.value)} />}
              </Field>
              <Field label="Término" error={errors.endDate}>
                {(a) => (
                  <input
                    {...a}
                    type="date"
                    className={inputClass}
                    value={f.endDate}
                    min={f.startDate || undefined}
                    onChange={(e) => set('endDate', e.target.value)}
                  />
                )}
              </Field>
              <Field label="Duración" optional hint="Por ejemplo: 2 días · 16 horas" error={errors.duration}>
                {(a) => <input {...a} className={inputClass} value={f.duration} maxLength={L.duration} onChange={(e) => set('duration', e.target.value)} />}
              </Field>
              <Field label="Modalidad">
                {(a) => (
                  <select {...a} className={inputClass} value={f.modality} onChange={(e) => set('modality', e.target.value as CourseForm['modality'])}>
                    {MODALITIES.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <div className="md:col-span-2">
                <Field
                  label={f.modality === 'online' ? 'Plataforma' : 'Lugar'}
                  hint={f.modality === 'online' ? 'Por ejemplo: Zoom' : 'Por ejemplo: Cajón del Maipo, Región Metropolitana'}
                  error={errors.location}
                >
                  {(a) => <input {...a} className={inputClass} value={f.location} maxLength={L.location} onChange={(e) => set('location', e.target.value)} />}
                </Field>
              </div>
            </div>
          </Card>

          <Card title="Cupos, valor y requisitos">
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Cupos" error={errors.spots}>
                {(a) => (
                  <input {...a} inputMode="numeric" className={inputClass} value={f.spots} onChange={(e) => set('spots', e.target.value.replace(/\D/g, ''))} />
                )}
              </Field>
              <Field
                label="Valor (CLP)"
                hint={f.price.trim() && !errors.price ? formatPrice(Number(f.price) || 0) : 'Déjalo vacío o en 0 si es gratuito'}
                error={errors.price}
              >
                {(a) => (
                  <input {...a} inputMode="numeric" className={inputClass} value={f.price} onChange={(e) => set('price', e.target.value.replace(/\D/g, ''))} />
                )}
              </Field>
              <div className="md:col-span-2">
                <Field label="Requisitos" optional hint={`Uno por línea, hasta ${L.requirements}`} error={errors.requirements}>
                  {(a) => (
                    <textarea
                      {...a}
                      className={textareaClass}
                      value={f.requirements}
                      placeholder={'Mayor de 16 años\nRopa para trabajar en exterior'}
                      onChange={(e) => set('requirements', e.target.value)}
                    />
                  )}
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="Certificación que entrega" optional hint="Por ejemplo: Certificado WFA con vigencia de 2 años" error={errors.certification}>
                  {(a) => (
                    <input
                      {...a}
                      className={inputClass}
                      value={f.certification}
                      maxLength={L.certification}
                      onChange={(e) => set('certification', e.target.value)}
                    />
                  )}
                </Field>
              </div>
            </div>
          </Card>
        </fieldset>

        {msg && (
          <p
            role={msg.ok ? 'status' : 'alert'}
            className={`rounded-xl p-4 ${msg.ok ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200' : 'bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200'}`}
          >
            {msg.ok ? '✓ ' : ''}
            {msg.text}
          </p>
        )}

        {editable && (
          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
            {status === 'draft' ? (
              <>
                <button type="button" onClick={() => save('published')} disabled={!!saving || !publishable} className={primaryButton}>
                  {saving === 'published' ? 'Publicando…' : 'Publicar'}
                </button>
                <button type="button" onClick={() => save('draft')} disabled={!!saving} className={secondaryButton}>
                  {saving === 'draft' ? 'Guardando…' : 'Guardar borrador'}
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => save(status)} disabled={!!saving || !dirty} className={primaryButton}>
                  {saving === status ? 'Guardando…' : 'Guardar cambios'}
                </button>
                {status === 'published' ? (
                  <button
                    type="button"
                    onClick={() => changeStatus('closed', 'Curso cerrado: ya no aparece en la app.')}
                    disabled={!!saving || dirty}
                    className={secondaryButton}
                  >
                    {saving === 'closed' ? 'Cerrando…' : 'Cerrar curso'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => changeStatus('published', 'Curso publicado otra vez.')}
                    disabled={!!saving || dirty || !publishable}
                    className={secondaryButton}
                  >
                    {saving === 'published' ? 'Publicando…' : 'Volver a publicar'}
                  </button>
                )}
              </>
            )}
            {status === 'draft' && course && (
              <div className="ml-auto">
                {confirmDelete ? (
                  <span className="flex items-center gap-2">
                    <span className="text-sm text-fg">¿Eliminar el borrador?</span>
                    <button type="button" onClick={() => setConfirmDelete(false)} className={secondaryButton}>
                      No
                    </button>
                    <button
                      type="button"
                      onClick={remove}
                      disabled={!!saving}
                      className="inline-flex h-11 items-center rounded-xl bg-red-600 px-4 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                    >
                      {saving === 'delete' ? 'Eliminando…' : 'Eliminar'}
                    </button>
                  </span>
                ) : (
                  <button type="button" onClick={() => setConfirmDelete(true)} className={dangerButton}>
                    Eliminar borrador
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        {editable && status !== 'draft' && dirty && <p className="text-sm text-muted">Guarda los cambios antes de cerrar o publicar el curso.</p>}
        {editable && !publishable && <p className="text-sm text-muted">Tu certificación venció: puedes guardar borradores, pero no publicar.</p>}
      </div>

      {/* Vista previa: cómo se verá en la app de rocketId */}
      <aside className="xl:sticky xl:top-6 xl:self-start">
        <p className="mb-2 px-1 text-sm font-medium text-muted">Vista previa en la app</p>
        <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
          <div className="flex items-start gap-3 p-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-2xl" aria-hidden="true">
              {cat?.icon ?? '🎓'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="leading-snug font-semibold text-fg">{f.title.trim() || 'Nombre del curso'}</p>
              <p className="mt-0.5 flex items-center gap-1 text-sm text-muted">
                <span className="truncate">{p.name}</span>
                <span className="text-primary-text" aria-label="verificado">
                  ✓
                </span>
              </p>
            </div>
          </div>
          {f.summary.trim() && <p className="px-4 pb-3 text-sm text-fg-soft">{f.summary.trim()}</p>}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line px-4 py-3 text-sm text-muted">
            <span>📅 {f.startDate && f.endDate && f.endDate >= f.startDate ? formatDateRange(f.startDate, f.endDate) : 'Fechas'}</span>
            <span>📍 {f.modality === 'online' ? 'Online' : f.location.split(',')[0].trim() || 'Lugar'}</span>
            <span className="ml-auto font-semibold text-fg">{formatPrice(Number(f.price) || 0)}</span>
          </div>
        </div>
        <p className="mt-3 px-1 text-xs text-subtle">
          Las personas postulan desde la app compartiendo sus datos con tu consentimiento. Podrás verlas en Postulaciones.
        </p>
      </aside>
    </form>
  )
}
