import { useEffect, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { categoryOf, formatMonth } from '../../../../shared/domain/skills'
import {
  decideVerification,
  shortDate,
  subscribeProviderVerificationRequests,
  VERIFICATION_STATUSES,
  type VerificationRequest,
  type VerificationStatus,
} from '../../../../shared/verificationsApi'
import { useAuth } from '../auth/AuthProvider'
import { ProviderPicker } from '../courses/ProviderPicker'
import { useCourseProvider } from '../courses/useCourseProvider'
import { Badge, primaryButton, secondaryButton, textareaClass } from '../ui/form'
import { BadgeIcon } from '../ui/icons'

type Filter = 'all' | VerificationStatus
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'pending', label: 'Pendientes' },
  { value: 'approved', label: 'Verificadas' },
  { value: 'rejected', label: 'Rechazadas' },
  { value: 'all', label: 'Todas' },
]

/** Solicitudes de verificación de certificaciones: cualquier miembro del formador decide (decisión 5) */
export function VerificationsPage() {
  const cp = useCourseProvider()
  const [params, setParams] = useSearchParams()
  const pid = cp.current?.provider.id ?? null
  const [state, setState] = useState<{ pid: string | null; list: VerificationRequest[] | null; error: boolean }>({ pid: null, list: null, error: false })
  const [filter, setFilter] = useState<Filter>('pending')
  const openId = params.get('s')

  useEffect(() => {
    if (!pid) return
    return subscribeProviderVerificationRequests(pid, (list, e) => {
      if (e) console.error('verification requests', e)
      setState({ pid, list, error: !!e })
    })
  }, [pid])

  const list = state.pid === pid ? state.list : null
  const counts = Object.fromEntries(FILTERS.map((f) => [f.value, (list ?? []).filter((r) => f.value === 'all' || r.status === f.value).length]))
  const shown = (list ?? []).filter((r) => filter === 'all' || r.status === filter)
  const open = (list ?? []).find((r) => r.id === openId) ?? null
  const choose = (id: string) => setParams({ s: id }, { replace: true })

  if (cp.loading) return <div className="h-80 animate-pulse rounded-2xl bg-line/60" aria-busy="true" />
  if (!cp.current)
    return (
      <Empty
        title="Aún no puedes verificar"
        text="Cuando tu registro de formador esté aprobado, las personas podrán pedirte que verifiques las certificaciones que emitiste."
        action={
          <Link to="/" className={`${primaryButton} mt-6`}>
            Ir al inicio
          </Link>
        }
      />
    )

  return (
    <div className="space-y-6">
      <ProviderPicker options={cp.options} current={cp.current} onChoose={cp.choose} />

      {state.error && state.pid === pid ? (
        <p role="alert" className="rounded-xl bg-amber-50 p-4 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          No pudimos cargar las solicitudes. Revisa tu conexión y recarga la página.
        </p>
      ) : list === null ? (
        <div className="h-80 animate-pulse rounded-2xl bg-line/60" aria-busy="true" />
      ) : list.length === 0 ? (
        <Empty
          title="Aún no hay solicitudes"
          text="Las personas piden la verificación desde Mis datos en la app de rocketId, eligiendo a tu formador. Al verificar, su certificación muestra la insignia ✓ con tu nombre."
        />
      ) : (
        <>
          <div role="tablist" aria-label="Estado" className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                role="tab"
                aria-selected={filter === f.value}
                onClick={() => setFilter(f.value)}
                className={`h-10 rounded-full px-4 text-sm font-medium transition ${
                  filter === f.value ? 'bg-primary text-white' : 'bg-card text-fg-soft ring-1 ring-line hover:bg-surface'
                }`}
              >
                {f.label} · {counts[f.value]}
              </button>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
            <section aria-label="Solicitudes" className="overflow-hidden rounded-2xl border border-line bg-card lg:self-start">
              {shown.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-muted">No hay solicitudes con este filtro.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {shown.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => choose(r.id)}
                        aria-current={r.id === openId ? 'true' : undefined}
                        className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition hover:bg-surface ${r.id === openId ? 'bg-primary/10' : ''}`}
                      >
                        <span className="mt-0.5 text-lg" aria-hidden="true">
                          {categoryOf(r.category)?.icon ?? '📄'}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold text-fg">{r.applicant.fullName || 'Sin nombre'}</span>
                          <span className="block truncate text-sm text-muted">{r.snapshot.name}</span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          <span className="text-xs text-subtle">{shortDate(r.createdAt)}</span>
                          <Badge tone={VERIFICATION_STATUSES[r.status].tone}>{VERIFICATION_STATUSES[r.status].label}</Badge>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {open ? (
              <RequestDetail key={open.id} r={open} canDecide={cp.current.provider.status === 'approved'} />
            ) : (
              <div className="hidden items-center justify-center rounded-2xl border border-dashed border-line-strong p-10 text-center text-muted lg:flex">
                Elige una solicitud para revisarla.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function RequestDetail({ r, canDecide }: { r: VerificationRequest; canDecide: boolean }) {
  const { user } = useAuth()
  const [deciding, setDeciding] = useState<'approved' | 'rejected' | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const a = r.applicant
  const s = r.snapshot

  const decide = async () => {
    if (!user || !deciding) return
    if (deciding === 'rejected' && note.trim().length < 5) {
      setMsg({ ok: false, text: 'Cuéntale a la persona por qué no la verificas.' })
      return
    }
    setBusy(true)
    setMsg(null)
    try {
      await decideVerification(user.uid, r, deciding, note)
      setMsg({
        ok: true,
        text: deciding === 'approved' ? 'Certificación verificada. Ya aparece con la insignia ✓.' : 'Solicitud rechazada. Le avisamos en su app.',
      })
      setDeciding(null)
    } catch (e) {
      console.error('decide verification', e)
      setMsg({ ok: false, text: 'No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <article aria-label={`Solicitud de ${a.fullName}`} className="rounded-2xl border border-line bg-card p-6 lg:self-start">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-fg">{a.fullName || 'Sin nombre'}</h2>
          <p className="mt-0.5 text-sm text-muted">
            {a.rocketId && <span className="font-mono">{a.rocketId}</span>}
            {a.rocketId && ' · '}
            Pedida el {shortDate(r.createdAt)}
          </p>
        </div>
        <Badge tone={VERIFICATION_STATUSES[r.status].tone}>{VERIFICATION_STATUSES[r.status].label}</Badge>
      </div>

      <h3 className="mt-6 text-sm font-semibold text-fg-soft">Certificación a verificar</h3>
      <dl className="mt-2 grid gap-x-8 gap-y-3 rounded-xl border border-line p-4 text-sm sm:grid-cols-2">
        <Item label="Certificación" value={`${categoryOf(r.category)?.icon ?? ''} ${s.name}`.trim()} />
        <Item label="Institución que declara" value={s.issuer} />
        <Item label="Año" value={s.year} />
        <Item label="Vigencia" value={s.expiresAt ? `Hasta ${formatMonth(s.expiresAt)}` : 'Sin vencimiento'} />
      </dl>
      <dl className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
        <Item label="Documento" value={[a.docType && a.docType.toUpperCase(), a.docNumber].filter(Boolean).join(' ')} />
      </dl>
      <p className="mt-4 text-xs text-subtle">
        Verifica solo si tu formador emitió esta certificación a esta persona, con estos datos. Si la persona los cambia, la insignia deja de mostrarse.
      </p>

      <div className="mt-6 space-y-4 border-t border-line pt-6">
        {r.status !== 'pending' ? (
          <p className="text-sm text-muted">
            {r.status === 'approved' ? '✓ Verificada' : 'Rechazada'} el {shortDate(r.reviewedAt)}
            {r.note ? ` · “${r.note}”` : ''}
          </p>
        ) : !canDecide ? (
          <p className="text-sm text-muted">El formador no está aprobado: no se pueden verificar certificaciones.</p>
        ) : deciding ? (
          <div className="space-y-3">
            <label htmlFor="vr-note" className="text-sm font-medium text-fg-soft">
              {deciding === 'approved' ? 'Mensaje para la persona' : 'Motivo del rechazo'}{' '}
              {deciding === 'approved' && <span className="font-normal text-subtle">(opcional)</span>}
            </label>
            <textarea
              id="vr-note"
              className={textareaClass}
              value={note}
              maxLength={500}
              autoFocus
              placeholder={deciding === 'approved' ? '' : 'Por ejemplo: no encontramos un registro con ese número de documento.'}
              onChange={(e) => setNote(e.target.value)}
            />
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={decide}
                disabled={busy}
                className={
                  deciding === 'approved'
                    ? primaryButton
                    : 'inline-flex h-11 items-center justify-center rounded-xl bg-red-600 px-5 font-semibold text-white hover:bg-red-700 disabled:opacity-60'
                }
              >
                {busy ? 'Guardando…' : deciding === 'approved' ? 'Confirmar verificación' : 'Rechazar solicitud'}
              </button>
              <button type="button" onClick={() => setDeciding(null)} disabled={busy} className={secondaryButton}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => setDeciding('approved')} className={primaryButton}>
              Verificar
            </button>
            <button type="button" onClick={() => setDeciding('rejected')} className={secondaryButton}>
              Rechazar
            </button>
          </div>
        )}
        {msg && (
          <p role={msg.ok ? 'status' : 'alert'} className={`text-sm ${msg.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {msg.ok ? '✓ ' : ''}
            {msg.text}
          </p>
        )}
      </div>
    </article>
  )
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted">{label}</dt>
      <dd className="truncate font-medium text-fg">{value || <span className="text-subtle">—</span>}</dd>
    </div>
  )
}

function Empty({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <section className="flex flex-col items-center rounded-2xl border border-dashed border-line-strong px-6 py-20 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary-text">
        <BadgeIcon className="size-7" />
      </span>
      <h2 className="mt-5 text-lg font-semibold text-fg">{title}</h2>
      <p className="mt-2 max-w-md text-muted">{text}</p>
      {action}
    </section>
  )
}
