import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Field, FormSection, inputClass, textareaClass } from '../../components/form'
import { useAuth } from '../auth/AuthProvider'
import { saveProfile, subscribeProfile } from '../profile/profileApi'
import {
  BLOOD_TYPES,
  CRITICAL_FIELDS,
  DOC_TYPES,
  INSURANCE_SYSTEMS,
  MAX_LEN,
  ageFrom,
  emptyProfile,
  formatRut,
  validate,
  type ProfileErrors,
  type ProfileForm,
} from '../profile/schema'

type Status = 'loading' | 'idle' | 'saving' | 'saved' | 'saved-offline' | 'error'

const today = new Date().toISOString().slice(0, 10)

export function MyDataPage() {
  const { user } = useAuth()
  const [form, setForm] = useState<ProfileForm>(emptyProfile)
  const [saved, setSaved] = useState<ProfileForm>(emptyProfile)
  const [errors, setErrors] = useState<ProfileErrors>({})
  const [status, setStatus] = useState<Status>('loading')
  const initialized = useRef(false)

  useEffect(() => {
    if (!user) return
    return subscribeProfile(user.uid, (profile, defaults) => {
      setSaved(profile)
      // Solo precargamos el formulario la primera vez, para no pisar lo que el usuario edita
      if (!initialized.current) {
        initialized.current = true
        setForm({
          ...profile,
          fullName: profile.fullName || defaults.name,
          contactEmail: profile.contactEmail || defaults.email,
        })
        setStatus('idle')
      }
    })
  }, [user])

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(saved), [form, saved])
  const missing = CRITICAL_FIELDS.filter(({ key }) => !saved[key].trim())
  const age = ageFrom(form.birthDate)

  const set = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
    if (status === 'saved' || status === 'saved-offline' || status === 'error') setStatus('idle')
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!user) return
    const next = form.docType === 'rut' && form.docNumber ? { ...form, docNumber: formatRut(form.docNumber) } : form
    const errs = validate(next)
    setErrors(errs)
    if (Object.keys(errs).length) {
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      return
    }
    setForm(next)
    setStatus('saving')
    const pending = saveProfile(user.uid, next)
    if (!navigator.onLine) {
      // Firestore lo guarda localmente y lo sincroniza al recuperar la conexión
      setStatus('saved-offline')
      pending.catch(() => setStatus('error'))
      return
    }
    try {
      await pending
      setStatus('saved')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'loading') return <FormSkeleton />

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4 pb-20">
      {missing.length > 0 ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <p className="font-semibold">Completa tu ficha antes de tu próxima salida</p>
          <p className="mt-1 opacity-90">Faltan: {missing.map((m) => m.label).join(', ')}.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-accent/30 bg-accent/10 p-4 text-sm font-medium text-fg">
          ✓ Tu ficha de emergencia está completa.
        </div>
      )}

      <FormSection icon="🪪" title="Identificación y contacto" description="Para listas de asistencia, registros de acceso y seguros.">
        <Field label="Nombre completo">
          {(a) => (
            <input {...a} className={inputClass} value={form.fullName} maxLength={MAX_LEN.short} autoComplete="name"
              onChange={(e) => set('fullName', e.target.value)} />
          )}
        </Field>

        <div className="grid grid-cols-[7.5rem_1fr] gap-3">
          <Field label="Documento">
            {(a) => (
              <select {...a} className={inputClass} value={form.docType} onChange={(e) => set('docType', e.target.value)}>
                {DOC_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            )}
          </Field>
          <Field label="Número" error={errors.docNumber}>
            {(a) => (
              <input {...a} className={inputClass} value={form.docNumber} maxLength={30} autoCapitalize="characters"
                placeholder={form.docType === 'rut' ? '12.345.678-9' : ''}
                onChange={(e) => set('docNumber', e.target.value)}
                onBlur={() => form.docType === 'rut' && form.docNumber && set('docNumber', formatRut(form.docNumber))} />
            )}
          </Field>
        </div>

        <Field label="Fecha de nacimiento" error={errors.birthDate} hint={age !== null && age >= 0 ? `${age} años` : undefined}>
          {(a) => (
            <input {...a} type="date" className={inputClass} value={form.birthDate} max={today} autoComplete="bday"
              onChange={(e) => set('birthDate', e.target.value)} />
          )}
        </Field>

        <Field label="Celular (con WhatsApp)" error={errors.phone}>
          {(a) => (
            <input {...a} type="tel" inputMode="tel" autoComplete="tel" className={inputClass} value={form.phone}
              maxLength={20} placeholder="+56 9 1234 5678" onChange={(e) => set('phone', e.target.value)} />
          )}
        </Field>

        <Field label="Correo electrónico" error={errors.contactEmail} hint="Aquí te enviaremos rutas (GPX), listas de equipo y descargos.">
          {(a) => (
            <input {...a} type="email" inputMode="email" autoComplete="email" className={inputClass}
              value={form.contactEmail} maxLength={MAX_LEN.short} onChange={(e) => set('contactEmail', e.target.value)} />
          )}
        </Field>
      </FormSection>

      <FormSection icon="⛑️" title="Seguridad y emergencias" description="Información crítica en caso de accidente en terreno.">
        <fieldset className="space-y-4 rounded-xl bg-surface p-3">
          <legend className="sr-only">Contacto de emergencia</legend>
          <p className="text-sm font-semibold text-fg">Contacto de emergencia</p>
          <p className="-mt-3 text-xs text-muted">Alguien que no asista a la salida y esté disponible durante la actividad.</p>
          <Field label="Nombre">
            {(a) => (
              <input {...a} className={inputClass} value={form.emergencyName} maxLength={MAX_LEN.short}
                onChange={(e) => set('emergencyName', e.target.value)} />
            )}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Parentesco">
              {(a) => (
                <input {...a} className={inputClass} value={form.emergencyRelationship} maxLength={60}
                  placeholder="Ej: madre" onChange={(e) => set('emergencyRelationship', e.target.value)} />
              )}
            </Field>
            <Field label="Teléfono" error={errors.emergencyPhone}>
              {(a) => (
                <input {...a} type="tel" inputMode="tel" className={inputClass} value={form.emergencyPhone}
                  maxLength={20} placeholder="+56 9…" onChange={(e) => set('emergencyPhone', e.target.value)} />
              )}
            </Field>
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Previsión de salud">
            {(a) => (
              <select {...a} className={inputClass} value={form.insuranceSystem} onChange={(e) => set('insuranceSystem', e.target.value)}>
                <option value="">Seleccionar</option>
                {INSURANCE_SYSTEMS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            )}
          </Field>
          <Field label="Grupo sanguíneo">
            {(a) => (
              <select {...a} className={inputClass} value={form.bloodType} onChange={(e) => set('bloodType', e.target.value)}>
                <option value="">Seleccionar</option>
                {BLOOD_TYPES.map((b) => <option key={b} value={b}>{b === 'unknown' ? 'No lo sé' : b}</option>)}
              </select>
            )}
          </Field>
        </div>

        {['isapre', 'private', 'other'].includes(form.insuranceSystem) && (
          <Field label="Nombre de la Isapre o seguro" hint="Incluye el número de póliza si lo tienes.">
            {(a) => (
              <input {...a} className={inputClass} value={form.insuranceDetail} maxLength={MAX_LEN.short}
                placeholder="Ej: Colmena, póliza 123456" onChange={(e) => set('insuranceDetail', e.target.value)} />
            )}
          </Field>
        )}

        <Field label="Alergias relevantes" hint="Medicamentos (penicilina, antiinflamatorios), picaduras (abejas, avispas) o alimentos.">
          {(a) => (
            <textarea {...a} className={textareaClass} value={form.allergies} maxLength={MAX_LEN.long}
              placeholder="Escribe “Ninguna” si no tienes" onChange={(e) => set('allergies', e.target.value)} />
          )}
        </Field>

        <Field label="Condiciones médicas o lesiones recientes" hint="Asma, problemas cardíacos, diabetes, esguinces recientes, etc.">
          {(a) => (
            <textarea {...a} className={textareaClass} value={form.conditions} maxLength={MAX_LEN.long}
              placeholder="Escribe “Ninguna” si no tienes" onChange={(e) => set('conditions', e.target.value)} />
          )}
        </Field>

        <Field label="Medicamentos habituales o de rescate" hint="Inhalador, EpiPen, insulina… e indica dónde lo llevas en la mochila.">
          {(a) => (
            <textarea {...a} className={textareaClass} value={form.medications} maxLength={MAX_LEN.long}
              placeholder="Ej: Inhalador salbutamol, bolsillo superior de la mochila" onChange={(e) => set('medications', e.target.value)} />
          )}
        </Field>
      </FormSection>

      <p className="px-1 text-center text-xs text-subtle">🔒 Solo tú puedes ver estos datos.</p>

      {/* Barra de guardado fija sobre la navegación inferior */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <p className="flex-1 text-sm text-muted" role="status" aria-live="polite">
            {status === 'saved' && '✓ Cambios guardados'}
            {status === 'saved-offline' && '✓ Guardado. Se sincronizará al volver la conexión.'}
            {status === 'error' && <span className="text-red-600 dark:text-red-400">No se pudo guardar.</span>}
            {status === 'idle' && (dirty ? 'Tienes cambios sin guardar' : 'Todo está al día')}
          </p>
          <button
            type="submit"
            disabled={status === 'saving' || !dirty}
            className="h-12 shrink-0 rounded-xl bg-primary px-6 font-semibold text-white transition active:bg-primary-dark disabled:opacity-50"
          >
            {status === 'saving' ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </form>
  )
}

function FormSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Cargando tus datos">
      {[0, 1].map((i) => (
        <div key={i} className="space-y-4 rounded-2xl border border-line bg-card p-4">
          <div className="h-5 w-1/2 animate-pulse rounded bg-line" />
          {[0, 1, 2].map((j) => <div key={j} className="h-12 animate-pulse rounded-xl bg-line" />)}
        </div>
      ))}
    </div>
  )
}
