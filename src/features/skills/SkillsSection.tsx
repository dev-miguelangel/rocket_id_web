import { useState } from 'react'
import { Field, Segmented, inputClass } from '../../components/form'
import { SwipeRow } from '../../components/SwipeRow'
import { VerifiedBadge } from '../../components/VerifiedBadge'
import { requestMatches, type VerificationRequest } from '../../../shared/verificationsApi'
import {
  CERT_STATUSES,
  ISSUER_SUGGESTIONS,
  MAX_CERTS,
  SKILL_CATEGORIES,
  categoryOf,
  emptyCert,
  formatMonth,
  isPastExpiry,
  statusOf,
  verificationFor,
  type CategoryId,
  type Certification,
  type SkillsData,
  type SkillsErrors,
  type Verification,
  type Verifications,
} from './schema'

export const SKILLS_TITLE = 'Conocimientos y experiencia'

const YEARS = Array.from({ length: new Date().getFullYear() - 1969 }, (_, i) => String(new Date().getFullYear() - i))

const TONE: Record<string, string> = {
  success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  info: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
}

export function StatusBadge({ status }: { status: string }) {
  const s = statusOf(status)
  if (!s) return null
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${TONE[s.tone]}`}>{s.label}</span>
}

const certSubtitle = (c: Certification) =>
  [c.issuer, c.year, c.expiresAt && `vence ${formatMonth(c.expiresAt)}`].filter(Boolean).join(' · ')

const verifiedText = (v: Verification) =>
  `Verificado por ${v.verifiedBy || 'la institución'}${
    v.verifiedAt ? ` · ${v.verifiedAt.toLocaleDateString('es', { month: 'short', year: 'numeric' }).replace('.', '')}` : ''
  }`

// ---------- Modo lectura ----------

export function SkillsReadSection({
  data,
  verifications,
  onEdit,
  onEditCert,
  onDeleteCert,
  requests = {},
  onRequestVerification,
}: {
  data: SkillsData
  verifications: Verifications
  onEdit: () => void
  onEditCert?: (id: string) => void
  onDeleteCert?: (id: string) => void
  /** Solicitudes de verificación a formadores, por id de certificación */
  requests?: Record<string, VerificationRequest>
  onRequestVerification?: () => void
}) {
  const anyVerified = data.certifications.some((c) => verificationFor(c, verifications))
  const canRequest = !!onRequestVerification && data.certifications.some((c) => c.name.trim() && !verificationFor(c, verifications))
  return (
    <section>
      <div className="mb-1.5 flex items-end justify-between px-4">
        <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">
          <span aria-hidden="true">🎓 </span>
          {SKILLS_TITLE}
        </h2>
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Editar ${SKILLS_TITLE}`}
          className="-my-2.5 h-11 rounded-lg px-3 text-base font-medium text-primary-text active:opacity-60"
        >
          Editar
        </button>
      </div>
      <div className="overflow-hidden rounded-2xl border border-line bg-card">
        {data.hasCertifications === 'yes' && data.certifications.length > 0 ? (
          <>
            {data.categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5 border-b border-line px-4 py-3">
                {data.categories.map((id) => {
                  const c = categoryOf(id)
                  return (
                    c && (
                      <span key={id} className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary-text">
                        {c.icon} {c.short}
                      </span>
                    )
                  )
                })}
              </div>
            )}
            <ul className="divide-y divide-line">
              {data.certifications.map((c) => {
                const stale = c.status === 'active' && isPastExpiry(c.expiresAt)
                const v = verificationFor(c, verifications)
                // Solicitud vigente (si editó la certificación después de pedirla, ya no aplica)
                const r = !v && requests[c.id] && requestMatches(requests[c.id], c) ? requests[c.id] : null
                return (
                  <li key={c.id}>
                    <SwipeRow
                      bg="bg-card"
                      leading={onEditCert ? [{ key: 'edit', label: 'Editar', icon: '✎', tone: 'primary', onClick: () => onEditCert(c.id) }] : []}
                      trailing={onDeleteCert ? [{ key: 'del', label: 'Eliminar', icon: '🗑', tone: 'danger', onClick: () => onDeleteCert(c.id) }] : []}
                    >
                    <button type="button" onClick={() => (onEditCert ? onEditCert(c.id) : onEdit())} className="flex w-full items-start gap-3 px-4 py-3 text-left active:bg-line/60">
                      <span className="mt-0.5 text-lg" aria-hidden="true">
                        {categoryOf(c.category)?.icon ?? '📄'}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-base font-medium break-words text-fg">
                          {c.name}
                          {v && <VerifiedBadge className="ml-1 size-4 -translate-y-px align-middle" />}
                        </span>
                        <span className="block text-sm break-words text-muted">{certSubtitle(c)}</span>
                        {v && <span className="mt-0.5 block text-xs font-medium text-blue-600 dark:text-blue-400">{verifiedText(v)}</span>}
                        {r?.status === 'pending' && (
                          <span className="mt-0.5 block text-xs font-medium text-sky-700 dark:text-sky-300">⏳ Verificación pedida a {r.providerName}</span>
                        )}
                        {r?.status === 'rejected' && (
                          <span className="mt-0.5 block text-xs text-red-700 dark:text-red-300">
                            {r.providerName} no la verificó{r.note ? `: ${r.note}` : ''}
                          </span>
                        )}
                        {stale && <span className="mt-1 block text-xs text-amber-700 dark:text-amber-300">⚠️ Revisa la vigencia</span>}
                      </span>
                      <StatusBadge status={c.status} />
                    </button>
                    </SwipeRow>
                  </li>
                )
              })}
            </ul>
            {canRequest ? (
              <button
                type="button"
                onClick={onRequestVerification}
                className="flex min-h-12 w-full items-center gap-2 border-t border-line px-4 py-2.5 text-left text-sm font-medium text-primary-text active:bg-line/60"
              >
                <VerifiedBadge className="size-4 shrink-0" />
                <span className="flex-1">Pedir verificación al formador que la emitió</span>
                <span aria-hidden="true">›</span>
              </button>
            ) : (
              <p className="flex items-center gap-1.5 border-t border-line px-4 py-2.5 text-xs text-muted">
                <VerifiedBadge className="size-3.5" />
                {anyVerified ? 'Verificado por la institución emisora.' : 'Las instituciones pueden verificar tus certificaciones.'}
              </p>
            )}
          </>
        ) : (
          <button type="button" onClick={onEdit} className="block w-full px-4 py-3 text-left active:bg-line/60">
            <span className="block text-xs text-muted">Cursos y certificaciones</span>
            <span className={`mt-0.5 block text-base ${data.hasCertifications === 'no' ? 'text-fg' : 'text-subtle italic'}`}>
              {data.hasCertifications === 'no' ? 'No declara certificaciones' : 'Sin informar'}
            </span>
          </button>
        )}
      </div>
    </section>
  )
}

// ---------- Edición ----------

interface FormProps {
  value: SkillsData
  /** Certificación que aparece abierta al entrar a editar */
  initialExpanded?: string | null
  verifications: Verifications
  errors: SkillsErrors
  onChange: (v: SkillsData) => void
}

export function SkillsForm({ value, initialExpanded = null, verifications, errors, onChange }: FormProps) {
  const [expanded, setExpanded] = useState<string | null>(initialExpanded)

  const toggleCategory = (id: CategoryId) =>
    onChange({
      ...value,
      categories: value.categories.includes(id) ? value.categories.filter((c) => c !== id) : [...value.categories, id],
    })

  const updateCert = (id: string, patch: Partial<Certification>) =>
    onChange({ ...value, certifications: value.certifications.map((c) => (c.id === id ? { ...c, ...patch } : c)) })

  const addCert = () => {
    const cert = emptyCert(value.categories.length === 1 ? value.categories[0] : '')
    onChange({ ...value, certifications: [...value.certifications, cert] })
    setExpanded(cert.id)
    requestAnimationFrame(() => document.getElementById(`cert-${cert.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const removeCert = (id: string) => onChange({ ...value, certifications: value.certifications.filter((c) => c.id !== id) })

  return (
    <>
      <div className="rounded-2xl border border-line bg-card p-4">
        <Segmented
          label="¿Cuentas con cursos o certificaciones relevantes para actividades outdoor?"
          value={value.hasCertifications}
          options={[
            { value: 'yes', label: 'Sí' },
            { value: 'no', label: 'No' },
          ]}
          onChange={(v) => {
            onChange({ ...value, hasCertifications: v })
            if (v === 'yes' && value.certifications.length === 0) setExpanded(null)
          }}
        />
        {value.hasCertifications === 'no' && value.certifications.length > 0 && (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">Al guardar se eliminarán las certificaciones registradas.</p>
        )}
      </div>

      {value.hasCertifications === 'yes' && (
        <>
          <div>
            <p className="mb-2 px-4 text-xs font-semibold tracking-wide text-muted uppercase">Áreas</p>
            <div className="flex flex-wrap gap-2">
              {SKILL_CATEGORIES.map((c) => {
                const on = value.categories.includes(c.id)
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleCategory(c.id)}
                    className={`flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 py-2 text-left text-sm font-medium transition active:scale-[0.97] ${
                      on ? 'border-primary bg-primary text-white' : 'border-line-strong bg-card text-fg'
                    }`}
                  >
                    <span aria-hidden="true">{on ? '✓' : c.icon}</span>
                    {c.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 px-4 text-xs font-semibold tracking-wide text-muted uppercase">
              Certificaciones ({value.certifications.length})
            </p>
            <div className="space-y-3">
              {value.certifications.map((c) => (
                <CertCard
                  key={c.id}
                  cert={c}
                  verification={verificationFor(c, verifications)}
                  wasVerified={!!verifications[c.id]}
                  errors={errors.certs[c.id]}
                  open={expanded === c.id || !!errors.certs[c.id]}
                  onToggle={() => setExpanded((e) => (e === c.id ? null : c.id))}
                  onChange={(patch) => updateCert(c.id, patch)}
                  onRemove={() => removeCert(c.id)}
                />
              ))}
              {value.certifications.length < MAX_CERTS && (
                <button
                  type="button"
                  onClick={addCert}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line-strong text-base font-semibold text-primary-text active:bg-line/50"
                >
                  <span aria-hidden="true" className="text-xl leading-none">+</span>
                  {value.certifications.length ? 'Agregar otra certificación' : 'Agregar certificación'}
                </button>
              )}
              {errors.general && <p className="px-4 text-sm text-red-600 dark:text-red-400">{errors.general}</p>}
            </div>
          </div>
          <datalist id="issuer-suggestions">
            {ISSUER_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
          </datalist>
        </>
      )}
    </>
  )
}

interface CertCardProps {
  cert: Certification
  verification: Verification | null
  /** Tenía verificación pero los datos ya no coinciden */
  wasVerified: boolean
  errors?: Partial<Record<keyof Certification, string>>
  open: boolean
  onToggle: () => void
  onChange: (patch: Partial<Certification>) => void
  onRemove: () => void
}

function CertCard({ cert, verification, wasVerified, errors = {}, open, onToggle, onChange, onRemove }: CertCardProps) {
  const cat = categoryOf(cert.category)
  const expiredByDate = isPastExpiry(cert.expiresAt)

  return (
    <div id={`cert-${cert.id}`} className={`scroll-mt-4 overflow-hidden rounded-2xl border bg-card ${Object.keys(errors).length ? 'border-red-400' : 'border-line'}`}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-line/60">
        <span className="text-lg" aria-hidden="true">{cat?.icon ?? '📄'}</span>
        <span className="min-w-0 flex-1">
          <span className={`flex items-center gap-1 text-base font-medium ${cert.name ? 'text-fg' : 'text-subtle italic'}`}>
            <span className="truncate">{cert.name || 'Nueva certificación'}</span>
            {verification && <VerifiedBadge className="size-4" />}
          </span>
          {certSubtitle(cert) && <span className="block truncate text-sm text-muted">{certSubtitle(cert)}</span>}
        </span>
        <StatusBadge status={cert.status} />
        <span aria-hidden="true" className={`text-muted transition-transform ${open ? 'rotate-90' : ''}`}>›</span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-line px-4 pt-4 pb-3">
          {verification && (
            <p className="flex items-start gap-2 rounded-xl bg-blue-50 p-3 text-xs text-blue-900 dark:bg-blue-500/10 dark:text-blue-200">
              <VerifiedBadge className="mt-px size-4" />
              <span>
                <strong className="font-semibold">{verifiedText(verification)}.</strong> Si cambias el nombre, la institución, el año o el
                vencimiento, la verificación se perderá.
              </span>
            </p>
          )}
          {!verification && wasVerified && (
            <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
              Los datos ya no coinciden con lo verificado por la institución. Al guardar, esta certificación quedará sin verificar.
            </p>
          )}
          <Field label="Área" error={errors.category}>
            {(a) => (
              <select {...a} className={inputClass} value={cert.category} onChange={(e) => onChange({ category: e.target.value as CategoryId })}>
                <option value="">Seleccionar</option>
                {SKILL_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            )}
          </Field>

          <div>
            <Field label="Nombre exacto del curso o certificación" error={errors.name}>
              {(a) => (
                <input {...a} className={inputClass} value={cert.name} maxLength={120} placeholder="Ej: WFR (Wilderness First Responder)"
                  onChange={(e) => onChange({ name: e.target.value })} />
              )}
            </Field>
            {cat && !cert.name && (
              <div className="mt-2 flex flex-wrap gap-2">
                {cat.suggestions.map((s) => (
                  <button key={s} type="button" onClick={() => onChange({ name: s })}
                    className="min-h-11 rounded-full bg-surface px-3.5 py-2 text-left text-sm font-medium text-fg-soft ring-1 ring-field active:bg-line">
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Field label="Institución u organismo emisor" error={errors.issuer} hint="Ej: Cruz Roja, NOLS, Ecomed, Federación de Andinismo.">
            {(a) => (
              <input {...a} className={inputClass} value={cert.issuer} maxLength={120} list="issuer-suggestions" autoCapitalize="words"
                onChange={(e) => onChange({ issuer: e.target.value })} />
            )}
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Año de obtención" error={errors.year}>
              {(a) => (
                <select {...a} className={inputClass} value={cert.year} onChange={(e) => onChange({ year: e.target.value })}>
                  <option value="">{cert.status === 'in_progress' ? 'En curso' : 'Año'}</option>
                  {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              )}
            </Field>
            <Field label="Vencimiento" error={errors.expiresAt} hint="Opcional">
              {(a) => (
                <input {...a} type="month" className={`${inputClass} date-input`} value={cert.expiresAt}
                  onChange={(e) => {
                    const expiresAt = e.target.value
                    // Si la fecha ya pasó y estaba "Vigente", sugerimos "Vencido"
                    onChange(isPastExpiry(expiresAt) && cert.status === 'active' ? { expiresAt, status: 'expired' } : { expiresAt })
                  }} />
              )}
            </Field>
          </div>

          <Segmented
            label="Estado"
            value={cert.status}
            options={CERT_STATUSES}
            onChange={(status) => onChange({ status })}
            error={errors.status}
          />
          {cert.status === 'expired' && (
            <p className="-mt-2 text-xs text-muted">Vencido, pero conservas los conocimientos teóricos y prácticos.</p>
          )}
          {cert.status === 'active' && expiredByDate && !errors.status && (
            <p className="-mt-2 text-xs text-amber-700 dark:text-amber-300">La fecha de vencimiento ya pasó.</p>
          )}

          <button type="button" onClick={onRemove} className="h-11 w-full rounded-xl text-sm font-medium text-red-600 active:bg-red-50 dark:text-red-400 dark:active:bg-red-500/10">
            Eliminar certificación
          </button>
        </div>
      )}
    </div>
  )
}
