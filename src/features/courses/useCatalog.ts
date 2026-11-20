import { doc, getDoc, onSnapshot } from 'firebase/firestore'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { parseCourse } from '../../../shared/domain/courses'
import { subscribePublishedCourses } from '../../../shared/coursesApi'
import { db } from '../../lib/firebase'
import { MOCK_COURSES } from './mockCourses'
import type { Course } from './schema'

/**
 * Catálogo de cursos: los publicados por formadores aprobados (Firestore) más los de demostración,
 * que la administración puede ocultar desde el panel (config/app.demoCourses).
 * Una sola suscripción compartida por toda la app.
 */
const DEMO: Course[] = MOCK_COURSES.map((c) => ({ ...c, demo: true }))

let demoOn = true
let real: Course[] = []
let snapshot: Course[] = DEMO
const listeners = new Set<() => void>()
let unsubs: (() => void)[] = []

function rebuild() {
  snapshot = [...real, ...(demoOn ? DEMO : [])].sort((a, b) => a.startDate.localeCompare(b.startDate))
  listeners.forEach((l) => l())
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  if (!unsubs.length) {
    unsubs = [
      onSnapshot(
        doc(db, 'config', 'app'),
        (s) => {
          demoOn = s.data()?.demoCourses !== false
          rebuild()
        },
        () => {},
      ),
      subscribePublishedCourses((list) => {
        real = list
        rebuild()
      }),
    ]
  }
  return () => {
    listeners.delete(cb)
    if (!listeners.size) {
      unsubs.forEach((u) => u())
      unsubs = []
    }
  }
}

export const useCatalog = (): Course[] => useSyncExternalStore(subscribe, () => snapshot)

/**
 * Cursos a los que la persona postuló y que ya no están en el catálogo (por ejemplo, porque se cerraron).
 * Las reglas permiten leer un curso a quien tiene una postulación a él.
 */
const appliedCache = new Map<string, Course | null>()

export function useAppliedCourses(courseIds: string[], catalog: Course[]): Course[] {
  const inCatalog = new Set(catalog.map((c) => c.id))
  const missing = courseIds.filter((id) => !inCatalog.has(id) && !id.startsWith('demo-'))
  const key = [...new Set(missing)].sort().join(',')
  const [, bump] = useState(0)

  useEffect(() => {
    if (!key) return
    let alive = true
    const todo = key.split(',').filter((id) => !appliedCache.has(id))
    Promise.all(
      todo.map((id) =>
        getDoc(doc(db, 'courses', id))
          .then((s) => appliedCache.set(id, s.exists() ? parseCourse(s.id, s.data()) : null))
          .catch(() => appliedCache.set(id, null)),
      ),
    ).then(() => alive && todo.length && bump((n) => n + 1))
    return () => {
      alive = false
    }
  }, [key])

  return key ? key.split(',').map((id) => appliedCache.get(id)).filter((c): c is Course => !!c) : []
}
