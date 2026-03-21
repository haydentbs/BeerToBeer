// BeerScore Theming System
// Two layers: App Mode (light/classic/dark) + Drink Theme (beer/cocktails/shots/tequila/wine/whiskey)

export type AppMode = 'light' | 'classic' | 'dark'
export type DrinkTheme = 'beer' | 'cocktails' | 'shots' | 'tequila' | 'wine' | 'whiskey'

export interface ThemeColors {
  background: string
  foreground: string
  card: string
  cardForeground: string
  primary: string
  primaryForeground: string
  secondary: string
  secondaryForeground: string
  muted: string
  mutedForeground: string
  accent: string
  accentForeground: string
  border: string
  input: string
  ring: string
  win: string
  loss: string
  surface: string
  surfaceElevated: string
}

export interface DrinkThemeConfig {
  name: string
  emoji: string
  icon: string // lucide icon name
  // Each drink theme defines accent hues for each mode
  hues: {
    primary: number      // oklch hue angle
    secondary: number
    accent: number
    win: number
    loss: number
  }
}

export const DRINK_THEMES: Record<DrinkTheme, DrinkThemeConfig> = {
  beer: {
    name: 'Beer',
    emoji: '🍺',
    icon: 'Beer',
    hues: { primary: 75, secondary: 160, accent: 80, win: 75, loss: 25 },
  },
  cocktails: {
    name: 'Cocktails',
    emoji: '🍸',
    icon: 'Martini',
    hues: { primary: 335, secondary: 310, accent: 345, win: 335, loss: 20 },
  },
  shots: {
    name: 'Shots',
    emoji: '🥃',
    icon: 'Zap',
    hues: { primary: 250, secondary: 230, accent: 265, win: 250, loss: 20 },
  },
  tequila: {
    name: 'Tequila',
    emoji: '🫗',
    icon: 'Flame',
    hues: { primary: 130, secondary: 150, accent: 120, win: 130, loss: 20 },
  },
  wine: {
    name: 'Wine',
    emoji: '🍷',
    icon: 'Wine',
    hues: { primary: 10, secondary: 355, accent: 18, win: 10, loss: 350 },
  },
  whiskey: {
    name: 'Whiskey',
    emoji: '🥃',
    icon: 'Cigarette',
    hues: { primary: 38, secondary: 25, accent: 32, win: 38, loss: 20 },
  },
}

// Generate CSS variables for a given mode + drink theme combination
export function generateThemeVars(mode: AppMode, drink: DrinkTheme): Record<string, string> {
  const h = DRINK_THEMES[drink].hues

  switch (mode) {
    case 'classic':
      // Current look: dark background + cream cards
      return {
        '--background': `oklch(0.12 0.01 ${h.primary})`,
        '--foreground': `oklch(0.95 0.01 ${h.primary + 15})`,
        '--card': `oklch(0.96 0.02 ${h.primary + 10})`,
        '--card-foreground': `oklch(0.15 0.01 ${h.primary})`,
        '--popover': `oklch(0.96 0.02 ${h.primary + 10})`,
        '--popover-foreground': `oklch(0.15 0.01 ${h.primary})`,
        '--primary': `oklch(0.75 0.15 ${h.primary})`,
        '--primary-foreground': `oklch(0.15 0.01 ${h.primary})`,
        '--secondary': `oklch(0.35 0.08 ${h.secondary})`,
        '--secondary-foreground': `oklch(0.95 0.01 ${h.primary + 15})`,
        '--muted': `oklch(0.20 0.01 ${h.primary})`,
        '--muted-foreground': `oklch(0.65 0.02 ${h.primary + 10})`,
        '--accent': `oklch(0.85 0.12 ${h.accent})`,
        '--accent-foreground': `oklch(0.15 0.01 ${h.primary})`,
        '--destructive': `oklch(0.55 0.18 ${h.loss})`,
        '--destructive-foreground': `oklch(0.95 0.01 90)`,
        '--border': `oklch(0.25 0.02 ${h.primary})`,
        '--input': `oklch(0.20 0.01 ${h.primary})`,
        '--ring': `oklch(0.75 0.15 ${h.primary})`,
        '--win': `oklch(0.75 0.15 ${h.win})`,
        '--loss': `oklch(0.55 0.18 ${h.loss})`,
        '--surface': `oklch(0.18 0.01 ${h.primary})`,
        '--surface-elevated': `oklch(0.22 0.01 ${h.primary})`,
      }

    case 'light':
      // Light backgrounds, dark text
      return {
        '--background': `oklch(0.97 0.01 ${h.primary + 10})`,
        '--foreground': `oklch(0.15 0.01 ${h.primary})`,
        '--card': `oklch(1.0 0 0)`,
        '--card-foreground': `oklch(0.15 0.01 ${h.primary})`,
        '--popover': `oklch(1.0 0 0)`,
        '--popover-foreground': `oklch(0.15 0.01 ${h.primary})`,
        '--primary': `oklch(0.65 0.18 ${h.primary})`,
        '--primary-foreground': `oklch(0.98 0.01 ${h.primary})`,
        '--secondary': `oklch(0.45 0.08 ${h.secondary})`,
        '--secondary-foreground': `oklch(0.98 0.01 ${h.primary})`,
        '--muted': `oklch(0.92 0.01 ${h.primary + 10})`,
        '--muted-foreground': `oklch(0.45 0.02 ${h.primary})`,
        '--accent': `oklch(0.90 0.08 ${h.accent})`,
        '--accent-foreground': `oklch(0.15 0.01 ${h.primary})`,
        '--destructive': `oklch(0.55 0.20 ${h.loss})`,
        '--destructive-foreground': `oklch(0.98 0.01 90)`,
        '--border': `oklch(0.80 0.03 ${h.primary})`,
        '--input': `oklch(0.92 0.01 ${h.primary})`,
        '--ring': `oklch(0.65 0.18 ${h.primary})`,
        '--win': `oklch(0.55 0.18 ${h.win})`,
        '--loss': `oklch(0.50 0.20 ${h.loss})`,
        '--surface': `oklch(0.94 0.01 ${h.primary + 10})`,
        '--surface-elevated': `oklch(0.98 0.01 ${h.primary + 10})`,
      }

    case 'dark':
      // Full dark mode
      return {
        '--background': `oklch(0.10 0.01 ${h.primary})`,
        '--foreground': `oklch(0.92 0.01 ${h.primary + 15})`,
        '--card': `oklch(0.16 0.02 ${h.primary})`,
        '--card-foreground': `oklch(0.92 0.01 ${h.primary + 15})`,
        '--popover': `oklch(0.16 0.02 ${h.primary})`,
        '--popover-foreground': `oklch(0.92 0.01 ${h.primary + 15})`,
        '--primary': `oklch(0.75 0.15 ${h.primary})`,
        '--primary-foreground': `oklch(0.12 0.01 ${h.primary})`,
        '--secondary': `oklch(0.30 0.08 ${h.secondary})`,
        '--secondary-foreground': `oklch(0.92 0.01 ${h.primary + 15})`,
        '--muted': `oklch(0.18 0.01 ${h.primary})`,
        '--muted-foreground': `oklch(0.60 0.02 ${h.primary + 10})`,
        '--accent': `oklch(0.80 0.12 ${h.accent})`,
        '--accent-foreground': `oklch(0.12 0.01 ${h.primary})`,
        '--destructive': `oklch(0.55 0.18 ${h.loss})`,
        '--destructive-foreground': `oklch(0.95 0.01 90)`,
        '--border': `oklch(0.25 0.02 ${h.primary})`,
        '--input': `oklch(0.18 0.01 ${h.primary})`,
        '--ring': `oklch(0.75 0.15 ${h.primary})`,
        '--win': `oklch(0.75 0.15 ${h.win})`,
        '--loss': `oklch(0.55 0.18 ${h.loss})`,
        '--surface': `oklch(0.14 0.01 ${h.primary})`,
        '--surface-elevated': `oklch(0.20 0.01 ${h.primary})`,
      }
  }
}

// Get the emoji for the current drink theme
export function getDrinkEmoji(theme: DrinkTheme): string {
  return DRINK_THEMES[theme].emoji
}

// Default settings
export const DEFAULT_APP_MODE: AppMode = 'classic'
export const DEFAULT_DRINK_THEME: DrinkTheme = 'beer'
