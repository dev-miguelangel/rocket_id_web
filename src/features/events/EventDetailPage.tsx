import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { Avatar } from '../../components/Avatar'
import { BottomSheet } from '../../components/Sheet'
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
  invite,
  removeParticipant,
  subscribeEvent,
  subscribeParticipants,
  viewSensitive,
  type SensitiveData,
} from './eventsApi'
import { EventFormSheet } from './EventFormSheet'
import { Chip, ParticipantChip, VisibilityChip } from './parts'
import {
  EVENT_CONSENT_TEXT,
  activityOf,
  formatEventDate,
  isPast,
  sensitiveWindowOpen,
  type EventDoc,
  type Participant,
  type Requirement,
} from './schema'
import { useMe } from './useMe'

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
  const [sheet, setSheet] = useState<null | 'consent' | 'invite' | 'cancel' | 'edit'>(null)
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
        <Link to="/eventos" className="mt-4 inline-flex h-11 items-center rounded-xl bg-primary px-5 font-semibold text-white">
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
      await confirmAttendance(event.id, me, !!myRow)
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
    if (!user) return
    setBusy(true)
    try {
      await declineAttendance(event.id, user.uid)
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
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setSheet('invite')} className={primaryBtn}>
          🪢 Invitar
        </button>
        <button type="button" onClick={shareWhatsApp} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#25D366] font-semibold text-white active:opacity-80">
          💬 Compartir
        </button>
      </div>
    )
  else if (myRow?.status === 'confirmed')
    action = (
      <div className="space-y-2">
        <p className="rounded-xl bg-emerald-50 p-3 text-center text-sm font-semibold text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">✓ Vas a este evento</p>
        <button type="button" onClick={doDecline} disabled={busy} className="h-10 w-full rounded-lg text-sm font-medium text-red-600 active:bg-red-50 dark:text-red-400">
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
    <div className="space-y-5 pb-4">
      {/* Encabezado */}
      <section className="rounded-3xl bg-gradient-to-br from-primary to-accent p-5 text-white shadow-lg shadow-primary/20">
        <div className="flex items-center gap-2 text-sm opacity-90">
          <span aria-hidden="true">{a.icon}</span>
          {a.label}
          <span className="ml-auto flex items-center gap-2">
            <VisibilityChip visibility={event.visibility} />
            {isOrganizer && !cancelled && (
              <button
                type="button"
                onClick={() => {
                  setEditSession((n) => n + 1)
                  setSheet('edit')
                }}
                className="h-8 rounded-full bg-white/20 px-3 text-xs font-semibold text-white active:bg-white/30"
              >
                ✎ Editar
              </button>
            )}
          </span>
        </div>
        <h2 className={`mt-2 text-2xl leading-tight font-bold ${cancelled ? 'line-through opacity-70' : ''}`}>{event.title}</h2>
        <p className="mt-2 text-sm opacity-95">📅 {formatEventDate(event.startAt, event.endAt)}</p>
        <p className="text-sm opacity-95">📍 {event.location}</p>
        {event.meetingPoint && <p className="text-sm opacity-95">🚩 {event.meetingPoint}</p>}
        <div className="mt-4 flex items-center gap-2 border-t border-white/20 pt-3">
          <Avatar name={event.organizerName} photoURL={event.organizerPhoto} className="size-8 text-xs ring-2 ring-white/40" />
          <span className="text-sm">
            Organiza <strong>{event.organizerName}</strong>
          </span>
        </div>
      </section>

      {action}

      {event.description && (
        <Block title="Descripción">
          <p className="text-sm leading-relaxed whitespace-pre-line text-fg-soft">{event.description}</p>
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
                        <span className="block truncate font-mono text-xs tracking-wide text-muted">{p.rocketId}</span>
                      </span>
                      {isOrganizer && p.role === 'participant' && p.status === 'confirmed' && !p.emergencyComplete && (
                        <span title="Ficha de emergencia incompleta" aria-label="Ficha de emergencia incompleta">⚠️</span>
                      )}
                      {p.role === 'organizer' ? <Chip tone="success">Organiza</Chip> : <ParticipantChip status={p.status} />}
                    </button>
                  </SwipeRow>
                </li>
              ))}
          </ul>
        </section>
      )}

      {isOrganizer && !cancelled && !past && (
        <button type="button" onClick={() => setSheet('cancel')} className="h-11 w-full rounded-xl text-sm font-medium text-red-600 active:bg-red-50 dark:text-red-400">
          Cancelar evento
        </button>
      )}

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
                cancelEvent(event.id)
                  .then(() => toast.show('Evento cancelado'))
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
      <ParticipantSheet participant={openP} event={event} isOrganizer={isOrganizer} onClose={closeP} />

      {toast.node}
    </div>
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
        <p className="mt-1 text-sm text-fg-soft">{EVENT_CONSENT_TEXT}</p>
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
                <span className="block font-mono text-xs text-muted">{c.rocketId}</span>
              </span>
              {inEvent.has(c.uid) ? (
                <span className="text-sm text-muted">Invitado</span>
              ) : (
                <button type="button" onClick={() => send(c)} disabled={sending === c.uid} className="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-white active:bg-primary-dark disabled:opacity-50">
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

function ParticipantSheet({ participant, event, isOrganizer, onClose }: { participant: Participant | null; event: EventDoc; isOrganizer: boolean; onClose: () => void }) {
  const me = useMe()
  const [shown, setShown] = useState(participant)
  const [profile, setProfile] = useState<SearchResult | null | undefined>(undefined)
  const [step, setStep] = useState<'profile' | 'warn' | 'data'>('profile')
  const [data, setData] = useState<SensitiveData | null | undefined>(undefined)
  const [loading, setLoading] = useState(false)

  if (participant && participant !== shown) {
    setShown(participant)
    setProfile(undefined)
    setStep('profile')
    setData(undefined)
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
  const canView =
    isOrganizer && shown.role === 'participant' && shown.status === 'confirmed' && sensitiveWindowOpen(event) && event.status === 'published'

  const view = async () => {
    if (!me) return
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
    canView && step === 'profile' ? (
      <div className="pb-3">
        <button type="button" onClick={() => setStep('warn')} className={primaryBtn}>
          🩺 Ver ficha de emergencia
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
              <p className="font-mono text-sm text-muted">{shown.rocketId}</p>
            </div>
          </div>
        ))}

      {step === 'warn' && (
        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            <span className="text-2xl" aria-hidden="true">🔔</span>
            <div>
              <p className="font-semibold">{firstName(shown.displayName)} será notificado</p>
              <p className="mt-1 text-sm">
                Vas a ver datos sensibles (identificación, salud y contacto de emergencia). {firstName(shown.displayName)} recibirá una notificación indicando que viste su ficha en “{event.title}”.
              </p>
            </div>
          </div>
          <p className="px-1 text-xs text-muted">Úsala solo para la seguridad del grupo. El acceso se cierra 2 días después del evento.</p>
        </div>
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
        <a href={`tel:${d.emergencyPhone.replace(/\s/g, '')}`} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-red-600 font-semibold text-white active:bg-red-700">
          📞 Llamar al contacto de emergencia
        </a>
      )}
      <Group title="⛑️ Salud" items={health} />
      <Group title="🪪 Identificación" items={rows} />
      <p className="flex items-center justify-center gap-1 text-xs text-muted">
        <VerifiedBadge className="size-3.5" label="Acceso registrado" /> Esta visualización quedó registrada y fue notificada.
      </p>
    </div>
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
