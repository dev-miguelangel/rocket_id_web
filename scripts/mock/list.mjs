// Lista los usuarios mock registrados (solo lectura).
//   npm run mock:list
import { REGISTRY_PATH, initAdmin, isEmulator, PROJECT_ID } from './lib.mjs'

const db = initAdmin()
console.log(`→ ${isEmulator() ? 'emulador' : PROJECT_ID}`)
const reg = (await db.doc(REGISTRY_PATH).get()).data()
if (!reg) {
  console.log('  No hay datos mock registrados.\n')
  process.exit(0)
}
console.log(`  seed: ${reg.seed} · ${reg.users?.length ?? 0} usuarios · ${reg.paths?.length ?? 0} documentos\n`)
for (const u of reg.users ?? []) console.log(`  ${u.rocketId}  ${u.displayName.padEnd(26)} ${u.email}`)
console.log()
process.exit(0)
