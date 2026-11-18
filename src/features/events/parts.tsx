import type { ReactNode } from 'react'
import { PARTICIPANT_STATUS, activityOf, formatEventDate, isPast, type EventDoc, type ParticipantStatus } from './schema'

const TONES = {
  info: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
  success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  neutral: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-500/20 dark:text-zinc-300',
  danger: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300',
} as const

export function Chip({ tone, children }: { tone: keyof typeof TONES; children: ReactNode }) {
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${TONES[tone]}`}>{children}</span>
}

export function ParticipantChip({ status }: { status: ParticipantStatus }) {
  const s = PARTICIPANT_STATUS[status]
  return <Chip tone={s.tone}>{s.label}</Chip>
}

export function VisibilityChip({ visibility }: { visibility: EventDoc['visibility'] }) {
  return visibility === 'public' ? <Chip tone="info">🌎 Público</Chip> : <Chip tone="neutral">🔒 Privado</Chip>
}

/** Fila de evento en listas */
export function EventRow({ event: e, note, onClick }: { event: EventDoc; note?: ReactNode; onClick: () => void }) {
  const a = activityOf(e.activity)
  const day = e.startAt.toLocaleDateString('es', { day: 'numeric' })
  const month = e.startAt.toLocaleDateString('es', { month: 'short' }).replace('.', '')
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 px-1 py-2.5 text-left active:opacity-60">
      <span className={`flex size-14 shrink-0 flex-col items-center justify-center rounded-2xl ${isPast(e) || e.status === 'cancelled' ? 'bg-line text-muted' : 'bg-primary/10 text-primary-text'}`}>
        <span className="text-lg leading-none font-bold">{day}</span>
        <span className="text-[11px] font-semibold uppercase">{month}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true">{a.icon}</span>
          <span className={`truncate text-[15px] font-semibold ${e.status === 'cancelled' ? 'text-muted line-through' : 'text-fg'}`}>{e.title}</span>
        </span>
        <span className="block truncate text-sm text-muted">
          {formatEventDate(e.startAt, e.endAt)} · {e.location || 'Sin lugar'}
        </span>
      </span>
      {note}
    </button>
  )
}
