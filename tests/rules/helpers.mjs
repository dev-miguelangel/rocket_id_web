// Utilidades compartidas por las pruebas de reglas.
import { initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/** Raíz del repositorio (con barra final) */
export const ROOT = fileURLToPath(new URL('../../', import.meta.url))

/** emulators:exec define FIRESTORE_EMULATOR_HOST y GCLOUD_PROJECT */
export const PROJECT_ID = process.env.GCLOUD_PROJECT || 'demo-rocketid'
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8089').split(':')

/**
 * Prepara un entorno limpio con las reglas reales del repo.
 * `t(nombre, fn)` registra un caso; `done()` imprime el resumen y termina con código ≠ 0 si algo falló.
 */
export async function setup() {
  const env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync(`${ROOT}firestore.rules`, 'utf8'), host, port: Number(port) },
  })
  // El emulador a veces rechaza la limpieza mientras cierra conexiones de la suite anterior: se reintenta
  for (let i = 0; ; i++) {
    try {
      await env.clearFirestore()
      break
    } catch (e) {
      if (i >= 4) throw e
      await new Promise((r) => setTimeout(r, 500 * (i + 1)))
    }
  }
  let pass = 0
  let fail = 0
  const t = async (name, fn) => {
    try {
      await fn()
      pass++
      console.log('✓', name)
    } catch (e) {
      fail++
      console.log('✗', name, '→', String(e?.message ?? e).split('\n')[0])
    }
  }
  const done = async () => {
    console.log(`\n${pass} ok, ${fail} fallidas`)
    await env.cleanup()
    process.exit(fail ? 1 : 0)
  }
  return { env, t, done }
}
