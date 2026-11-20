/**
 * Direcciones públicas de cada app. Salen de variables de entorno para que cambiar al dominio
 * propio (rocketid.cl) sea solo configuración: nada de direcciones escritas en el código.
 */
const env = import.meta.env

/** App de deportistas (móvil) */
export const APP_URL: string = env.VITE_APP_URL || 'https://rocketid.vercel.app'

/** App de formadores (escritorio) */
export const FORMADORES_URL: string = env.VITE_FORMADORES_URL || 'https://rocketid-formadores.vercel.app'
