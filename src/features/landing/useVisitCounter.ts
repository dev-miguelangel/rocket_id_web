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
        // Total y visitas del día (hora de Chile), para el panel de administración
        const day = doc(db, 'stats', 'landing', 'days', new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date()))
        const bump = (r: typeof ref) => updateDoc(r, { visits: increment(1) }).catch(() => setDoc(r, { visits: 1 }).catch(() => {}))
        await Promise.all([bump(ref), bump(day)])
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
