import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { Avatar } from '../../components/Avatar'
import { BottomSheet } from '../../components/Sheet'
import { HoldButton } from '../../components/HoldButton'
import { SwipeRow } from '../../components/SwipeRow'
import { useToast } from '../../components/Toast'
import { VerifiedBadge } from '../../components/VerifiedBadge'
import { firstName } from '../../lib/names'
import { useAuth } from '../auth/AuthProvider'
import { subscribeContacts, type Contact } from '../contacts/contactsApi'
import { PublicProfileCard } from '../contacts/PublicProfileCard'
import { getPublicProfile, type SearchResult } from '../contacts/publicProfile'
import { DOC_TYPES } from '../profile/schema'
import { categoryOf, isPastExpiry, verificationFor } from '../skills/schema'
import {
  cancelEvent,
  confirmAttendance,
  declineAttendance,
  emergencyAccess,
  invite,
  queueOfflineViewNotice,
  removeParticipant,
  saveFichasOffline,
  setCoOrganizer,
  subscribeEvent,
  subscribeParticipants,
  viewSensitive,
  type SensitiveData,
} from './eventsApi'
import { EventFormSheet } from './EventFormSheet'
import { Chip, ParticipantChip, VisibilityChip } from './parts'
import {
  EVENT_CONSENT_TEXT,
  MAX_CO_ORGANIZERS,
  activityOf,
  emergencyWindowOpen,
  formatEventDate,
  isPast,
  sensitiveWindowOpen,
  type EventDoc,
  type Participant,
  type Requirement,
} from './schema'
import { useMe } from './useMe'
import { useOnline } from '../../lib/useOnline'
import { toE164Digits } from '../../lib/phone'
import { getOfflineEvent, removeOfflineEvent, removeOfflineFicha, saveOfflineFichas } from './offlineFichas'

const primaryBtn =
  'flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-white transition active:bg-primary-dark disabled:opacity-50'
const secondaryBtn =
  'flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-line-strong bg-card text-base font-semibold text-fg active:bg-line/60 disabled:opacity-60'

/** ¿Cumple la persona el requisito? (certificación activa del área; "verified" si una institución la verificó) */
function meets(req: Requirement, r: SearchResult | undefined) {
  if (!r || r.profile.skills.hasCertifications !== 'yes') return { ok: false, verified: false }
  const certs = r.profile.skills.certifications.filter(
    (c) => c.category === req.category && c.status !== 'in_progress' && !(c.status === 'expired' || isPastExpiry(c.expiresAt)),
  )
  return { ok: certs.length > 0, verified: certs.some((c) => verificationFor(c, r.verifications)) }
}

export function EventDetailPage() {
  const { eventId = '' } = useParams()
  const { user } = useAuth()
  const me = useMe()
  const toast = useToast()
  const [event, setEvent] = useState<EventDoc | null | undefined>(undefined)
  const [participants, setParticipants] = useState<Participant[] | null>(null)
  const [profiles, setProfiles] = useState<Record<string, SearchResult>>({})
  const [sheet, setSheet] = useState<null | 'consent' | 'invite' | 'cancel' | 'edit' | 'options' | 'offline'>(null)
  const [openP, setOpenP] = useState<Participant | null>(null)
  const [busy, setBusy] = useState(false)
  const [editSession, setEditSession] = useState(0)
  const closeSheet = useCallback(() => setSheet(null), [])
  const closeP = useCallback(() => setOpenP(null), [])

  useEffect(() => subscribeEvent(eventId, setEvent), [eventId])
  // Solo participantes y organizador pueden leer la lista (si no, queda en null)
  useEffect(() => subscribeParticipants(eventId, setParticipants), [eventId, user])

  const isOrganizer = !!event && event.organizerUid === user?.uid
  const myRow = participants?.find((p) => p.uid === user?.uid)
  // Equipo de seguridad: organizador o co-organizador confirmado (mismo criterio que las reglas)
  const isLead = isOrganizer || (!!event && !!user && event.coOrganizers.includes(user.uid) && myRow?.status === 'confirmed')
  const confirmed = useMemo(() => participants?.filter((p) => p.status === 'confirmed') ?? [], [participants])

  // Perfiles públicos de los confirmados (para requisitos), solo para el organizador
  useEffect(() => {
    if (!isOrganizer || !event?.requirements.length) return
    const missing = confirmed.filter((p) => p.role === 'participant' && !profiles[p.uid])
    if (!missing.length) return
    Promise.all(missing.map((p) => getPublicProfile(p.uid).then((r) => [p.uid, r] as const))).then((pairs) =>
      setProfiles((cur) => ({ ...cur, ...Object.fromEntries(pairs.filter(([, r]) => r) as [string, SearchResult][]) })),
    )
  }, [isOrganizer, event, confirmed, profiles])

  if (event === undefined) return <div className="h-80 animate-pulse rounded-2xl bg-line" aria-label="Cargando evento" />
  if (event === null)
    return (
      <div className="px-6 py-12 text-center">
        <p className="text-4xl" aria-hidden="true">🔗</p>
        <p className="mt-3 font-semibold text-fg">Evento no encontrado</p>
        <p className="mt-1 text-sm text-muted">El enlace no es válido o el evento ya no existe.</p>
        <Link to="/eventos" className="mt-4 inline-flex h-11 items-center rounded-xl bg-primary px-5 font-semibold text-white active:bg-primary-dark">
          Ver eventos
        </Link>
      </div>
    )

  const a = activityOf(event.activity)
  const cancelled = event.status === 'cancelled'
  const past = isPast(event)
  const full = event.capacity > 0 && confirmed.length >= event.capacity
  const url = `${window.location.origin}/e/${event.id}`

  const doConfirm = async () => {
    if (!me) return
    setBusy(true)
    try {
      await confirmAttendance(event, me, !!myRow)
      navigator.vibrate?.([10, 40, 10])
      toast.show('¡Confirmado! Nos vemos en la salida 🏔️')
      setSheet(null)
    } catch (e) {
      console.error('confirmAttendance', e)
      toast.show('No se pudo confirmar. Inténtalo de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  const doDecline = async () => {
    if (!me) return
    setBusy(true)
    try {
      await declineAttendance(event, me)
      toast.show('Avisamos al organizador que no vas')
    } catch {
      toast.show('No se pudo actualizar. Inténtalo de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  const shareWhatsApp = () => {
    const text = `Te invito a “${event.title}” · ${formatEventDate(event.startAt, event.endAt)} ${a.icon} ${url}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
  }

  // ---------- Acción principal según mi rol/estado ----------
  let action: ReactNode = null
  if (cancelled) action = <p className="rounded-xl bg-red-50 p-3 text-center text-sm font-medium text-red-700 dark:bg-red-500/10 dark:text-red-300">Este evento fue cancelado</p>
  else if (past) action = <p className="text-center text-sm text-muted">Este evento ya terminó</p>
  else if (isOrganizer)
    action = (
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
        <button type="button" onClick={shareWhatsApp} className={`${secondaryBtn} px-4`} aria-label="Compartir por WhatsApp">
          💬 Compartir
        </button>
        <button type="button" onClick={() => setSheet('invite')} className={primaryBtn}>
          🪢 Invitar a mi cordada
        </button>
      </div>
    )
  else if (myRow?.status === 'confirmed')
    action = (
      <div className="space-y-2">
        <p className="rounded-xl bg-emerald-50 p-3 text-center text-base font-semibold text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">✓ Vas a este evento</p>
        <button type="button" onClick={doDecline} disabled={busy} className="h-11 w-full rounded-lg text-sm font-medium text-red-600 active:bg-red-50 dark:text-red-400">
          Ya no puedo ir
        </button>
      </div>
    )
  else if (myRow?.status === 'invited')
    action = (
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={doDecline} disabled={busy} className={secondaryBtn}>
          No puedo
        </button>
        <button type="button" onClick={() => setSheet('consent')} className={primaryBtn}>
          Confirmar
        </button>
      </div>
    )
  else
    action = (
      <button type="button" onClick={() => setSheet('consent')} disabled={full} className={primaryBtn}>
        {full ? 'Cupos completos' : myRow?.status === 'declined' ? 'Volver a confirmar' : 'Unirme a este evento'}
      </button>
    )

  return (
    <div className={`space-y-5 ${cancelled || past ? 'pb-4' : 'pb-32'}`}>
      {/* Encabezado */}
      <section className="rounded-3xl bg-gradient-to-br from-primary-dark to-primary p-5 text-white shadow-lg shadow-primary/20">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span aria-hidden="true">{a.icon}</span>
          {a.label}
          <span className="ml-auto flex items-center gap-2">
            <VisibilityChip visibility={event.visibility} />
            {isOrganizer && !cancelled && (
              <button
                type="button"
                onClick={() => setSheet('options')}
                aria-label="Opciones del evento"
                className="-my-2 -mr-2 flex size-11 items-center justify-center rounded-full text-xl font-bold text-white active:bg-white/20"
              >
                ⋯
              </button>
            )}
          </span>
        </div>
        <h2 className={`mt-2 text-2xl leading-tight font-bold ${cancelled ? 'line-through opacity-70' : ''}`}>{event.title}</h2>
        <p className="mt-2 text-base">📅 {formatEventDate(event.startAt, event.endAt)}</p>
        <p className="text-base">📍 {event.location}</p>
        {event.meetingPoint && <p className="text-base">🚩 {event.meetingPoint}</p>}
        <div className="mt-4 flex items-center gap-2 border-t border-white/20 pt-3">
          <Avatar name={event.organizerName} photoURL={event.organizerPhoto} className="size-8 text-xs ring-2 ring-white/40" />
          <span className="text-sm">
            Organiza <strong>{event.organizerName}</strong>
          </span>
        </div>
      </section>

      {(cancelled || past) && action}

      {event.description && (
        <Block title="Descripción">
          <p className="max-w-prose text-base leading-relaxed whitespace-pre-line text-fg-soft">{event.description}</p>
        </Block>
      )}

      {event.requirements.length > 0 && (
        <Block title="Requisitos">
          <ul className="space-y-2">
            {event.requirements.map((r, i) => {
              const okCount = isOrganizer ? confirmed.filter((p) => p.role === 'participant' && meets(r, profiles[p.uid]).ok).length : null
              const total = confirmed.filter((p) => p.role === 'participant').length
              return (
                <li key={i} className="flex items-center gap-2 text-sm text-fg">
                  <span aria-hidden="true">{categoryOf(r.category)?.icon}</span>
                  <span className="flex-1">{r.label}</span>
                  {okCount !== null && total > 0 && <Chip tone={okCount === total ? 'success' : 'info'}>{okCount}/{total} cumplen</Chip>}
                </li>
              )
            })}
          </ul>
        </Block>
      )}

      {participants && <SafetyTeam event={event} participants={participants} />}

      {isLead && !cancelled && sensitiveWindowOpen(event) && (
        <OfflineStatus event={event} participants={participants ?? []} onOpen={() => setSheet('offline')} />
      )}

      {isOrganizer && !cancelled && <Checklist event={event} participants={participants ?? []} profiles={profiles} />}

      {/* Participantes (solo visible para quienes participan) */}
      {participants && (
        <section>
          <div className="flex items-baseline justify-between px-1 pb-1">
            <h3 className="text-base font-bold text-fg">
              Participantes <span className="font-normal text-muted">· {confirmed.length}{event.capacity ? `/${event.capacity}` : ''}</span>
            </h3>
            {isOrganizer && <span className="text-xs text-subtle">Desliza ← → para acciones</span>}
          </div>
          <ul>
            {[...participants]
              .sort((x, y) => (x.role === 'organizer' ? -1 : y.role === 'organizer' ? 1 : x.displayName.localeCompare(y.displayName)))
              .map((p) => (
                <li key={p.uid}>
                  <SwipeRow
                    leading={[{ key: 'view', label: 'Perfil', icon: '👤', tone: 'primary', onClick: () => setOpenP(p) }]}
                    trailing={
                      isOrganizer && p.role === 'participant'
                        ? [{ key: 'rm', label: 'Quitar', icon: '✕', tone: 'danger', onClick: () => removeParticipant(event.id, p.uid).then(() => toast.show(`${firstName(p.displayName)} ya no está en el evento`)) }]
                        : []
                    }
                  >
                    <button type="button" onClick={() => setOpenP(p)} className="flex w-full items-center gap-3 px-1 py-2 text-left active:opacity-60">
                      <Avatar name={p.displayName} photoURL={p.photoURL} className="size-11" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold text-fg">
                          {p.displayName} {p.uid === user?.uid && <span className="font-normal text-muted">(tú)</span>}
                        </span>
                        <span className="block font-mono text-xs tracking-wide whitespace-nowrap text-muted">{p.rocketId}</span>
                      </span>
                      {isLead && p.role === 'participant' && p.status === 'confirmed' && !p.emergencyComplete && (
                        <span title="Ficha de emergencia incompleta" aria-label="Ficha de emergencia incompleta">⚠️</span>
                      )}
                      {p.role === 'organizer' ? (
                        <Chip tone="success">Organiza</Chip>
                      ) : event.coOrganizers.includes(p.uid) && p.status === 'confirmed' ? (
                        <Chip tone="success">🛡️ Seguridad</Chip>
                      ) : (
                        <ParticipantChip status={p.status} />
                      )}
                    </button>
                  </SwipeRow>
                </li>
              ))}
          </ul>
        </section>
      )}

      {/* Acción principal en la zona del pulgar, sobre la navegación inferior */}
      {!cancelled && !past && (
        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 border-t border-line bg-surface/95 backdrop-blur">
          <div className="mx-auto max-w-3xl px-4 py-3">{action}</div>
        </div>
      )}

      {/* Opciones del organizador: secundarias y destructivas, arriba y fuera de la zona del pulgar */}
      <BottomSheet open={sheet === 'options'} title="Opciones del evento" onClose={closeSheet}>
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
          <li>
            <OptionRow
              icon="✎"
              label="Editar evento"
              onClick={() => {
                setEditSession((n) => n + 1)
                setSheet('edit')
              }}
            />
          </li>
          <li>
            <OptionRow icon="💬" label="Compartir por WhatsApp" onClick={() => { setSheet(null); shareWhatsApp() }} />
          </li>
          <li>
            <OptionRow
              icon="⧉"
              label="Copiar enlace del evento"
              onClick={() => {
                navigator.clipboard?.writeText(url).then(() => toast.show('Enlace copiado')).catch(() => {})
                setSheet(null)
              }}
            />
          </li>
          {sensitiveWindowOpen(event) && (
            <li>
              <OptionRow icon="📥" label="Fichas sin conexión" onClick={() => setSheet('offline')} />
            </li>
          )}
        </ul>
        {!past && (
          <ul className="overflow-hidden rounded-2xl border border-line bg-card">
            <li>
              <OptionRow icon="🚫" label="Cancelar evento" danger onClick={() => setSheet('cancel')} />
            </li>
          </ul>
        )}
      </BottomSheet>

      {/* ---------- Hojas ---------- */}
      {isOrganizer && (
        <EventFormSheet
          key={editSession}
          open={sheet === 'edit'}
          event={event}
          onClose={closeSheet}
          onCreated={() => {
            setSheet(null)
            toast.show('Cambios guardados')
          }}
        />
      )}
      <ConsentSheet open={sheet === 'consent'} event={event} busy={busy} onClose={closeSheet} onConfirm={doConfirm} />
      <InviteSheet open={sheet === 'invite'} event={event} participants={participants ?? []} onClose={closeSheet} onInvited={(n) => toast.show(`Invitación enviada a ${n}`)} />
      <BottomSheet
        open={sheet === 'cancel'}
        title="Cancelar evento"
        onClose={closeSheet}
        footer={
          <div className="grid grid-cols-2 gap-2 pb-3">
            <button type="button" onClick={closeSheet} className={secondaryBtn}>
              Volver
            </button>
            <button
              type="button"
              onClick={() =>
                (me ? cancelEvent(event, me) : Promise.reject(new Error('sin perfil')))
                  .then(() => toast.show('Evento cancelado · avisamos a los participantes'))
                  .catch(() => toast.show('No se pudo cancelar. Inténtalo de nuevo.'))
                  .finally(closeSheet)
              }
              className="h-12 rounded-xl bg-red-600 font-semibold text-white active:bg-red-700"
            >
              Cancelar evento
            </button>
          </div>
        }
      >
        <p className="text-base text-fg">¿Cancelar “{event.title}”? Los participantes verán el evento como cancelado.</p>
      </BottomSheet>
      <ParticipantSheet
        participant={openP}
        event={event}
        isOrganizer={isOrganizer}
        isLead={isLead}
        iAmConfirmed={myRow?.status === 'confirmed'}
        onClose={closeP}
        onToast={toast.show}
      />
      {isLead && (
        <OfflineFichasSheet open={sheet === 'offline'} event={event} participants={participants ?? []} onClose={closeSheet} onDone={(m) => toast.show(m)} />
      )}

      {toast.node}
    </div>
  )
}

function OptionRow({ icon, label, danger, onClick }: { icon: string; label: string; danger?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-12 w-full items-center gap-3 px-4 text-left text-base font-medium active:bg-line/60 ${danger ? 'text-red-600 dark:text-red-400' : 'text-fg'}`}
    >
      <span className="w-6 text-center text-lg" aria-hidden="true">{icon}</span>
      <span className="flex-1">{label}</span>
      {!danger && <span className="text-muted" aria-hidden="true">›</span>}
    </button>
  )
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 px-1 text-xs font-semibold tracking-wide text-muted uppercase">{title}</h3>
      <div className="rounded-2xl border border-line bg-card p-4">{children}</div>
    </section>
  )
}

// ---------- Revisión antes de la salida (organizador) ----------

function Checklist({ event, participants, profiles }: { event: EventDoc; participants: Participant[]; profiles: Record<string, SearchResult> }) {
  const others = participants.filter((p) => p.role === 'participant')
  const confirmed = others.filter((p) => p.status === 'confirmed')
  const pending = others.filter((p) => p.status === 'invited')
  const incomplete = confirmed.filter((p) => !p.emergencyComplete)
  const reqGaps = event.requirements.flatMap((r) =>
    confirmed.filter((p) => !meets(r, profiles[p.uid]).ok).map((p) => `${firstName(p.displayName)}: ${r.label}`),
  )
  const items = [
    { ok: confirmed.length > 0, text: `${confirmed.length} ${confirmed.length === 1 ? 'persona confirmada' : 'personas confirmadas'}` },
    { ok: pending.length === 0, text: pending.length ? `${pending.length} sin responder: ${pending.map((p) => firstName(p.displayName)).join(', ')}` : 'Todas las invitaciones respondidas' },
    {
      ok: incomplete.length === 0,
      text: incomplete.length ? `Ficha de emergencia incompleta: ${incomplete.map((p) => firstName(p.displayName)).join(', ')}` : 'Fichas de emergencia completas',
    },
    ...(event.requirements.length
      ? [{ ok: reqGaps.length === 0, text: reqGaps.length ? `Requisitos pendientes — ${reqGaps.join(' · ')}` : 'Todos cumplen los requisitos' }]
      : []),
    {
      ok: event.coOrganizers.some((uid) => confirmed.some((p) => p.uid === uid)),
      text: event.coOrganizers.some((uid) => confirmed.some((p) => p.uid === uid))
        ? 'Hay respaldo en el equipo de seguridad'
        : 'Sin respaldo: suma a alguien al equipo de seguridad (toca a un confirmado)',
    },
  ]
  const allOk = items.every((i) => i.ok)
  return (
    <Block title="Revisión antes de la salida">
      <ul className="space-y-2.5">
        {items.map((i) => (
          <li key={i.text} className="flex items-start gap-2.5 text-sm">
            <span aria-hidden="true">{i.ok ? '✅' : '⚠️'}</span>
            <span className={i.ok ? 'text-fg-soft' : 'font-medium text-fg'}>{i.text}</span>
          </li>
        ))}
      </ul>
      {allOk && <p className="mt-3 rounded-lg bg-emerald-50 p-2 text-center text-sm font-medium text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">Todo listo para salir 🎒</p>}
    </Block>
  )
}

// ---------- Consentimiento al confirmar / unirse ----------

function ConsentSheet({ open, event, busy, onClose, onConfirm }: { open: boolean; event: EventDoc; busy: boolean; onClose: () => void; onConfirm: () => void }) {
  const [ok, setOk] = useState(false)
  return (
    <BottomSheet
      open={open}
      title="Confirmar asistencia"
      onClose={onClose}
      footer={
        <div className="pb-3">
          <button type="button" disabled={!ok || busy} onClick={onConfirm} className={primaryBtn}>
            {busy ? 'Confirmando…' : 'Aceptar y confirmar'}
          </button>
        </div>
      }
    >
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
        <p className="font-semibold text-fg">Compartirás tu ficha de emergencia con {event.organizerName}</p>
        <p className="mt-1 max-w-prose text-base text-fg-soft">{EVENT_CONSENT_TEXT}</p>
      </div>
      <p className="px-1 text-xs text-muted">
        Revisa que tu ficha esté al día en{' '}
        <Link to="/mis-datos" className="font-medium text-primary-text underline">
          Mis datos
        </Link>
        . Se envía una copia al confirmar; si la cambias después, vuelve a confirmar para actualizarla.
      </p>
      {event.visibility === 'public' && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <p className="font-semibold">⚠️ Evento público</p>
          <p className="mt-1">rocketId no organiza ni supervisa esta actividad. Asistes bajo tu propia responsabilidad: verifica que tu experiencia y equipo sean adecuados.</p>
        </div>
      )}
      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-card p-4 active:bg-line/40">
        <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} className="mt-0.5 size-6 shrink-0 accent-[#0D9488]" />
        <span className="text-sm text-fg">
          Acepto compartir mi ficha de emergencia con <strong>{event.organizerName}</strong> para “{event.title}”.
        </span>
      </label>
    </BottomSheet>
  )
}

// ---------- Invitar desde la cordada ----------

function InviteSheet({
  open,
  event,
  participants,
  onClose,
  onInvited,
}: {
  open: boolean
  event: EventDoc
  participants: Participant[]
  onClose: () => void
  onInvited: (name: string) => void
}) {
  const { user } = useAuth()
  const me = useMe()
  const [contacts, setContacts] = useState<Contact[] | null>(null)
  const [sending, setSending] = useState<string | null>(null)
  useEffect(() => {
    if (!user || !open) return
    return subscribeContacts(user.uid, setContacts)
  }, [user, open])
  const inEvent = new Set(participants.map((p) => p.uid))

  const send = async (c: Contact) => {
    if (!me) return
    setSending(c.uid)
    try {
      await invite(event, me, c)
      navigator.vibrate?.(10)
      onInvited(firstName(c.displayName))
    } catch (e) {
      console.error('invite', e)
    } finally {
      setSending(null)
    }
  }

  return (
    <BottomSheet open={open} title="Invitar a tu cordada" onClose={onClose}>
      {contacts === null ? (
        <div className="h-40 animate-pulse rounded-2xl bg-line" />
      ) : contacts.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <p className="font-semibold text-fg">Tu cordada está vacía</p>
          <p className="mt-1 text-sm text-muted">Agrega personas en Cordada o comparte el enlace del evento por WhatsApp.</p>
        </div>
      ) : (
        <ul>
          {contacts.map((c) => (
            <li key={c.uid} className="flex items-center gap-3 py-2">
              <Avatar name={c.displayName} photoURL={c.photoURL} className="size-11" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold text-fg">{c.displayName}</span>
                <span className="block font-mono text-xs whitespace-nowrap text-muted">{c.rocketId}</span>
              </span>
              {inEvent.has(c.uid) ? (
                <span className="text-sm text-muted">Invitado</span>
              ) : (
                <button type="button" onClick={() => send(c)} disabled={sending === c.uid} className="h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-white active:bg-primary-dark disabled:opacity-50">
                  {sending === c.uid ? '…' : 'Invitar'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </BottomSheet>
  )
}

// ---------- Participante: perfil + ficha de emergencia (organizador) ----------

interface ParticipantSheetProps {
  participant: Participant | null
  event: EventDoc
  isOrganizer: boolean
  /** Organizador o co-organizador confirmado */
  isLead: boolean
  iAmConfirmed: boolean
  onClose: () => void
  onToast: (msg: string) => void
}

function ParticipantSheet({ participant, event, isOrganizer, isLead, iAmConfirmed, onClose, onToast }: ParticipantSheetProps) {
  const me = useMe()
  const online = useOnline()
  const [shown, setShown] = useState(participant)
  const [profile, setProfile] = useState<SearchResult | null | undefined>(undefined)
  const [fromDevice, setFromDevice] = useState(false)
  const [step, setStep] = useState<'profile' | 'warn' | 'emergency' | 'data'>('profile')
  const [viaEmergency, setViaEmergency] = useState(false)
  const [data, setData] = useState<SensitiveData | null | undefined>(undefined)
  const [loading, setLoading] = useState(false)

  if (participant && participant !== shown) {
    setShown(participant)
    setProfile(undefined)
    setStep('profile')
    setData(undefined)
    setFromDevice(false)
    setViaEmergency(false)
  }

  useEffect(() => {
    if (!participant) return
    let alive = true
    getPublicProfile(participant.uid)
      .then((r) => alive && setProfile(r))
      .catch(() => alive && setProfile(null))
    return () => {
      alive = false
    }
  }, [participant])

  if (!shown) return null
  const isConfirmedParticipant = shown.role === 'participant' && shown.status === 'confirmed'
  const canView = isLead && isConfirmedParticipant && sensitiveWindowOpen(event) && event.status === 'published'
  // Acceso de emergencia: confirmados que no son del equipo, solo durante la salida y con conexión
  const canEmergency = !isLead && iAmConfirmed && isConfirmedParticipant && shown.uid !== me?.uid && emergencyWindowOpen(event) && online
  const isCoOrg = event.coOrganizers.includes(shown.uid)
  const canManageTeam = isOrganizer && isConfirmedParticipant && event.status === 'published' && (isCoOrg || event.coOrganizers.length < MAX_CO_ORGANIZERS)

  const toggleTeam = async () => {
    if (!me) return
    try {
      await setCoOrganizer(event, me, shown.uid, !isCoOrg)
      onToast(isCoOrg ? `${firstName(shown.displayName)} salió del equipo de seguridad` : `${firstName(shown.displayName)} ahora es parte del equipo de seguridad`)
      onClose()
    } catch {
      onToast('No se pudo actualizar el equipo de seguridad.')
    }
  }

  const openEmergency = async () => {
    if (!me) return
    setLoading(true)
    try {
      setData(await emergencyAccess(event, me, shown.uid))
      setViaEmergency(true)
      setStep('data')
    } catch (e) {
      console.error('emergencyAccess', e)
      setData(null)
      setStep('data')
    } finally {
      setLoading(false)
    }
  }
  // Copia guardada en este teléfono (para emergencias sin señal)
  const local = me ? getOfflineEvent(event.id, me.uid)?.fichas[shown.uid] : undefined
  const offlineNoCopy = canView && !online && !local

  const view = async () => {
    if (!me) return
    // Sin señal: se abre la copia del teléfono y el aviso queda en cola hasta que vuelva la conexión
    if (!online && local) {
      queueOfflineViewNotice(event, me, shown.uid)
      setData(local.data)
      setFromDevice(true)
      setStep('data')
      return
    }
    setLoading(true)
    try {
      setData(await viewSensitive(event, me, shown.uid))
      setStep('data')
    } catch (e) {
      console.error('viewSensitive', e)
      setData(null)
      setStep('data')
    } finally {
      setLoading(false)
    }
  }

  const footer =
    step === 'profile' && (canView || canEmergency || canManageTeam) ? (
      <div className="space-y-2 pb-3">
        {canEmergency && (
          <button
            type="button"
            onClick={() => setStep('emergency')}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-red-600 text-base font-semibold text-red-700 active:bg-red-50 dark:text-red-400 dark:active:bg-red-500/10"
          >
            🆘 Acceso de emergencia
          </button>
        )}
        {canManageTeam && (
          <button type="button" onClick={toggleTeam} className={secondaryBtn}>
            {isCoOrg ? 'Quitar del equipo de seguridad' : '🛡️ Sumar al equipo de seguridad'}
          </button>
        )}
        {offlineNoCopy && (
          <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
            Sin conexión y sin copia en este teléfono. Para la próxima, guarda las fichas antes de salir desde <strong>Opciones → Fichas sin conexión</strong>.
          </p>
        )}
        {canView && (
          <button type="button" onClick={() => setStep('warn')} disabled={offlineNoCopy} className={primaryBtn}>
            🩺 Ver ficha de emergencia{!online && local ? ' (sin conexión)' : ''}
          </button>
        )}
      </div>
    ) : step === 'emergency' ? (
      <div className="space-y-2 pb-3">
        <HoldButton onConfirm={openEmergency} disabled={loading}>
          {loading ? 'Abriendo…' : 'Mantén presionado para abrir la ficha'}
        </HoldButton>
        <button type="button" onClick={() => setStep('profile')} className="h-11 w-full rounded-lg text-sm font-medium text-fg-soft active:bg-line/60">
          No es una emergencia
        </button>
      </div>
    ) : step === 'warn' ? (
      <div className="grid grid-cols-2 gap-2 pb-3">
        <button type="button" onClick={() => setStep('profile')} className={secondaryBtn}>
          Volver
        </button>
        <button type="button" onClick={view} disabled={loading} className={primaryBtn}>
          {loading ? 'Abriendo…' : 'Ver y notificar'}
        </button>
      </div>
    ) : undefined

  return (
    <BottomSheet open={!!participant} title={step === 'data' ? 'Ficha de emergencia' : 'Participante'} onClose={onClose} footer={footer}>
      {step === 'profile' &&
        (profile === undefined ? (
          <div className="h-64 animate-pulse rounded-2xl bg-line" />
        ) : profile ? (
          <PublicProfileCard result={profile} maxCerts={20} />
        ) : (
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-card p-4">
            <Avatar name={shown.displayName} photoURL={shown.photoURL} className="size-14" />
            <div>
              <p className="font-semibold text-fg">{shown.displayName}</p>
              <p className="font-mono text-sm whitespace-nowrap text-muted">{shown.rocketId}</p>
            </div>
          </div>
        ))}

      {step === 'warn' && (
        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            <span className="text-2xl" aria-hidden="true">🔔</span>
            <div>
              <p className="font-semibold">{firstName(shown.displayName)} será notificado</p>
              <p className="mt-1 text-base">
                Vas a ver datos sensibles (identificación, salud y contacto de emergencia). {firstName(shown.displayName)} recibirá una notificación indicando que viste su ficha en “{event.title}”
                {!online && local ? ' apenas vuelva la conexión' : ''}.
              </p>
            </div>
          </div>
          <p className="px-1 text-xs text-muted">Úsala solo para la seguridad del grupo. El acceso se cierra 2 días después del evento.</p>
        </div>
      )}

      {step === 'emergency' && (
        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-2xl border-2 border-red-300 bg-red-50 p-4 text-red-900 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
            <span className="text-2xl" aria-hidden="true">🆘</span>
            <div>
              <p className="text-lg font-bold">¿Es una emergencia?</p>
              <p className="mt-1 text-base">
                Úsalo solo si {firstName(shown.displayName)} necesita ayuda y el organizador y su equipo de seguridad no están disponibles.
              </p>
            </div>
          </div>
          <ul className="space-y-2 rounded-2xl border border-line bg-card p-4 text-base text-fg-soft">
            <li>🔔 Se avisará a {firstName(shown.displayName)}, al organizador y al equipo de seguridad.</li>
            <li>📝 El acceso queda registrado a tu nombre.</li>
            <li>📞 Si hay riesgo vital, llama primero al <strong>131 (SAMU)</strong>.</li>
          </ul>
          <a href="tel:131" className="flex h-12 items-center justify-center gap-2 rounded-xl border border-field bg-card font-semibold text-fg active:bg-line/60">
            📞 Llamar al 131 (SAMU)
          </a>
        </div>
      )}

      {step === 'data' && viaEmergency && (
        <p className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-800 dark:bg-red-500/10 dark:text-red-200">
          🆘 Acceso de emergencia registrado. Avisamos a {firstName(shown.displayName)}, al organizador y al equipo de seguridad.
        </p>
      )}
      {step === 'data' && fromDevice && local && (
        <p className="rounded-xl bg-sky-50 p-3 text-sm text-sky-900 dark:bg-sky-500/10 dark:text-sky-200">
          📥 Copia guardada en este teléfono el {new Date(local.savedAt).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}. Puede no incluir cambios posteriores.
        </p>
      )}
      {step === 'data' && (data ? <SensitiveView data={data} /> : <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">No se pudo abrir la ficha. Puede que la persona no la haya compartido o que el acceso ya haya expirado.</p>)}
    </BottomSheet>
  )
}

function SensitiveView({ data: d }: { data: SensitiveData }) {
  const blood = d.bloodType === 'unknown' ? 'No lo sabe' : d.bloodType
  const doc = DOC_TYPES.find((x) => x.value === d.docType)?.label ?? 'Documento'
  const rows: [string, string][] = [
    ['Nombre', d.fullName],
    [doc, d.docNumber],
    ['Fecha de nacimiento', d.birthDate ? new Date(`${d.birthDate}T00:00:00`).toLocaleDateString('es') : ''],
    ['Celular', d.phone],
  ]
  const emergency: [string, string][] = [
    ['Contacto', [d.emergencyName, d.emergencyRelationship && `(${d.emergencyRelationship})`].filter(Boolean).join(' ')],
    ['Teléfono', d.emergencyPhone],
  ]
  const health: [string, string][] = [
    ['Grupo sanguíneo', blood],
    ['Previsión', [d.insuranceSystem && d.insuranceSystem[0].toUpperCase() + d.insuranceSystem.slice(1), d.insuranceDetail].filter(Boolean).join(' · ')],
    ['Alergias', d.allergies],
    ['Condiciones médicas', d.conditions],
    ['Medicamentos', d.medications],
  ]
  return (
    <div className="space-y-4">
      <Group title="🆘 Contacto de emergencia" items={emergency} />
      {d.emergencyPhone && (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <a
            href={`tel:+${toE164Digits(d.emergencyPhone)}`}
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-red-600 px-3 font-semibold text-white active:bg-red-700"
          >
            📞 Llamar
          </a>
          <a
            href={`https://wa.me/${toE164Digits(d.emergencyPhone)}?text=${encodeURIComponent(whatsappText(d))}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 font-semibold text-white active:opacity-80"
          >
            <WhatsAppGlyph />
            WhatsApp
          </a>
        </div>
      )}
      <Group title="⛑️ Salud" items={health} />
      <Group title="🪪 Identificación" items={rows} />
      <p className="flex items-center justify-center gap-1 text-xs text-muted">
        <VerifiedBadge className="size-3.5" label="Acceso registrado" /> Esta visualización quedó registrada y fue notificada.
      </p>
    </div>
  )
}

/** Mensaje inicial para el contacto de emergencia (se puede editar antes de enviar) */
const whatsappText = (d: SensitiveData) =>
  `Hola${d.emergencyName ? ` ${d.emergencyName.split(' ')[0]}` : ''}, te escribo desde rocketId porque eres el contacto de emergencia de ${d.fullName || 'un participante'} en una salida.`

function WhatsAppGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.3-.4.8-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3c-.2.3-.9.9-.9 2.2s1 2.6 1.1 2.7c.1.2 1.9 2.9 4.6 4.1 1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.8-1.2.2-.6.2-1.1.1-1.2l-.4-.2z" />
    </svg>
  )
}

function Group({ title, items }: { title: string; items: [string, string][] }) {
  return (
    <section>
      <h4 className="mb-1.5 px-1 text-xs font-semibold tracking-wide text-muted uppercase">{title}</h4>
      <dl className="divide-y divide-line rounded-2xl border border-line bg-card">
        {items.map(([k, v]) => (
          <div key={k} className="px-4 py-2.5">
            <dt className="text-xs text-muted">{k}</dt>
            <dd className={`text-sm break-words whitespace-pre-line ${v ? 'text-fg' : 'text-subtle italic'}`}>{v || 'Sin informar'}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

// ---------- Fichas sin conexión (organizador) ----------

function OfflineStatus({ event, participants, onOpen }: { event: EventDoc; participants: Participant[]; onOpen: () => void }) {
  const me = useMe()
  const online = useOnline()
  const saved = me ? getOfflineEvent(event.id, me.uid) : null
  const confirmed = participants.filter((p) => p.role === 'participant' && p.status === 'confirmed')
  const savedCount = saved ? confirmed.filter((p) => saved.fichas[p.uid]).length : 0
  const outdated = saved ? confirmed.filter((p) => !saved.fichas[p.uid] || p.updatedAt > saved.fichas[p.uid].savedAt).length : 0
  if (!confirmed.length && !saved) return null
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3 text-left active:bg-line/60"
    >
      <span className="text-xl" aria-hidden="true">
        {online ? '📥' : '📵'}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-medium text-fg">
          {saved ? `${savedCount} de ${confirmed.length} fichas guardadas sin conexión` : 'Guarda las fichas para usarlas sin señal'}
        </span>
        <span className="block text-sm text-muted">
          {!online
            ? saved
              ? 'Sin conexión: puedes abrir las fichas guardadas en este teléfono'
              : 'Sin conexión: no hay fichas guardadas en este teléfono'
            : saved
              ? outdated
                ? `${outdated} por actualizar · toca para revisar`
                : 'Todo al día'
              : 'Recomendado antes de salir a terreno'}
        </span>
      </span>
      <span className="text-lg text-muted" aria-hidden="true">
        ›
      </span>
    </button>
  )
}

function OfflineFichasSheet({
  open,
  event,
  participants,
  onClose,
  onDone,
}: {
  open: boolean
  event: EventDoc
  participants: Participant[]
  onClose: () => void
  onDone: (msg: string) => void
}) {
  const me = useMe()
  const online = useOnline()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [, force] = useState(0)
  const saved = me ? getOfflineEvent(event.id, me.uid) : null
  const confirmed = participants.filter((p) => p.role === 'participant' && p.status === 'confirmed')
  const pending = confirmed.filter((p) => !saved?.fichas[p.uid] || p.updatedAt > (saved?.fichas[p.uid]?.savedAt ?? 0))

  const save = async () => {
    if (!me) return
    setBusy(true)
    setError(null)
    try {
      const res = await saveFichasOffline(event, me, participants, saved?.fichas ?? {})
      saveOfflineFichas(event.id, me.uid, event.title, event.endAt.getTime(), res.saved)
      // Quien ya no está confirmado no debe quedar en el teléfono
      const ok = new Set(confirmed.map((p) => p.uid))
      Object.keys(getOfflineEvent(event.id, me.uid)?.fichas ?? {}).forEach((uid) => !ok.has(uid) && removeOfflineFicha(event.id, uid))
      navigator.vibrate?.(10)
      const n = Object.keys(res.saved).length
      onDone(n ? `${n} ficha${n === 1 ? '' : 's'} guardada${n === 1 ? '' : 's'} en este teléfono` : 'Las fichas ya estaban al día')
      if (res.failed) setError(`${res.failed} ficha${res.failed === 1 ? '' : 's'} no se pudieron descargar. Inténtalo de nuevo.`)
      else onClose()
    } catch (e) {
      console.error('saveFichasOffline', e)
      setError('No se pudieron guardar. Revisa tu conexión e inténtalo de nuevo.')
    } finally {
      setBusy(false)
      force((n) => n + 1)
    }
  }

  const remove = () => {
    removeOfflineEvent(event.id)
    force((n) => n + 1)
    onDone('Fichas borradas de este teléfono')
    onClose()
  }

  return (
    <BottomSheet
      open={open}
      title="Fichas sin conexión"
      onClose={onClose}
      footer={
        <div className="space-y-2 pb-3">
          <button type="button" onClick={save} disabled={busy || !online || !confirmed.length || (!!saved && !pending.length)} className={primaryBtn}>
            {busy
              ? 'Guardando…'
              : !online
                ? 'Necesitas conexión para guardar'
                : saved
                  ? pending.length
                    ? `Actualizar ${pending.length} ficha${pending.length === 1 ? '' : 's'}`
                    : 'Fichas al día'
                  : `Guardar ${confirmed.length} ficha${confirmed.length === 1 ? '' : 's'} en este teléfono`}
          </button>
          {saved && (
            <button type="button" onClick={remove} className="h-11 w-full rounded-lg text-sm font-medium text-red-600 active:bg-red-50 dark:text-red-400 dark:active:bg-red-500/10">
              Borrar fichas de este teléfono
            </button>
          )}
        </div>
      }
    >
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
        <p className="font-semibold text-fg">Para emergencias en terreno sin señal</p>
        <p className="mt-1 max-w-prose text-base text-fg-soft">
          Se descargan las fichas de emergencia de las personas confirmadas, <strong>sin mostrarlas</strong>. Si alguien tiene una emergencia y no hay señal, podrás abrir su ficha desde este teléfono.
        </p>
      </div>
      <ul className="space-y-3 rounded-2xl border border-line bg-card p-4">
        {[
          ['🔔', 'Cada participante recibe un aviso de que guardaste su ficha.'],
          ['👁️', 'Si abres una ficha, se le avisa igual que siempre; sin señal, el aviso llega apenas vuelva la conexión.'],
          ['🗑️', 'Las copias se borran solas 2 días después del evento y al cerrar sesión.'],
          ['📱', 'Quedan solo en este teléfono. Actualízalas antes de salir si alguien cambió su ficha.'],
        ].map(([i, t]) => (
          <li key={t} className="flex gap-3 text-base text-fg-soft">
            <span aria-hidden="true">{i}</span>
            {t}
          </li>
        ))}
      </ul>
      {confirmed.length > 0 ? (
        <section>
          <h4 className="mb-1.5 px-1 text-xs font-semibold tracking-wide text-muted uppercase">Confirmados ({confirmed.length})</h4>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
            {confirmed.map((p) => {
              const f = saved?.fichas[p.uid]
              const stale = f && p.updatedAt > f.savedAt
              return (
                <li key={p.uid} className="flex items-center gap-3 px-4 py-2.5">
                  <Avatar name={p.displayName} photoURL={p.photoURL} className="size-9 text-xs" />
                  <span className="min-w-0 flex-1 truncate text-base text-fg">{p.displayName}</span>
                  <span className="shrink-0 text-sm text-muted">{!f ? 'Sin guardar' : stale ? '⚠️ Cambió' : '✓ Guardada'}</span>
                </li>
              )
            })}
          </ul>
        </section>
      ) : (
        <p className="px-1 text-base text-muted">Todavía no hay personas confirmadas.</p>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
          ⚠️ {error}
        </p>
      )}
    </BottomSheet>
  )
}

// ---------- Equipo de seguridad (visible para el grupo) ----------

function SafetyTeam({ event, participants }: { event: EventDoc; participants: Participant[] }) {
  const organizer = participants.find((p) => p.role === 'organizer')
  const team = participants.filter((p) => event.coOrganizers.includes(p.uid) && p.status === 'confirmed')
  if (!organizer) return null
  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      <p className="flex items-center gap-2 text-base font-semibold text-fg">
        <span aria-hidden="true">🛡️</span> Equipo de seguridad
      </p>
      <p className="mt-1 text-sm text-muted">Pueden ver las fichas de emergencia del grupo si hace falta.</p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {[organizer, ...team].map((p) => (
          <li key={p.uid} className="flex h-10 items-center gap-2 rounded-full bg-surface pr-3 pl-1 ring-1 ring-line">
            <Avatar name={p.displayName} photoURL={p.photoURL} className="size-8 text-xs" />
            <span className="text-sm font-medium text-fg">
              {firstName(p.displayName)}
              {p.role === 'organizer' && <span className="text-muted"> · organiza</span>}
            </span>
          </li>
        ))}
      </ul>
      {team.length === 0 && (
        <p className="mt-3 text-sm text-muted">
          Sin respaldo designado. Si el organizador no está disponible, cualquier confirmado puede usar el acceso de emergencia durante la salida.
        </p>
      )}
    </section>
  )
}
