import type { Metadata, Viewport } from 'next'
import { Bungee, Lexend, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { SettleUpThemeProvider } from '@/components/theme-provider'
import { AppStateProvider } from '@/lib/app-state'
import './globals.css'

/** Display / poster — titles, primary CTAs */
const bungee = Bungee({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bungee',
})
/** Body & UI — Lexend variable supports 100–900 */
const lexend = Lexend({
  subsets: ['latin'],
  variable: '--font-lexend',
})
/** Tertiary — codes, timers, tabular */
const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
})

export const metadata: Metadata = {
  title: 'SettleUp',
  description: 'The betting app where the stakes are real drinks',
  generator: 'v0.app',
  manifest: '/manifest.json',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#1a1614',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="bg-background">
      <body
        className={`${bungee.variable} ${lexend.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <SettleUpThemeProvider>
          <AppStateProvider>
            {children}
          </AppStateProvider>
        </SettleUpThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
