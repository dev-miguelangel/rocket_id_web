import { doc, onSnapshot } from 'firebase/firestore'
import { useSyncExternalStore } from 'react'
import { db } from '../../lib/firebase'
import { MOCK_COURSES } from './mockCourses'
import type { Course } from './schema'

/**
 * Catálogo de cursos. Por ahora solo hay cursos de demostración; la administración puede ocultarlos
 * desde /admin (config/app.demoCourses). Una sola suscripción compartida por toda la app.
 */
let demoOn = true
const listeners = new Set<() => void>()
let unsub: (() => void) | null = null

function subscribe(cb: () => void) {
  listeners.add(cb)
  if (!unsub) {
    unsub = onSnapshot(
      doc(db, 'config', 'app'),
      (s) => {
        demoOn = s.data()?.demoCourses !== false
        listeners.forEach((l) => l())
      },
      () => {},
    )
  }
  return () => {
    listeners.delete(cb)
    if (!listeners.size && unsub) {
      unsub()
      unsub = null
    }
  }
}

const EMPTY: Course[] = []
export const useCatalog = (): Course[] => useSyncExternalStore(subscribe, () => (demoOn ? MOCK_COURSES : EMPTY))
