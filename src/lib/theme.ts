import { useCallback, useEffect, useSyncExternalStore } from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'rocketid-theme'
const THEME_COLORS = { light: '#0F766E', dark: '#09090B' } as const
const media = () => window.matchMedia('(prefers-color-scheme: dark)')

function readPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark') return v
  } catch {
    /* almacenamiento bloqueado: usamos el del sistema */
  }
  return 'system'
}

function applyTheme(pref: ThemePreference) {
  const dark = pref === 'dark' || (pref === 'system' && media().matches)
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', dark ? THEME_COLORS.dark : THEME_COLORS.light)
}

// Store mínimo para compartir la preferencia entre componentes
const listeners = new Set<() => void>()
let current: ThemePreference = readPreference()

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function useTheme() {
  const preference = useSyncExternalStore(subscribe, () => current)

  // Si la preferencia es "sistema", seguimos los cambios del SO en vivo
  useEffect(() => {
    applyTheme(preference)
    if (preference !== 'system') return
    const mq = media()
    const onChange = () => applyTheme('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [preference])

  const setPreference = useCallback((pref: ThemePreference) => {
    current = pref
    try {
      if (pref === 'system') localStorage.removeItem(STORAGE_KEY)
      else localStorage.setItem(STORAGE_KEY, pref)
    } catch {
      /* ignorar */
    }
    listeners.forEach((l) => l())
  }, [])

  return { preference, setPreference }
}
