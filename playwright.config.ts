import { defineConfig, devices } from '@playwright/test'

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
      testIgnore: /auth\.spec\.ts|\.mobile\.spec\.ts/,
      dependencies: ['auth'],
    },
    {
      /**
       * Deliberately a narrow testMatch, not the whole suite at a second size.
       *
       * `workers: 1` and `fullyParallel: false` against a single shared
       * database mean re-running all 68 tests would double the runtime and
       * double the blast radius of any failed restore - in a repo that has
       * already had one cross-spec data leak. This project covers the things
       * that only exist on a phone: the bottom bar, and lists rendering as
       * cards instead of a table.
       */
      name: 'mobile',
      testMatch: /\.mobile\.spec\.ts/,
      dependencies: ['auth'],
      // iPhone 14 geometry and touch, but Chromium: this project exists to
      // check layout at 390px, not WebKit compatibility, and the device
      // descriptor's default browser would mean a separate engine download for
      // no signal the rest of the suite is not already giving.
      use: { ...devices['iPhone 14'], browserName: 'chromium' },
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
})
