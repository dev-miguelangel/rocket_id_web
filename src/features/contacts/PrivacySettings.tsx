import { doc, onSnapshot } from 'firebase/firestore'
import { useEffect, useState } from 'react'
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
            <p className="mt-0.5 text-xs text-muted">
              {on
                ? 'Solo te encuentran con tu correo exacto, tu rocketId o tu enlace.'
                : 'También apareces cuando alguien escribe tu nombre o parte de tu rocketId.'}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={!!on}
            aria-labelledby="exact-only-label"
            disabled={on === null || busy}
            onClick={toggle}
            className={`relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-60 ${on ? 'bg-primary' : 'bg-line-strong'}`}
          >
            <span className={`absolute top-1 left-1 size-6 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-6' : ''}`} />
          </button>
        </div>
      </div>

      <div className="space-y-2 rounded-2xl border border-line bg-card p-4 text-sm">
        <p className="font-medium text-fg">👁️ Lo que ven otras personas</p>
        <p className="text-muted">Nombre, foto, rocketId y tus conocimientos y certificaciones.</p>
        <p className="pt-2 font-medium text-fg">🔒 Nunca se muestra</p>
        <p className="text-muted">Correo, documento, teléfono, fecha de nacimiento, contacto de emergencia ni datos de salud.</p>
      </div>
    </>
  )
}
