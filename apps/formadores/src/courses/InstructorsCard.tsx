import { useEffect, useState } from 'react'
import { MEMBER_ROLES, type Member } from '../../../../shared/domain/providers'
import { getPerson, setCourseInstructors, subscribeTeam, type Person } from '../../../../shared/teamsApi'
import { Card } from '../ui/form'

/**
 * Instructores asignados al curso: ven y gestionan sus postulaciones (desde el computador o
 * desde "Cursos que dictas" en el celular). Se guarda al marcar.
 */
export function InstructorsCard({ courseId, providerId, assigned, editable }: { courseId: string; providerId: string; assigned: string[]; editable: boolean }) {
  const [team, setTeam] = useState<Member[] | null>(null)
  const [people, setPeople] = useState<Record<string, Person | null>>({})
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => subscribeTeam(providerId, (list) => setTeam(list)), [providerId])
  const key = (team ?? []).map((m) => m.uid).join(',')
  useEffect(() => {
    if (!key) return
    let alive = true
    Promise.all(key.split(',').map(async (uid) => [uid, await getPerson(uid)] as const)).then((r) => alive && setPeople(Object.fromEntries(r)))
    return () => {
      alive = false
    }
  }, [key])

  const instructors = (team ?? []).filter((m) => m.role === 'instructor')
  const toggle = async (uid: string, on: boolean) => {
    setBusy(true)
    setFailed(false)
    try {
      await setCourseInstructors(courseId, on ? [...assigned, uid] : assigned.filter((x) => x !== uid))
    } catch (e) {
      console.error('instructors', e)
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card
      title="Instructores"
      description="Las personas asignadas ven y gestionan las postulaciones de este curso. Responsables y coordinación ya las ven todas."
    >
      {team === null ? (
        <div className="h-16 animate-pulse rounded-xl bg-line/60" aria-busy="true" />
      ) : instructors.length === 0 ? (
        <p className="text-sm text-muted">
          Aún no hay instructores en el equipo. Invítalos desde <span className="font-medium text-fg">Equipo</span> con el rol {MEMBER_ROLES.instructor.label}.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {instructors.map((m) => (
            <li key={m.uid}>
              <label className="flex min-h-12 cursor-pointer items-center gap-3 py-2">
                <input
                  type="checkbox"
                  checked={assigned.includes(m.uid)}
                  disabled={!editable || busy}
                  onChange={(e) => toggle(m.uid, e.target.checked)}
                  className="size-5 accent-primary"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-fg">{people[m.uid]?.displayName || 'Persona sin perfil público'}</span>
                  {people[m.uid]?.rocketId && <span className="block font-mono text-sm text-muted">{people[m.uid]?.rocketId}</span>}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {failed && (
        <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
          No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.
        </p>
      )}
    </Card>
  )
}
