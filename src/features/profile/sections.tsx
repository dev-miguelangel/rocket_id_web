import { useState, type ReactNode } from 'react'
import { isContactPickerSupported, pickContact } from '../../lib/contactPicker'
import { toTitleCaseName } from '../../lib/names'
import { Field, dateInputClass, inputClass, textareaClass } from '../../components/form'
import {
  BLOOD_TYPES,
  DOC_TYPES,
  INSURANCE_SYSTEMS,
  MAX_LEN,
  RUT_ERROR_MESSAGES,
  ageFrom,
  cleanRut,
  formatRut,
  formatRutLive,
  rutError,
  type ProfileErrors,
  type ProfileForm,
} from './schema'

export type SectionId = 'identity' | 'contact' | 'health'

export const SECTIONS: { id: SectionId; title: string; icon: string; keys: (keyof ProfileForm)[] }[] = [
  {
    id: 'identity',
    title: 'Identificación y contacto',
    icon: '🪪',
    keys: ['fullName', 'docType', 'docNumber', 'birthDate', 'phone', 'contactEmail'],
  },
  {
    id: 'contact',
    title: 'Contacto de emergencia',
    icon: '🆘',
    keys: ['emergencyName', 'emergencyRelationship', 'emergencyPhone'],
  },
  {
    id: 'health',
    title: 'Salud',
    icon: '⛑️',
    keys: ['insuranceSystem', 'insuranceDetail', 'bloodType', 'allergies', 'conditions', 'medications'],
  },
]

const today = new Date().toISOString().slice(0, 10)

// ---------- Formato para modo lectura ----------

const labelOf = (list: readonly { value: string; label: string }[], v: string) => list.find((o) => o.value === v)?.label ?? v

function formatBirth(v: string) {
  if (!v) return ''
  const d = new Date(`${v}T00:00:00`)
  if (Number.isNaN(d.getTime())) return v
  const age = ageFrom(v)
  return `${d.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}${age !== null ? ` · ${age} años` : ''}`
}

interface Row {
  label: string
  value: string
}

export function rowsFor(id: SectionId, p: ProfileForm): Row[] {
  switch (id) {
    case 'identity':
      return [
        { label: 'Nombre completo', value: toTitleCaseName(p.fullName) },
        { label: labelOf(DOC_TYPES, p.docType || 'rut'), value: p.docNumber },
        { label: 'Fecha de nacimiento', value: formatBirth(p.birthDate) },
        { label: 'Celular (WhatsApp)', value: p.phone },
        { label: 'Correo electrónico', value: p.contactEmail },
      ]
    case 'contact':
      return [
        { label: 'Nombre', value: toTitleCaseName(p.emergencyName) },
        { label: 'Parentesco', value: p.emergencyRelationship },
        { label: 'Teléfono', value: p.emergencyPhone },
      ]
    case 'health':
      return [
        { label: 'Previsión de salud', value: p.insuranceSystem ? labelOf(INSURANCE_SYSTEMS, p.insuranceSystem) : '' },
        { label: 'Isapre, seguros y centros preferentes', value: p.insuranceDetail },
        { label: 'Grupo sanguíneo', value: p.bloodType === 'unknown' ? 'No lo sé' : p.bloodType },
        { label: 'Alergias', value: p.allergies },
        { label: 'Condiciones médicas o lesiones', value: p.conditions },
        { label: 'Medicamentos', value: p.medications },
      ]
  }
}

/** Grupo de lista en modo lectura (estilo Ajustes de iOS/Android) */
export function ReadSection({ title, icon, rows, onEdit }: { title: string; icon: string; rows: Row[]; onEdit: () => void }) {
  return (
    <section>
      <div className="mb-1.5 flex items-end justify-between px-4">
        <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">
          <span aria-hidden="true">{icon} </span>
          {title}
        </h2>
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Editar ${title}`}
          className="-my-2 h-10 rounded-lg px-2 text-base font-medium text-primary-text active:opacity-60"
        >
          Editar
        </button>
      </div>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
        {rows.map((r) => (
          <li key={r.label}>
            <button type="button" onClick={onEdit} className="block w-full px-4 py-3 text-left transition-colors active:bg-line/60">
              <span className="block text-xs text-muted">{r.label}</span>
              <span className={`mt-0.5 block text-base break-words whitespace-pre-line ${r.value ? 'text-fg' : 'text-subtle italic'}`}>
                {r.value || 'Sin informar'}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

// ---------- Formularios de edición ----------

interface FormProps {
  form: ProfileForm
  errors: ProfileErrors
  set: <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => void
}

function Group({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div>
      <div className="space-y-4 rounded-2xl border border-line bg-card p-4">{children}</div>
      {hint && <p className="mt-2 px-4 text-xs text-muted">{hint}</p>}
    </div>
  )
}

export function IdentityForm({ form, errors, set }: FormProps) {
  const age = ageFrom(form.birthDate)
  const [docTouched, setDocTouched] = useState(false)
  const isRut = form.docType === 'rut'
  const rutErr = isRut && form.docNumber ? rutError(form.docNumber) : null
  // El RUT se valida en cuanto está completo (9 caracteres) o al salir del campo
  const rutComplete = cleanRut(form.docNumber).length >= 8
  const docError =
    errors.docNumber ?? (isRut && rutErr && (docTouched || cleanRut(form.docNumber).length >= 9) ? RUT_ERROR_MESSAGES[rutErr] : undefined)
  const docSuccess = isRut && form.docNumber && !rutErr && rutComplete ? '✓ RUT válido' : undefined
  return (
    <Group hint="Se usa para listas de asistencia, registros de acceso a parques (ej. CONAF) y seguros.">
      <Field label="Nombre completo">
        {(a) => (
          <input {...a} className={inputClass} value={form.fullName} maxLength={MAX_LEN.short} autoComplete="name"
            autoCapitalize="words" onChange={(e) => set('fullName', e.target.value)}
            onBlur={() => set('fullName', toTitleCaseName(form.fullName))} />
        )}
      </Field>
      <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3">
        <Field label="Documento">
          {(a) => (
            <select {...a} className={inputClass} value={form.docType}
              onChange={(e) => {
                set('docType', e.target.value)
                setDocTouched(false)
              }}>
              {DOC_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          )}
        </Field>
        <Field label="Número" error={docError} success={docSuccess}>
          {(a) => (
            <input {...a} className={inputClass} value={form.docNumber} autoCapitalize="characters" autoComplete="off"
              spellCheck={false} enterKeyHint="next"
              maxLength={isRut ? 12 : 20}
              placeholder={isRut ? '12.345.678-5' : ''}
              onChange={(e) => set('docNumber', isRut ? formatRutLive(e.target.value) : e.target.value.toUpperCase())}
              onBlur={() => {
                setDocTouched(true)
                if (isRut && form.docNumber) set('docNumber', formatRut(form.docNumber))
              }} />
          )}
        </Field>
      </div>
      <Field label="Fecha de nacimiento" error={errors.birthDate} hint={age !== null && age >= 0 ? `${age} años` : undefined}>
        {(a) => (
          <input {...a} type="date" className={dateInputClass} value={form.birthDate} max={today} autoComplete="bday"
            onChange={(e) => set('birthDate', e.target.value)} />
        )}
      </Field>
      <Field label="Celular (con WhatsApp)" error={errors.phone}>
        {(a) => (
          <input {...a} type="tel" inputMode="tel" autoComplete="tel" className={inputClass} value={form.phone}
            maxLength={20} placeholder="+56 9 1234 5678" onChange={(e) => set('phone', e.target.value)} />
        )}
      </Field>
      <Field label="Correo electrónico" error={errors.contactEmail} hint="Para rutas (GPX), listas de equipo y descargos.">
        {(a) => (
          <input {...a} type="email" inputMode="email" autoComplete="email" className={inputClass}
            value={form.contactEmail} maxLength={MAX_LEN.short} onChange={(e) => set('contactEmail', e.target.value)} />
        )}
      </Field>
    </Group>
  )
}

export function ContactForm({ form, errors, set }: FormProps) {
  const [phoneOptions, setPhoneOptions] = useState<string[]>([])
  const [pickError, setPickError] = useState<string | null>(null)
  const canPick = isContactPickerSupported()

  const handlePick = async () => {
    setPickError(null)
    setPhoneOptions([])
    try {
      const c = await pickContact()
      if (!c) return
      if (c.name) set('emergencyName', toTitleCaseName(c.name).slice(0, MAX_LEN.short))
      if (c.phones.length === 1) set('emergencyPhone', c.phones[0].slice(0, 20))
      else if (c.phones.length > 1) setPhoneOptions(c.phones)
      else setPickError('Ese contacto no tiene teléfono. Ingrésalo a mano.')
    } catch {
      setPickError('No se pudo abrir tus contactos.')
    }
  }

  return (
    <>
    {canPick && (
      <div>
        <button
          type="button"
          onClick={handlePick}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-line bg-card text-base font-semibold text-primary-text transition active:scale-[0.98]"
        >
          <ContactsIcon />
          Elegir de mis contactos
        </button>
        {pickError && <p className="mt-2 px-4 text-xs text-red-600 dark:text-red-400">{pickError}</p>}
      </div>
    )}
    {phoneOptions.length > 1 && (
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
        <p className="mb-3 text-sm font-medium text-fg">¿Qué número usamos?</p>
        <div className="flex flex-wrap gap-2">
          {phoneOptions.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                set('emergencyPhone', p.slice(0, 20))
                setPhoneOptions([])
              }}
              className="h-11 rounded-full border border-line-strong bg-card px-4 text-sm font-medium text-fg active:bg-line"
            >
              {p}
            </button>
          ))}
        </div>
      </div>
    )}
    <Group hint="Debe ser alguien que no asista a la salida y que esté disponible durante la actividad.">
      <Field label="Nombre">
        {(a) => (
          <input {...a} className={inputClass} value={form.emergencyName} maxLength={MAX_LEN.short} autoComplete="off"
            autoCapitalize="words" onChange={(e) => set('emergencyName', e.target.value)}
            onBlur={() => set('emergencyName', toTitleCaseName(form.emergencyName))} />
        )}
      </Field>
      <Field label="Parentesco">
        {(a) => (
          <input {...a} className={inputClass} value={form.emergencyRelationship} maxLength={60}
            placeholder="Ej: madre, pareja, amigo" onChange={(e) => set('emergencyRelationship', e.target.value)} />
        )}
      </Field>
      <Field label="Teléfono" error={errors.emergencyPhone}>
        {(a) => (
          <input {...a} type="tel" inputMode="tel" autoComplete="off" className={inputClass} value={form.emergencyPhone}
            maxLength={20} placeholder="+56 9 1234 5678" onChange={(e) => set('emergencyPhone', e.target.value)} />
        )}
      </Field>
    </Group>
    </>
  )
}

function ContactsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <circle cx="12" cy="10" r="3" />
      <path d="M7 18c.8-2 2.7-3 5-3s4.2 1 5 3M2 7h2M2 12h2M2 17h2" />
    </svg>
  )
}

export function HealthForm({ form, set }: FormProps) {
  return (
    <>
      <Group>
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
        <Field
          label="Isapre, seguros y centros de salud preferentes"
          hint="Nombre de tu Isapre, seguros complementarios o de accidentes (con N° de póliza) y clínicas u hospitales donde prefieres ser atendido."
        >
          {(a) => (
            <textarea {...a} className={textareaClass} value={form.insuranceDetail} maxLength={MAX_LEN.medium}
              placeholder="Ej: Isapre Colmena. Seguro de accidentes MetLife, póliza 123456. Clínica Alemana o Hospital del Trabajador."
              onChange={(e) => set('insuranceDetail', e.target.value)} />
          )}
        </Field>
      </Group>
      <Group>
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
      </Group>
    </>
  )
}
