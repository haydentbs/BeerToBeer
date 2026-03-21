import { expect, test } from '@playwright/test'
import { createCrewWithNight, resetDatabase } from '../helpers/backend-fixtures'

let inviteCode = ''
let crewName = ''

test.beforeAll(async () => {
  await resetDatabase()
  const fixture = await createCrewWithNight('Playwright Guest')
  inviteCode = fixture.crew.inviteCode
  crewName = fixture.crew.name
})

test.beforeEach(async ({ context }) => {
  await context.clearCookies()
})

test('guest session survives reload and keeps crew access visible', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('button', { name: 'Join as Guest' })).toBeVisible({ timeout: 10000 })

  await page.getByPlaceholder('XXXX-XX').fill(inviteCode)
  await page.getByPlaceholder('What should we call you?').fill('Taylor Guest')
  await page.getByRole('button', { name: 'Join as Guest' }).click()

  await expect(page.getByText(crewName)).toBeVisible({ timeout: 10000 })

  await page.reload()

  await expect(page.getByText(crewName)).toBeVisible({ timeout: 10000 })
  await expect(page.getByRole('button', { name: 'Join as Guest' })).toHaveCount(0)
})
