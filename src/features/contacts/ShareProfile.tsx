import { useEffect, useState } from 'react'
import { firstName } from '../../lib/names'
import { useAuth } from '../auth/AuthProvider'
import { useRocketId } from '../auth/useRocketId'

export const profileUrl = (rocketId: string) => `${window.location.origin}/p/${rocketId}`

export function shareText(rocketId: string, name?: string | null) {
  const who = name ? `Soy ${firstName(name)}. ` : ''
  return `${who}Agrégame a tu cordada en rocketId 🚀 Mi rocketId es ${rocketId}: ${profileUrl(rocketId)}`
}

/** Tarjeta "Comparte tu perfil": WhatsApp, menú nativo de compartir y copiar enlace. */
export function ShareProfile({ heading = true }: { heading?: boolean }) {
  const { user } = useAuth()
  const rocketId = useRocketId()
  const [copied, setCopied] = useState(false)
  const canNativeShare = typeof navigator !== 'undefined' && 'share' in navigator

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1800)
    return () => clearTimeout(t)
  }, [copied])

  if (!rocketId) return null
  const url = profileUrl(rocketId)
  const text = shareText(rocketId, user?.displayName)

  const nativeShare = async () => {
    try {
      await navigator.share({ title: 'Mi perfil en rocketId', text, url })
    } catch {
      /* la persona canceló */
    }
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      navigator.vibrate?.(10)
      setCopied(true)
    } catch {
      /* portapapeles no disponible */
    }
  }

  return (
    <section>
      {heading && <h2 className="mb-1.5 px-4 text-xs font-semibold tracking-wide text-muted uppercase">Comparte tu perfil</h2>}
      <div className="rounded-2xl border border-line bg-card p-4">
        <p className="text-sm text-fg-soft">Envía tu enlace para que te agreguen a su cordada.</p>
        <p className="mt-2 truncate rounded-lg bg-surface px-3 py-2 font-mono text-xs text-muted">{url}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(text)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#25D366] font-semibold text-white active:opacity-80"
          >
            <WhatsAppIcon />
            WhatsApp
          </a>
          {canNativeShare ? (
            <button type="button" onClick={nativeShare} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-line-strong font-semibold text-fg active:bg-line/60">
              <ShareIcon />
              Compartir
            </button>
          ) : (
            <button type="button" onClick={copy} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-line-strong font-semibold text-fg active:bg-line/60">
              {copied ? '✓ Copiado' : '⧉ Copiar enlace'}
            </button>
          )}
        </div>
        {canNativeShare && (
          <button type="button" onClick={copy} className="mt-2 h-10 w-full rounded-lg text-sm font-medium text-primary-text active:bg-line/60">
            {copied ? '✓ Enlace copiado' : 'Copiar enlace'}
          </button>
        )}
      </div>
    </section>
  )
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.3-.4.8-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3c-.2.3-.9.9-.9 2.2s1 2.6 1.1 2.7c.1.2 1.9 2.9 4.6 4.1 1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.8-1.2.2-.6.2-1.1.1-1.2l-.4-.2z" />
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
    </svg>
  )
}
