import { doc, onSnapshot } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '../../lib/firebase'
import { isValidRocketId } from '../../lib/rocketId'
import { useAuth } from './AuthProvider'

/** rocketId de la persona en sesión (null mientras se asigna o carga). */
export function useRocketId() {
  const { user } = useAuth()
  const [rocketId, setRocketId] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    return onSnapshot(
      doc(db, 'users', user.uid),
      (s) => {
        const v = s.data()?.rocketId
        setRocketId(isValidRocketId(v) ? v : null)
      },
      () => setRocketId(null),
    )
  }, [user])

  return user ? rocketId : null
}
