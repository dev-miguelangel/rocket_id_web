import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router'
import { RocketIdBadge } from '../../components/RocketIdBadge'
import { firstName } from '../../lib/names'
import { useAuth } from '../auth/AuthProvider'
import { useRocketId } from '../auth/useRocketId'

interface Slide {
  icon: string
  tint: string
  title: string
  text: string
  points?: string[]
  extra?: ReactNode
}

/** Recorrido de primer uso a pantalla completa: 5 pasos, deslizable, con "Saltar". */
export function Onboarding({ open, onFinish }: { open: boolean; onFinish: () => void }) {
  const { user } = useAuth()
  const rocketId = useRocketId()
  const navigate = useNavigate()
  const [i, setI] = useState(0)
  const [dx, setDx] = useState(0)
  const drag = useRef({ x: 0, y: 0, active: false, axis: '' as '' | 'x' | 'y' })
  const titleRef = useRef<HTMLHeadingElement>(null)

  const slides: Slide[] = [
    {
      icon: '🚀',
      tint: 'from-primary-dark to-primary',
      title: `Hola${user?.displayName ? `, ${firstName(user.displayName)}` : ''}. Este es tu rocketId`,
      text: 'Tu identidad outdoor: tu ficha de emergencia, tu formación y tu cordada, listas para cuando más importa.',
      extra: (
        <div className="flex flex-col items-center gap-1">
          <RocketIdBadge rocketId={rocketId} variant="light" />
          <span className="text-sm text-white/90">Tu código único: compártelo para que te encuentren</span>
        </div>
      ),
    },
    {
      icon: '🩺',
      tint: 'from-red-700 to-red-600',
      title: 'Tu ficha de emergencia',
      text: 'Contacto de emergencia, grupo sanguíneo, alergias y medicamentos. Solo tú la ves hasta que confirmas una salida.',
      points: ['Tarjeta QR que se lee sin internet', 'Se actualiza sola en tus salidas', 'Te avisamos si alguien la ve'],
    },
    {
      icon: '🪢',
      tint: 'from-sky-800 to-sky-700',
      title: 'Tu cordada',
      text: 'Busca a tus compañeros por nombre, correo o rocketId, o comparte tu perfil por WhatsApp.',
      points: ['Mira la formación de tu grupo', 'Certificaciones verificadas por las instituciones', 'Tú decides si apareces en búsquedas'],
    },
    {
      icon: '🏔️',
      tint: 'from-emerald-800 to-emerald-700',
      title: 'Salidas seguras',
      text: 'Crea o únete a una salida, revisa que el grupo esté preparado y ten un botón de emergencia a mano.',
      points: ['Equipo de seguridad y fichas sin señal', 'Llamadas directas a 131 · 132 · 133', 'Cursos recomendados para tu cordada'],
    },
    {
      icon: '🔒',
      tint: 'from-violet-800 to-violet-600',
      title: 'Tus datos, bajo tu control',
      text: 'Nada se comparte sin tu consentimiento, y siempre sabrás quién vio tu ficha. Empecemos por lo más importante.',
    },
  ]
  const last = i === slides.length - 1
  const s = slides[i]

  // Bloquea el scroll de fondo y mueve el foco al título en cada paso (lectores de pantalla)
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])
  useEffect(() => {
    if (open) titleRef.current?.focus()
  }, [open, i])

  if (!open) return null

  const go = (n: number) => setI(Math.max(0, Math.min(slides.length - 1, n)))
  const close = (to?: string) => {
    setI(0)
    onFinish()
    if (to) navigate(to)
  }

  const onDown = (e: PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, active: true, axis: '' }
  }
  const onMove = (e: PointerEvent) => {
    const d = drag.current
    if (!d.active) return
    const mx = e.clientX - d.x
    const my = e.clientY - d.y
    if (!d.axis && (Math.abs(mx) > 8 || Math.abs(my) > 8)) d.axis = Math.abs(mx) > Math.abs(my) ? 'x' : 'y'
    if (d.axis === 'x') setDx(mx)
  }
  const onUp = () => {
    const d = drag.current
    d.active = false
    if (d.axis === 'x') {
      if (dx < -60) go(i + 1)
      else if (dx > 60) go(i - 1)
    }
    setDx(0)
  }

  return createPortal(
    <div
      className={`pt-safe pb-safe fixed inset-0 z-50 flex flex-col bg-gradient-to-b ${s.tint} text-white transition-colors duration-500 motion-reduce:transition-none`}
      role="dialog"
      aria-modal="true"
      aria-label="Recorrido de bienvenida"
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') go(i + 1)
        if (e.key === 'ArrowLeft') go(i - 1)
        if (e.key === 'Escape') close()
      }}
    >
      <div className="mx-auto flex w-full max-w-md items-center justify-between px-4 py-2">
        <span className="text-sm font-medium" aria-live="polite">
          {i + 1} de {slides.length}
        </span>
        {!last && (
          <button type="button" onClick={() => close()} className="h-11 rounded-lg px-3 text-base font-medium text-white/90 active:bg-white/15">
            Saltar
          </button>
        )}
      </div>

      <div
        className="mx-auto flex w-full max-w-md flex-1 touch-pan-y flex-col items-center justify-center px-6 text-center select-none"
        style={{ transform: `translateX(${dx * 0.4}px)`, opacity: 1 - Math.min(Math.abs(dx) / 400, 0.4) }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <div key={i} className="flex flex-col items-center motion-safe:animate-[pop_400ms_ease-out]">
          <span className="flex size-28 items-center justify-center rounded-[2rem] bg-white/15 text-6xl ring-1 ring-white/25" aria-hidden="true">
            {s.icon}
          </span>
          <h2 ref={titleRef} tabIndex={-1} className="mt-8 text-3xl leading-tight font-extrabold tracking-tight text-balance outline-none">
            {s.title}
          </h2>
          <p className="mt-3 max-w-prose text-lg text-white/95">{s.text}</p>
          {s.points && (
            <ul className="mt-6 w-full space-y-2.5 text-left">
              {s.points.map((p) => (
                <li key={p} className="flex items-center gap-3 rounded-2xl bg-white/12 px-4 py-3 text-base ring-1 ring-white/15">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-zinc-900" aria-hidden="true">
                    ✓
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          )}
          {s.extra && <div className="mt-6">{s.extra}</div>}
        </div>
      </div>

      <div className="mx-auto w-full max-w-md space-y-4 px-6 pb-6">
        <div className="flex justify-center gap-2" role="tablist" aria-label="Pasos del recorrido">
          {slides.map((sl, n) => (
            <button
              key={sl.title}
              type="button"
              role="tab"
              aria-selected={n === i}
              aria-label={`Paso ${n + 1}: ${sl.title}`}
              onClick={() => go(n)}
              className="flex h-11 items-center px-1"
            >
              <span className={`block h-2 rounded-full bg-white transition-all ${n === i ? 'w-6' : 'w-2 opacity-50'}`} />
            </button>
          ))}
        </div>
        {last ? (
          <div className="space-y-2">
            <button type="button" onClick={() => close('/mis-datos')} className="h-14 w-full rounded-2xl bg-white text-lg font-bold text-zinc-900 shadow-lg active:bg-white/90">
              Completar mi ficha
            </button>
            <button type="button" onClick={() => close()} className="h-12 w-full rounded-2xl text-base font-semibold text-white active:bg-white/15">
              Explorar la app
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
            {i > 0 ? (
              <button type="button" onClick={() => go(i - 1)} aria-label="Anterior" className="h-14 rounded-2xl px-5 text-xl font-semibold text-white ring-1 ring-white/40 active:bg-white/15">
                ‹
              </button>
            ) : (
              <span />
            )}
            <button type="button" onClick={() => go(i + 1)} className="h-14 rounded-2xl bg-white text-lg font-bold text-zinc-900 shadow-lg active:bg-white/90">
              Siguiente
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
