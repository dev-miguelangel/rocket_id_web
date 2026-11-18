import type { CategoryId } from '../skills/schema'

export const EVENT_ACTIVITIES = [
  { id: 'trekking', label: 'Trekking', icon: '🥾' },
  { id: 'montanismo', label: 'Montañismo', icon: '⛰️' },
  { id: 'escalada', label: 'Escalada', icon: '🧗' },
  { id: 'kayak', label: 'Kayak / agua', icon: '🛶' },
  { id: 'ciclismo', label: 'Ciclismo', icon: '🚵' },
  { id: 'nieve', label: 'Esquí / nieve', icon: '⛷️' },
  { id: 'buceo', label: 'Buceo', icon: '🤿' },
  { id: 'otro', label: 'Otra actividad', icon: '🏕️' },
] as const

export type ActivityId = (typeof EVENT_ACTIVITIES)[number]['id']
export const activityOf = (id: string) => EVENT_ACTIVITIES.find((a) => a.id === id) ?? EVENT_ACTIVITIES[7]

export type Visibility = 'private' | 'public'
export type EventStatus = 'published' | 'cancelled'

/** Requisito: un área de conocimiento (y un nombre opcional para mostrar, ej. "WFA vigente") */
export interface Requirement {
  category: CategoryId
  label: string
}

export interface EventDoc {
  id: string
  title: string
  activity: ActivityId
  description: string
  startAt: Date
  endAt: Date
  location: string
  meetingPoint: string
  visibility: Visibility
  capacity: number // 0 = sin límite
  requirements: Requirement[]
  status: EventStatus
  organizerUid: string
  organizerName: string
  organizerRocketId: string
  organizerPhoto: string | null
  /** Equipo de seguridad: hasta 2 participantes con el mismo acceso a las fichas */
  coOrganizers: string[]
}

export type ParticipantStatus = 'invited' | 'confirmed' | 'declined'

export interface Participant {
  uid: string
  displayName: string
  rocketId: string
  photoURL: string | null
  role: 'organizer' | 'participant'
  status: ParticipantStatus
  /** Autoinformado al confirmar: ¿su ficha de emergencia está completa? */
  emergencyComplete: boolean
  /** Última actualización de su participación o ficha (ms) */
  updatedAt: number
  /** Dio su consentimiento para compartir la ficha (los participantes, al confirmar; el organizador, explícitamente) */
  consented: boolean
}

/** ¿Su ficha está disponible para el equipo de seguridad y para emergencias? */
export const sharesFicha = (p: Participant) => p.status === 'confirmed' && (p.role === 'participant' || p.consented)

export const ORGANIZER_CONSENT_TEXT =
  'Comparto mi ficha de emergencia con el equipo de seguridad del evento y, ante una emergencia durante la salida, con los participantes confirmados. Recibiré un aviso cada vez que alguien la vea.'

export const PARTICIPANT_STATUS = {
  invited: { label: 'Invitado', tone: 'info' },
  confirmed: { label: 'Confirmado', tone: 'success' },
  declined: { label: 'No va', tone: 'neutral' },
} as const

/** Versiones de los textos aceptados. Cambiarlas si cambia el texto. */
export const PUBLIC_ACK_VERSION = '2026-11-v1'
export const EVENT_CONSENT_VERSION = '2026-11-v1'

/** Horas tras el fin del evento durante las que el organizador aún puede ver fichas (coincide con las reglas) */
export const SENSITIVE_GRACE_DAYS = 2

export const PUBLIC_RESPONSIBILITIES = [
  'rocketId no organiza, supervisa ni garantiza esta actividad: eres el único responsable de organizarla.',
  'Debes planificar la ruta, evaluar los riesgos, revisar el pronóstico y las condiciones del terreno.',
  'Debes gestionar los permisos y registros necesarios (por ejemplo, CONAF en áreas protegidas).',
  'Cada participante asiste bajo su propia responsabilidad; verifica que su experiencia y equipo sean adecuados.',
  'Si cobras por la actividad, debes cumplir la normativa vigente para guías y operadores de turismo.',
  'Cualquier persona con cuenta podrá ver el evento y unirse.',
]

export const EVENT_CONSENT_TEXT =
  'Al confirmar, compartes tu ficha de emergencia (identificación, contacto de emergencia, previsión, grupo sanguíneo, alergias, condiciones médicas y medicamentos) con el organizador y su equipo de seguridad (hasta 2 personas). Podrán verla hasta 2 días después del evento. Si ninguno está disponible, otro participante confirmado podrá abrirla en una emergencia durante la salida. Recibirás una notificación cada vez que alguien la vea.'

export const MAX_CO_ORGANIZERS = 2

// ---------- Formato ----------

export function formatEventDate(start: Date, end: Date) {
  const sameDay = start.toDateString() === end.toDateString()
  const day = (d: Date) => d.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', '')
  const time = (d: Date) => d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
  return sameDay ? `${day(start)} · ${time(start)}–${time(end)}` : `${day(start)} ${time(start)} → ${day(end)}`
}

export const isPast = (e: EventDoc) => e.endAt.getTime() < Date.now()

/** Mismo criterio que las reglas: desde 2 h antes del inicio hasta 12 h después del término */
export const emergencyWindowOpen = (e: EventDoc, now = Date.now()) =>
  e.status === 'published' && now >= e.startAt.getTime() - 2 * 3_600_000 && now <= e.endAt.getTime() + 12 * 3_600_000
export const sensitiveWindowOpen = (e: EventDoc) => Date.now() < e.endAt.getTime() + SENSITIVE_GRACE_DAYS * 86_400_000
