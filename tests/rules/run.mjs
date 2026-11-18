// Ejecuta todas las suites *.test.mjs contra el emulador de Firestore y resume el resultado.
//   npm run test:rules            → resumen (muestra solo los casos que fallan)
//   npm run test:rules -- -v      → todos los casos
import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { ROOT } from './helpers.mjs'

const dir = fileURLToPath(new URL('.', import.meta.url))
const verbose = process.argv.includes('-v') || process.argv.includes('--verbose')
const only = process.argv.slice(2).find((a) => !a.startsWith('-'))
const suites = readdirSync(dir)
  .filter((f) => f.endsWith('.test.mjs') && (!only || f.includes(only)))
  .sort()

let totalOk = 0
let totalFail = 0
const failed = []

for (const file of suites) {
  const r = spawnSync(process.execPath, [`${dir}${file}`], { cwd: ROOT, env: process.env, encoding: 'utf8' })
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
  const m = out.match(/(\d+) ok, (\d+) fallidas/)
  const ok = m ? Number(m[1]) : 0
  const ko = m ? Number(m[2]) : 1
  totalOk += ok
  totalFail += ko
  const badExit = r.status !== 0
  console.log(`${ko || badExit ? '✗' : '✓'} ${file.replace('.test.mjs', '').padEnd(18)} ${ok} ok${ko ? `, ${ko} fallidas` : ''}`)
  const lines = out.split('\n').filter((l) => (verbose ? /^[✓✗]/.test(l) : l.startsWith('✗')))
  for (const l of lines) console.log(`    ${l}`)
  if (badExit && !m) console.log(out.split('\n').slice(-15).map((l) => `    ${l}`).join('\n'))
  if (ko || badExit) failed.push(file)
}

console.log(`\n${failed.length ? '✗' : '✓'} ${totalOk} casos ok, ${totalFail} fallidos en ${suites.length} suites`)
process.exit(failed.length ? 1 : 0)
