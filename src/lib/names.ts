/** Partículas que en nombres hispanos van en minúscula salvo al inicio: "María de los Ángeles" */
const PARTICLES = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'da', 'do', 'dos', 'van', 'von'])

const capitalize = (w: string) => (w ? w.charAt(0).toLocaleUpperCase('es') + w.slice(1) : w)

/**
 * Formatea un nombre propio en Title Case respetando tildes, ñ, guiones y apóstrofos.
 * "JUAN PABLO pérez-cotapos" → "Juan Pablo Pérez-Cotapos"; "bernardo o'higgins" → "Bernardo O'Higgins"
 */
export function toTitleCaseName(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('es')
    .split(' ')
    .map((word, i) => {
      if (i > 0 && PARTICLES.has(word)) return word
      return word
        .split('-')
        .map((part) => part.split("'").map(capitalize).join("'"))
        .join('-')
    })
    .join(' ')
}

/** Primer nombre en Title Case, para saludos. */
export const firstName = (value: string | null | undefined) => toTitleCaseName(value).split(' ')[0] ?? ''
