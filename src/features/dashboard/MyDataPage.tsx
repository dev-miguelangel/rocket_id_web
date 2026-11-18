import { onSnapshot, setDoc } from 'firebase/firestore'
import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { userDocRef, type UserProfile } from '../auth/userProfile'

export function MyDataPage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [phone, setPhone] = useState('')
  const [bio, setBio] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  // Suscripción en tiempo real (también funciona offline gracias a la caché local)
  useEffect(() => {
    if (!user) return
    return onSnapshot(userDocRef(user.uid), (snap) => {
      const data = snap.data() as UserProfile | undefined
      if (!data) return
      setProfile(data)
      setPhone((p) => p || data.phone || '')
      setBio((b) => b || data.bio || '')
    })
  }, [user])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!user) return
    setStatus('saving')
    try {
      await setDoc(userDocRef(user.uid), { phone: phone.trim(), bio: bio.trim() }, { merge: true })
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 2000)
    } catch {
      setStatus('error')
    }
  }

  const memberSince = profile?.createdAt?.toDate().toLocaleDateString('es', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="space-y-4">
      <section className="flex items-center gap-4 rounded-2xl border border-line bg-card p-4">
        {user?.photoURL && (
          <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="size-14 rounded-full" />
        )}
        <div className="min-w-0">
          <p className="truncate font-semibold text-fg">{profile?.displayName ?? user?.displayName}</p>
          <p className="truncate text-sm text-muted">{profile?.email ?? user?.email}</p>
          {memberSince && <p className="text-xs text-subtle">Miembro desde {memberSince}</p>}
        </div>
      </section>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-line bg-card p-4">
        <label className="block">
          <span className="text-sm font-medium text-fg-soft">Teléfono</span>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+56 9 1234 5678"
            className="mt-1 h-12 w-full rounded-xl border border-line-strong bg-card px-3 text-base text-fg outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-fg-soft">Sobre mí</span>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            maxLength={280}
            className="mt-1 w-full rounded-xl border border-line-strong bg-card p-3 text-base text-fg outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </label>
        <button
          type="submit"
          disabled={status === 'saving'}
          className="h-12 w-full rounded-xl bg-primary font-semibold text-white transition active:bg-primary-dark disabled:opacity-60"
        >
          {status === 'saving' ? 'Guardando…' : status === 'saved' ? '✓ Guardado' : 'Guardar cambios'}
        </button>
        {status === 'error' && (
          <p role="alert" className="text-center text-sm text-red-600 dark:text-red-400">
            No se pudo guardar. Inténtalo de nuevo.
          </p>
        )}
      </form>
    </div>
  )
}
