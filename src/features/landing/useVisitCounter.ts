import { doc, getDoc, increment, setDoc, updateDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db, isFirebaseConfigured } from '../../lib/firebase'

const KEY = 'rocketid-landing-visit'

/**
 * Contador de visitas de la landing (Firestore `stats/landing`).
 * Suma una visita por sesión del navegador (recargar no la vuelve a contar) y devuelve el total.
 */
export function useVisitCounter() {
  const [visits, setVisits] = useState<number | null>(null)

  useEffect(() => {
    if (!isFirebaseConfigured) return
    let cancelled = false
    const ref = doc(db, 'stats', 'landing')
    const counted = (() => {
      try {
        return sessionStorage.getItem(KEY) === '1'
      } catch {
        return false
      }
    })()
    ;(async () => {
      if (!counted) {
        try {
          await updateDoc(ref, { visits: increment(1) })
        } catch {
          // Primera visita de la historia: el documento aún no existe
          await setDoc(ref, { visits: 1 }).catch(() => {})
        }
        try {
          sessionStorage.setItem(KEY, '1')
        } catch {
          /* ignorar */
        }
      }
      const s = await getDoc(ref).catch(() => null)
      const v = s?.data()?.visits
      if (!cancelled && typeof v === 'number') setVisits(v)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return visits
}
