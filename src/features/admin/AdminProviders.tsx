import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  credentialExpiry,
  emptyProviderForm,
  formatMonthYear,
  formatRut,
  hasProviderErrors,
  independentId,
  MEMBER_ROLES,
  PROVIDER_KINDS,
  PROVIDER_STATUSES,
  validateProvider,
  type MemberRole,
  type Provider,
  type ProviderForm,
  type ProviderStatus,
} from '../../../shared/domain/providers'
import { listAllProviders, makeIndependentProvider, reviewProvider } from '../../../shared/providersApi'
import { invitePerson } from '../../../shared/teamsApi'
import { HoldButton } from '../../components/HoldButton'
import { Field, inputClass, Segmented, textareaClass } from '../../components/form'
import { BottomSheet } from '../../components/Sheet'
import { useToast } from '../../components/Toast'
import { normalizeText } from '../../lib/searchTokens'
import { useAuth } from '../auth/AuthProvider'
import { fetchUsers, type AdminUser } from './usersApi'

type Filter = 'pending' | 'approved' | 'other'

const tones = {
  info: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
  success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  danger: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300',
  neutral: 'bg-zinc-200 text-zinc-800 dark:bg-zinc-500/20 dark:text-zinc-200',
}
const short = (d: Date | null) => (d ? d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

function StatusBadge({ status }: { status: ProviderStatus }) {
  const s = PROVIDER_STATUSES[status]
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[s.tone]}`}>{s.label}</span>
}

/** Pestaña "Formadores" del panel: revisar solicitudes y hacer formador a un deportista */
export function AdminProviders() {
  const toast = useToast()
  const [list, setList] = useState<Provider[] | null>(null)
  const [error, setError] = useState(false)
  const [reload, setReload] = useState(0)
  const [filter, setFilter] = useState<Filter>('pending')
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [making, setMaking] = useState(false)
  const refresh = useCallback(() => setReload((n) => n + 1), [])

  useEffect(() => {
    let alive = true
    listAllProviders()
      .then((r) => {
        if (!alive) return
        setList(r)
        setError(false)
      })
      .catch((e) => {
        console.error('admin providers', e)
        if (alive) setError(true)
      })
    return () => {
      alive = false
    }
  }, [reload])

  const counts = useMemo(() => {
    const all = list ?? []
    const pending = all.filter((p) => p.status === 'pending').length
    const approved = all.filter((p) => p.status === 'approved').length
    return { pending, approved, other: all.length - pending - approved }
  }, [list])

  const expiring = useMemo(() => (list ?? []).filter((p) => p.status === 'approved' && credentialExpiry(p)), [list])

  const shown = useMemo(() => {
    const term = normalizeText(q)
    const rutQ = q.replace(/[^0-9kK]/g, '').toUpperCase()
    return (list ?? [])
      .filter((p) => (filter === 'other' ? p.status === 'rejected' || p.status === 'suspended' : p.status === filter))
      .filter(
        (p) =>
          !term ||
          normalizeText(p.name).includes(term) ||
          normalizeText(p.legalName).includes(term) ||
          normalizeText(p.contact.email).includes(term) ||
          (rutQ.length >= 3 && p.rut.replace('-', '').includes(rutQ)),
      )
      .sort((a, b) =>
        // En revisión: las más antiguas primero (orden de llegada); el resto: las más recientes
        filter === 'pending' ? (a.updatedAt?.getTime() ?? 0) - (b.updatedAt?.getTime() ?? 0) : (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0),
      )
  }, [list, filter, q])

  const open = list?.find((p) => p.id === openId) ?? null

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-fg">Formadores</h2>
          <p className="mt-1 text-sm text-muted">Solo la administración aprueba formadores.</p>
        </div>
        <button
          type="button"
          onClick={() => setMaking(true)}
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-line px-4 text-base font-medium text-fg active:bg-line/60"
        >
          <span aria-hidden="true">＋</span> Hacer formador
        </button>
      </div>

      {expiring.length > 0 && (
        <section aria-labelledby="exp-title" className="rounded-2xl bg-amber-50 p-4 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          <h3 id="exp-title" className="font-semibold">
            ⚠️ Certificaciones por vencer
          </h3>
          <ul className="mt-2 space-y-1 text-sm">
            {expiring.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => setOpenId(p.id)} className="text-left underline underline-offset-2">
                  {p.name}
                </button>{' '}
                · {credentialExpiry(p) === 'expired' ? 'venció' : 'vence'} en {formatMonthYear(p.credential.expiresAt)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <Segmented
        label="Mostrar"
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'pending', label: `Revisión · ${counts.pending}` },
          { value: 'approved', label: `Aprobados · ${counts.approved}` },
          { value: 'other', label: `Otros · ${counts.other}` },
        ]}
      />

      <div>
        <label htmlFor="admin-provider-search" className="sr-only">
          Buscar formadores
        </label>
        <input
          id="admin-provider-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nombre, correo o RUT"
          autoComplete="off"
          className="h-11 w-full rounded-xl border border-field bg-card px-3.5 text-base text-fg outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          <span className="flex-1">No se pudieron cargar los formadores. Revisa tu conexión.</span>
          <button
            type="button"
            onClick={refresh}
            className="h-11 shrink-0 rounded-lg bg-amber-200/60 px-4 font-semibold active:bg-amber-200 dark:bg-amber-500/20"
          >
            Reintentar
          </button>
        </div>
      )}

      <section aria-live="polite">
        {list === null && !error ? (
          <div className="space-y-2" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-line/60" />
            ))}
          </div>
        ) : shown.length === 0 && list ? (
          <div className="px-6 py-10 text-center">
            <p className="font-semibold text-fg">{q ? 'Sin resultados' : filter === 'pending' ? 'No hay solicitudes por revisar' : 'Nada por aquí'}</p>
            <p className="mt-1 text-sm text-muted">{q ? 'Prueba con otro nombre, correo o RUT.' : 'Las solicitudes llegan desde la app de formadores.'}</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {shown.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(p.id)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-line bg-card p-4 text-left active:bg-line/40"
                >
                  <span className="text-2xl" aria-hidden="true">
                    {PROVIDER_KINDS[p.kind].icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-fg">{p.name}</span>
                    <span className="block truncate text-sm text-muted">
                      {PROVIDER_KINDS[p.kind].label} · {p.contact.email || 'sin correo'}
                    </span>
                    <span className="block text-xs text-subtle">
                      {p.status === 'pending' ? 'Enviada' : 'Actualizada'} {short(p.updatedAt)}
                    </span>
                  </span>
                  <StatusBadge status={p.status} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ReviewSheet
        provider={open}
        onClose={() => setOpenId(null)}
        onDone={(msg) => {
          setOpenId(null)
          toast.show(msg)
          refresh()
        }}
      />
      <MakeProviderSheet
        open={making}
        taken={new Set((list ?? []).map((p) => p.id))}
        onClose={() => setMaking(false)}
        onDone={(msg) => {
          setMaking(false)
          toast.show(msg)
          setFilter('approved')
          refresh()
        }}
      />
      {toast.node}
    </div>
  )
}

// ---------- Revisión de una solicitud ----------

type Action = 'reject' | 'suspend' | null

function ReviewSheet({ provider: p, onClose, onDone }: { provider: Provider | null; onClose: () => void; onDone: (msg: string) => void }) {
  const { user } = useAuth()
  const [action, setAction] = useState<Action>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [lastId, setLastId] = useState<string | null>(null)

  // Al abrir otra solicitud se reinicia el formulario
  if ((p?.id ?? null) !== lastId) {
    setLastId(p?.id ?? null)
    setAction(null)
    setNote('')
    setFailed(false)
  }

  const run = async (status: ProviderStatus, msg: string) => {
    if (!p || !user) return
    setBusy(true)
    setFailed(false)
    try {
      await reviewProvider(user.uid, p.id, status, status === 'approved' ? '' : note)
      onDone(msg)
    } catch (e) {
      console.error('review provider', e)
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  const expiry = p ? credentialExpiry(p) : null
  const canApprove = p && (p.status === 'pending' || p.status === 'rejected')

  const footer = p && (
    <div className="space-y-2">
      {action ? (
        <>
          <Field label={action === 'reject' ? 'Motivo del rechazo' : 'Motivo de la suspensión'} hint="La persona lo verá en la app de formadores">
            {(f) => <textarea {...f} className={textareaClass} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} autoFocus />}
          </Field>
          {action === 'reject' ? (
            <button
              type="button"
              onClick={() => run('rejected', 'Solicitud rechazada')}
              disabled={busy || note.trim().length < 5}
              className="h-12 w-full rounded-xl bg-red-600 text-base font-semibold text-white active:bg-red-700 disabled:opacity-50"
            >
              {busy ? 'Guardando…' : 'Rechazar solicitud'}
            </button>
          ) : (
            <HoldButton onConfirm={() => run('suspended', 'Formador suspendido')} disabled={busy || note.trim().length < 5}>
              {busy ? 'Guardando…' : 'Mantén presionado para suspender'}
            </HoldButton>
          )}
          <button type="button" onClick={() => setAction(null)} className="h-11 w-full rounded-xl text-base font-medium text-muted active:bg-line/60">
            Cancelar
          </button>
        </>
      ) : canApprove ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setAction('reject')}
            className="h-12 rounded-xl border border-red-300 text-base font-semibold text-red-700 active:bg-red-50 dark:border-red-500/40 dark:text-red-300"
          >
            Rechazar
          </button>
          <button
            type="button"
            onClick={() => run('approved', `${p.name} aprobado`)}
            disabled={busy}
            className="h-12 rounded-xl bg-primary text-base font-semibold text-white active:bg-primary-dark disabled:opacity-60"
          >
            {busy ? 'Aprobando…' : 'Aprobar'}
          </button>
        </div>
      ) : p.status === 'approved' ? (
        <button
          type="button"
          onClick={() => setAction('suspend')}
          className="h-12 w-full rounded-xl border border-red-300 text-base font-semibold text-red-700 active:bg-red-50 dark:border-red-500/40 dark:text-red-300"
        >
          Suspender formador
        </button>
      ) : (
        <button
          type="button"
          onClick={() => run('approved', `${p.name} reactivado`)}
          disabled={busy}
          className="h-12 w-full rounded-xl bg-primary text-base font-semibold text-white active:bg-primary-dark disabled:opacity-60"
        >
          {busy ? 'Reactivando…' : 'Reactivar formador'}
        </button>
      )}
      {failed && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.
        </p>
      )}
    </div>
  )

  return (
    <BottomSheet open={!!p} title="Solicitud de formador" onClose={onClose} footer={footer}>
      {p && (
        <div className="space-y-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-bold text-fg">{p.name}</h3>
              <StatusBadge status={p.status} />
            </div>
            <p className="mt-1 text-sm text-muted">
              {PROVIDER_KINDS[p.kind].icon} {PROVIDER_KINDS[p.kind].label} · enviada {short(p.createdAt)}
              {p.updatedAt && p.createdAt && p.updatedAt.getTime() - p.createdAt.getTime() > 60000 ? ` · actualizada ${short(p.updatedAt)}` : ''}
            </p>
          </div>

          {p.reviewNote && p.status !== 'approved' && (
            <p className="rounded-xl bg-surface p-3 text-sm text-fg-soft">
              <span className="font-semibold">Última nota:</span> {p.reviewNote}
            </p>
          )}

          <dl className="divide-y divide-line rounded-2xl border border-line">
            {p.kind === 'organization' ? (
              <>
                <Row label="Razón social" value={p.legalName} />
                <Row label="RUT" value={formatRut(p.rut)} />
              </>
            ) : (
              <>
                <Row label="Certificación" value={p.credential.name} />
                <Row label="Emitida por" value={p.credential.issuer} />
                <Row label="Número" value={p.credential.number} />
                <Row
                  label="Vigencia"
                  value={
                    p.credential.expiresAt
                      ? `Hasta ${formatMonthYear(p.credential.expiresAt)}${expiry === 'expired' ? ' · vencida' : expiry === 'soon' ? ' · vence pronto' : ''}`
                      : 'Sin vencimiento'
                  }
                />
                <Row label="Respaldo" value={p.credential.evidenceUrl} link />
              </>
            )}
            <Row label="Sitio web" value={p.website} link />
            <Row label="Descripción" value={p.about} />
          </dl>

          <div>
            <h4 className="px-1 text-sm font-semibold text-fg-soft">Contacto</h4>
            <dl className="mt-1 divide-y divide-line rounded-2xl border border-line">
              <Row label="Responsable" value={p.contact.name} />
              <Row label="Correo" value={p.contact.email} href={p.contact.email ? `mailto:${p.contact.email}` : undefined} />
              <Row label="Teléfono" value={p.contact.phone} href={p.contact.phone ? `tel:${p.contact.phone.replace(/\s/g, '')}` : undefined} />
            </dl>
          </div>
          <p className="px-1 text-xs text-subtle">
            Revisa que el nombre no suplante a otra institución o persona{p.kind === 'independent' ? ' y que la certificación sea vigente y verificable' : ''}.
          </p>
          {p.kind === 'organization' && p.status === 'approved' && <AdminInvite key={p.id} provider={p} />}
        </div>
      )}
    </BottomSheet>
  )
}

function Row({ label, value, link, href }: { label: string; value: string; link?: boolean; href?: string }) {
  const url = href ?? (link && /^https?:\/\//i.test(value) ? value : undefined)
  return (
    <div className="flex gap-3 px-4 py-3">
      <dt className="w-28 shrink-0 text-sm text-muted">{label}</dt>
      <dd className="min-w-0 flex-1 text-sm break-words text-fg">
        {!value ? (
          <span className="text-subtle">—</span>
        ) : url ? (
          <a href={url} target={href ? undefined : '_blank'} rel="noopener noreferrer" className="font-medium text-primary-text underline underline-offset-2">
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  )
}

// ---------- Hacer formador a un deportista ----------

function MakeProviderSheet({ open, taken, onClose, onDone }: { open: boolean; taken: Set<string>; onClose: () => void; onDone: (msg: string) => void }) {
  const { user } = useAuth()
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [q, setQ] = useState('')
  const [person, setPerson] = useState<AdminUser | null>(null)
  const [f, setF] = useState<ProviderForm>(() => emptyProviderForm('independent'))
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!open || users) return
    let alive = true
    fetchUsers()
      .then((r) => alive && setUsers(r.filter((u) => !u.isMock)))
      .catch(() => alive && setUsers([]))
    return () => {
      alive = false
    }
  }, [open, users])

  const close = () => {
    setPerson(null)
    setQ('')
    setTried(false)
    setFailed(false)
    setF(emptyProviderForm('independent'))
    onClose()
  }

  const matches = useMemo(() => {
    const term = normalizeText(q)
    if (!term) return []
    return (users ?? [])
      .filter((u) => normalizeText(u.displayName).includes(term) || normalizeText(u.email).includes(term) || u.rocketId.toLowerCase().includes(q.toLowerCase()))
      .slice(0, 8)
  }, [users, q])

  const errors = tried ? validateProvider(f) : {}
  const setCred = (k: keyof ProviderForm['credential'], v: string) => setF((x) => ({ ...x, credential: { ...x.credential, [k]: v } }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (!person || !user || hasProviderErrors(validateProvider(f))) return
    setBusy(true)
    setFailed(false)
    try {
      await makeIndependentProvider(user.uid, { uid: person.uid, displayName: person.displayName, email: person.email }, f)
      close()
      onDone(`${f.name.trim()} ahora es formador`)
    } catch (err) {
      console.error('make provider', err)
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  const footer = person && (
    <div className="space-y-2">
      {failed && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="h-12 w-full rounded-xl bg-primary text-base font-semibold text-white active:bg-primary-dark disabled:opacity-60"
      >
        {busy ? 'Guardando…' : 'Hacer formador independiente'}
      </button>
    </div>
  )

  return (
    <BottomSheet open={open} title="Hacer formador" onClose={close} footer={footer} onSubmit={submit} confirmDiscard={!!person}>
      {!person ? (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Elige a un deportista de rocketId. Quedará como formador independiente <span className="font-medium text-fg">ya aprobado</span>.
          </p>
          <Field label="Buscar persona">
            {(p) => (
              <input
                {...p}
                type="search"
                className={inputClass}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nombre, correo o rocketId"
                autoFocus
              />
            )}
          </Field>
          {users === null ? (
            <p className="text-sm text-muted">Cargando usuarios…</p>
          ) : (
            <ul className="divide-y divide-line">
              {matches.map((u) => {
                const already = taken.has(independentId(u.uid))
                return (
                  <li key={u.uid}>
                    <button
                      type="button"
                      disabled={already}
                      onClick={() => {
                        setPerson(u)
                        setF(emptyProviderForm('independent', u.displayName))
                      }}
                      className="flex min-h-14 w-full items-center gap-3 py-2 text-left disabled:opacity-50"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-fg">{u.displayName || 'Sin nombre'}</span>
                        <span className="block truncate text-sm text-muted">
                          {u.rocketId} · {u.email}
                        </span>
                      </span>
                      <span className="text-sm text-muted">{already ? 'Ya es formador' : '›'}</span>
                    </button>
                  </li>
                )
              })}
              {q && matches.length === 0 && <li className="py-3 text-sm text-muted">Sin resultados.</li>}
            </ul>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-xl bg-surface p-3">
            <div className="min-w-0">
              <p className="truncate font-semibold text-fg">{person.displayName}</p>
              <p className="truncate text-sm text-muted">{person.email}</p>
            </div>
            <button
              type="button"
              onClick={() => setPerson(null)}
              className="h-11 shrink-0 rounded-lg px-3 text-sm font-medium text-primary-text active:bg-line/60"
            >
              Cambiar
            </button>
          </div>
          <Field label="Nombre visible" error={errors.name}>
            {(p) => <input {...p} className={inputClass} value={f.name} maxLength={80} onChange={(e) => setF((x) => ({ ...x, name: e.target.value }))} />}
          </Field>
          <Field label="Certificación que lo habilita" hint="Por ejemplo: Instructor WFA" error={errors.credName}>
            {(p) => <input {...p} className={inputClass} value={f.credential.name} maxLength={100} onChange={(e) => setCred('name', e.target.value)} />}
          </Field>
          <Field label="Emitida por" error={errors.issuer}>
            {(p) => <input {...p} className={inputClass} value={f.credential.issuer} maxLength={100} onChange={(e) => setCred('issuer', e.target.value)} />}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Número (opcional)" error={errors.number}>
              {(p) => <input {...p} className={inputClass} value={f.credential.number} maxLength={60} onChange={(e) => setCred('number', e.target.value)} />}
            </Field>
            <Field label="Vigente hasta" hint="Vacío si no vence" error={errors.expiresAt}>
              {(p) => (
                <input {...p} type="month" className={inputClass} value={f.credential.expiresAt} onChange={(e) => setCred('expiresAt', e.target.value)} />
              )}
            </Field>
          </div>
          <Field label="Enlace al respaldo (opcional)" error={errors.evidenceUrl}>
            {(p) => (
              <input
                {...p}
                type="url"
                className={inputClass}
                value={f.credential.evidenceUrl}
                placeholder="https://"
                onChange={(e) => setCred('evidenceUrl', e.target.value)}
              />
            )}
          </Field>
        </div>
      )}
    </BottomSheet>
  )
}

// ---------- Vincular a una persona con una organización (le llega como invitación) ----------

function AdminInvite({ provider }: { provider: Provider }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [q, setQ] = useState('')
  const [role, setRole] = useState<MemberRole>('instructor')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    if (!open || users) return
    let alive = true
    fetchUsers()
      .then((r) => alive && setUsers(r.filter((u) => !u.isMock)))
      .catch(() => alive && setUsers([]))
    return () => {
      alive = false
    }
  }, [open, users])

  const term = normalizeText(q)
  const matches = term
    ? (users ?? [])
        .filter(
          (u) => normalizeText(u.displayName).includes(term) || normalizeText(u.email).includes(term) || u.rocketId.toLowerCase().includes(q.toLowerCase()),
        )
        .slice(0, 6)
    : []

  const send = async (u: AdminUser) => {
    if (!user) return
    setBusy(true)
    setMsg(null)
    try {
      await invitePerson(provider.id, provider.name, { uid: user.uid, name: 'Administración de rocketId' }, u.uid, role)
      setMsg({ ok: true, text: `Invitamos a ${u.displayName || 'la persona'} como ${MEMBER_ROLES[role].label.toLowerCase()}. Debe aceptar desde su app.` })
      setQ('')
    } catch (e) {
      console.error('admin invite', e)
      setMsg({ ok: false, text: 'No se pudo invitar. Puede que ya sea parte del equipo o tenga una invitación pendiente.' })
    } finally {
      setBusy(false)
    }
  }

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="h-11 w-full rounded-xl border border-line text-base font-medium text-fg active:bg-line/60">
        ＋ Vincular a una persona con esta organización
      </button>
    )
  return (
    <section aria-label="Vincular a una persona" className="space-y-3 rounded-2xl border border-line p-4">
      <p className="text-sm text-muted">Le llegará como invitación: queda en el equipo cuando la acepta.</p>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <label htmlFor="adm-inv-q" className="sr-only">
          Buscar persona
        </label>
        <input
          id="adm-inv-q"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nombre, correo o rocketId"
          className={inputClass.replace('mt-1 ', '')}
        />
        <label htmlFor="adm-inv-role" className="sr-only">
          Rol
        </label>
        <select
          id="adm-inv-role"
          value={role}
          onChange={(e) => setRole(e.target.value as MemberRole)}
          className="h-12 rounded-xl border border-field bg-card px-3 text-base text-fg"
        >
          {(Object.keys(MEMBER_ROLES) as MemberRole[]).map((r) => (
            <option key={r} value={r}>
              {MEMBER_ROLES[r].label}
            </option>
          ))}
        </select>
      </div>
      {users === null ? (
        <p className="text-sm text-muted">Cargando usuarios…</p>
      ) : (
        <ul className="divide-y divide-line">
          {matches.map((u) => (
            <li key={u.uid} className="flex items-center gap-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-fg">{u.displayName || 'Sin nombre'}</span>
                <span className="block truncate text-sm text-muted">
                  {u.rocketId} · {u.email}
                </span>
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => send(u)}
                className="h-11 shrink-0 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                Invitar
              </button>
            </li>
          ))}
          {q && matches.length === 0 && <li className="py-2 text-sm text-muted">Sin resultados.</li>}
        </ul>
      )}
      {msg && (
        <p role="status" className={`text-sm ${msg.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
          {msg.text}
        </p>
      )}
    </section>
  )
}
