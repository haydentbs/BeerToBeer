import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000'
const useGoogleAuth = process.env.PLAYWRIGHT_USE_GOOGLE_AUTH === '1'
const useAppServer = process.env.PLAYWRIGHT_USE_APP_SERVER !== '0'

const projects: any[] = [
  {
    name: 'guest',
    testMatch: /guest-flow\.spec\.ts/,
    use: {
      ...devices['Desktop Chrome'],
    },
  },
]

if (useGoogleAuth) {
  projects.unshift(
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'authenticated',
      testIgnore: /auth\.setup\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/e2e/.auth/google-state.json',
      },
      dependencies: ['setup'],
    }
  )
}

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './output/playwright',
  fullyParallel: true,
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects,
  webServer: useAppServer
    ? {
        command: 'npx next dev --hostname 127.0.0.1 --port 3000',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
      }
    : undefined,
})
