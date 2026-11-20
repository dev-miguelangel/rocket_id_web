import { doc, onSnapshot } from 'firebase/firestore'
import { useSyncExternalStore } from 'react'
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
