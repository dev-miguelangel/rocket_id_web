/**
 * Copia local (en este teléfono) de las fichas de emergencia de un evento, para emergencias sin señal.
 * - Solo la guarda el organizador, tras notificar a cada participante ("guardó tu ficha").
 * - No se muestra al guardar: se abre solo desde "Ver ficha", que vuelve a notificar.
 * - Se borra sola 2 días después del evento y al cerrar sesión.
 */
import type { SensitiveData } from './eventsApi'
import { SENSITIVE_GRACE_DAYS } from './schema'

const KEY = 'rocketid-offline-fichas'

export interface OfflineFicha {
  name: string
  data: SensitiveData
  savedAt: number
}

export interface OfflineEvent {
  ownerUid: string
  eventTitle: string
  /** Fin del evento (ms); define cuándo se borra la copia */
  endAt: number
  savedAt: number
  fichas: Record<string, OfflineFicha>
}

type Store = Record<string, OfflineEvent>

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Store) : {}
  } catch {
    return {}
  }
}

function write(store: Store) {
  try {
    if (Object.keys(store).length) localStorage.setItem(KEY, JSON.stringify(store))
    else localStorage.removeItem(KEY)
  } catch {
    /* sin espacio o almacenamiento bloqueado */
  }
}

const expired = (e: OfflineEvent, now = Date.now()) => now > e.endAt + SENSITIVE_GRACE_DAYS * 86_400_000

/** Copia de un evento, solo si pertenece a quien tiene la sesión y no venció */
export function getOfflineEvent(eid: string, uid: string): OfflineEvent | null {
  const e = read()[eid]
  if (!e || e.ownerUid !== uid || expired(e)) return null
  return e
}

export function saveOfflineFichas(eid: string, uid: string, eventTitle: string, endAt: number, fichas: Record<string, OfflineFicha>) {
  const store = read()
  const prev = store[eid]?.ownerUid === uid ? store[eid].fichas : {}
  store[eid] = { ownerUid: uid, eventTitle, endAt, savedAt: Date.now(), fichas: { ...prev, ...fichas } }
  write(store)
}

/** Quita del teléfono la ficha de alguien que ya no está confirmado */
export function removeOfflineFicha(eid: string, pid: string) {
  const store = read()
  if (!store[eid]) return
  delete store[eid].fichas[pid]
  if (!Object.keys(store[eid].fichas).length) delete store[eid]
  write(store)
}

export function removeOfflineEvent(eid: string) {
  const store = read()
  delete store[eid]
  write(store)
}

/** Borra las copias vencidas y las de otras cuentas. Se llama al abrir la app. */
export function purgeOfflineFichas(currentUid?: string) {
  const store = read()
  let changed = false
  for (const [eid, e] of Object.entries(store)) {
    if (expired(e) || (currentUid && e.ownerUid !== currentUid)) {
      delete store[eid]
      changed = true
    }
  }
  if (changed) write(store)
}

/** Al cerrar sesión no queda ninguna ficha en el teléfono */
export function clearAllOfflineFichas() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignorar */
  }
}
