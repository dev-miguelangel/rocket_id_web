import { APP_URL } from '../../../../shared/urls'
import { PhoneIcon } from './icons'

/**
 * Esta app está pensada para el computador: en un celular sugerimos la app de rocketId.
 * Fase 3: sumar el acceso a "🎓 Cursos que dictas" cuando exista esa vista.
 */
export function MobileNotice() {
  return (
    <aside className="flex items-start gap-3 border-b border-line bg-card px-4 py-3 text-sm md:hidden">
      <PhoneIcon className="mt-0.5 size-5 shrink-0 text-primary-text" />
      <p className="text-fg-soft">
        Formadores está pensada para el computador. Para tu ficha y tus cursos como deportista, usa{' '}
        <a href={APP_URL} className="font-semibold text-primary-text underline underline-offset-2">
          la app de rocketId
        </a>
        .
      </p>
    </aside>
  )
}
