import { expect, test } from '@playwright/test'
import { DEMO_CREW_CODE, DEMO_CREW_NAME } from '../../lib/demo-crew'
import { resetDatabase } from '../helpers/backend-fixtures'

test.beforeAll(async () => {
  await resetDatabase()
})

test.beforeEach(async ({ context }) => {
  await context.clearCookies()
})

test('guest session survives reload and keeps crew access visible', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('button', { name: 'Join as Guest' })).toBeVisible({ timeout: 10000 })

  await page.getByPlaceholder('XXXX-XX').fill(DEMO_CREW_CODE)
  await page.getByPlaceholder('What should we call you?').fill('Taylor Guest')
  await page.getByRole('button', { name: 'Join as Guest' }).click()

  await expect(page.getByText(DEMO_CREW_NAME)).toBeVisible({ timeout: 10000 })
  await page.getByRole('button', { name: 'Crew' }).click()
  await expect(page.getByRole('heading', { name: 'Members' })).toBeVisible()

  const guestName = page.getByTestId('member-name').filter({ hasText: 'Taylor Guest' })
  const guestRole = page.getByTestId('member-role').filter({ hasText: '~ Guest' })

  await expect(guestName).toBeVisible()
  await expect(guestName).toHaveClass(/text-muted-foreground/)
  await expect(guestRole).toBeVisible()

  await page.reload()

  await expect(page.getByText(DEMO_CREW_NAME)).toBeVisible({ timeout: 10000 })
  await expect(page.getByRole('button', { name: 'Join as Guest' })).toHaveCount(0)
})
