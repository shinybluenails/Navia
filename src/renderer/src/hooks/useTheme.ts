import { useState, useEffect } from 'react'

export type Theme = 'dark' | 'light' | 'cherry'

const STORAGE_KEY = 'homemind-theme'
const DEFAULT: Theme = 'dark'

function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme)
}

function loadTheme(): Theme {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === 'dark' || raw === 'light' || raw === 'cherry') return raw
  } catch {
    // ignore
  }
  return DEFAULT
}

export function useTheme(): { theme: Theme; setTheme: (t: Theme) => void } {
  const [theme, setThemeState] = useState<Theme>(() => {
    const t = loadTheme()
    applyTheme(t)
    return t
  })

  useEffect(() => {
    applyTheme(theme)
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // ignore
    }
  }, [theme])

  return { theme, setTheme: setThemeState }
}
