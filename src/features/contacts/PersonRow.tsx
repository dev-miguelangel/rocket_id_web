import { Avatar } from '../../components/Avatar'

interface Props {
  name: string
  photoURL: string | null
  rocketId: string
  /** Texto secundario a la derecha del rocketId (ej. "En tu cordada") */
  note?: string
  isMock?: boolean
  onClick: () => void
}

/** Fila de persona estilo lista de búsqueda (avatar · nombre en negrita · rocketId tenue). */
export function PersonRow({ name, photoURL, rocketId, note, isMock, onClick }: Props) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 px-1 py-2 text-left active:opacity-60">
      <Avatar name={name} photoURL={photoURL} className="size-12 text-base" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[15px] font-semibold text-fg">{name || 'Sin nombre'}</span>
          {isMock && (
            <span className="shrink-0 text-xs" title="Perfil de prueba" aria-label="Perfil de prueba">
              🧪
            </span>
          )}
        </span>
        <span className="flex min-w-0 items-baseline gap-1 text-sm text-muted">
          <span className="shrink-0 font-mono tracking-wide whitespace-nowrap">{rocketId}</span>
          {note && <span className="truncate">· {note}</span>}
        </span>
      </span>
    </button>
  )
}
