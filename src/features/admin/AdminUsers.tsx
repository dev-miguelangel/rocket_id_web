import { useCallback, useEffect, useMemo, useState } from 'react'
import { Segmented } from '../../components/form'
import { useToast } from '../../components/Toast'
import { normalizeText } from '../../lib/searchTokens'
import { useAuth } from '../auth/AuthProvider'
import { subscribeContacts } from '../contacts/contactsApi'
import { PersonRow } from '../contacts/PersonRow'
import { ProfileSheet } from '../contacts/ProfileSheet'
import { fetchUsers, type AdminUser } from './usersApi'

type Kind = 'all' | 'real' | 'mock'
type Sort = 'recent' | 'name'

const short = (d: Date) =>
  d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' })

/** Pestaña "Usuarios" del panel: misma lista que Cordada, con búsqueda y filtros */
export function AdminUsers() {
  const { user } = useAuth()
  const toast = useToast()
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [error, setError] = useState(false)
  const [reload, setReload] = useState(0)
  const [q, setQ] = useState('')
  const [kind, setKind] = useState<Kind>('all')
  const [sort, setSort] = useState<Sort>('recent')
  const [openUid, setOpenUid] = useState<string | null>(null)
  const [cordada, setCordada] = useState<Set<string>>(new Set())
  const closeSheet = useCallback(() => setOpenUid(null), [])

  useEffect(() => {
    let alive = true
    fetchUsers()
      .then((r) => {
        if (!alive) return
        setUsers(r)
        setError(false)
      })
      .catch((e) => {
        console.error('admin users', e)
        if (alive) setError(true)
      })
    return () => {
      alive = false
    }
  }, [reload])

  useEffect(() => {
    if (!user) return
    return subscribeContacts(user.uid, (c) => setCordada(new Set(c.map((x) => x.uid))))
  }, [user])

  const shown = useMemo(() => {
    const term = normalizeText(q).replace(/\s+/g, ' ')
    const compact = term.replace(/[^a-z0-9]/g, '')
    const list = (users ?? []).filter((u) => {
      if (kind === 'real' && u.isMock) return false
      if (kind === 'mock' && !u.isMock) return false
      if (!term) return true
      return (
        normalizeText(u.displayName).includes(term) ||
        normalizeText(u.email).includes(term) ||
        (!!compact &&
          u.rocketId
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '')
            .includes(compact))
      )
    })
    return list.sort((a, b) =>
      sort === 'name' ? a.displayName.localeCompare(b.displayName, 'es') : (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
    )
  }, [users, q, kind, sort])

  const counts = useMemo(() => {
    const all = users ?? []
    const mock = all.filter((u) => u.isMock).length
    return { all: all.length, real: all.length - mock, mock }
  }, [users])

  return (
    <div className="space-y-4">
      <div className="relative">
        <label htmlFor="admin-user-search" className="sr-only">
          Buscar usuarios
        </label>
        <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" aria-hidden="true">
          🔍
        </span>
        <input
          id="admin-user-search"
          type="search"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="off"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nombre, correo o rocketId"
          className="h-11 w-full rounded-xl border border-field bg-card pr-11 pl-10 text-base text-fg outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20 [&::-webkit-search-cancel-button]:hidden"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ('')}
            aria-label="Borrar búsqueda"
            className="absolute top-1/2 right-0 flex size-11 -translate-y-1/2 items-center justify-center"
          >
            <span className="flex size-6 items-center justify-center rounded-full bg-muted/70 text-xs text-white" aria-hidden="true">
              ✕
            </span>
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <Segmented
          label="Mostrar"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'all', label: `Todos · ${counts.all}` },
            { value: 'real', label: `Reales · ${counts.real}` },
            { value: 'mock', label: `Prueba · ${counts.mock}` },
          ]}
        />
        <Segmented
          label="Ordenar"
          value={sort}
          onChange={setSort}
          options={[
            { value: 'recent', label: 'Recientes' },
            { value: 'name', label: 'A-Z' },
          ]}
        />
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          <span className="flex-1">No se pudieron cargar los usuarios. Revisa tu conexión.</span>
          <button
            type="button"
            onClick={() => setReload((n) => n + 1)}
            className="h-11 shrink-0 rounded-lg bg-amber-200/60 px-4 font-semibold active:bg-amber-200 dark:bg-amber-500/20"
          >
            Reintentar
          </button>
        </div>
      )}

      <section aria-live="polite">
        <h2 className="px-1 pb-1 text-base font-bold text-fg">Usuarios {users && <span className="font-normal text-muted">· {shown.length}</span>}</h2>
        {users === null && !error ? (
          <div aria-busy="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 px-1 py-2">
                <div className="size-12 animate-pulse rounded-full bg-line" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-1/2 animate-pulse rounded bg-line" />
                  <div className="h-3 w-1/4 animate-pulse rounded bg-line" />
                </div>
              </div>
            ))}
          </div>
        ) : shown.length === 0 && users ? (
          <div className="px-6 py-10 text-center">
            <p className="font-semibold text-fg">Sin resultados</p>
            <p className="mt-1 text-sm text-muted">Prueba con otro nombre, correo o rocketId, o cambia el filtro.</p>
          </div>
        ) : (
          <ul>
            {shown.map((u) => (
              <li key={u.uid}>
                <PersonRow
                  name={u.displayName}
                  photoURL={u.photoURL}
                  rocketId={u.rocketId}
                  isMock={u.isMock}
                  note={[u.uid === user?.uid ? 'Tú' : cordada.has(u.uid) ? 'En tu cordada' : null, u.createdAt ? `se unió ${short(u.createdAt)}` : null]
                    .filter(Boolean)
                    .join(' · ')}
                  onClick={() => setOpenUid(u.uid)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <ProfileSheet uid={openUid} inCordada={!!openUid && cordada.has(openUid)} onClose={closeSheet} onToast={toast.show} />
      {toast.node}
    </div>
  )
}
