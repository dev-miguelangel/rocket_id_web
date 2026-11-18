import { useEffect, useId, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { BottomSheet } from '../../components/Sheet'
import { useAuth } from '../auth/AuthProvider'
import { useRocketId } from '../auth/useRocketId'
import { DOC_TYPES, type ProfileForm } from '../profile/schema'
import { categoryOf, statusOf, type SkillsData } from '../skills/schema'
import { REQUIRED_FOR_APPLY, buildApplicantSnapshot, submitApplication } from './applicationsApi'
import { ApplicationBadge, ProviderLine } from './parts'
import { APPLICATION_STATUSES, formatDateRange, formatPrice, type Application, type Course } from './schema'

type Step = 'detail' | 'consent' | 'sent'

interface Props {
  course: Course | null
  application?: Application
  profile: ProfileForm
  skills: SkillsData
  onClose: () => void
  /** Abrir directamente en un paso (ej. "consent" desde el gesto Postular) */
  initialStep?: 'detail' | 'consent'
}

const primaryBtn =
  'h-12 w-full rounded-xl bg-primary text-base font-semibold text-white transition active:bg-primary-dark disabled:opacity-50'

export function CourseSheet({ course, application, profile, skills, onClose, initialStep = 'detail' }: Props) {
  const { user } = useAuth()
  const rocketId = useRocketId()
  const navigate = useNavigate()
  // Conserva el último curso para que el contenido no desaparezca durante la animación de cierre
  const [shown, setShown] = useState<Course | null>(course)
  const [step, setStep] = useState<Step>('detail')
  const [accepted, setAccepted] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (course && course !== shown) {
    setShown(course)
    setStep(application ? 'detail' : initialStep)
    setAccepted(false)
    setError(null)
  }

  if (!shown) return null
  const c = shown
  const provider = c.provider.name
  const missing = REQUIRED_FOR_APPLY.filter(({ key }) => !profile[key].trim())

  const send = async () => {
    if (!user) return
    if (!navigator.onLine) {
      setError('Necesitas conexión a internet para enviar tu postulación.')
      return
    }
    setSending(true)
    setError(null)
    try {
      await submitApplication(user.uid, c, buildApplicantSnapshot(profile, skills, rocketId))
      navigator.vibrate?.([10, 40, 10])
      setStep('sent')
    } catch (e) {
      const code = (e as { code?: string }).code
      console.error('submitApplication', code, e)
      setError(
        code === 'permission-denied'
          ? 'No se pudo validar tu postulación. Si el problema continúa, cierra y vuelve a abrir la app.'
          : code === 'unavailable'
            ? 'Sin conexión con el servidor. Inténtalo de nuevo en unos segundos.'
            : 'No se pudo enviar. Inténtalo de nuevo.',
      )
    } finally {
      setSending(false)
    }
  }

  const titles: Record<Step, string> = { detail: 'Curso', consent: 'Postular', sent: 'Postulación' }

  const footer =
    step === 'detail' ? (
      application ? (
        <button type="button" disabled className={primaryBtn}>
          ✓ Postulación {APPLICATION_STATUSES[application.status].label.toLowerCase()}
        </button>
      ) : (
        <button type="button" onClick={() => setStep('consent')} className={primaryBtn}>
          Postular a este curso
        </button>
      )
    ) : step === 'consent' ? (
      missing.length ? (
        <button
          type="button"
          onClick={() => {
            onClose()
            navigate('/mis-datos')
          }}
          className={primaryBtn}
        >
          Completar mis datos
        </button>
      ) : (
        <button type="button" onClick={send} disabled={!accepted || sending} className={primaryBtn}>
          {sending ? 'Enviando…' : 'Aceptar y enviar postulación'}
        </button>
      )
    ) : (
      <button type="button" onClick={onClose} className={primaryBtn}>
        Entendido
      </button>
    )

  return (
    <BottomSheet
      open={!!course}
      title={titles[step]}
      onClose={onClose}
      left={
        step === 'consent' ? (
          <button type="button" onClick={() => setStep('detail')} className="h-11 rounded-lg px-3 text-base text-primary-text active:opacity-60">
            ‹ Volver
          </button>
        ) : undefined
      }
      footer={<div className="pb-3">{footer}</div>}
    >
      {step === 'detail' && <Detail course={c} application={application} />}
      {step === 'consent' && (
        <Consent
          provider={provider}
          rocketId={rocketId}
          profile={profile}
          skills={skills}
          missing={missing.map((m) => m.label)}
          accepted={accepted}
          onAccept={setAccepted}
          error={error}
        />
      )}
      {step === 'sent' && <Sent provider={provider} />}
    </BottomSheet>
  )
}

// ---------- Paso 1: detalle ----------

function Detail({ course: c, application }: { course: Course; application?: Application }) {
  const cat = categoryOf(c.category)
  return (
    <>
      <div className="flex items-start gap-3">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-3xl" aria-hidden="true">
          {cat?.icon}
        </span>
        <div className="min-w-0">
          <h3 className="text-xl leading-tight font-bold text-fg">{c.title}</h3>
          <ProviderLine provider={c.provider} />
        </div>
      </div>

      {application && (
        <div className="flex items-center justify-between rounded-2xl border border-line bg-card p-4">
          <div>
            <p className="text-sm font-medium text-fg">Ya postulaste a este curso</p>
            {application.createdAt && (
              <p className="text-xs text-muted">
                {application.createdAt.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>
          <ApplicationBadge status={application.status} />
        </div>
      )}

      <p className="text-base text-fg-soft">{c.summary}</p>

      <dl className="grid grid-cols-2 gap-2">
        <Info label="Fechas" value={formatDateRange(c.startDate, c.endDate)} />
        <Info label="Duración" value={c.duration} />
        <Info label="Lugar" value={c.location} wide />
        <Info label="Modalidad" value={c.modality[0].toUpperCase() + c.modality.slice(1)} />
        <Info label="Nivel" value={c.level} />
        <Info label="Valor" value={formatPrice(c.priceCLP)} />
        <Info label="Cupos" value={String(c.spots)} />
      </dl>

      <Block title="Descripción">
        <p className="max-w-prose text-base leading-relaxed text-fg-soft">{c.description}</p>
      </Block>
      <Block title="Requisitos">
        <ul className="space-y-1.5 text-base text-fg-soft">
          {c.requirements.map((r) => (
            <li key={r} className="flex gap-2">
              <span className="text-primary-text" aria-hidden="true">•</span>
              {r}
            </li>
          ))}
        </ul>
      </Block>
      <Block title="Al aprobar obtienes">
        <p className="text-base text-fg-soft">🎓 {c.certification}</p>
      </Block>
    </>
  )
}

function Info({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`rounded-xl border border-line bg-card px-3 py-2.5 ${wide ? 'col-span-2' : ''}`}>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-fg">{value}</dd>
    </div>
  )
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h4 className="mb-1.5 px-1 text-xs font-semibold tracking-wide text-muted uppercase">{title}</h4>
      <div className="rounded-2xl border border-line bg-card p-4">{children}</div>
    </section>
  )
}

// ---------- Paso 2: consentimiento ----------

interface ConsentProps {
  provider: string
  rocketId: string | null
  profile: ProfileForm
  skills: SkillsData
  missing: string[]
  accepted: boolean
  onAccept: (v: boolean) => void
  error: string | null
}

function Consent({ provider, rocketId, profile: p, skills, missing, accepted, onAccept, error }: ConsentProps) {
  const checkId = useId()
  const docLabel = DOC_TYPES.find((d) => d.value === p.docType)?.label ?? 'Documento'
  const certs = skills.hasCertifications === 'yes' ? skills.certifications : []

  useEffect(() => {
    if (error) navigator.vibrate?.(30)
  }, [error])

  return (
    <>
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
        <p className="text-base font-semibold text-fg">Compartirás tus datos con {provider}</p>
        <p className="mt-1 max-w-prose text-base text-fg-soft">
          Para realizar esta postulación se enviará tu información de <strong>identificación</strong>, <strong>contacto</strong> y{' '}
          <strong>conocimientos</strong> a la institución.
        </p>
      </div>

      {missing.length > 0 && (
        <div role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <p className="font-semibold">Completa tus datos para postular</p>
          <p className="mt-1">Faltan: {missing.join(', ')}.</p>
        </div>
      )}

      <Preview title="🪪 Identificación">
        <Row label="rocketId" value={rocketId ?? ''} nowrap />
        <Row label="Nombre" value={p.fullName} />
        <Row label={docLabel} value={p.docNumber} />
        <Row label="Fecha de nacimiento" value={p.birthDate ? new Date(`${p.birthDate}T00:00:00`).toLocaleDateString('es') : ''} />
      </Preview>
      <Preview title="📞 Contacto">
        <Row label="Celular" value={p.phone} />
        <Row label="Correo" value={p.contactEmail} />
      </Preview>
      <Preview title="🎓 Conocimientos">
        {certs.length ? (
          certs.map((c) => (
            <Row key={c.id} label={[c.issuer, c.year, statusOf(c.status)?.label].filter(Boolean).join(' · ')} value={c.name} />
          ))
        ) : (
          <Row label="Certificaciones" value={skills.hasCertifications === 'no' ? 'No declara' : ''} />
        )}
      </Preview>

      <p className="flex items-start gap-2 px-1 text-xs text-muted">
        <span aria-hidden="true">🔒</span>
        No se comparten tus datos de salud ni tu contacto de emergencia.
      </p>

      {missing.length === 0 && (
        <label htmlFor={checkId} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-card p-4 active:bg-line/40">
          <input
            id={checkId}
            type="checkbox"
            checked={accepted}
            onChange={(e) => onAccept(e.target.checked)}
            className="mt-0.5 size-6 shrink-0 accent-[#0D9488]"
          />
          <span className="text-sm text-fg">
            Acepto enviar mi información de identificación, contacto y conocimientos a <strong>{provider}</strong> para esta postulación.
          </span>
        </label>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </p>
      )}
    </>
  )
}

function Preview({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h4 className="mb-1.5 px-1 text-xs font-semibold tracking-wide text-muted uppercase">{title}</h4>
      <div className="divide-y divide-line rounded-2xl border border-line bg-card">{children}</div>
    </section>
  )
}

function Row({ label, value, nowrap }: { label: string; value: string; nowrap?: boolean }) {
  return (
    <div className="px-4 py-2.5">
      <p className="text-xs text-muted">{label}</p>
      <p className={`text-sm ${nowrap ? 'font-mono whitespace-nowrap' : 'break-words'} ${value ? 'text-fg' : 'text-subtle italic'}`}>{value || 'Sin informar'}</p>
    </div>
  )
}

// ---------- Paso 3: enviada ----------

function Sent({ provider }: { provider: string }) {
  return (
    <div className="flex flex-col items-center px-2 pt-6 text-center">
      <div className="flex size-20 items-center justify-center rounded-full bg-emerald-100 text-4xl text-emerald-700 motion-safe:animate-[pop_400ms_ease-out] dark:bg-emerald-500/15 dark:text-emerald-300">
        ✓
      </div>
      <h3 className="mt-5 text-xl font-bold text-fg">¡Postulación enviada!</h3>
      <p className="mt-2 text-base text-fg-soft">
        Tu información fue enviada a <strong>{provider}</strong>.
      </p>

      <div className="mt-6 w-full space-y-3 text-left">
        <div className="flex gap-3 rounded-2xl border border-line bg-card p-4">
          <span className="text-xl" aria-hidden="true">📬</span>
          <p className="text-base text-fg-soft">
            La institución tomará contacto contigo <strong>directamente por sus canales preferentes</strong> (correo, teléfono o
            WhatsApp). rocketId no gestiona esta comunicación.
          </p>
        </div>
        <div className="flex gap-3 rounded-2xl border border-line bg-card p-4">
          <span className="text-xl" aria-hidden="true">🔔</span>
          <p className="text-base text-fg-soft">
            Revisa el estado en <strong>Cursos → Mis postulaciones</strong>. Más adelante la institución podrá marcarla como{' '}
            <em>vista</em>, <em>aceptada</em> o <em>rechazada</em>.
          </p>
        </div>
      </div>
    </div>
  )
}
