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
  const [error, setError] = useState(false)
  const closeForm = useCallback(() => setCreating(false), [])

  useEffect(() => {
    if (!user) return
    let alive = true
    fetchMyEvents(user.uid)
      .then((r) => alive && setMine(r))
      .catch((e) => {
        console.error('fetchMyEvents', e)
        if (alive) {
          setMine([])
          setError(true)
        }
      })
    return () => {
      alive = false
    }
  }, [user])

  useEffect(() => {
    if (tab !== 'explore' || publicEvents) return
    fetchPublicEvents()
      .then(setPublicEvents)
      .catch((e) => {
        console.error('fetchPublicEvents', e)
        setPublicEvents([])
        setError(true)
      })
  }, [tab, publicEvents])

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

      {error && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">Algunos eventos no se pudieron cargar. Revisa tu conexión.</p>}

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
        <button type="button" onClick={action.onClick} className="mt-4 h-11 rounded-xl bg-primary px-5 font-semibold text-white active:bg-primary-dark">
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
