// Levanta el emulador de Firestore, corre run.mjs (con los argumentos recibidos) y lo apaga.
// Uso: npm run test:rules [-- -v] [-- events]
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const firebase = fileURLToPath(new URL('./node_modules/.bin/firebase', import.meta.url))
const args = process.argv.slice(2).map((a) => JSON.stringify(a)).join(' ')

const r = spawnSync(
  firebase,
  ['emulators:exec', '--only', 'firestore', '--project', 'demo-rocketid', `node tests/rules/run.mjs ${args}`],
  { cwd: ROOT, stdio: ['inherit', 'pipe', 'inherit'], encoding: 'utf8' },
)
// Muestra solo la salida de las pruebas (oculta el ruido del emulador)
const out = r.stdout ?? ''
const start = out.indexOf('Running script')
const body = (start >= 0 ? out.slice(out.indexOf('\n', start) + 1) : out)
  .split('\n')
  .filter((l) => !/^(i |⚠ |✔ |\s*$)|emulators:|Shutting down|Stopping|It is now safe|Script exited/.test(l))
console.log(body.join('\n'))
process.exit(r.status ?? 1)
