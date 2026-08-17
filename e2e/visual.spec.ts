import { test, expect } from '@playwright/test'

/**
 * Pixel baselines for the pages a token change can quietly break.
 *
 * The UI is Hebrew RTL with no visual coverage, and a design-token sweep touches
 * hundreds of class names across every screen. These snapshots are the only
 * thing that would catch a shade or a spacing that shifted by accident.
 *
 * Baselines are machine-specific (font rendering), so they are a local safety
 * net for a refactor, not a CI gate.
 *
 * Comparison options live in playwright.config.ts under `expect`, so every
 * baseline in this file is recorded and compared the same way.
 */

const PAGES = [
  { name: 'dashboard', path: '/' },
  { name: 'contacts', path: '/contacts' },
  { name: 'clients', path: '/clients' },
  { name: 'projects', path: '/projects' },
  { name: 'tasks', path: '/tasks' },
  { name: 'requests', path: '/requests' },
  { name: 'money', path: '/money' },
]

/**
 * Detail pages, reached by clicking rather than by id.
 *
 * The ids are seeded per run, so a static path would need a lookup. Following
 * the first row of a deterministically sorted list is simpler and also
 * exercises that the row is a real link.
 */
const DETAIL_PAGES = [
  {
    name: 'client-detail',
    from: '/clients',
    settlesAt: /\/clients\/[\w-]+/,
    // The page fires three fetches and only one drives its skeleton, so
    // `networkidle` alone photographs the loading state. Wait for something
    // that only exists once the data is in.
    ready: '[data-slot="money-line"]',
  },
]

for (const page of DETAIL_PAGES) {
  test(`visual: ${page.name}`, async ({ page: browserPage }) => {
    await browserPage.goto(page.from)
    await browserPage.waitForLoadState('networkidle')
    await browserPage.locator('[data-testid="row"]').first().locator('a').first().click()
    // App Router navigation is client-side, so there is no load event to wait
    // for - assert on the URL settling, or the screenshot catches the list.
    await browserPage.waitForURL(page.settlesAt)
    await browserPage.locator(page.ready).waitFor({ state: 'visible' })
    await browserPage.waitForLoadState('networkidle')
    await browserPage.waitForTimeout(500)

    await expect(browserPage).toHaveScreenshot(`${page.name}.png`, {
      fullPage: true,
      mask: [browserPage.locator('[data-volatile]')],
    })
  })
}

for (const page of PAGES) {
  test(`visual: ${page.name}`, async ({ page: browserPage }) => {
    await browserPage.goto(page.path)
    await browserPage.waitForLoadState('networkidle')
    // Relative dates and "good morning" greetings move on their own.
    await browserPage.waitForTimeout(500)

    await expect(browserPage).toHaveScreenshot(`${page.name}.png`, {
      fullPage: true,
      // Mask the element, not the <header> landmark. When the shell rewrite
      // replaces <header>, a tag-based mask silently matches nothing and every
      // baseline starts failing once a minute as the clock ticks - which reads
      // as flakiness and trains everyone to accept new snapshots blind.
      mask: [browserPage.locator('[data-volatile]')],
    })
  })
}
