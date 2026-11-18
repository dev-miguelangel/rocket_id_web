import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Sheet } from '../../components/Sheet'
import { toTitleCaseName } from '../../lib/names'
import { normalizePhone } from '../../lib/phone'
import { useAuth } from '../auth/AuthProvider'
import { saveProfile, subscribeProfile } from '../profile/profileApi'
import { CRITICAL_FIELDS, emptyProfile, formatRut, validate, type ProfileErrors, type ProfileForm } from '../profile/schema'
import { ContactForm, HealthForm, IdentityForm, ReadSection, SECTIONS, rowsFor, type SectionId } from '../profile/sections'
import { SKILLS_TITLE, SkillsForm, SkillsReadSection } from '../skills/SkillsSection'
import { emptySkills, hasSkillsErrors, validateSkills, type SkillsData, type SkillsErrors, type Verifications } from '../skills/schema'
import { saveSkills, subscribeSkills, subscribeVerifications } from '../skills/skillsApi'

const FORMS = { identity: IdentityForm, contact: ContactForm, health: HealthForm }

export function MyDataPage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<ProfileForm | null>(null)
  const [skills, setSkills] = useState<SkillsData | null>(null)
  const [verifications, setVerifications] = useState<Verifications>({})
  const [skillsDraft, setSkillsDraft] = useState<SkillsData>(emptySkills)
  const [skillsErrors, setSkillsErrors] = useState<SkillsErrors>({ certs: {} })
  const [editing, setEditing] = useState<SectionId | 'skills' | null>(null)
  const [draft, setDraft] = useState<ProfileForm>(emptyProfile)
  const [errors, setErrors] = useState<ProfileErrors>({})
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    return subscribeProfile(user.uid, (p, defaults) =>
      setProfile({ ...p, fullName: toTitleCaseName(p.fullName || defaults.name),
        emergencyName: toTitleCaseName(p.emergencyName), contactEmail: p.contactEmail || defaults.email }),
    )
  }, [user])

  useEffect(() => {
    if (!user) return
    return subscribeSkills(user.uid, setSkills)
  }, [user])

  useEffect(() => {
    if (!user) return
    return subscribeVerifications(user.uid, setVerifications)
  }, [user])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast])

  const section = SECTIONS.find((s) => s.id === editing)
  const dirty = useMemo(() => {
    if (editing === 'skills') return JSON.stringify(skillsDraft) !== JSON.stringify(skills ?? emptySkills)
    return !!profile && !!section && section.keys.some((k) => draft[k] !== profile[k])
  }, [editing, skillsDraft, skills, draft, profile, section])

  const openEditor = (id: SectionId | 'skills') => {
    if (!profile) return
    if (id === 'skills') {
      setSkillsDraft(skills ?? emptySkills)
      setSkillsErrors({ certs: {} })
    } else {
      setDraft(profile)
      setErrors({})
    }
    setEditing(id)
  }

  /** Espera la confirmación del servidor (o la deja en cola si no hay red) y cierra la hoja. */
  const commit = async (pending: Promise<void>) => {
    setSaving(true)
    try {
      // Offline: Firestore lo deja en cola local y sincroniza al volver la red
      if (navigator.onLine) await pending
      else pending.catch(() => setToast('No se pudo sincronizar'))
      navigator.vibrate?.(10)
      setToast(navigator.onLine ? 'Cambios guardados' : 'Guardado · se sincronizará con conexión')
      setEditing(null)
    } catch {
      setToast('No se pudo guardar. Inténtalo de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  const changeSkills = (v: SkillsData) => {
    setSkillsDraft(v)
    if (hasSkillsErrors(skillsErrors)) setSkillsErrors(validateSkills(v))
  }
  const closeEditor = useCallback(() => setEditing(null), [])

  const set = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => {
    setDraft((d) => ({ ...d, [key]: value }))
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e))
  }

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    if (!user) return
    if (editing === 'skills') {
      const errs = validateSkills(skillsDraft)
      setSkillsErrors(errs)
      if (hasSkillsErrors(errs)) {
        requestAnimationFrame(() =>
          document.querySelector<HTMLElement>('[role="dialog"] [aria-invalid="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
        )
        return
      }
      return commit(saveSkills(user.uid, skillsDraft))
    }
    if (!section) return
    const next: ProfileForm = {
      ...draft,
      fullName: toTitleCaseName(draft.fullName),
      emergencyName: toTitleCaseName(draft.emergencyName),
      phone: normalizePhone(draft.phone),
      emergencyPhone: normalizePhone(draft.emergencyPhone),
      docNumber: draft.docType === 'rut' && draft.docNumber ? formatRut(draft.docNumber) : draft.docNumber,
    }
    const all = validate(next)
    const errs = Object.fromEntries(Object.entries(all).filter(([k]) => section.keys.includes(k as keyof ProfileForm)))
    setErrors(errs)
    if (Object.keys(errs).length) {
      document.querySelector<HTMLElement>('[role="dialog"] [aria-invalid="true"]')?.focus()
      return
    }
    return commit(saveProfile(user.uid, next))
  }

  if (!profile) return <ListSkeleton />

  const missing = CRITICAL_FIELDS.filter(({ key }) => !profile[key].trim())
  const firstMissingSection = SECTIONS.find((s) => missing[0] && s.keys.includes(missing[0].key))
  const EditForm = editing && editing !== 'skills' ? FORMS[editing] : null

  return (
    <div className="space-y-6 pb-4">
      {missing.length > 0 ? (
        <button
          type="button"
          onClick={() => firstMissingSection && openEditor(firstMissingSection.id)}
          className="flex w-full items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-left text-sm text-amber-900 active:opacity-80 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
        >
          <span className="text-xl" aria-hidden="true">⚠️</span>
          <span className="flex-1">
            <span className="block font-semibold">Completa tu ficha antes de tu próxima salida</span>
            <span className="mt-0.5 block opacity-90">
              Faltan {missing.length}: {missing.map((m) => m.label).join(', ')}.
            </span>
          </span>
          <span aria-hidden="true" className="text-lg opacity-60">›</span>
        </button>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl border border-accent/30 bg-accent/10 p-4 text-sm font-medium text-fg">
          <span className="text-xl" aria-hidden="true">✅</span>
          Tu ficha de emergencia está completa.
        </div>
      )}

      {SECTIONS.map((s) => (
        <ReadSection key={s.id} title={s.title} icon={s.icon} rows={rowsFor(s.id, profile)} onEdit={() => openEditor(s.id)} />
      ))}

      <SkillsReadSection data={skills ?? emptySkills} verifications={verifications} onEdit={() => openEditor('skills')} />

      <p className="px-4 text-center text-xs text-subtle">🔒 Solo tú puedes ver estos datos.</p>

      <Sheet
        open={!!editing}
        title={editing === 'skills' ? SKILLS_TITLE : (section?.title ?? '')}
        onCancel={closeEditor}
        onSubmit={handleSave}
        saving={saving}
        canSave={dirty}
      >
        {EditForm && <EditForm form={draft} errors={errors} set={set} />}
        {editing === 'skills' && <SkillsForm value={skillsDraft} verifications={verifications} errors={skillsErrors} onChange={changeSkills} />}
      </Sheet>

      {/* Toast de confirmación, sobre la navegación inferior */}
      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 transition-all duration-300 motion-reduce:transition-none ${toast ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
      >
        {toast && (
          <span className="rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg ring-1 ring-white/10">
            {toast}
          </span>
        )}
      </div>
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando tus datos">
      <div className="h-16 animate-pulse rounded-2xl bg-line" />
      {[5, 3, 6].map((n, i) => (
        <div key={i}>
          <div className="mb-2 ml-4 h-3 w-40 animate-pulse rounded bg-line" />
          <div className="divide-y divide-line rounded-2xl border border-line bg-card">
            {Array.from({ length: n }, (_, j) => (
              <div key={j} className="space-y-2 px-4 py-3">
                <div className="h-2.5 w-24 animate-pulse rounded bg-line" />
                <div className="h-4 w-2/3 animate-pulse rounded bg-line" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
