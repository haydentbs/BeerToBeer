import { expect, test } from '@playwright/test'
import { resetDatabase } from '../helpers/backend-fixtures'

const useDevAuth = process.env.PLAYWRIGHT_USE_DEV_AUTH === '1'

test.skip(!useDevAuth, 'Dev-auth battle flow is optional and disabled by default.')

test.beforeAll(async () => {
  await resetDatabase()
})

test('two dev users can create a sandbox, join the same crew, and exchange a Beer Bomb challenge', async ({ browser, baseURL }) => {
  const alexContext = await browser.newContext()
  const rileyContext = await browser.newContext()
  const alexPage = await alexContext.newPage()
  const rileyPage = await rileyContext.newPage()
  const pendingInviteCopy = 'Waiting for Riley Dev to accept your 1 Beer Bomb challenge.'

  try {
    await alexPage.goto(baseURL ?? '/')
    await expect(alexPage.getByRole('button', { name: 'Continue as Alex Dev' })).toBeVisible()
    await alexPage.getByRole('button', { name: 'Continue as Alex Dev' }).click()
    await expect(alexPage.getByRole('button', { name: /Create Battle Sandbox/i })).toBeVisible()
    await alexPage.getByRole('button', { name: /Create Battle Sandbox/i }).click()
    await expect(alexPage.getByTestId('crew-invite-code')).toBeVisible()

    const inviteCode = (await alexPage.getByTestId('crew-invite-code').textContent())?.trim()
    expect(inviteCode).toBeTruthy()

    await rileyPage.goto(baseURL ?? '/')
    await expect(rileyPage.getByRole('button', { name: 'Continue as Riley Dev' })).toBeVisible()
    await rileyPage.getByRole('button', { name: 'Continue as Riley Dev' }).click()
    await expect(rileyPage.getByRole('button', { name: 'Join with Code' })).toBeVisible()
    await rileyPage.getByRole('button', { name: 'Join with Code' }).click()
    await rileyPage.getByPlaceholder('DEMO1234').fill(inviteCode!)
    await rileyPage.getByRole('button', { name: /^Join$/ }).click()

    await expect(rileyPage.getByText('Alex Dev Battle Sandbox')).toBeVisible()

    await alexPage.getByRole('button', { name: 'Create bet or challenge' }).click()
    await alexPage.getByRole('button', { name: 'Beer Bomb' }).click()
    await alexPage.getByRole('button', { name: 'Riley Dev' }).click()
    await alexPage.getByRole('button', { name: /Start vs Riley Dev/i }).click()
    await expect(alexPage.getByText(pendingInviteCopy)).toBeVisible()

    await expect(rileyPage.getByText('Game invite')).toBeVisible()
    await expect(rileyPage.getByRole('button', { name: /Accept & play for 1/i })).toBeVisible()
    await rileyPage.getByRole('button', { name: /Accept & play for 1/i }).click()

    await expect(rileyPage.getByText('Alex Dev vs Riley Dev')).toBeVisible()
    await expect(rileyPage.getByRole('button', { name: /Accept & play for 1/i })).toBeHidden()

    await expect(alexPage.getByText(pendingInviteCopy)).toBeHidden({ timeout: 10_000 })
  } finally {
    await alexContext.close()
    await rileyContext.close()
  }
})
