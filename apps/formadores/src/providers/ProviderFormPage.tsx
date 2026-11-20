import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import {
  emptyProviderForm,
  formatRut,
  hasProviderErrors,
  independentId,
  PROVIDER_KINDS,
  providerToForm,
  validateProvider,
  type ProviderErrors,
  type ProviderForm,
  type ProviderKind,
} from '../../../../shared/domain/providers'
import { registerProvider, resubmitProvider } from '../../../../shared/providersApi'
import { useAuth } from '../auth/AuthProvider'
import { Card, Field, inputClass, primaryButton, secondaryButton, textareaClass } from '../ui/form'
import { useMyProviders } from './MyProviders'

const KIND_BY_SLUG: Record<string, ProviderKind> = { organizacion: 'organization', independiente: 'independent' }

/** /registro/:tipo (nueva solicitud) y /solicitud/:id (corregir y reenviar) */
export function ProviderFormPage() {
  const { tipo, id } = useParams()
  const { memberships } = useMyProviders()
  const { user } = useAuth()

  if (memberships === null) return <div className="h-96 animate-pulse rounded-2xl bg-line/60" aria-busy="true" />

  if (id) {
    const m = memberships.find((x) => x.provider.id === id)
    // Solo se corrige una solicitud propia en revisión o rechazada
    if (!m || m.role !== 'owner' || !['pending', 'rejected'].includes(m.provider.status)) return <Navigate to="/" replace />
    return <Form key={id} initial={providerToForm(m.provider)} providerId={id} rejectedNote={m.provider.status === 'rejected' ? m.provider.reviewNote : ''} />
  }

  const kind = tipo ? KIND_BY_SLUG[tipo] : undefined
  if (!kind) return <Navigate to="/" replace />
  // Un solo registro como independiente por persona
  if (kind === 'independent' && user && memberships.some((m) => m.provider.id === independentId(user.uid))) return <Navigate to="/" replace />
  return <Form key={kind} initial={emptyProviderForm(kind, kind === 'independent' ? (user?.displayName ?? '') : '')} />
}

function Form({ initial, providerId, rejectedNote }: { initial: ProviderForm; providerId?: string; rejectedNote?: string }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [f, setF] = useState(initial)
  const [declared, setDeclared] = useState(!!providerId)
  const [tried, setTried] = useState(false)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)

  const errors: ProviderErrors = tried ? validateProvider(f) : {}
  const declareError = tried && !declared ? 'Confirma que los datos son verdaderos para enviar la solicitud.' : undefined
  const org = f.kind === 'organization'

  const set = <K extends keyof ProviderForm>(k: K, v: ProviderForm[K]) => setF((x) => ({ ...x, [k]: v }))
  const setCred = (k: keyof ProviderForm['credential'], v: string) => setF((x) => ({ ...x, credential: { ...x.credential, [k]: v } }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (hasProviderErrors(validateProvider(f)) || !declared || !user) {
      // Lleva el foco al primer campo con error
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      return
    }
    setSaving(true)
    setFailed(false)
    try {
      if (providerId) await resubmitProvider(user, providerId, f)
      else await registerProvider(user, f)
      navigate('/', { replace: true, state: { sent: true } })
    } catch (err) {
      console.error('provider submit', err)
      setFailed(true)
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="space-y-6">
        <div>
          <Link to="/" className="text-sm font-medium text-primary-text hover:underline">
            ‹ Volver al inicio
          </Link>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-fg">
            {providerId ? 'Corregir y reenviar la solicitud' : org ? 'Registrar una organización' : 'Registrarte como formador independiente'}
          </h2>
          <p className="mt-1 text-muted">
            {PROVIDER_KINDS[f.kind].icon} {PROVIDER_KINDS[f.kind].label} · {PROVIDER_KINDS[f.kind].hint}
          </p>
        </div>

        {rejectedNote && (
          <div role="note" className="rounded-xl bg-red-50 p-4 text-red-900 dark:bg-red-500/10 dark:text-red-200">
            <p className="font-semibold">Motivo del rechazo</p>
            <p className="mt-1">{rejectedNote}</p>
          </div>
        )}

        <Card title={org ? 'Tu organización' : 'Tu perfil de formador'} description="Así te verá la comunidad en los cursos y en la insignia de verificación.">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <Field
                label="Nombre visible"
                hint={org ? 'Por ejemplo: Escuela Andina de Montaña' : 'Tu nombre o el nombre con que impartes cursos'}
                error={errors.name}
              >
                {(p) => (
                  <input
                    {...p}
                    className={inputClass}
                    value={f.name}
                    maxLength={80}
                    onChange={(e) => set('name', e.target.value)}
                    autoComplete="organization"
                  />
                )}
              </Field>
            </div>
            {org && (
              <>
                <Field label="Razón social" error={errors.legalName}>
                  {(p) => <input {...p} className={inputClass} value={f.legalName} maxLength={120} onChange={(e) => set('legalName', e.target.value)} />}
                </Field>
                <Field label="RUT" hint="Con dígito verificador, por ejemplo 76.123.456-K" error={errors.rut}>
                  {(p) => (
                    <input
                      {...p}
                      className={inputClass}
                      value={f.rut}
                      inputMode="text"
                      maxLength={12}
                      onChange={(e) => set('rut', e.target.value)}
                      onBlur={() => f.rut.trim() && set('rut', formatRut(f.rut))}
                    />
                  )}
                </Field>
              </>
            )}
            <div className="md:col-span-2">
              <Field label={org ? 'Sitio web' : 'Sitio web o redes'} optional error={errors.website}>
                {(p) => (
                  <input
                    {...p}
                    type="url"
                    className={inputClass}
                    value={f.website}
                    placeholder="https://"
                    maxLength={200}
                    onChange={(e) => set('website', e.target.value)}
                  />
                )}
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Descripción breve" optional hint={`${f.about.length}/500 · Qué cursos impartes y dónde`} error={errors.about}>
                {(p) => <textarea {...p} className={textareaClass} value={f.about} maxLength={500} onChange={(e) => set('about', e.target.value)} />}
              </Field>
            </div>
          </div>
        </Card>

        {!org && (
          <Card
            title="Certificación que te habilita"
            description="La certificación que te permite impartir cursos. La administración de rocketId la revisa antes de aprobarte."
          >
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Certificación" hint="Por ejemplo: Instructor WFA" error={errors.credName}>
                {(p) => <input {...p} className={inputClass} value={f.credential.name} maxLength={100} onChange={(e) => setCred('name', e.target.value)} />}
              </Field>
              <Field label="Institución que la emitió" error={errors.issuer}>
                {(p) => <input {...p} className={inputClass} value={f.credential.issuer} maxLength={100} onChange={(e) => setCred('issuer', e.target.value)} />}
              </Field>
              <Field label="Número o código" optional error={errors.number}>
                {(p) => <input {...p} className={inputClass} value={f.credential.number} maxLength={60} onChange={(e) => setCred('number', e.target.value)} />}
              </Field>
              <Field label="Vigente hasta" optional hint="Déjalo vacío si no vence" error={errors.expiresAt}>
                {(p) => (
                  <input
                    {...p}
                    type="month"
                    className={inputClass}
                    value={f.credential.expiresAt}
                    placeholder="AAAA-MM"
                    onChange={(e) => setCred('expiresAt', e.target.value)}
                  />
                )}
              </Field>
              <div className="md:col-span-2">
                <Field
                  label="Enlace al respaldo"
                  optional
                  hint="Un enlace a tu certificado: un PDF compartido, Drive o la página de la institución"
                  error={errors.evidenceUrl}
                >
                  {(p) => (
                    <input
                      {...p}
                      type="url"
                      className={inputClass}
                      value={f.credential.evidenceUrl}
                      placeholder="https://"
                      maxLength={300}
                      onChange={(e) => setCred('evidenceUrl', e.target.value)}
                    />
                  )}
                </Field>
              </div>
            </div>
          </Card>
        )}

        <Card title="Contacto" description="Para que la administración de rocketId pueda escribirte sobre tu solicitud.">
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-fg-soft">Responsable</p>
              <p className="mt-1.5 truncate text-fg">{user?.displayName}</p>
              <p className="truncate text-sm text-muted">{user?.email}</p>
            </div>
            <Field label="Teléfono" optional error={errors.phone}>
              {(p) => (
                <input
                  {...p}
                  type="tel"
                  className={inputClass}
                  value={f.phone}
                  maxLength={30}
                  placeholder="+56 9"
                  onChange={(e) => set('phone', e.target.value)}
                />
              )}
            </Field>
          </div>
        </Card>

        <div className="space-y-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={declared}
              onChange={(e) => setDeclared(e.target.checked)}
              aria-invalid={declareError ? true : undefined}
              aria-describedby={declareError ? 'declare-err' : undefined}
              className="mt-0.5 size-5 shrink-0 accent-primary"
            />
            <span className="text-fg-soft">
              Declaro que los datos son verdaderos y que {org ? 'represento a esta organización' : 'estoy certificado para impartir cursos'}. Acepto que la
              administración de rocketId los revise.
            </span>
          </label>
          {declareError && (
            <p id="declare-err" className="text-sm text-red-600 dark:text-red-400">
              {declareError}
            </p>
          )}
          {failed && (
            <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
              No se pudo enviar. Revisa tu conexión e inténtalo de nuevo.
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={saving} className={primaryButton}>
              {saving ? 'Enviando…' : providerId ? 'Guardar y reenviar' : 'Enviar solicitud'}
            </button>
            <Link to="/" className={secondaryButton}>
              Cancelar
            </Link>
          </div>
        </div>
      </div>

      <aside className="space-y-4 xl:pt-24">
        <div className="rounded-2xl bg-card p-5 ring-1 ring-line">
          <p className="font-semibold text-fg">¿Qué pasa después?</p>
          <ol className="mt-3 space-y-3 text-sm text-muted">
            <li>
              <span className="font-semibold text-fg">1.</span> Tu solicitud queda <span className="font-medium text-fg">En revisión</span>.
            </li>
            <li>
              <span className="font-semibold text-fg">2.</span> La administración de rocketId revisa tus datos y la aprueba, o te indica qué corregir.
            </li>
            <li>
              <span className="font-semibold text-fg">3.</span> Una vez aprobada, podrás publicar cursos.
            </li>
          </ol>
        </div>
        <p className="px-1 text-sm text-subtle">Mientras esté en revisión puedes corregirla o retirarla. Registrarse es gratis.</p>
      </aside>
    </form>
  )
}
