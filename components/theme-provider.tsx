'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import {
  type AppMode,
  type DrinkTheme,
  DEFAULT_APP_MODE,
  DEFAULT_DRINK_THEME,
  generateThemeVars,
  getDrinkEmoji,
} from '@/lib/themes'

interface ThemeContextValue {
  mode: AppMode
  setMode: (mode: AppMode) => void
  // Active drink theme (from crew or night override)
  activeDrinkTheme: DrinkTheme
  setActiveDrinkTheme: (theme: DrinkTheme) => void
  // Whether user has disabled crew/night themes
  themesDisabled: boolean
  setThemesDisabled: (disabled: boolean) => void
  // Helper to get the effective emoji
  drinkEmoji: string
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within BeerScoreThemeProvider')
  return ctx
}

interface BeerScoreThemeProviderProps {
  children: React.ReactNode
}

export function BeerScoreThemeProvider({ children }: BeerScoreThemeProviderProps) {
  const [mode, setModeState] = useState<AppMode>(DEFAULT_APP_MODE)
  const [activeDrinkTheme, setActiveDrinkThemeState] = useState<DrinkTheme>(DEFAULT_DRINK_THEME)
  const [themesDisabled, setThemesDisabledState] = useState(false)

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const savedMode = localStorage.getItem('beerscore_mode') as AppMode | null
      const savedDisabled = localStorage.getItem('beerscore_themes_disabled')
      if (savedMode && ['light', 'classic', 'dark'].includes(savedMode)) {
        setModeState(savedMode)
      }
      if (savedDisabled === 'true') {
        setThemesDisabledState(true)
      }
    } catch {
      // localStorage not available
    }
  }, [])

  // Apply CSS variables whenever mode or drink theme changes
  useEffect(() => {
    const effectiveTheme = themesDisabled ? 'beer' : activeDrinkTheme
    const vars = generateThemeVars(mode, effectiveTheme)
    const root = document.documentElement
    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value)
    }
  }, [mode, activeDrinkTheme, themesDisabled])

  const setMode = useCallback((m: AppMode) => {
    setModeState(m)
    try { localStorage.setItem('beerscore_mode', m) } catch {}
  }, [])

  const setActiveDrinkTheme = useCallback((t: DrinkTheme) => {
    setActiveDrinkThemeState(t)
  }, [])

  const setThemesDisabled = useCallback((d: boolean) => {
    setThemesDisabledState(d)
    try { localStorage.setItem('beerscore_themes_disabled', String(d)) } catch {}
  }, [])

  const drinkEmoji = themesDisabled
    ? getDrinkEmoji('beer')
    : getDrinkEmoji(activeDrinkTheme)

  return (
    <ThemeContext.Provider
      value={{
        mode,
        setMode,
        activeDrinkTheme,
        setActiveDrinkTheme,
        themesDisabled,
        setThemesDisabled,
        drinkEmoji,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}
