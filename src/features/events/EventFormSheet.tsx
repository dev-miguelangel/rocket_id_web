import { useCallback, useId, useState, type FormEvent } from 'react'
import { Field, Segmented, dateInputClass, inputClass, textareaClass } from '../../components/form'
import { BottomSheet, Sheet } from '../../components/Sheet'
import { SKILL_CATEGORIES, categoryOf, type CategoryId } from '../skills/schema'
import { createEvent, type EventInput } from './eventsApi'
import { EVENT_ACTIVITIES, PUBLIC_RESPONSIBILITIES, type Requirement, type Visibility } from './schema'
import { useMe } from './useMe'

const pad = (n: number) => String(n).padStart(2, '0')
/** Date → valor para <input type="datetime-local"> en hora local */
const toLocalInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`

function defaults() {
  const start = new Date(Date.now() + 7 * 86_400_000)
  start.setHours(8, 0, 0, 0)
  const end = new Date(start)
  end.setHours(18)
  return { start: toLocalInput(start), end: toLocalInput(end) }
}

type Errors = Partial<Record<'title' | 'start' | 'end' | 'location' | 'general', string>>

export function EventFormSheet({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const me = useMe()
  const d = defaults()
  const [activity, setActivity] = useState<string>('trekking')
  const [title, setTitle] = useState('')
  const [start, setStart] = useState(d.start)
  const [end, setEnd] = useState(d.end)
  const [location, setLocation] = useState('')
  const [meetingPoint, setMeetingPoint] = useState('')
  const [description, setDescription] = useState('')
  const [capacity, setCapacity] = useState('')
  const [requirements, setRequirements] = useState<Requirement[]>([])
  const [visibility, setVisibility] = useState<Visibility>('private')
  const [publicAck, setPublicAck] = useState(false)
  const [ackOpen, setAckOpen] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)
  const closeAck = useCallback(() => setAckOpen(false), [])

  const reset = () => {
    const n = defaults()
    setActivity('trekking')
    setTitle('')
    setStart(n.start)
    setEnd(n.end)
    setLocation('')
    setMeetingPoint('')
    setDescription('')
    setCapacity('')
    setRequirements([])
    setVisibility('private')
    setPublicAck(false)
    setErrors({})
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!me) return
    const s = new Date(start)
    const en = new Date(end)
    const errs: Errors = {}
    if (!title.trim()) errs.title = 'Ponle un nombre a la salida.'
    if (Number.isNaN(s.getTime())) errs.start = 'Indica cuándo empieza.'
    if (Number.isNaN(en.getTime()) || en < s) errs.end = 'Debe terminar después de empezar.'
    if (s.getTime() < Date.now() - 3_600_000) errs.start = 'La fecha ya pasó.'
    if (!location.trim()) errs.location = 'Indica el lugar o la ruta.'
    if (visibility === 'public' && !publicAck) errs.general = 'Para publicar debes aceptar las responsabilidades.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSaving(true)
    try {
      const input: EventInput = {
        title,
        activity,
        description,
        startAt: s,
        endAt: en,
        location,
        meetingPoint,
        visibility,
        capacity: Number(capacity) || 0,
        requirements,
        publicAck,
      }
      const id = await createEvent(me, input)
      navigator.vibrate?.(10)
      reset()
      onCreated(id)
    } catch (err) {
      console.error('createEvent', err)
      setErrors({ general: 'No se pudo crear el evento. Inténtalo de nuevo.' })
    } finally {
      setSaving(false)
    }
  }

  const chooseVisibility = (v: Visibility) => {
    if (v === 'public' && !publicAck) setAckOpen(true)
    else setVisibility(v)
  }

  return (
    <>
      <Sheet open={open} title="Nuevo evento" onCancel={onClose} onSubmit={submit} saving={saving} canSave={!!me}>
        {!me && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">Cargando tu perfil…</p>}

        <div className="rounded-2xl border border-line bg-card p-4">
          <p className="mb-2 text-sm font-medium text-fg-soft">Actividad</p>
          <div className="-mx-1 flex flex-wrap gap-2">
            {EVENT_ACTIVITIES.map((a) => (
              <button
                key={a.id}
                type="button"
                aria-pressed={activity === a.id}
                onClick={() => setActivity(a.id)}
                className={`h-10 rounded-full border px-3 text-sm font-medium ${activity === a.id ? 'border-primary bg-primary text-white' : 'border-line-strong bg-card text-fg'}`}
              >
                {a.icon} {a.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-line bg-card p-4">
          <Field label="Nombre de la salida" error={errors.title}>
            {(a) => <input {...a} className={inputClass} value={title} maxLength={100} placeholder="Ej: Ascenso al cerro Provincia" onChange={(e) => setTitle(e.target.value)} />}
          </Field>
          <div className="grid grid-cols-1 gap-3">
            <Field label="Inicio" error={errors.start}>
              {(a) => <input {...a} type="datetime-local" className={dateInputClass} value={start} onChange={(e) => setStart(e.target.value)} />}
            </Field>
            <Field label="Término" error={errors.end}>
              {(a) => <input {...a} type="datetime-local" className={dateInputClass} value={end} min={start} onChange={(e) => setEnd(e.target.value)} />}
            </Field>
          </div>
          <Field label="Lugar o ruta" error={errors.location}>
            {(a) => <input {...a} className={inputClass} value={location} maxLength={150} placeholder="Ej: Cerro Provincia, Santiago" onChange={(e) => setLocation(e.target.value)} />}
          </Field>
          <Field label="Punto de encuentro" hint="Opcional">
            {(a) => <input {...a} className={inputClass} value={meetingPoint} maxLength={200} placeholder="Ej: Estacionamiento San Carlos de Apoquindo, 7:30" onChange={(e) => setMeetingPoint(e.target.value)} />}
          </Field>
          <Field label="Descripción" hint="Dificultad, equipo necesario, horarios, costos compartidos…">
            {(a) => <textarea {...a} className={textareaClass} value={description} maxLength={2000} onChange={(e) => setDescription(e.target.value)} />}
          </Field>
          <Field label="Cupos" hint="Déjalo vacío si no hay límite">
            {(a) => (
              <input {...a} type="number" inputMode="numeric" min={0} max={500} className={inputClass} value={capacity} placeholder="Sin límite" onChange={(e) => setCapacity(e.target.value.replace(/\D/g, '').slice(0, 3))} />
            )}
          </Field>
        </div>

        <RequirementsEditor value={requirements} onChange={setRequirements} />

        <div className="space-y-3 rounded-2xl border border-line bg-card p-4">
          <Segmented
            label="¿Quién puede verlo?"
            value={visibility}
            options={[
              { value: 'private', label: '🔒 Privado' },
              { value: 'public', label: '🌎 Público' },
            ]}
            onChange={chooseVisibility}
          />
          <p className="text-xs text-muted">
            {visibility === 'private'
              ? 'Solo lo ven las personas que invites o que tengan el enlace.'
              : 'Aparece en “Explorar” y cualquier persona con cuenta puede unirse.'}
          </p>
        </div>

        {errors.general && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{errors.general}</p>}
      </Sheet>

      <PublicAckSheet
        open={ackOpen}
        onClose={closeAck}
        onAccept={() => {
          setPublicAck(true)
          setVisibility('public')
          setAckOpen(false)
        }}
      />
    </>
  )
}

function RequirementsEditor({ value, onChange }: { value: Requirement[]; onChange: (v: Requirement[]) => void }) {
  const [cat, setCat] = useState<CategoryId | ''>('')
  const [label, setLabel] = useState('')
  const add = () => {
    if (!cat) return
    onChange([...value, { category: cat, label: label.trim() || categoryOf(cat)?.label || '' }])
    setCat('')
    setLabel('')
  }
  return (
    <div className="space-y-3 rounded-2xl border border-line bg-card p-4">
      <div>
        <p className="text-sm font-medium text-fg-soft">Requisitos</p>
        <p className="text-xs text-muted">Opcional. Verás qué participantes los cumplen según sus certificaciones.</p>
      </div>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {value.map((r, i) => (
            <li key={i} className="flex items-center gap-1 rounded-full bg-primary/10 py-1 pr-1 pl-3 text-sm font-medium text-primary-text">
              {categoryOf(r.category)?.icon} {r.label}
              <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={`Quitar ${r.label}`} className="flex size-7 items-center justify-center rounded-full active:bg-primary/20">
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      {value.length < 10 && (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <select aria-label="Área del requisito" className={inputClass.replace('mt-1 ', '')} value={cat} onChange={(e) => setCat(e.target.value as CategoryId)}>
            <option value="">Elegir área…</option>
            {SKILL_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
          </select>
          <button type="button" onClick={add} disabled={!cat} className="h-12 rounded-xl bg-primary px-4 font-semibold text-white disabled:opacity-40">
            Agregar
          </button>
          {cat && (
            <input
              aria-label="Detalle del requisito"
              className={`${inputClass.replace('mt-1 ', '')} col-span-2`}
              value={label}
              maxLength={80}
              placeholder={`Detalle opcional (ej. "WFA vigente")`}
              onChange={(e) => setLabel(e.target.value)}
            />
          )}
        </div>
      )}
    </div>
  )
}

/** Alerta de responsabilidades personales al elegir "Público" */
function PublicAckSheet({ open, onClose, onAccept }: { open: boolean; onClose: () => void; onAccept: () => void }) {
  const id = useId()
  const [checked, setChecked] = useState(false)
  return (
    <BottomSheet
      open={open}
      title="Evento público"
      onClose={onClose}
      left={
        <button type="button" onClick={onClose} className="h-11 rounded-lg px-3 text-base text-primary-text active:opacity-60">
          Cancelar
        </button>
      }
      footer={
        <div className="pb-3">
          <button
            type="button"
            disabled={!checked}
            onClick={() => {
              setChecked(false)
              onAccept()
            }}
            className="h-12 w-full rounded-xl bg-primary text-base font-semibold text-white active:bg-primary-dark disabled:opacity-40"
          >
            Hacer público
          </button>
        </div>
      }
    >
      <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
        <span className="text-2xl" aria-hidden="true">⚠️</span>
        <div>
          <p className="font-semibold">Responsabilidades personales</p>
          <p className="mt-1 text-sm">Al publicar una actividad abierta a cualquier persona, asumes estas responsabilidades:</p>
        </div>
      </div>
      <ul className="space-y-3 rounded-2xl border border-line bg-card p-4">
        {PUBLIC_RESPONSIBILITIES.map((r) => (
          <li key={r} className="flex gap-3 text-sm text-fg-soft">
            <span className="text-primary-text" aria-hidden="true">•</span>
            {r}
          </li>
        ))}
      </ul>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-card p-4 active:bg-line/40">
        <input id={id} type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-0.5 size-6 shrink-0 accent-[#0D9488]" />
        <span className="text-sm font-medium text-fg">Entiendo y acepto que soy responsable de esta actividad.</span>
      </label>
    </BottomSheet>
  )
}
