import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AppHeader } from '@/components/app-header'
import { SettleUpThemeProvider } from '@/components/theme-provider'

describe('AppHeader', () => {
  it('wires the guest finish-account action from the user menu', async () => {
    const user = userEvent.setup()
    const onFinishAccount = vi.fn()

    render(
      <SettleUpThemeProvider>
        <AppHeader
          crewName="The Regulars"
          netPosition={0}
          userName="Guest Pal"
          isGuest
          onBack={vi.fn()}
          onFinishAccount={onFinishAccount}
        />
      </SettleUpThemeProvider>
    )

    await user.click(screen.getByRole('button', { name: 'GU' }))
    await user.click(screen.getByRole('button', { name: 'Finish Account' }))

    expect(onFinishAccount).toHaveBeenCalled()
  })
})
