import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { useCallback, useEffect, useState } from 'react'
import { db } from '../../lib/firebase'
import { useAuth } from '../auth/AuthProvider'

/** Evento para volver a abrir el recorrido desde el menú del avatar */
export const REOPEN_EVENT = 'rocketid:onboarding'
export const reopenOnboarding = () => window.dispatchEvent(new Event(REOPEN_EVENT))

/**
 * Recorrido de primer uso: se muestra una sola vez por persona (se guarda `onboardedAt` en su perfil,
 * así no se repite en otro teléfono). Se puede volver a abrir desde el menú del avatar.
 */
export function useOnboarding() {
  const { user } = useAuth()
  const [seen, setSeen] = useState<boolean | null>(null)
  const [forced, setForced] = useState(false)

  useEffect(() => {
    if (!user) return
    return onSnapshot(
      doc(db, 'users', user.uid),
      // Solo los cambios confirmados por el servidor (evita mostrarlo un instante con la caché vacía)
      (s) => {
        // Con datos de la caché solo se confirma "ya lo vio"; "no lo vio" se espera del servidor
        if (s.metadata.fromCache && !s.data()?.onboardedAt) return
        setSeen(!!s.data()?.onboardedAt)
      },
      () => setSeen(true),
    )
  }, [user])

  useEffect(() => {
    const open = () => setForced(true)
    window.addEventListener(REOPEN_EVENT, open)
    return () => window.removeEventListener(REOPEN_EVENT, open)
  }, [])

  const finish = useCallback(() => {
    setForced(false)
    setSeen(true)
    if (user) setDoc(doc(db, 'users', user.uid), { onboardedAt: serverTimestamp() }, { merge: true }).catch(() => {})
  }, [user])

  return { open: forced || seen === false, finish }
}
