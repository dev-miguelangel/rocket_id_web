import { useEffect, useState } from 'react'
import { BottomSheet } from '../../components/Sheet'
import { firstName } from '../../lib/names'
import { useAuth } from '../auth/AuthProvider'
import { addContact, removeContact } from './contactsApi'
import { PublicProfileCard } from './PublicProfileCard'
import { getPublicProfile, peekPublicProfile, type SearchResult } from './publicProfile'

const primaryBtn =
  'flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-white transition active:bg-primary-dark disabled:opacity-50'
const secondaryBtn =
  'flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-line-strong bg-card text-base font-semibold text-fg disabled:opacity-60'

interface Props {
  /** uid de la persona a mostrar (null = cerrada) */
  uid: string | null
  inCordada: boolean
  onClose: () => void
  onToast: (msg: string) => void
}

/** Perfil público en hoja inferior, con agregar / quitar de la cordada. */
export function ProfileSheet({ uid, inCordada, onClose, onToast }: Props) {
  const { user } = useAuth()
  const [shownUid, setShownUid] = useState(uid)
  const [result, setResult] = useState<SearchResult | null | undefined>(() => (uid ? peekPublicProfile(uid) : undefined))
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  if (uid && uid !== shownUid) {
    setShownUid(uid)
    setResult(peekPublicProfile(uid))
    setConfirming(false)
  }

  useEffect(() => {
    if (!uid) return
    let alive = true
    getPublicProfile(uid)
      .then((r) => alive && setResult(r))
      // Sin conexión: si ya teníamos el perfil, se mantiene
      .catch(() => alive && setResult((r) => r ?? null))
    return () => {
      alive = false
    }
  }, [uid])

  if (!shownUid) return null
  const p = result?.profile
  const name = p ? firstName(p.displayName) : ''
  const isMe = shownUid === user?.uid

  const add = async () => {
    if (!user || !p) return
    setBusy(true)
    try {
      await addContact(user.uid, p)
      navigator.vibrate?.(10)
      onToast(`${name} se unió a tu cordada`)
    } catch {
      onToast('No se pudo agregar. Inténtalo de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!user) return
    setBusy(true)
    try {
      await removeContact(user.uid, shownUid)
      navigator.vibrate?.(10)
      onToast(`${name || 'La persona'} salió de tu cordada`)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const footer = isMe ? (
    <p className="pb-4 text-center text-sm text-muted">Así te ven los demás 👀</p>
  ) : !inCordada ? (
    <div className="pb-3">
      <button type="button" onClick={add} disabled={busy || !p} className={primaryBtn}>
        🪢 {busy ? 'Agregando…' : 'Agregar a mi cordada'}
      </button>
    </div>
  ) : confirming ? (
    <div className="space-y-2 pb-3">
      <p className="text-center text-sm text-fg">¿Quitar a {name || 'esta persona'} de tu cordada?</p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setConfirming(false)} className={secondaryBtn}>
          Cancelar
        </button>
        <button type="button" onClick={remove} disabled={busy} className="h-12 rounded-xl bg-red-600 font-semibold text-white active:bg-red-700 disabled:opacity-60">
          {busy ? 'Quitando…' : 'Quitar'}
        </button>
      </div>
    </div>
  ) : (
    <div className="space-y-2 pb-3">
      <button type="button" disabled className={secondaryBtn}>
        ✓ En tu cordada
      </button>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="h-11 w-full rounded-lg text-sm font-medium text-red-600 active:bg-red-50 dark:text-red-400 dark:active:bg-red-500/10"
      >
        Quitar de mi cordada
      </button>
    </div>
  )

  return (
    <BottomSheet open={!!uid} title="Perfil" onClose={onClose} footer={footer}>
      {result === undefined ? (
        <div className="h-72 animate-pulse rounded-2xl bg-line" aria-label="Cargando perfil" />
      ) : result ? (
        <PublicProfileCard result={result} maxCerts={20} />
      ) : (
        <div className="rounded-2xl border border-dashed border-line-strong bg-card px-6 py-10 text-center">
          <p className="text-3xl" aria-hidden="true">🙈</p>
          <p className="mt-2 font-semibold text-fg">Perfil no disponible</p>
          <p className="mt-1 text-sm text-muted">Esta persona ya no tiene un perfil público.</p>
        </div>
      )}
    </BottomSheet>
  )
}
