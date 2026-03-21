import { test, expect } from '@playwright/test'

const useGoogleAuth = process.env.PLAYWRIGHT_USE_GOOGLE_AUTH === '1'

test.skip(!useGoogleAuth, 'Google-backed auth is optional and disabled by default.')

test('loads the app shell', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText(/BeerScore/i)).toBeVisible()
})
