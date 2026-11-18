import { doc, onSnapshot } from 'firebase/firestore'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Avatar } from '../../components/Avatar'
import { BottomSheet } from '../../components/Sheet'
import { db } from '../../lib/firebase'
import { useAuth } from '../auth/AuthProvider'
import { addContact, removeContact, subscribeContacts, type Contact } from './contactsApi'
import { PublicProfileCard } from './PublicProfileCard'
import { MIN_QUERY, parseQuery } from '../../lib/searchTokens'
import { ShareProfile } from './ShareProfile'
import {
  findPerson,
  getPublicProfile,
  looksLikeEmail,
  normalizeRocketIdInput,
  searchApprox,
  setExactOnly,
  type PublicProfile,
  type SearchResult,
} from './publicProfile'

type SearchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'format' }
  | { kind: 'notFound'; query: string }
  | { kind: 'error' }
  | { kind: 'found'; result: SearchResult }

const primaryBtn =
  'flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-white transition active:bg-primary-dark disabled:opacity-50'
const secondaryBtn =
  'flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-line-strong bg-card text-base font-semibold text-fg disabled:opacity-60'

export function ContactsPage() {
  const { user } = useAuth()
  const [q, setQ] = useState('')
  const [search, setSearch] = useState<SearchState>({ kind: 'idle' })
  const [contacts, setContacts] = useState<Contact[] | null>(null)
  const [adding, setAdding] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [openContact, setOpenContact] = useState<Contact | null>(null)
  const [suggestions, setSuggestions] = useState<PublicProfile[] | null>(null)

  // Búsqueda aproximada mientras se escribe (≥ 3 caracteres, con pausa de 300 ms)
  const canSuggest = !q.includes('@') && !!parseQuery(q)
  useEffect(() => {
    const text = q.trim()
    if (text.includes('@') || !parseQuery(text)) return
    let alive = true
    const t = setTimeout(() => {
      searchApprox(text)
        .then((r) => alive && setSuggestions(r))
        .catch((e) => {
          console.warn('searchApprox', e)
          if (alive) setSuggestions([])
        })
    }, 300)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [q])

  const pick = async (uid: string) => {
    ;(document.activeElement as HTMLElement | null)?.blur()
    setSuggestions(null)
    setSearch({ kind: 'loading' })
    try {
      const r = await getPublicProfile(uid)
      setSearch(r ? { kind: 'found', result: r } : { kind: 'notFound', query: q })
    } catch {
      setSearch({ kind: 'error' })
    }
  }

  useEffect(() => {
    if (!user) return
    return subscribeContacts(user.uid, setContacts)
  }, [user])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast])

  const inCordada = (uid: string) => !!contacts?.some((c) => c.uid === uid)

  const onSearch = async (e: FormEvent) => {
    e.preventDefault()
    const query = q.trim()
    if (!query) return
    // Sin correo ni rocketId completo: si hay una sola sugerencia, la abrimos
    if (!looksLikeEmail(query) && !normalizeRocketIdInput(query)) {
      if (canSuggest && suggestions?.length === 1) pick(suggestions[0].uid)
      else if (!canSuggest) setSearch({ kind: 'format' })
      return
    }
    ;(document.activeElement as HTMLElement | null)?.blur() // cierra el teclado
    setSuggestions(null)
    setSearch({ kind: 'loading' })
    try {
      const result = await findPerson(query)
      setSearch(result ? { kind: 'found', result } : { kind: 'notFound', query })
    } catch (err) {
      setSearch(err === 'format' ? { kind: 'format' } : { kind: 'error' })
    }
  }

  const onAdd = async (r: SearchResult) => {
    if (!user) return
    setAdding(true)
    try {
      await addContact(user.uid, r.profile)
      navigator.vibrate?.(10)
      setToast(`${r.profile.displayName.split(' ')[0]} se unió a tu cordada`)
    } catch {
      setToast('No se pudo agregar. Inténtalo de nuevo.')
    } finally {
      setAdding(false)
    }
  }

  const closeContact = useCallback(() => setOpenContact(null), [])

  return (
    <div className="space-y-6 pb-4">
      {/* Búsqueda */}
      <section>
        <form onSubmit={onSearch} role="search" className="flex gap-2">
          <label htmlFor="contact-search" className="sr-only">
            Buscar por nombre, correo o rocketId
          </label>
          <div className="relative min-w-0 flex-1">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" aria-hidden="true">
              🔍
            </span>
            <input
              id="contact-search"
              type="search"
              inputMode="email"
              enterKeyHint="search"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="off"
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                if (search.kind !== 'loading') setSearch({ kind: 'idle' })
              }}
              placeholder="Nombre, correo o rocketId"
              className="h-12 w-full rounded-xl border border-line-strong bg-card pr-3 pl-10 text-base text-fg outline-none placeholder:text-subtle focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <button
            type="submit"
            disabled={!q.trim() || search.kind === 'loading'}
            className="h-12 shrink-0 rounded-xl bg-primary px-4 font-semibold text-white active:bg-primary-dark disabled:opacity-50"
          >
            Buscar
          </button>
        </form>

        {canSuggest && suggestions !== null && search.kind === 'idle' && (
          <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-card">
            {suggestions.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted">Sin coincidencias. Prueba con un correo exacto o el rocketId completo.</p>
            ) : (
              <ul className="divide-y divide-line" aria-label="Sugerencias">
                {suggestions.map((p) => (
                  <li key={p.uid}>
                    <button type="button" onClick={() => pick(p.uid)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-line/60">
                      <Avatar name={p.displayName} photoURL={p.photoURL} className="size-10" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-base font-medium text-fg">
                          {p.displayName}
                          {p.isMock && <span className="ml-1.5 text-xs" title="Perfil de prueba">🧪</span>}
                        </span>
                        <span className="block font-mono text-xs font-semibold tracking-wider text-muted">{p.rocketId}</span>
                      </span>
                      {inCordada(p.uid) && <span className="text-xs font-medium text-primary-text">En tu cordada</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {q.trim().length > 0 && q.trim().length < MIN_QUERY && search.kind === 'idle' && (
          <p className="mt-2 px-1 text-xs text-muted">Escribe al menos {MIN_QUERY} caracteres.</p>
        )}

        <div className="mt-3" aria-live="polite">
          {search.kind === 'loading' && <div className="h-48 animate-pulse rounded-2xl bg-line" aria-label="Buscando" />}
          {search.kind === 'format' && (
            <Notice icon="✍️" title="Revisa lo que escribiste" text="Escribe al menos 3 letras del nombre, un correo completo (nombre@dominio.cl) o un rocketId como SU-1234." />
          )}
          {search.kind === 'notFound' && (
            <Notice
              icon="🤷"
              title="No encontramos a nadie"
              text="Verifica el correo o rocketId. Si buscas por nombre, puede que esa persona solo aparezca en búsquedas exactas."
            />
          )}
          {search.kind === 'error' && <Notice icon="⚠️" title="No se pudo buscar" text="Revisa tu conexión e inténtalo de nuevo." />}
          {search.kind === 'found' && (
            <PublicProfileCard
              result={search.result}
              action={
                search.result.profile.uid === user?.uid ? (
                  <p className="py-2 text-center text-sm text-muted">Este eres tú 👋</p>
                ) : inCordada(search.result.profile.uid) ? (
                  <button type="button" disabled className={secondaryBtn}>
                    ✓ Ya está en tu cordada
                  </button>
                ) : (
                  <button type="button" onClick={() => onAdd(search.result)} disabled={adding} className={primaryBtn}>
                    <span aria-hidden="true">🪢</span>
                    {adding ? 'Agregando…' : 'Agregar a mi cordada'}
                  </button>
                )
              }
            />
          )}
        </div>
      </section>

      {/* Mi cordada */}
      <section>
        <h2 className="mb-1.5 px-4 text-xs font-semibold tracking-wide text-muted uppercase">
          🪢 Mi cordada{contacts?.length ? ` (${contacts.length})` : ''}
        </h2>
        {contacts === null ? (
          <div className="h-32 animate-pulse rounded-2xl bg-line" />
        ) : contacts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line-strong bg-card px-6 py-8 text-center">
            <p className="text-3xl" aria-hidden="true">🧗</p>
            <p className="mt-2 font-semibold text-fg">Tu cordada está vacía</p>
            <p className="mt-1 text-sm text-muted">Busca a tus compañeros de salida por nombre, correo o rocketId.</p>
          </div>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
            {contacts.map((c) => (
              <li key={c.uid}>
                <button type="button" onClick={() => setOpenContact(c)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-line/60">
                  <Avatar name={c.displayName} photoURL={c.photoURL} className="size-11" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-medium text-fg">{c.displayName}</span>
                    <span className="block font-mono text-xs font-semibold tracking-wider text-muted">{c.rocketId}</span>
                  </span>
                  <span className="text-lg text-muted" aria-hidden="true">›</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ShareProfile />

      <ExactOnlySetting />

      <ContactSheet contact={openContact} onClose={closeContact} onRemoved={(name) => setToast(`${name} salió de tu cordada`)} />

      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 transition-all duration-300 motion-reduce:transition-none ${toast ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
      >
        {toast && <span className="rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg ring-1 ring-white/10">{toast}</span>}
      </div>
    </div>
  )
}

function Notice({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-line bg-card p-4">
      <span className="text-2xl" aria-hidden="true">{icon}</span>
      <div>
        <p className="font-semibold text-fg">{title}</p>
        <p className="mt-0.5 text-sm text-muted">{text}</p>
      </div>
    </div>
  )
}

// ---------- Detalle de un contacto ----------

function ContactSheet({ contact, onClose, onRemoved }: { contact: Contact | null; onClose: () => void; onRemoved: (name: string) => void }) {
  const { user } = useAuth()
  const [shown, setShown] = useState<Contact | null>(contact)
  const [result, setResult] = useState<SearchResult | null | undefined>(undefined)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  if (contact && contact !== shown) {
    setShown(contact)
    setResult(undefined)
    setConfirming(false)
  }

  // Trae el perfil público actualizado (nombre, foto y conocimientos pueden haber cambiado)
  useEffect(() => {
    if (!contact) return
    let alive = true
    getPublicProfile(contact.uid)
      .then((r) => alive && setResult(r))
      .catch(() => alive && setResult(null))
    return () => {
      alive = false
    }
  }, [contact])

  if (!shown) return null

  const remove = async () => {
    if (!user) return
    setBusy(true)
    try {
      await removeContact(user.uid, shown.uid)
      navigator.vibrate?.(10)
      onRemoved(shown.displayName.split(' ')[0])
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <BottomSheet
      open={!!contact}
      title="Cordada"
      onClose={onClose}
      footer={
        <div className="space-y-2 pb-3">
          {confirming ? (
            <>
              <p className="text-center text-sm text-fg">¿Quitar a {shown.displayName.split(' ')[0]} de tu cordada?</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setConfirming(false)} className={secondaryBtn}>
                  Cancelar
                </button>
                <button type="button" onClick={remove} disabled={busy} className="h-12 rounded-xl bg-red-600 font-semibold text-white active:bg-red-700 disabled:opacity-60">
                  {busy ? 'Quitando…' : 'Quitar'}
                </button>
              </div>
            </>
          ) : (
            <button type="button" onClick={() => setConfirming(true)} className="h-12 w-full rounded-xl text-base font-semibold text-red-600 active:bg-red-50 dark:text-red-400 dark:active:bg-red-500/10">
              Quitar de mi cordada
            </button>
          )}
        </div>
      }
    >
      {result === undefined ? (
        <div className="h-64 animate-pulse rounded-2xl bg-line" />
      ) : result ? (
        <PublicProfileCard result={result} maxCerts={20} />
      ) : (
        <>
          <div className="flex items-center gap-4 rounded-2xl border border-line bg-card p-4">
            <Avatar name={shown.displayName} photoURL={shown.photoURL} className="size-16 text-xl" />
            <div>
              <p className="text-lg font-bold text-fg">{shown.displayName}</p>
              <p className="font-mono text-sm font-bold tracking-wider text-primary-text">🚀 {shown.rocketId}</p>
            </div>
          </div>
          <Notice icon="🙈" title="Perfil no disponible" text="Esta persona ocultó su perfil de las búsquedas, por eso no podemos mostrar sus conocimientos actualizados." />
        </>
      )}
    </BottomSheet>
  )
}

// ---------- Visibilidad ----------

function ExactOnlySetting() {
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
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <h2 className="mb-1.5 px-4 text-xs font-semibold tracking-wide text-muted uppercase">Privacidad</h2>
      <div className="rounded-2xl border border-line bg-card p-4">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p id="exact-only-label" className="font-medium text-fg">Solo aparecer en búsquedas exactas</p>
            <p className="text-xs text-muted">
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
        <p className="mt-3 border-t border-line pt-3 text-xs text-muted">
          👁️ Se muestra: nombre, foto, rocketId y tus conocimientos. <br />
          🔒 Nunca se muestra: correo, documento, teléfono, fecha de nacimiento ni datos de salud.
        </p>
      </div>
    </section>
  )
}
