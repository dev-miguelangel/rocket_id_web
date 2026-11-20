import { APP_URL } from '../../../../shared/urls'
import { PhoneIcon } from './icons'

/**
 * Esta app está pensada para el computador: en un celular sugerimos la app de rocketId.
 */
export function MobileNotice() {
  return (
    <aside className="flex items-start gap-3 border-b border-line bg-card px-4 py-3 text-sm md:hidden">
      <PhoneIcon className="mt-0.5 size-5 shrink-0 text-primary-text" />
      <p className="text-fg-soft">
        Formadores está pensada para el computador. En el celular puedes revisar tus postulaciones en{' '}
        <a href={`${APP_URL}/dictas`} className="font-semibold text-primary-text underline underline-offset-2">
          la app de rocketId
        </a>
        , en el menú de tu foto → <span className="whitespace-nowrap">🎓 Cursos que dictas</span>.
      </p>
    </aside>
  )
}
