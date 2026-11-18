import { doc, onSnapshot } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { Switch } from '../../components/form'
import { db } from '../../lib/firebase'
import { useAuth } from '../auth/AuthProvider'
import { setExactOnly } from './publicProfile'

/** Ajuste "Solo aparecer en búsquedas exactas" + qué se muestra de tu perfil. */
export function PrivacySettings() {
  const { user } = useAuth()
  const [on, setOn] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!user) return
    return onSnapshot(doc(db, 'users', user.uid), (s) => setOn(s.data()?.exactOnly === true))
  }, [user])

  const toggle = async () => {
    if (!user || on === null) return
    setBusy(true)
    try {
      await setExactOnly(user, !on)
      navigator.vibrate?.(10)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="rounded-2xl border border-line bg-card p-4">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p id="exact-only-label" className="font-medium text-fg">
              Solo aparecer en búsquedas exactas
            </p>
            <p className="mt-0.5 text-sm text-muted">
              {on
                ? 'Solo te encuentran con tu correo exacto, tu rocketId o tu enlace.'
                : 'También apareces cuando alguien escribe tu nombre o parte de tu rocketId.'}
            </p>
          </div>
          <Switch checked={!!on} onChange={toggle} labelledBy="exact-only-label" disabled={on === null || busy} />
        </div>
      </div>

      <div className="max-w-prose space-y-2 rounded-2xl border border-line bg-card p-4 text-base">
        <p className="font-medium text-fg">👁️ Lo que ven otras personas</p>
        <p className="text-muted">Nombre, foto, rocketId y tus conocimientos y certificaciones.</p>
        <p className="text-muted">Quien tenga tu enlace o tu rocketId puede ver este perfil, incluso sin tener cuenta en rocketId.</p>
        <p className="pt-2 font-medium text-fg">🔒 Nunca se muestra</p>
        <p className="text-muted">Correo, documento, teléfono, fecha de nacimiento, contacto de emergencia ni datos de salud.</p>
      </div>
    </>
  )
}
