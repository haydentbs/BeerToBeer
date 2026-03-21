import { test } from '@playwright/test'
import fs from 'node:fs/promises'

const useGoogleAuth = process.env.PLAYWRIGHT_USE_GOOGLE_AUTH === '1'

test.skip(!useGoogleAuth, 'Google-backed auth is optional and disabled by default.')

test('persist prepared auth state when already logged in', async ({ page, context }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await fs.mkdir('tests/e2e/.auth', { recursive: true })
  await context.storageState({ path: 'tests/e2e/.auth/google-state.json' })
})
