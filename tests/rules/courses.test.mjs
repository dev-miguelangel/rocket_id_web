// Cursos de formadores: courses/{cid}
// Las pruebas de administración necesitan: ROCKETID_ADMIN_EMAIL=<correo admin> npm run test:rules
import { setup } from './helpers.mjs'
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, Timestamp } from 'firebase/firestore'

const { env, t, done } = await setup()
const ADMIN = process.env.ROCKETID_ADMIN_EMAIL
const ctx = (uid) => env.authenticatedContext(uid, { email: `${uid}@rocketid.test`, email_verified: true }).firestore()
// owner: responsable de org1 (aprobada) · mgr: coordinación · ins: instructor · pend: responsable de un formador en revisión
const owner = ctx('owner')
const mgr = ctx('mgr')
const ins = ctx('ins')
const pend = ctx('pend')
const athlete = ctx('athlete')
const anon = env.unauthenticatedContext().firestore()
const admin = ADMIN && env.authenticatedContext('admin', { email: ADMIN, email_verified: true }).firestore()

await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore()
  const now = Timestamp.now()
  await setDoc(doc(db, 'providers/org1'), { kind: 'organization', name: 'Escuela Andina', status: 'approved', ownerUid: 'owner' })
  await setDoc(doc(db, 'providers/org1/members/owner'), { uid: 'owner', role: 'owner', addedBy: 'owner', since: now })
  await setDoc(doc(db, 'providers/org1/members/mgr'), { uid: 'mgr', role: 'manager', addedBy: 'owner', since: now })
  await setDoc(doc(db, 'providers/org1/members/ins'), { uid: 'ins', role: 'instructor', addedBy: 'owner', since: now })
  await setDoc(doc(db, 'providers/ind_pend'), { kind: 'independent', name: 'Pendiente', status: 'pending', ownerUid: 'pend' })
  await setDoc(doc(db, 'providers/ind_pend/members/pend'), { uid: 'pend', role: 'owner', addedBy: 'pend', since: now })
  await setDoc(doc(db, 'courses/pub'), { ...course('org1', 'owner'), status: 'published', createdAt: now, updatedAt: now })
  await setDoc(doc(db, 'courses/draft'), { ...course('org1', 'owner'), createdAt: now, updatedAt: now })
})

function course(providerId, uid, extra = {}) {
  return {
    providerId,
    providerName: providerId === 'org1' ? 'Escuela Andina' : 'Pendiente',
    providerKind: providerId === 'org1' ? 'organization' : 'independent',
    title: 'Primeros auxilios en áreas remotas',
    category: 'first_aid',
    summary: 'Evaluación y manejo de lesiones lejos de la ayuda.',
    description: '',
    location: 'Cajón del Maipo',
    modality: 'presencial',
    startDate: '2027-01-10',
    endDate: '2027-01-11',
    duration: '2 días',
    priceCLP: 120000,
    spots: 20,
    level: 'Inicial',
    requirements: ['Mayor de 16 años'],
    certification: 'Certificado WFA',
    status: 'draft',
    instructorUids: [],
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...extra,
  }
}

// ---------- Crear ----------
await t('Responsable de un formador aprobado crea un curso', () => assertSucceeds(setDoc(doc(owner, 'courses/c1'), course('org1', 'owner'))))
await t('Coordinación crea un curso', () => assertSucceeds(setDoc(doc(mgr, 'courses/c2'), course('org1', 'mgr'))))
await t('Instructor NO crea cursos', () => assertFails(setDoc(doc(ins, 'courses/c3'), course('org1', 'ins'))))
await t('Formador en revisión NO crea cursos', () => assertFails(setDoc(doc(pend, 'courses/c4'), course('ind_pend', 'pend'))))
await t('Deportista NO crea cursos de un formador ajeno', () => assertFails(setDoc(doc(athlete, 'courses/c5'), course('org1', 'athlete'))))
await t('Sin sesión NO crea cursos', () => assertFails(setDoc(doc(anon, 'courses/c6'), course('org1', 'x'))))
await t('NO inventa el nombre del formador', () => assertFails(setDoc(doc(owner, 'courses/c7'), course('org1', 'owner', { providerName: 'Cruz Roja' }))))
await t('NO cambia el tipo de formador', () => assertFails(setDoc(doc(owner, 'courses/c8'), course('org1', 'owner', { providerKind: 'independent' }))))
await t('NO crea a nombre de otra persona', () => assertFails(setDoc(doc(owner, 'courses/c9'), course('org1', 'mgr'))))
await t('NO termina antes de empezar', () => assertFails(setDoc(doc(owner, 'courses/c10'), course('org1', 'owner', { endDate: '2027-01-09' }))))
await t('NO acepta un precio con decimales', () => assertFails(setDoc(doc(owner, 'courses/c11'), course('org1', 'owner', { priceCLP: 1000.5 }))))
await t('NO acepta 0 cupos', () => assertFails(setDoc(doc(owner, 'courses/c12'), course('org1', 'owner', { spots: 0 }))))
await t('NO acepta una categoría desconocida', () => assertFails(setDoc(doc(owner, 'courses/c13'), course('org1', 'owner', { category: 'yoga' }))))
await t('NO agrega campos desconocidos', () => assertFails(setDoc(doc(owner, 'courses/c14'), course('org1', 'owner', { featured: true }))))
await t('NO acepta más de 10 requisitos', () =>
  assertFails(setDoc(doc(owner, 'courses/c15'), course('org1', 'owner', { requirements: Array.from({ length: 11 }, (_, i) => `r${i}`) }))),
)

// ---------- Leer ----------
await t('Deportista lee un curso publicado', () => assertSucceeds(getDoc(doc(athlete, 'courses/pub'))))
await t('Deportista NO lee un borrador', () => assertFails(getDoc(doc(athlete, 'courses/draft'))))
await t('Sin sesión NO lee cursos', () => assertFails(getDoc(doc(anon, 'courses/pub'))))
await t('Deportista lista el catálogo publicado', () => assertSucceeds(getDocs(query(collection(athlete, 'courses'), where('status', '==', 'published')))))
await t('Deportista NO lista todos los cursos', () => assertFails(getDocs(collection(athlete, 'courses'))))
await t('Instructor lee los borradores de su formador', () => assertSucceeds(getDoc(doc(ins, 'courses/draft'))))
await t('El formador lista sus cursos', () => assertSucceeds(getDocs(query(collection(owner, 'courses'), where('providerId', '==', 'org1')))))
await t('Otro formador NO lista los cursos ajenos', () => assertFails(getDocs(query(collection(pend, 'courses'), where('providerId', '==', 'org1')))))

// ---------- Editar, publicar y cerrar ----------
await t('Responsable publica un borrador', () => assertSucceeds(updateDoc(doc(owner, 'courses/c1'), { status: 'published', updatedAt: serverTimestamp() })))
await t('Coordinación edita un curso publicado', () => assertSucceeds(updateDoc(doc(mgr, 'courses/c1'), { spots: 25, updatedAt: serverTimestamp() })))
await t('Responsable cierra un curso', () => assertSucceeds(updateDoc(doc(owner, 'courses/c1'), { status: 'closed', updatedAt: serverTimestamp() })))
await t('Instructor NO edita cursos', () => assertFails(updateDoc(doc(ins, 'courses/c1'), { spots: 30, updatedAt: serverTimestamp() })))
await t('Deportista NO edita cursos', () => assertFails(updateDoc(doc(athlete, 'courses/pub'), { spots: 30, updatedAt: serverTimestamp() })))
await t('NO mueve un curso a otro formador', () => assertFails(updateDoc(doc(owner, 'courses/c1'), { providerId: 'ind_pend', updatedAt: serverTimestamp() })))
await t('NO cambia quién lo creó', () => assertFails(updateDoc(doc(owner, 'courses/c1'), { createdBy: 'mgr', updatedAt: serverTimestamp() })))
await t('NO usa un estado desconocido', () => assertFails(updateDoc(doc(owner, 'courses/c1'), { status: 'featured', updatedAt: serverTimestamp() })))

// ---------- Borrar ----------
await t('NO borra un curso publicado o cerrado', () => assertFails(deleteDoc(doc(owner, 'courses/c1'))))
await t('Instructor NO borra borradores', () => assertFails(deleteDoc(doc(ins, 'courses/c2'))))
await t('Coordinación borra un borrador', () => assertSucceeds(deleteDoc(doc(mgr, 'courses/c2'))))

// ---------- Formador suspendido ----------
await env.withSecurityRulesDisabled((c) => updateDoc(doc(c.firestore(), 'providers/org1'), { status: 'suspended' }))
await t('Formador suspendido NO edita sus cursos', () => assertFails(updateDoc(doc(owner, 'courses/draft'), { spots: 5, updatedAt: serverTimestamp() })))
await t('Formador suspendido NO crea cursos', () => assertFails(setDoc(doc(owner, 'courses/c16'), course('org1', 'owner'))))

if (admin) {
  await t('Admin lista todos los cursos', () => assertSucceeds(getDocs(collection(admin, 'courses'))))
  await t('Admin NO edita cursos de un formador', () => assertFails(updateDoc(doc(admin, 'courses/pub'), { spots: 1, updatedAt: serverTimestamp() })))
} else {
  console.log('  (sin ROCKETID_ADMIN_EMAIL: se omiten las pruebas de acceso admin)')
}

await done()
