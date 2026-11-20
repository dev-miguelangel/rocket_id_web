import { useState } from 'react'
import type { Membership } from '../../../../shared/providersApi'
import { useMyProviders } from '../providers/MyProviders'

const KEY = 'formadores:provider'
const read = () => {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

/**
 * Formador con el que se trabaja en Cursos (si la persona es parte de varios, se elige y se recuerda).
 * Solo cuentan los formadores aprobados o suspendidos (estos últimos en solo lectura).
 */
export function useCourseProvider() {
  const { memberships, error } = useMyProviders()
  const [chosen, setChosen] = useState<string | null>(read)
  const options: Membership[] = (memberships ?? []).filter((m) => m.provider.status === 'approved' || m.provider.status === 'suspended')
  const current = options.find((m) => m.provider.id === chosen) ?? options[0] ?? null

  const choose = (id: string) => {
    setChosen(id)
    try {
      localStorage.setItem(KEY, id)
    } catch {
      /* sin almacenamiento: solo dura esta sesión */
    }
  }

  return {
    loading: memberships === null && !error,
    error,
    /** Todas las membresías (para explicar por qué no hay cursos) */
    memberships: memberships ?? [],
    options,
    current,
    choose,
    /** Responsable o coordinación: crea y edita cursos */
    canEdit: !!current && (current.role === 'owner' || current.role === 'manager'),
  }
}
