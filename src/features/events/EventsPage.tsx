import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Segmented } from '../../components/form'
import { useAuth } from '../auth/AuthProvider'
import { EventFormSheet } from './EventFormSheet'
import { fetchMyEvents, fetchPublicEvents } from './eventsApi'
import { Chip, EventRow, ParticipantChip } from './parts'
import { isPast, type EventDoc, type Participant } from './schema'

type Tab = 'mine' | 'explore'

export function EventsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('mine')
  const [mine, setMine] = useState<{ event: EventDoc; me: Participant }[] | null>(null)
  const [publicEvents, setPublicEvents] = useState<EventDoc[] | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<{ mine?: boolean; explore?: boolean }>({})
  const [reload, setReload] = useState(0)
  const closeForm = useCallback(() => setCreating(false), [])

  // Reintenta automáticamente una vez (p. ej. mientras un índice termina de construirse)
  const withRetry = <T,>(fn: () => Promise<T>) => fn().catch(() => new Promise<T>((res, rej) => setTimeout(() => fn().then(res, rej), 2500)))

  useEffect(() => {
    if (!user) return
    let alive = true
    withRetry(() => fetchMyEvents(user.uid))
      .then((r) => {
        if (!alive) return
        setMine(r)
        setError((e) => ({ ...e, mine: false }))
      })
      .catch((e) => {
        console.error('fetchMyEvents', e)
        if (alive) {
          setMine((m) => m ?? [])
          setError((x) => ({ ...x, mine: true }))
        }
      })
    return () => {
      alive = false
    }
  }, [user, reload])

  useEffect(() => {
    if (tab !== 'explore') return
    let alive = true
    withRetry(fetchPublicEvents)
      .then((r) => {
        if (!alive) return
        setPublicEvents(r)
        setError((e) => ({ ...e, explore: false }))
      })
      .catch((e) => {
        console.error('fetchPublicEvents', e)
        if (alive) {
          setPublicEvents((p) => p ?? [])
          setError((x) => ({ ...x, explore: true }))
        }
      })
    return () => {
      alive = false
    }
  }, [tab, reload])

  const upcoming = (mine ?? []).filter((r) => !isPast(r.event) && r.me.status !== 'declined')
  const past = (mine ?? []).filter((r) => isPast(r.event) || r.me.status === 'declined')
  const myIds = new Set((mine ?? []).map((r) => r.event.id))

  return (
    <div className="space-y-4 pb-24">
      <Segmented
        label="Ver"
        value={tab}
        options={[
          { value: 'mine', label: 'Mis eventos' },
          { value: 'explore', label: 'Explorar' },
        ]}
        onChange={setTab}
      />

      {error[tab] && (
        <div className="flex items-center gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          <span className="flex-1">No se pudieron cargar los eventos. Revisa tu conexión.</span>
          <button type="button" onClick={() => setReload((n) => n + 1)} className="h-11 shrink-0 rounded-lg bg-amber-200/60 px-4 font-semibold active:bg-amber-200 dark:bg-amber-500/20">
            Reintentar
          </button>
        </div>
      )}

      {tab === 'mine' ? (
        mine === null ? (
          <RowsSkeleton />
        ) : mine.length === 0 ? (
          <Empty
            icon="🏔️"
            title="Aún no tienes eventos"
            text="Crea una salida e invita a tu cordada, o explora los eventos públicos."
            action={{ label: 'Crear evento', onClick: () => setCreating(true) }}
          />
        ) : (
          <>
            <List
              title="Próximos"
              items={upcoming.map((r) => ({
                event: r.event,
                note: r.me.role === 'organizer' ? <Chip tone="success">Organizas</Chip> : <ParticipantChip status={r.me.status} />,
              }))}
              onOpen={(id) => navigate(`/e/${id}`)}
            />
            {past.length > 0 && <List title="Anteriores" items={past.map((r) => ({ event: r.event }))} onOpen={(id) => navigate(`/e/${id}`)} />}
          </>
        )
      ) : publicEvents === null ? (
        <RowsSkeleton />
      ) : publicEvents.length === 0 ? (
        <Empty icon="🌎" title="No hay eventos públicos próximos" text="Sé el primero en publicar una salida abierta." action={{ label: 'Crear evento', onClick: () => setCreating(true) }} />
      ) : (
        <List
          title="Eventos públicos"
          items={publicEvents.map((e) => ({ event: e, note: myIds.has(e.id) ? <Chip tone="success">Participas</Chip> : undefined }))}
          onOpen={(id) => navigate(`/e/${id}`)}
        />
      )}

      {/* Botón flotante (FAB) para crear */}
      <button
        type="button"
        onClick={() => setCreating(true)}
        aria-label="Crear evento"
        className="fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-20 flex size-14 items-center justify-center rounded-2xl bg-primary text-3xl text-white shadow-lg shadow-primary/30 active:scale-95"
      >
        +
      </button>

      <EventFormSheet
        open={creating}
        onClose={closeForm}
        onCreated={(id) => {
          setCreating(false)
          navigate(`/e/${id}`)
        }}
      />
    </div>
  )
}

function List({ title, items, onOpen }: { title: string; items: { event: EventDoc; note?: ReactNode }[]; onOpen: (id: string) => void }) {
  if (!items.length) return null
  return (
    <section>
      <h2 className="px-1 pb-1 text-base font-bold text-fg">{title}</h2>
      <ul>
        {items.map(({ event, note }) => (
          <li key={event.id}>
            <EventRow event={event} note={note} onClick={() => onOpen(event.id)} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function Empty({ icon, title, text, action }: { icon: string; title: string; text: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="text-4xl" aria-hidden="true">{icon}</p>
      <p className="mt-3 font-semibold text-fg">{title}</p>
      <p className="mt-1 text-sm text-muted">{text}</p>
      {action && (
        <button type="button" onClick={action.onClick} className="mt-4 h-11 rounded-xl border border-field bg-card px-5 font-semibold text-primary-text active:bg-line/60">
          {action.label}
        </button>
      )}
    </div>
  )
}

function RowsSkeleton() {
  return (
    <div aria-busy="true" className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3 px-1">
          <div className="size-14 animate-pulse rounded-2xl bg-line" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-2/3 animate-pulse rounded bg-line" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-line" />
          </div>
        </div>
      ))}
    </div>
  )
}
