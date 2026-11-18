import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MIN_QUERY, parseQuery } from '../../lib/searchTokens'
import { useAuth } from '../auth/AuthProvider'
import { subscribeContacts, type Contact } from './contactsApi'
import { PersonRow } from './PersonRow'
import { ProfileSheet } from './ProfileSheet'
import { findPerson, looksLikeEmail, normalizeRocketIdInput, searchApprox, type PublicProfile } from './publicProfile'

/** Resultado de búsqueda unificado (aproximada o exacta) */
interface Hit {
  uid: string
  displayName: string
  photoURL: string | null
  rocketId: string
  isMock: boolean
}

const toHit = (p: PublicProfile): Hit => ({
  uid: p.uid,
  displayName: p.displayName,
  photoURL: p.photoURL,
  rocketId: p.rocketId,
  isMock: p.isMock,
})

/** Vista Cordada estilo buscador de perfiles: barra de búsqueda + una sola lista. */
export function ContactsPage() {
  const { user } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<Hit[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [contacts, setContacts] = useState<Contact[] | null>(null)
  const [openUid, setOpenUid] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    return subscribeContacts(user.uid, setContacts)
  }, [user])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast])

  const text = q.trim()
  const isExact = looksLikeEmail(text) || !!normalizeRocketIdInput(text)
  const isSearching = text.length > 0
  const canSearch = isExact || (!text.includes('@') && !!parseQuery(text))

  // Búsqueda mientras se escribe: exacta (correo / rocketId completo) o aproximada (≥ 3 caracteres)
  useEffect(() => {
    if (!canSearch) return
    let alive = true
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const [exact, approx] = await Promise.all([
          isExact ? findPerson(text).catch(() => null) : Promise.resolve(null),
          looksLikeEmail(text) ? Promise.resolve([]) : searchApprox(text).catch(() => []),
        ])
        if (!alive) return
        const list = [...(exact ? [toHit(exact.profile)] : []), ...approx.map(toHit)]
        setHits(list.filter((h, i) => list.findIndex((x) => x.uid === h.uid) === i))
      } finally {
        if (alive) setLoading(false)
      }
    }, 300)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [text, canSearch, isExact])

  const cordadaUids = useMemo(() => new Set(contacts?.map((c) => c.uid)), [contacts])
  const closeSheet = useCallback(() => setOpenUid(null), [])

  const clear = () => {
    setQ('')
    setHits(null)
    inputRef.current?.blur()
  }

  return (
    <div className="-mt-1 pb-4">
      {/* Barra de búsqueda */}
      <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-10 -mx-4 bg-surface/95 px-4 pt-1 pb-3 backdrop-blur">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault()
            inputRef.current?.blur()
          }}
          className="flex items-center gap-2"
        >
          <label htmlFor="people-search" className="sr-only">
            Buscar por nombre, correo o rocketId
          </label>
          <div className="relative min-w-0 flex-1">
            <SearchIcon />
            <input
              ref={inputRef}
              id="people-search"
              type="search"
              enterKeyHint="search"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="off"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar"
              className="h-11 w-full rounded-xl bg-line/70 pr-9 pl-10 text-base text-fg outline-none placeholder:text-muted focus:ring-2 focus:ring-primary/30 [&::-webkit-search-cancel-button]:hidden"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ('')}
                aria-label="Borrar búsqueda"
                className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full bg-muted/60 text-xs text-white"
              >
                ✕
              </button>
            )}
          </div>
          {isSearching && (
            <button type="button" onClick={clear} className="h-11 shrink-0 px-1 text-base font-medium text-primary-text active:opacity-60">
              Cancelar
            </button>
          )}
        </form>
      </div>

      {isSearching ? (
        // ---------- Resultados ----------
        <section aria-live="polite">
          {!canSearch ? (
            <p className="px-1 py-6 text-center text-sm text-muted">
              {text.includes('@') ? 'Escribe el correo completo.' : `Escribe al menos ${MIN_QUERY} caracteres.`}
            </p>
          ) : loading && !hits ? (
            <RowsSkeleton />
          ) : hits && hits.length > 0 ? (
            <ul>
              {hits.map((h) => (
                <li key={h.uid}>
                  <PersonRow
                    name={h.displayName}
                    photoURL={h.photoURL}
                    rocketId={h.rocketId}
                    isMock={h.isMock}
                    note={h.uid === user?.uid ? 'Tú' : cordadaUids.has(h.uid) ? 'En tu cordada' : undefined}
                    onClick={() => setOpenUid(h.uid)}
                  />
                </li>
              ))}
            </ul>
          ) : hits ? (
            <div className="px-6 py-10 text-center">
              <p className="font-semibold text-fg">Sin resultados</p>
              <p className="mt-1 text-sm text-muted">
                Prueba con el correo exacto o el rocketId completo. Algunas personas solo aparecen en búsquedas exactas.
              </p>
            </div>
          ) : null}
        </section>
      ) : (
        // ---------- Mi cordada ----------
        <section>
          <h2 className="px-1 pb-1 text-base font-bold text-fg">
            Mi cordada {contacts?.length ? <span className="font-normal text-muted">· {contacts.length}</span> : null}
          </h2>
          {contacts === null ? (
            <RowsSkeleton />
          ) : contacts.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-4xl" aria-hidden="true">🧗</p>
              <p className="mt-3 font-semibold text-fg">Tu cordada está vacía</p>
              <p className="mt-1 text-sm text-muted">Busca a tus compañeros de salida por nombre, correo o rocketId.</p>
              <button
                type="button"
                onClick={() => inputRef.current?.focus()}
                className="mt-4 h-11 rounded-xl bg-primary px-5 font-semibold text-white active:bg-primary-dark"
              >
                Buscar personas
              </button>
            </div>
          ) : (
            <ul>
              {contacts.map((c) => (
                <li key={c.uid}>
                  <PersonRow
                    name={c.displayName}
                    photoURL={c.photoURL}
                    rocketId={c.rocketId}
                    isMock={c.uid.startsWith('mock_')}
                    onClick={() => setOpenUid(c.uid)}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <ProfileSheet uid={openUid} inCordada={!!openUid && cordadaUids.has(openUid)} onClose={closeSheet} onToast={setToast} />

      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 transition-all duration-300 motion-reduce:transition-none ${toast ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
      >
        {toast && (
          <span className="rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg ring-1 ring-white/10">{toast}</span>
        )}
      </div>
    </div>
  )
}

function RowsSkeleton() {
  return (
    <div aria-busy="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 px-1 py-2">
          <div className="size-12 animate-pulse rounded-full bg-line" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-1/2 animate-pulse rounded bg-line" />
            <div className="h-3 w-1/4 animate-pulse rounded bg-line" />
          </div>
        </div>
      ))}
    </div>
  )
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}
