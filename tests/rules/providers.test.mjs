// Formadores: registro, revisión por la administración y membresías (providers/{pid}/members/{uid})
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
const ctx = (uid, email) => env.authenticatedContext(uid, { email, email_verified: true }).firestore()
const alice = ctx('alice', 'alice@rocketid.test')
const bob = ctx('bob', 'bob@rocketid.test')
const anon = env.unauthenticatedContext().firestore()
const admin = ADMIN && ctx('admin', ADMIN)
const adminUnverified = ADMIN && env.authenticatedContext('admin2', { email: ADMIN, email_verified: false }).firestore()

const independent = (uid, email, extra = {}) => ({
  kind: 'independent',
  name: 'Alice Montaña',
  website: '',
  about: 'Instructora WFA',
  credential: { name: 'Instructor WFA', issuer: 'Escuela Andina', number: 'A-123', expiresAt: '2027-06', evidenceUrl: '' },
  contact: { name: 'Alice', email, phone: '' },
  ownerUid: uid,
  status: 'pending',
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  ...extra,
})
const organization = (uid, email, extra = {}) => ({
  kind: 'organization',
  name: 'Escuela Andina',
  website: 'https://escuela.test',
  about: '',
  legalName: 'Escuela Andina SpA',
  rut: '76123456-K',
  contact: { name: 'Bob', email, phone: '+56911111111' },
  ownerUid: uid,
  status: 'pending',
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  ...extra,
})
const ownerMember = (uid) => ({ uid, role: 'owner', addedBy: uid, since: serverTimestamp() })

/** Registro: formador + membresía en el mismo lote */
const register = (db, pid, data, memberUid = data.ownerUid, member = ownerMember(memberUid)) => {
  const b = writeBatch(db)
  b.set(doc(db, `providers/${pid}`), data)
  b.set(doc(db, `providers/${pid}/members/${memberUid}`), member)
  return b.commit()
}

// ---------- Registro ----------
await t('Independiente se registra (ind_{uid} + responsable)', () => assertSucceeds(register(alice, 'ind_alice', independent('alice', 'alice@rocketid.test'))))
await t('Organización se registra con id automático', () => assertSucceeds(register(bob, 'org1', organization('bob', 'bob@rocketid.test'))))
await t('NO registra un independiente a nombre de otra persona', () =>
  assertFails(register(bob, 'ind_carol', independent('carol', 'bob@rocketid.test'), 'bob')),
)
await t('NO registra un independiente con id distinto de ind_{uid}', () => assertFails(register(bob, 'otro', independent('bob', 'bob@rocketid.test'))))
await t('NO registra una organización con id ind_', () => assertFails(register(bob, 'ind_bob', organization('bob', 'bob@rocketid.test'))))
await t('NO crea el formador sin su membresía', () => assertFails(setDoc(doc(bob, 'providers/ind_bob'), independent('bob', 'bob@rocketid.test'))))
await t('NO crea una membresía sin el formador', () => assertFails(setDoc(doc(bob, 'providers/org9/members/bob'), ownerMember('bob'))))
await t('NO se registra ya aprobado', () => assertFails(register(bob, 'ind_bob', independent('bob', 'bob@rocketid.test', { status: 'approved' }))))
await t('NO se registra con nota de revisión', () => assertFails(register(bob, 'ind_bob', independent('bob', 'bob@rocketid.test', { reviewNote: 'ok' }))))
await t('NO usa un correo de contacto que no es el suyo', () => assertFails(register(bob, 'ind_bob', independent('bob', 'otro@rocketid.test'))))
await t('NO registra organización con RUT inválido', () =>
  assertFails(register(bob, 'org2', organization('bob', 'bob@rocketid.test', { rut: '76.123.456-k' }))),
)
await t('NO registra independiente sin certificación', () =>
  assertFails(register(bob, 'ind_bob', independent('bob', 'bob@rocketid.test', { credential: { name: 'x', issuer: '' } }))),
)
await t('NO registra independiente con vigencia inválida', () =>
  assertFails(
    register(
      bob,
      'ind_bob',
      independent('bob', 'bob@rocketid.test', {
        credential: { name: 'Instructor WFA', issuer: 'Escuela', number: '', expiresAt: '2027-13', evidenceUrl: '' },
      }),
    ),
  ),
)
await t('NO agrega campos desconocidos', () => assertFails(register(bob, 'ind_bob', independent('bob', 'bob@rocketid.test', { verified: true }))))
await t('NO se registra con rol distinto de responsable', () =>
  assertFails(register(bob, 'ind_bob', independent('bob', 'bob@rocketid.test'), 'bob', { ...ownerMember('bob'), role: 'manager' })),
)
await t('NO se suma como miembro de un formador que ya existe', () => assertFails(setDoc(doc(alice, 'providers/org1/members/alice'), ownerMember('alice'))))
await t('Sin sesión NO se registra', () => assertFails(register(anon, 'org3', organization('x', 'x@rocketid.test'))))

// ---------- Lectura ----------
await t('La responsable lee su solicitud', () => assertSucceeds(getDoc(doc(alice, 'providers/ind_alice'))))
await t('Otra persona NO lee una solicitud en revisión', () => assertFails(getDoc(doc(bob, 'providers/ind_alice'))))
await t('Sin sesión NO lee formadores', () => assertFails(getDoc(doc(anon, 'providers/ind_alice'))))
await t('Lee sus membresías (consulta de grupo por uid)', () => assertSucceeds(getDocs(query(collectionGroup(alice, 'members'), where('uid', '==', 'alice')))))
await t('NO lee las membresías de otra persona', () => assertFails(getDocs(query(collectionGroup(alice, 'members'), where('uid', '==', 'bob')))))
await t('NO lista todos los formadores', () => assertFails(getDocs(collection(bob, 'providers'))))
await t('Lista los formadores aprobados', () => assertSucceeds(getDocs(query(collection(bob, 'providers'), where('status', '==', 'approved')))))
await t('NO lee el equipo de otro formador', () => assertFails(getDocs(collection(alice, 'providers/org1/members'))))
await t('Lee el equipo de su formador', () => assertSucceeds(getDocs(collection(bob, 'providers/org1/members'))))

// ---------- Edición por la persona ----------
await t('Corrige su solicitud en revisión', () =>
  assertSucceeds(updateDoc(doc(alice, 'providers/ind_alice'), { name: 'Alice Andes', updatedAt: serverTimestamp() })),
)
await t('NO se aprueba a sí misma', () => assertFails(updateDoc(doc(alice, 'providers/ind_alice'), { status: 'approved', updatedAt: serverTimestamp() })))
await t('NO escribe la nota de revisión', () => assertFails(updateDoc(doc(alice, 'providers/ind_alice'), { reviewNote: 'ok', updatedAt: serverTimestamp() })))
await t('NO cambia el tipo de formador', () => assertFails(updateDoc(doc(bob, 'providers/org1'), { kind: 'independent', updatedAt: serverTimestamp() })))
await t('NO cambia la responsable', () => assertFails(updateDoc(doc(alice, 'providers/ind_alice'), { ownerUid: 'bob', updatedAt: serverTimestamp() })))
await t('Otra persona NO edita la solicitud', () => assertFails(updateDoc(doc(bob, 'providers/ind_alice'), { name: 'Hack', updatedAt: serverTimestamp() })))
await t('NO edita las membresías', () => assertFails(updateDoc(doc(bob, 'providers/org1/members/bob'), { role: 'manager' })))

// Estados fijados por la administración (sin reglas) para probar lo que sigue
await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore()
  await updateDoc(doc(db, 'providers/org1'), { status: 'approved' })
  await setDoc(doc(db, 'providers/ind_carol'), {
    ...independent('carol', 'carol@rocketid.test'),
    status: 'rejected',
    reviewNote: 'Falta respaldo',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  })
  await setDoc(doc(db, 'providers/ind_carol/members/carol'), { uid: 'carol', role: 'owner', addedBy: 'carol', since: Timestamp.now() })
})
const carol = ctx('carol', 'carol@rocketid.test')

await t('Cualquiera con sesión lee un formador aprobado', () => assertSucceeds(getDoc(doc(alice, 'providers/org1'))))
await t('NO edita un formador aprobado', () => assertFails(updateDoc(doc(bob, 'providers/org1'), { name: 'Otra', updatedAt: serverTimestamp() })))
await t('Reenvía una solicitud rechazada (vuelve a revisión)', () =>
  assertSucceeds(updateDoc(doc(carol, 'providers/ind_carol'), { name: 'Carol Guía', status: 'pending', updatedAt: serverTimestamp() })),
)
await t('NO deja una solicitud reenviada como rechazada', async () => {
  await env.withSecurityRulesDisabled((c) => updateDoc(doc(c.firestore(), 'providers/ind_carol'), { status: 'rejected' }))
  await assertFails(updateDoc(doc(carol, 'providers/ind_carol'), { name: 'Carol', updatedAt: serverTimestamp() }))
})

// ---------- Retiro ----------
await t('NO borra solo la membresía mientras exista la solicitud', () => assertFails(deleteDoc(doc(alice, 'providers/ind_alice/members/alice'))))
await t('NO borra solo la solicitud dejando la membresía', () => assertFails(deleteDoc(doc(alice, 'providers/ind_alice'))))
await t('Otra persona NO retira la solicitud', async () => {
  const b = writeBatch(bob)
  b.delete(doc(bob, 'providers/ind_alice'))
  b.delete(doc(bob, 'providers/ind_alice/members/alice'))
  await assertFails(b.commit())
})
await t('NO retira un formador aprobado', async () => {
  const b = writeBatch(bob)
  b.delete(doc(bob, 'providers/org1'))
  b.delete(doc(bob, 'providers/org1/members/bob'))
  await assertFails(b.commit())
})
await t('Retira su solicitud en revisión (con su membresía)', async () => {
  const b = writeBatch(alice)
  b.delete(doc(alice, 'providers/ind_alice'))
  b.delete(doc(alice, 'providers/ind_alice/members/alice'))
  await assertSucceeds(b.commit())
})

// ---------- Administración ----------
await t('Una persona NO aprueba solicitudes ajenas', () =>
  assertFails(updateDoc(doc(alice, 'providers/ind_carol'), { status: 'approved', updatedAt: serverTimestamp() })),
)
await t('Una persona NO hace formador a otra', () =>
  assertFails(
    register(alice, 'ind_dave', independent('dave', 'dave@rocketid.test', { status: 'approved' }), 'dave', {
      uid: 'dave',
      role: 'owner',
      addedBy: 'alice',
      since: serverTimestamp(),
    }),
  ),
)

if (admin) {
  const review = (status, note) => ({
    status,
    reviewedAt: serverTimestamp(),
    reviewedBy: 'admin',
    updatedAt: serverTimestamp(),
    ...(note ? { reviewNote: note } : {}),
  })
  await t('Admin lista todas las solicitudes', () => assertSucceeds(getDocs(collection(admin, 'providers'))))
  await t('Admin lee una solicitud en revisión', () => assertSucceeds(getDoc(doc(admin, 'providers/ind_carol'))))
  await t('Admin lista todas las membresías', () => assertSucceeds(getDocs(collectionGroup(admin, 'members'))))
  await t('Admin rechaza con motivo', () => assertSucceeds(updateDoc(doc(admin, 'providers/ind_carol'), review('rejected', 'Falta el documento'))))
  await t('Admin aprueba', () => assertSucceeds(updateDoc(doc(admin, 'providers/ind_carol'), review('approved'))))
  await t('Admin suspende', () => assertSucceeds(updateDoc(doc(admin, 'providers/org1'), review('suspended', 'Certificación vencida'))))
  await t('Admin NO cambia los datos del formador', () => assertFails(updateDoc(doc(admin, 'providers/org1'), { name: 'Otro', updatedAt: serverTimestamp() })))
  await t('Admin NO usa un estado desconocido', () => assertFails(updateDoc(doc(admin, 'providers/org1'), review('verified'))))
  await t('Admin hace formador independiente a un deportista (aprobado)', () =>
    assertSucceeds(
      register(
        admin,
        'ind_dave',
        independent('dave', 'dave@rocketid.test', { status: 'approved', reviewedAt: serverTimestamp(), reviewedBy: 'admin' }),
        'dave',
        {
          uid: 'dave',
          role: 'owner',
          addedBy: 'admin',
          since: serverTimestamp(),
        },
      ),
    ),
  )
  await t('Admin NO crea un independiente con id ajeno', () =>
    assertFails(
      register(admin, 'ind_erin', independent('dave', 'dave@rocketid.test'), 'dave', {
        uid: 'dave',
        role: 'owner',
        addedBy: 'admin',
        since: serverTimestamp(),
      }),
    ),
  )
  await t('Dave ve su formador aprobado', () =>
    assertSucceeds(getDocs(query(collectionGroup(ctx('dave', 'dave@rocketid.test'), 'members'), where('uid', '==', 'dave')))),
  )
  await t('Admin borra un formador con su equipo', async () => {
    const b = writeBatch(admin)
    b.delete(doc(admin, 'providers/ind_dave'))
    b.delete(doc(admin, 'providers/ind_dave/members/dave'))
    await assertSucceeds(b.commit())
  })
  await t('Admin con correo sin verificar NO aprueba', () => assertFails(updateDoc(doc(adminUnverified, 'providers/org1'), review('approved'))))
} else {
  console.log('  (sin ROCKETID_ADMIN_EMAIL: se omiten las pruebas de acceso admin)')
}

await done()
