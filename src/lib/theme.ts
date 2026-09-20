import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

const query = '(prefers-color-scheme: dark)'

// The theme follows the system unless it is switched by hand. A manual choice is only kept in memory,
// so a refresh goes back to the system setting.
export function currentTheme(): Theme {
  const set = document.documentElement.getAttribute('data-theme')
  if (set === 'light' || set === 'dark') return set
  return window.matchMedia(query).matches ? 'dark' : 'light'
}

export function toggleTheme(): Theme {
  const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark'
  document.documentElement.setAttribute('data-theme', next)
  window.dispatchEvent(new Event('themechange'))
  return next
}

export function useTheme(): Theme {
  const [theme, setTheme] = useState<Theme>(currentTheme)
  useEffect(() => {
    const update = () => setTheme(currentTheme())
    const media = window.matchMedia(query)
    window.addEventListener('themechange', update)
    media.addEventListener('change', update)
    return () => {
      window.removeEventListener('themechange', update)
      media.removeEventListener('change', update)
    }
  }, [])
  return theme
}
