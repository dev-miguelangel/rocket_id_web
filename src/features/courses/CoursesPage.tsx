import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Segmented } from '../../components/form'
import { SwipeRow } from '../../components/SwipeRow'
import { useAuth } from '../auth/AuthProvider'
import { subscribeProfile } from '../profile/profileApi'
import { emptyProfile, type ProfileForm } from '../profile/schema'
import { SKILL_CATEGORIES, categoryOf, emptySkills, type CategoryId, type SkillsData } from '../skills/schema'
import { subscribeSkills } from '../skills/skillsApi'
import { subscribeMyApplications } from './applicationsApi'
import { CourseSheet } from './CourseSheet'
import { MOCK_COURSES } from './mockCourses'
import { ApplicationBadge, ProviderLine } from './parts'
import { formatDateRange, formatPrice, type Application, type Course } from './schema'

type Tab = 'explore' | 'mine'

export function CoursesPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('explore')
  const [filter, setFilter] = useState<CategoryId | 'all'>('all')
  const [selected, setSelected] = useState<Course | null>(null)
  const [startStep, setStartStep] = useState<'detail' | 'consent'>('detail')
  const open = (c: Course, step: 'detail' | 'consent' = 'detail') => {
    setStartStep(step)
    setSelected(c)
  }
  const [apps, setApps] = useState<Application[] | null>(null)
  const [profile, setProfile] = useState<ProfileForm>(emptyProfile)
  const [skills, setSkills] = useState<SkillsData>(emptySkills)

  useEffect(() => {
    if (!user) return
    const u1 = subscribeMyApplications(user.uid, setApps)
    const u2 = subscribeProfile(user.uid, (p, defaults) =>
      setProfile({ ...p, fullName: p.fullName || defaults.name, contactEmail: p.contactEmail || defaults.email }),
    )
    const u3 = subscribeSkills(user.uid, setSkills)
    return () => {
      u1()
      u2()
      u3()
    }
  }, [user])

  const appByCourse = useMemo(() => new Map((apps ?? []).map((a) => [a.courseId, a])), [apps])
  const usedCategories = SKILL_CATEGORIES.filter((c) => MOCK_COURSES.some((m) => m.category === c.id))

  const courses = useMemo(() => {
    const base = tab === 'mine' ? MOCK_COURSES.filter((c) => appByCourse.has(c.id)) : MOCK_COURSES
    const filtered = filter === 'all' ? base : base.filter((c) => c.category === filter)
    return [...filtered].sort((a, b) => a.startDate.localeCompare(b.startDate))
  }, [tab, filter, appByCourse])

  const close = useCallback(() => setSelected(null), [])

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-start gap-3 rounded-2xl border border-sky-300 bg-sky-50 p-3 text-sm text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200">
        <span aria-hidden="true">🧪</span>
        <p>
          <strong className="font-semibold">Cursos de demostración.</strong> Las instituciones y cursos de esta lista son ficticios mientras
          desarrollamos la app para instituciones.
        </p>
      </div>

      <Segmented
        label="Ver"
        value={tab}
        options={[
          { value: 'explore', label: 'Explorar' },
          { value: 'mine', label: `Mis postulaciones${apps?.length ? ` (${apps.length})` : ''}` },
        ]}
        onChange={setTab}
      />

      {/* Filtros por área: carrusel horizontal */}
      <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Filtrar por área">
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
          Todos
        </FilterChip>
        {usedCategories.map((c) => (
          <FilterChip key={c.id} active={filter === c.id} onClick={() => setFilter(c.id)}>
            {c.icon} {c.short}
          </FilterChip>
        ))}
      </div>

      {apps === null ? (
        <ListSkeleton />
      ) : courses.length === 0 ? (
        <EmptyState mine={tab === 'mine'} onExplore={() => setTab('explore')} />
      ) : (
        <ul className="space-y-3">
          {courses.map((c) => (
            <li key={c.id}>
              <SwipeRow
                className="rounded-2xl"
                leading={
                  appByCourse.has(c.id)
                    ? [{ key: 'view', label: 'Ver', icon: '👁', tone: 'primary', onClick: () => open(c) }]
                    : [{ key: 'apply', label: 'Postular', icon: '✍️', tone: 'primary', onClick: () => open(c, 'consent') }]
                }
              >
                <CourseCard course={c} application={appByCourse.get(c.id)} onOpen={() => open(c)} />
              </SwipeRow>
            </li>
          ))}
        </ul>
      )}

      <CourseSheet
        course={selected}
        application={selected ? appByCourse.get(selected.id) : undefined}
        profile={profile}
        skills={skills}
        onClose={close}
        initialStep={startStep}
      />
    </div>
  )
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`h-11 shrink-0 snap-start rounded-full border px-4 text-sm font-medium whitespace-nowrap transition active:scale-[0.97] ${
        active ? 'border-primary bg-primary text-white' : 'border-line-strong bg-card text-fg'
      }`}
    >
      {children}
    </button>
  )
}

function CourseCard({ course, application, onOpen }: { course: Course; application?: Application; onOpen: () => void }) {
  const cat = categoryOf(course.category)
  return (
    <button
      type="button"
      onClick={onOpen}
      className="block w-full overflow-hidden rounded-2xl border border-line bg-card text-left shadow-sm transition active:scale-[0.99]"
    >
      <div className="flex items-start gap-3 p-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-2xl" aria-hidden="true">
          {cat?.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base leading-snug font-semibold text-fg">{course.title}</p>
          <ProviderLine provider={course.provider} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line px-4 py-3 text-sm text-muted">
        <span>📅 {formatDateRange(course.startDate, course.endDate)}</span>
        <span>📍 {course.modality === 'online' ? 'Online' : course.location.split(',')[0]}</span>
        <span className="ml-auto font-semibold text-fg">{formatPrice(course.priceCLP)}</span>
      </div>
      {application && (
        <div className="flex items-center justify-between border-t border-line bg-surface px-4 py-2.5 text-sm">
          <span className="text-muted">Tu postulación</span>
          <ApplicationBadge status={application.status} />
        </div>
      )}
    </button>
  )
}

function EmptyState({ mine, onExplore }: { mine: boolean; onExplore: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line-strong bg-card px-6 py-12 text-center">
      <div className="text-4xl" aria-hidden="true">{mine ? '📭' : '🔎'}</div>
      <p className="mt-3 font-semibold text-fg">{mine ? 'Aún no postulas a cursos' : 'No hay cursos en esta área'}</p>
      <p className="mt-1 text-sm text-muted">{mine ? 'Explora los cursos disponibles y postula.' : 'Prueba con otra área.'}</p>
      {mine && (
        <button type="button" onClick={onExplore} className="mt-4 h-11 rounded-xl bg-primary px-5 font-semibold text-white active:bg-primary-dark">
          Explorar cursos
        </button>
      )}
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Cargando cursos">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-36 animate-pulse rounded-2xl bg-line" />
      ))}
    </div>
  )
}
