import { SettleUpThemeProvider } from '@/components/theme-provider'
import { AppStateProvider } from '@/lib/app-state'

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <SettleUpThemeProvider>
      <AppStateProvider>
        {children}
      </AppStateProvider>
    </SettleUpThemeProvider>
  )
}
