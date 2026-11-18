import { VerifiedBadge } from '../../components/VerifiedBadge'
import { APPLICATION_STATUSES, type ApplicationStatus, type CourseProvider } from './schema'

const TONES = {
  info: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
  neutral: 'bg-zinc-200 text-zinc-800 dark:bg-zinc-500/20 dark:text-zinc-200',
  success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  danger: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300',
} as const

export function ApplicationBadge({ status }: { status: ApplicationStatus }) {
  const s = APPLICATION_STATUSES[status]
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONES[s.tone]}`}>{s.label}</span>
}

export function ProviderLine({ provider }: { provider: CourseProvider }) {
  return (
    <p className="mt-0.5 flex items-center gap-1 text-sm text-muted">
      <span className="truncate">{provider.name}</span>
      {provider.verified && (
        <VerifiedBadge
          className="size-3.5"
          label={provider.kind === 'instructor' ? 'Instructor verificado' : 'Institución verificada'}
        />
      )}
    </p>
  )
}
