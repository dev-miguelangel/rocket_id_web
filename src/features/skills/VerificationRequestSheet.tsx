import { useEffect, useState } from 'react'
import type { Provider } from '../../../shared/domain/providers'
import {
  cancelVerificationRequest,
  listApprovedProviders,
  requestMatches,
  requestVerification,
  type VerificationApplicant,
  type VerificationRequest,
} from '../../../shared/verificationsApi'
import { BottomSheet } from '../../components/Sheet'
import { normalizeText } from '../../lib/searchTokens'
import { useAuth } from '../auth/AuthProvider'
import { categoryOf, verificationFor, type Certification, type Verifications } from './schema'

interface Props {
  open: boolean
  onClose: () => void
  onDone: (text: string) => void
  certs: Certification[]
  verifications: Verifications
  requests: Record<string, VerificationRequest>
  applicant: VerificationApplicant
  /** Certificación que aparece elegida al abrir */
  initialCert?: string | null
}

/** Certificaciones que se pueden pedir verificar: con nombre y aún sin verificar */
const verifiableCerts = (certs: Certification[], v: Verifications) => certs.filter((c) => c.name.trim() && !verificationFor(c, v))

/**
 * "Pedir verificación": la persona elige una certificación y el formador que la emitió.
 * Comparte su nombre, rocketId, documento y los datos de esa certificación (nunca su ficha de salud).
 */
export function VerificationRequestSheet({ open, onClose, onDone, certs, verifications, requests, applicant, initialCert }: Props) {
  const { user } = useAuth()
  const options = verifiableCerts(certs, verifications)
  const [certId, setCertId] = useState<string | null>(null)
  const [providers, setProviders] = useState<Provider[] | null>(null)
  const [q, setQ] = useState('')
  const [providerId, setProviderId] = useState<string | null>(null)
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [wasOpen, setWasOpen] = useState(false)

  // Al abrir: reinicia y preselecciona
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setCertId(initialCert && options.some((c) => c.id === initialCert) ? initialCert : (options[0]?.id ?? null))
      setProviderId(null)
      setQ('')
      setAccepted(false)
      setFailed(false)
    }
  }

  useEffect(() => {
    if (!open || providers) return
    let alive = true
    listApprovedProviders()
      .then((r) => alive && setProviders(r))
      .catch(() => alive && setProviders([]))
    return () => {
      alive = false
    }
  }, [open, providers])

  const cert = options.find((c) => c.id === certId) ?? null
  const current = cert ? requests[cert.id] : undefined
  const currentValid = current && cert && requestMatches(current, cert) ? current : undefined

  // Primero los formadores cuyo nombre coincide con la institución emisora
  const list = (() => {
    const issuer = normalizeText(cert?.issuer ?? '')
    const term = normalizeText(q)
    const match = (p: Provider) => {
      const n = normalizeText(p.name)
      return !!issuer && !!n && (issuer.includes(n) || n.includes(issuer))
    }
    return (providers ?? [])
      .filter((p) => !term || normalizeText(p.name).includes(term))
      .map((p) => ({ p, suggested: match(p) }))
      .sort((a, b) => Number(b.suggested) - Number(a.suggested))
  })()
  const provider = providers?.find((p) => p.id === providerId) ?? null

  const send = async () => {
    if (!user || !cert || !provider || !accepted) return
    setBusy(true)
    setFailed(false)
    try {
      await requestVerification(user.uid, cert, provider, applicant)
      onDone(`Pedimos a ${provider.name} que verifique “${cert.name}”`)
    } catch (e) {
      console.error('request verification', e)
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  const cancel = async () => {
    if (!currentValid) return
    setBusy(true)
    try {
      await cancelVerificationRequest(currentValid)
      onDone('Solicitud retirada')
    } catch (e) {
      console.error('cancel verification', e)
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  const footer = cert && (
    <div className="space-y-2">
      {failed && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          No se pudo completar. Revisa tu conexión e inténtalo de nuevo.
        </p>
      )}
      <button
        type="button"
        onClick={send}
        disabled={!provider || !accepted || busy}
        className="h-12 w-full rounded-xl bg-primary text-base font-semibold text-white active:bg-primary-dark disabled:opacity-50"
      >
        {busy ? 'Enviando…' : currentValid?.status === 'pending' ? 'Enviar a este formador' : 'Pedir verificación'}
      </button>
    </div>
  )

  return (
    <BottomSheet open={open} title="Pedir verificación" onClose={onClose} footer={footer}>
      {options.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="font-semibold text-fg">No hay certificaciones por verificar</p>
          <p className="mt-1 text-sm text-muted">Agrega tus certificaciones en Mis datos; las ya verificadas no aparecen aquí.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <p className="text-base text-muted">
            El formador que emitió tu certificación confirma que es real. Si la aprueba, aparecerá con la insignia ✓ en tu perfil.
          </p>

          <fieldset>
            <legend className="px-1 text-sm font-semibold text-fg-soft">1. Certificación</legend>
            <div className="mt-2 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
              {options.map((c) => {
                const r = requests[c.id]
                const live = r && requestMatches(r, c) ? r : undefined
                return (
                  <label key={c.id} className="flex min-h-14 cursor-pointer items-center gap-3 px-4 py-3 active:bg-line/40">
                    <input type="radio" name="cert" checked={certId === c.id} onChange={() => setCertId(c.id)} className="size-5 shrink-0 accent-primary" />
                    <span aria-hidden="true">{categoryOf(c.category)?.icon ?? '📄'}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-medium text-fg">{c.name}</span>
                      <span className="block truncate text-sm text-muted">
                        {live?.status === 'pending'
                          ? `⏳ Pedida a ${live.providerName}`
                          : live?.status === 'rejected'
                            ? `${live.providerName} no la verificó`
                            : [c.issuer, c.year].filter(Boolean).join(' · ') || 'Sin institución'}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>

          {currentValid?.status === 'pending' && (
            <div className="flex items-center gap-3 rounded-2xl bg-sky-50 p-4 text-sm text-sky-900 dark:bg-sky-500/10 dark:text-sky-200">
              <p className="flex-1">
                Ya la pediste a <strong className="font-semibold">{currentValid.providerName}</strong>. Si eliges otro formador, la solicitud se le enviará a
                él.
              </p>
              <button
                type="button"
                onClick={cancel}
                disabled={busy}
                className="h-11 shrink-0 rounded-lg px-3 font-semibold active:bg-sky-100 dark:active:bg-sky-500/20"
              >
                Retirar
              </button>
            </div>
          )}
          {currentValid?.status === 'rejected' && (
            <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-900 dark:bg-red-500/10 dark:text-red-200">
              <p className="font-semibold">{currentValid.providerName} no la verificó</p>
              {currentValid.note && <p className="mt-1">{currentValid.note}</p>}
              <p className="mt-1">Revisa los datos de la certificación o pídela a otro formador.</p>
            </div>
          )}

          {cert && (
            <fieldset>
              <legend className="px-1 text-sm font-semibold text-fg-soft">2. Formador que la emitió</legend>
              <label htmlFor="vr-search" className="sr-only">
                Buscar formador
              </label>
              <input
                id="vr-search"
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nombre"
                autoComplete="off"
                className="mt-2 h-11 w-full rounded-xl border border-field bg-card px-3.5 text-base text-fg outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              {providers === null ? (
                <p className="mt-3 px-1 text-sm text-muted">Cargando formadores…</p>
              ) : list.length === 0 ? (
                <p className="mt-3 px-1 text-sm text-muted">
                  {providers.length === 0
                    ? 'Aún no hay formadores en rocketId. Pídele a tu institución que se registre.'
                    : 'Sin resultados. Si tu institución no aparece, pídele que se registre en rocketId Formadores.'}
                </p>
              ) : (
                <div className="mt-2 max-h-72 divide-y divide-line overflow-y-auto rounded-2xl border border-line bg-card">
                  {list.map(({ p, suggested }) => (
                    <label key={p.id} className="flex min-h-14 cursor-pointer items-center gap-3 px-4 py-3 active:bg-line/40">
                      <input
                        type="radio"
                        name="provider"
                        checked={providerId === p.id}
                        onChange={() => setProviderId(p.id)}
                        className="size-5 shrink-0 accent-primary"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-base font-medium text-fg">{p.name}</span>
                        <span className="block text-sm text-muted">
                          {p.kind === 'organization' ? 'Organización' : 'Independiente'}
                          {suggested && <span className="font-medium text-primary-text"> · coincide con la institución</span>}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </fieldset>
          )}

          {cert && provider && (
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-surface p-4 ring-1 ring-line">
              <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-primary" />
              <span className="text-sm text-fg-soft">
                Comparto con <strong className="font-semibold text-fg">{provider.name}</strong> mi nombre, rocketId, documento y los datos de “{cert.name}” (
                {[cert.issuer, cert.year].filter(Boolean).join(', ')}) para que la verifique. No comparto mi ficha de salud.
              </span>
            </label>
          )}
        </div>
      )}
    </BottomSheet>
  )
}
