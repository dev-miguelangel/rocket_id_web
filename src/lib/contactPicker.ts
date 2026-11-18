/**
 * Contact Picker API: abre el selector de contactos nativo del teléfono.
 * Soportado en Chrome para Android (navegador y PWA instalada). No disponible en iOS Safari.
 * La app solo recibe el contacto que la persona elige, nunca la agenda completa.
 */

interface ContactInfo {
  name?: string[]
  tel?: string[]
}

interface ContactsManager {
  select(props: ('name' | 'tel')[], options?: { multiple?: boolean }): Promise<ContactInfo[]>
}

const getManager = () => (navigator as Navigator & { contacts?: ContactsManager }).contacts

export const isContactPickerSupported = () =>
  typeof window !== 'undefined' && window.isSecureContext && 'ContactsManager' in window && !!getManager()

export interface PickedContact {
  name: string
  phones: string[]
}

/** Devuelve null si la persona cancela. */
export async function pickContact(): Promise<PickedContact | null> {
  const manager = getManager()
  if (!manager) return null
  const [c] = await manager.select(['name', 'tel'], { multiple: false })
  if (!c) return null
  const phones = [...new Set((c.tel ?? []).map((t) => t.trim()).filter(Boolean))]
  return { name: (c.name?.[0] ?? '').trim(), phones }
}
