import { collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, type Unsubscribe } from 'firebase/firestore'
import { db } from './firebase'
import { courseData, parseCourse, todayCL, type CourseForm, type CourseStatus, type ProviderCourse } from './domain/courses'
import { credentialExpiry, parseProvider, type Provider } from './domain/providers'

// ---------- Formador ----------

/** Cursos de un formador (todos los estados), más recientes primero */
export function subscribeProviderCourses(providerId: string, cb: (list: ProviderCourse[] | null, error?: unknown) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'courses'), where('providerId', '==', providerId)),
    (snap) =>
      cb(snap.docs.map((d) => parseCourse(d.id, d.data())).sort((a, b) => (b.updatedAt?.getTime() ?? Date.now()) - (a.updatedAt?.getTime() ?? Date.now()))),
    (e) => cb(null, e),
  )
}

/** Un curso (null si no existe o no se puede leer) */
export function subscribeCourse(courseId: string, cb: (c: ProviderCourse | null) => void): Unsubscribe {
  return onSnapshot(
    doc(db, 'courses', courseId),
    (s) => cb(s.exists() ? parseCourse(s.id, s.data()) : null),
    () => cb(null),
  )
}

/** Id nuevo para un curso (se usa en la URL antes de guardar) */
export const newCourseId = () => doc(collection(db, 'courses')).id

export function createCourse(uid: string, provider: Provider, courseId: string, f: CourseForm, status: CourseStatus) {
  return setDoc(doc(db, 'courses', courseId), {
    ...courseData(f),
    providerId: provider.id,
    providerName: provider.name,
    providerKind: provider.kind,
    status,
    instructorUids: [],
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export function updateCourse(provider: Provider, courseId: string, f: CourseForm, status: CourseStatus) {
  return updateDoc(doc(db, 'courses', courseId), { ...courseData(f), providerName: provider.name, status, updatedAt: serverTimestamp() })
}

export function setCourseStatus(courseId: string, status: CourseStatus) {
  return updateDoc(doc(db, 'courses', courseId), { status, updatedAt: serverTimestamp() })
}

/** Solo borradores (los publicados se cierran, porque pueden tener postulaciones) */
export const deleteCourse = (courseId: string) => deleteDoc(doc(db, 'courses', courseId))

/** ¿Puede publicar? Formador aprobado y, si es independiente, con la certificación vigente */
export const canPublish = (p: Provider) => p.status === 'approved' && credentialExpiry(p) !== 'expired'

// ---------- Catálogo (app de deportistas) ----------

/**
 * Cursos publicados de formadores aprobados (y vigentes), que aún no terminan.
 * Un formador suspendido o con la certificación vencida deja de mostrarse sin tocar sus cursos.
 */
export function subscribePublishedCourses(cb: (list: ProviderCourse[]) => void): Unsubscribe {
  let courses: ProviderCourse[] | null = null
  let active: Set<string> | null = null
  const emit = () => {
    if (!courses || !active) return
    const today = todayCL()
    cb(courses.filter((c) => active!.has(c.providerId) && c.endDate >= today))
  }
  const u1 = onSnapshot(
    query(collection(db, 'courses'), where('status', '==', 'published')),
    (s) => {
      courses = s.docs.map((d) => parseCourse(d.id, d.data()))
      emit()
    },
    (e) => {
      console.warn('catálogo de cursos', e)
      courses = []
      emit()
    },
  )
  const u2 = onSnapshot(
    query(collection(db, 'providers'), where('status', '==', 'approved')),
    (s) => {
      active = new Set(
        s.docs
          .map((d) => parseProvider(d.id, d.data()))
          .filter(canPublish)
          .map((p) => p.id),
      )
      emit()
    },
    (e) => {
      console.warn('formadores aprobados', e)
      active = new Set()
      emit()
    },
  )
  return () => {
    u1()
    u2()
  }
}
