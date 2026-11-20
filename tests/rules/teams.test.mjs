// Equipos de formadores: invitaciones, aceptar, roles, salir; instructores con cursos asignados
// Las pruebas de administración necesitan: ROCKETID_ADMIN_EMAIL=<correo admin> npm run test:rules
import { setup } from './helpers.mjs'
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  Timestamp,
} from 'firebase/firestore'

const { env, t, done } = await setup()
const ADMIN = process.env.ROCKETID_ADMIN_EMAIL
const ctx = (uid) => env.authenticatedContext(uid, { email: `${uid}@rocketid.test`, email_verified: true }).firestore()
const owner = ctx('owner') // responsable de org1
const mgr = ctx('mgr') // coordinación de org1
const ana = ctx('ana') // deportista invitada como instructora
const bea = ctx('bea') // deportista sin invitación
const indep = ctx('indep') // independiente
const admin = ADMIN && env.authenticatedContext('admin', { email: ADMIN, email_verified: true }).firestore()

await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore()
  const now = Timestamp.now()
  await setDoc(doc(db, 'providers/org1'), { kind: 'organization', name: 'Escuela Andina', status: 'approved', ownerUid: 'owner' })
  await setDoc(doc(db, 'providers/org2'), { kind: 'organization', name: 'Escuela Nueva', status: 'pending', ownerUid: 'owner' })
  await setDoc(doc(db, 'providers/ind_indep'), { kind: 'independent', name: 'Indep', status: 'approved', ownerUid: 'indep' })
  await setDoc(doc(db, 'providers/org1/members/owner'), { uid: 'owner', role: 'owner', addedBy: 'owner', since: now })
  await setDoc(doc(db, 'providers/org1/members/mgr'), { uid: 'mgr', role: 'manager', addedBy: 'owner', since: now })
  await setDoc(doc(db, 'providers/org2/members/owner'), { uid: 'owner', role: 'owner', addedBy: 'owner', since: now })
  await setDoc(doc(db, 'providers/ind_indep/members/indep'), { uid: 'indep', role: 'owner', addedBy: 'indep', since: now })
  const course = (id, instructorUids) =>
    setDoc(doc(db, `courses/${id}`), { providerId: 'org1', providerName: 'Escuela Andina', title: id, status: 'published', instructorUids })
  await course('cA', ['ana'])
  await course('cB', [])
  const app = (uid, cid) =>
    setDoc(doc(db, `applications/${uid}_${cid}`), { uid, courseId: cid, courseTitle: cid, providerId: 'org1', providerName: 'Escuela Andina', status: 'sent' })
  await app('zoe', 'cA')
  await app('zoe', 'cB')
})

const invite = (uid, role = 'instructor', extra = {}) => ({
  uid,
  role,
  providerName: 'Escuela Andina',
  invitedBy: 'owner',
  invitedByName: 'Olga',
  createdAt: serverTimestamp(),
  ...extra,
})
const accept = (db, pid, uid, role, invitedBy = 'owner') => {
  const b = writeBatch(db)
  b.set(doc(db, `providers/${pid}/members/${uid}`), { uid, role, addedBy: invitedBy, since: serverTimestamp() })
  b.delete(doc(db, `providers/${pid}/invites/${uid}`))
  return b.commit()
}

// ---------- Invitar ----------
await t('El responsable invita a una deportista', () => assertSucceeds(setDoc(doc(owner, 'providers/org1/invites/ana'), invite('ana'))))
await t('Coordinación NO invita', () => assertFails(setDoc(doc(mgr, 'providers/org1/invites/bea'), invite('bea', 'instructor', { invitedBy: 'mgr' }))))
await t('Una deportista NO se invita sola', () => assertFails(setDoc(doc(bea, 'providers/org1/invites/bea'), invite('bea', 'owner', { invitedBy: 'bea' }))))
await t('NO invita con otro nombre de formador', () =>
  assertFails(setDoc(doc(owner, 'providers/org1/invites/bea'), invite('bea', 'instructor', { providerName: 'Cruz Roja' }))),
)
await t('NO invita a nombre de otra persona', () =>
  assertFails(setDoc(doc(owner, 'providers/org1/invites/bea'), invite('bea', 'instructor', { invitedBy: 'mgr' }))),
)
await t('NO invita con un rol desconocido', () => assertFails(setDoc(doc(owner, 'providers/org1/invites/bea'), invite('bea', 'admin'))))
await t('NO invita a quien ya es parte del equipo', () => assertFails(setDoc(doc(owner, 'providers/org1/invites/mgr'), invite('mgr'))))
await t('NO invita desde una organización en revisión', () =>
  assertFails(setDoc(doc(owner, 'providers/org2/invites/bea'), invite('bea', 'instructor', { providerName: 'Escuela Nueva' }))),
)
await t('Un independiente NO tiene equipo', () =>
  assertFails(setDoc(doc(indep, 'providers/ind_indep/invites/bea'), invite('bea', 'instructor', { providerName: 'Indep', invitedBy: 'indep' }))),
)
await t('El responsable invita y avisa en el mismo lote', async () => {
  const b = writeBatch(owner)
  b.set(doc(owner, 'providers/org1/invites/bea'), invite('bea', 'manager'))
  b.set(doc(owner, 'users/bea/notifications/n1'), {
    type: 'provider_invite',
    eventId: 'org1',
    eventTitle: 'Escuela Andina',
    actorUid: 'owner',
    actorName: 'Olga',
    detail: 'Rol: Coordinación',
    read: false,
    createdAt: serverTimestamp(),
  })
  await assertSucceeds(b.commit())
})
await t('NO avisa de una invitación que no existe', () =>
  assertFails(
    setDoc(doc(owner, 'users/zoe/notifications/n2'), {
      type: 'provider_invite',
      eventId: 'org1',
      eventTitle: 'Escuela Andina',
      actorUid: 'owner',
      actorName: 'Olga',
      read: false,
      createdAt: serverTimestamp(),
    }),
  ),
)

// ---------- Ver invitaciones ----------
await t('La invitada ve sus invitaciones (consulta de grupo)', () => assertSucceeds(getDocs(query(collectionGroup(ana, 'invites'), where('uid', '==', 'ana')))))
await t('NO ve invitaciones ajenas', () => assertFails(getDocs(query(collectionGroup(ana, 'invites'), where('uid', '==', 'bea')))))
await t('El responsable lista las invitaciones pendientes', () => assertSucceeds(getDocs(collection(owner, 'providers/org1/invites'))))
await t('Coordinación NO lista invitaciones', () => assertFails(getDocs(collection(mgr, 'providers/org1/invites'))))

// ---------- Aceptar ----------
await t('NO acepta con otro rol', () => assertFails(accept(ana, 'org1', 'ana', 'owner')))
await t('NO acepta sin borrar la invitación', () =>
  assertFails(setDoc(doc(ana, 'providers/org1/members/ana'), { uid: 'ana', role: 'instructor', addedBy: 'owner', since: serverTimestamp() })),
)
await t('Sin invitación NO se suma al equipo', () => assertFails(accept(ctx('zoe'), 'org1', 'zoe', 'instructor')))
await t('La invitada acepta (membresía + borra la invitación)', () => assertSucceeds(accept(ana, 'org1', 'ana', 'instructor')))
await t('La otra invitada rechaza (borra su invitación)', () => assertSucceeds(deleteDoc(doc(bea, 'providers/org1/invites/bea'))))
await t('El responsable cancela una invitación', async () => {
  await setDoc(doc(owner, 'providers/org1/invites/bea'), invite('bea'))
  await assertSucceeds(deleteDoc(doc(owner, 'providers/org1/invites/bea')))
})

// ---------- Instructor con cursos asignados ----------
await t('Instructora ve postulaciones de su curso asignado', () =>
  assertSucceeds(getDocs(query(collection(ana, 'applications'), where('courseId', '==', 'cA')))),
)
await t('Instructora NO ve postulaciones de un curso no asignado', () =>
  assertFails(getDocs(query(collection(ana, 'applications'), where('courseId', '==', 'cB')))),
)
await t('Instructora NO lista todas las del formador', () => assertFails(getDocs(query(collection(ana, 'applications'), where('providerId', '==', 'org1')))))
await t('Instructora acepta en su curso y avisa', async () => {
  const b = writeBatch(ana)
  b.update(doc(ana, 'applications/zoe_cA'), { status: 'accepted', reviewedBy: 'ana', reviewedAt: serverTimestamp() })
  b.set(doc(ana, 'users/zoe/notifications/n3'), {
    type: 'application_accepted',
    eventId: 'cA',
    eventTitle: 'cA',
    actorUid: 'ana',
    actorName: 'Escuela Andina',
    read: false,
    createdAt: serverTimestamp(),
  })
  await assertSucceeds(b.commit())
})
await t('Instructora NO decide en un curso no asignado', () =>
  assertFails(updateDoc(doc(ana, 'applications/zoe_cB'), { status: 'accepted', reviewedBy: 'ana', reviewedAt: serverTimestamp() })),
)
await t('Instructora NO edita cursos', () => assertFails(updateDoc(doc(ana, 'courses/cA'), { title: 'Otro' })))

// ---------- Roles y salida ----------
await t('Coordinación NO cambia roles', () => assertFails(updateDoc(doc(mgr, 'providers/org1/members/ana'), { role: 'manager' })))
await t('El responsable sube a coordinación a la instructora', () => assertSucceeds(updateDoc(doc(owner, 'providers/org1/members/ana'), { role: 'manager' })))
await t('El responsable NO cambia su propio rol', () => assertFails(updateDoc(doc(owner, 'providers/org1/members/owner'), { role: 'instructor' })))
await t('NO cambia otros datos de la membresía', () => assertFails(updateDoc(doc(owner, 'providers/org1/members/ana'), { addedBy: 'ana' })))
await t('Una persona del equipo sale por su cuenta', () => assertSucceeds(deleteDoc(doc(ana, 'providers/org1/members/ana'))))
await t('El responsable NO sale solo (debe nombrar a otro)', () => assertFails(deleteDoc(doc(owner, 'providers/org1/members/owner'))))
await t('Coordinación NO quita a otras personas', async () => {
  await env.withSecurityRulesDisabled((c) =>
    setDoc(doc(c.firestore(), 'providers/org1/members/ana'), { uid: 'ana', role: 'instructor', addedBy: 'owner', since: Timestamp.now() }),
  )
  await assertFails(deleteDoc(doc(mgr, 'providers/org1/members/ana')))
})
await t('El responsable quita a una persona', () => assertSucceeds(deleteDoc(doc(owner, 'providers/org1/members/ana'))))
await t('Fuera del equipo, ya NO ve las postulaciones del curso', () =>
  assertFails(getDocs(query(collection(ana, 'applications'), where('courseId', '==', 'cA')))),
)

if (admin) {
  await t('La administración vincula a una persona a una organización (invitación)', () =>
    assertSucceeds(setDoc(doc(admin, 'providers/org1/invites/bea'), invite('bea', 'instructor', { invitedBy: 'admin', invitedByName: 'rocketId' }))),
  )
  await t('Acepta la invitación de la administración', () => assertSucceeds(accept(bea, 'org1', 'bea', 'instructor', 'admin')))
} else {
  console.log('  (sin ROCKETID_ADMIN_EMAIL: se omiten las pruebas de acceso admin)')
}

await getDoc(doc(owner, 'providers/org1'))
await done()
