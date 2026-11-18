import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { addContact, subscribeContacts, type Contact } from './contactsApi'
import { PublicProfileCard } from './PublicProfileCard'
import { findPerson, normalizeRocketIdInput, type SearchResult } from './publicProfile'
import { ShareProfile } from './ShareProfile'

/** Página de un enlace compartido: /p/SU-1234 */
export function ProfileLinkPage() {
  const { rocketId: param = '' } = useParams()
  const { user } = useAuth()
  const code = normalizeRocketIdInput(param)
  const [result, setResult] = useState<SearchResult | null | undefined>(undefined)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)

  useEffect(() => {
    if (!code) return
    let alive = true
    findPerson(code)
      .then((r) => alive && setResult(r))
      .catch(() => alive && setResult(null))
    return () => {
      alive = false
    }
  }, [code])

  useEffect(() => {
    if (!user) return
    return subscribeContacts(user.uid, setContacts)
  }, [user])

  if (!code || result === null) {
    return (
      <div className="rounded-2xl border border-dashed border-line-strong bg-card px-6 py-12 text-center">
        <p className="text-4xl" aria-hidden="true">🔗</p>
        <p className="mt-3 font-semibold text-fg">Enlace no válido</p>
        <p className="mt-1 text-sm text-muted">No encontramos un perfil con el rocketId {param.toUpperCase()}.</p>
        <Link to="/cordada" className="mt-4 inline-flex h-11 items-center rounded-xl bg-primary px-5 font-semibold text-white">
          Ir a Cordada
        </Link>
      </div>
    )
  }

  if (result === undefined) return <div className="h-72 animate-pulse rounded-2xl bg-line" aria-label="Cargando perfil" />

  const isMe = result.profile.uid === user?.uid
  const inCordada = added || contacts.some((c) => c.uid === result.profile.uid)

  const add = async () => {
    if (!user) return
    setAdding(true)
    try {
      await addContact(user.uid, result.profile)
      navigator.vibrate?.(10)
      setAdded(true)
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="space-y-6 pb-4">
      <PublicProfileCard
        result={result}
        maxCerts={20}
        action={
          isMe ? (
            <p className="py-2 text-center text-sm text-muted">Así te ven los demás 👀</p>
          ) : inCordada ? (
            <Link to="/cordada" className="flex h-12 w-full items-center justify-center rounded-xl border border-line-strong font-semibold text-fg">
              ✓ En tu cordada · Ver cordada
            </Link>
          ) : (
            <button
              type="button"
              onClick={add}
              disabled={adding}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-white active:bg-primary-dark disabled:opacity-50"
            >
              🪢 {adding ? 'Agregando…' : 'Agregar a mi cordada'}
            </button>
          )
        }
      />
      {isMe && <ShareProfile />}
    </div>
  )
}
