import { defineConfig } from '@playwright/test'

// Overridable so the suite can run while another project holds port 3000.
const PORT = process.env.E2E_PORT ?? '3000'
const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    storageState: './e2e/.auth/storageState.json',
    // Pinned explicitly. The visual baselines are fullPage screenshots, so
    // leaning on Playwright's implicit 1280x720 default means a Playwright
    // upgrade can invalidate all six of them without anything in this repo
    // changing.
    viewport: { width: 1280, height: 720 },
  },
  expect: {
    // Defaults for every toHaveScreenshot call, so a new baseline cannot be
    // added with different comparison rules than the existing ones.
    // `animations: 'disabled'` matters more once motion tokens land.
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    },
  },
  projects: [
    {
      name: 'auth',
      testMatch: /auth\.spec\.ts/,
      // An explicit empty state, not `undefined`: undefined merges as "unset",
      // so the top-level storageState would still log these tests in.
      use: { storageState: { cookies: [], origins: [] } },
    },
    {
      name: 'main',
      testIgnore: /auth\.spec\.ts/,
      dependencies: ['auth'],
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
})
