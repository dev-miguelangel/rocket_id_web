import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Avatar } from '../../components/Avatar'
import { BottomSheet } from '../../components/Sheet'
import { useAuth } from '../auth/AuthProvider'
import { subscribeParticipants } from './eventsApi'
import { sharesFicha, type EventDoc, type Participant } from './schema'

/** Números de emergencia de Chile. Las llamadas de emergencia funcionan sin datos móviles. */
export const EMERGENCY_NUMBERS = [
  { number: '131', label: 'Ambulancia', detail: 'SAMU', icon: '🚑', className: 'bg-red-600 active:bg-red-700' },
  { number: '132', label: 'Bomberos', detail: 'Rescate e incendios', icon: '🚒', className: 'bg-orange-600 active:bg-orange-700' },
  { number: '133', label: 'Carabineros', detail: 'Policía', icon: '🚓', className: 'bg-sky-700 active:bg-sky-800' },
] as const

/**
 * Hoja de emergencia de un evento: llamadas directas y acceso a la ficha de un participante.
 * La ficha se abre en el evento con el flujo correspondiente (equipo de seguridad, copia sin
 * conexión o acceso de emergencia), manteniendo los avisos y las reglas de siempre.
 */
export function EmergencySheet({ event, open, onClose }: { event: EventDoc; open: boolean; onClose: () => void }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [participants, setParticipants] = useState<Participant[] | null>(null)
  const [choosing, setChoosing] = useState(false)

  useEffect(() => {
    if (!open) return
    return subscribeParticipants(event.id, setParticipants)
  }, [open, event.id])

  // Al cerrar, volver al menú principal de la hoja
  const close = () => {
    setChoosing(false)
    onClose()
  }

  // Confirmados y el organizador (si compartió su ficha), excepto yo
  const others = (participants ?? []).filter((p) => sharesFicha(p) && p.uid !== user?.uid)

  const openFicha = (uid: string) => {
    close()
    navigate(`/e/${event.id}`, { state: { ficha: uid } })
  }

  return (
    <BottomSheet
      open={open}
      title={choosing ? 'Ficha de un participante' : 'Emergencia'}
      onClose={close}
      left={
        choosing ? (
          <button type="button" onClick={() => setChoosing(false)} className="h-11 rounded-lg px-3 text-base text-primary-text active:opacity-60">
            ‹ Volver
          </button>
        ) : undefined
      }
    >
      {!choosing ? (
        <>
          <p className="px-1 text-base text-fg-soft">
            Si hay riesgo para la vida, <strong>llama primero</strong>. Las llamadas de emergencia funcionan aunque no tengas datos móviles.
          </p>
          <ul className="space-y-3">
            {EMERGENCY_NUMBERS.map((n) => (
              <li key={n.number}>
                <a
                  href={`tel:${n.number}`}
                  className={`flex min-h-16 items-center gap-4 rounded-2xl px-5 text-white shadow-sm ${n.className}`}
                  aria-label={`Llamar al ${n.number}, ${n.label}`}
                >
                  <span className="text-3xl" aria-hidden="true">
                    {n.icon}
                  </span>
                  <span className="flex-1">
                    <span className="block text-lg leading-tight font-bold">{n.label}</span>
                    <span className="block text-sm text-white/90">{n.detail}</span>
                  </span>
                  <span className="text-3xl font-extrabold tabular-nums">{n.number}</span>
                </a>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => setChoosing(true)}
            className="flex min-h-16 w-full items-center gap-4 rounded-2xl border-2 border-field bg-card px-5 text-left active:bg-line/60"
          >
            <span className="text-3xl" aria-hidden="true">
              🩺
            </span>
            <span className="flex-1">
              <span className="block text-lg leading-tight font-bold text-fg">Ver ficha de un participante</span>
              <span className="block text-sm text-muted">Alergias, medicamentos y contacto de emergencia</span>
            </span>
            <span className="text-xl text-muted" aria-hidden="true">
              ›
            </span>
          </button>
        </>
      ) : participants === null ? (
        <div className="h-40 animate-pulse rounded-2xl bg-line" aria-label="Cargando participantes" />
      ) : others.length === 0 ? (
        <p className="px-1 py-6 text-center text-base text-muted">No hay otros participantes confirmados en este evento.</p>
      ) : (
        <>
          <p className="px-1 text-base text-fg-soft">Elige a quién necesitas atender. Se le avisará que viste su ficha.</p>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
            {others.map((p) => (
              <li key={p.uid}>
                <button type="button" onClick={() => openFicha(p.uid)} className="flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left active:bg-line/60">
                  <Avatar name={p.displayName} photoURL={p.photoURL} className="size-11" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-semibold text-fg">
                      {p.displayName}
                      {p.role === 'organizer' && <span className="font-normal text-muted"> · organiza</span>}
                    </span>
                    <span className="block font-mono text-xs whitespace-nowrap text-muted">{p.rocketId}</span>
                  </span>
                  {!p.emergencyComplete && (
                    <span className="text-xs text-amber-700 dark:text-amber-300" title="Ficha incompleta">
                      ⚠️ incompleta
                    </span>
                  )}
                  <span className="text-lg text-muted" aria-hidden="true">
                    ›
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </BottomSheet>
  )
}
