// Scripts de datos mock (scripts/mock): seed idempotente, búsqueda con reglas reales y purga completa
// Ejecutar con: npm run test:rules
import { setup, ROOT } from './helpers.mjs'
import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'
import { doc, getDoc, setDoc, serverTimestamp, writeBatch } from 'firebase/firestore'

const run = (cmd) => execSync(cmd, { cwd: ROOT, env: process.env, encoding: 'utf8' })
const { env } = await setup()
let ok = 0
let ko = 0
const check = (name, cond) => {
  if (cond) ok++
  else ko++
  console.log(cond ? '✓' : '✗', name)
}

// Usuario REAL con rocketId y perfil
const real = env.authenticatedContext('realuser', { email: 'real@gmail.com', email_verified: true }).firestore()
await setDoc(doc(real, 'users/realuser'), { displayName: 'Real', createdAt: serverTimestamp() })
const b = writeBatch(real); b.set(doc(real, 'rocketIds/KA-7777'), { uid: 'realuser', createdAt: serverTimestamp() }); b.set(doc(real, 'users/realuser'), { rocketId: 'KA-7777' }, { merge: true }); await b.commit()

console.log(run('node scripts/mock/seed.mjs').trim())
console.log(run('node scripts/mock/list.mjs').trim())
console.log(run('node scripts/mock/seed.mjs').split('\n').filter((l) => l.includes('ya existe')).length + ' omitidos en segunda ejecución (idempotente)')

const emailHash = createHash('sha256').update('camila.rojas@rocketid.test').digest('hex')
const idx = await getDoc(doc(real, 'emailIndex', emailHash))
check('Usuario real encuentra a Camila por correo (con reglas)', idx.data()?.uid === 'mock_camila_rojas')
const prof = await getDoc(doc(real, 'publicProfiles/mock_camila_rojas'))
check('Perfil público mock legible', prof.data()?.displayName === 'Camila Rojas Fuentes')
check('Perfil mock marcado con _mock', prof.data()?._mock?.isMock === true)
const rid = prof.data()?.rocketId
const byRid = await getDoc(doc(real, 'rocketIds', rid))
check(`Búsqueda por rocketId ${rid}`, byRid.data()?.uid === 'mock_camila_rojas')
const ver = await getDoc(doc(real, 'users/mock_camila_rojas/private/verifications'))
check('Verificaciones mock legibles (2)', Object.keys(ver.data()?.certs ?? {}).length === 2)
await setDoc(doc(real, 'users/realuser/contacts/mock_camila_rojas'), { uid: 'mock_camila_rojas', rocketId: rid, displayName: 'Camila Rojas Fuentes', photoURL: null, addedAt: serverTimestamp() })
check('Usuario real agrega a Camila a su cordada', (await getDoc(doc(real, 'users/realuser/contacts/mock_camila_rojas'))).exists())

console.log(run('node scripts/mock/purge.mjs').trim())

await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore()
  check('publicProfile mock eliminado', !(await getDoc(doc(db, 'publicProfiles/mock_camila_rojas'))).exists())
  check('emailIndex mock eliminado', !(await getDoc(doc(db, 'emailIndex', emailHash))).exists())
  check('rocketId mock liberado', !(await getDoc(doc(db, 'rocketIds', rid))).exists())
  check('verificaciones mock eliminadas', !(await getDoc(doc(db, 'users/mock_camila_rojas/private/verifications'))).exists())
  check('users mock eliminado', !(await getDoc(doc(db, 'users/mock_camila_rojas'))).exists())
  check('contacto mock en cordada real eliminado', !(await getDoc(doc(db, 'users/realuser/contacts/mock_camila_rojas'))).exists())
  check('registro eliminado', !(await getDoc(doc(db, '_mock/registry'))).exists())
  check('usuario REAL intacto', (await getDoc(doc(db, 'users/realuser'))).data()?.rocketId === 'KA-7777')
  check('rocketId REAL intacto', (await getDoc(doc(db, 'rocketIds/KA-7777'))).exists())
})
console.log(run('node scripts/mock/list.mjs').trim())

console.log(`\n${ok} ok, ${ko} fallidas`)
await env.cleanup()
process.exit(ko ? 1 : 0)
