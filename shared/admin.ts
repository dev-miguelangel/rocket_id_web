/**
 * Administración de la plataforma (aprueba formadores, ve métricas, datos de prueba).
 * Solo se guarda el sha256 del correo: las reglas de Firestore validan lo mismo en `isAdmin()`.
 * Para sumar otra cuenta de administración, agregar su hash aquí y en firestore.rules.
 */
const ADMIN_EMAIL_HASHES = ['4505f00c6a3f199d9f1a7b6a32b492291441f41fd8510826e44a76c0c306c6e4']

export async function isAdminEmail(email: string | null | undefined) {
  if (!email) return false
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email.trim().toLowerCase()))
  const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
  return ADMIN_EMAIL_HASHES.includes(hex)
}
