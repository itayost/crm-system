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
 */

const PAGES = [
  { name: 'dashboard', path: '/' },
  { name: 'contacts', path: '/contacts' },
  { name: 'clients', path: '/clients' },
  { name: 'projects', path: '/projects' },
  { name: 'tasks', path: '/tasks' },
  { name: 'requests', path: '/requests' },
]

for (const page of PAGES) {
  test(`visual: ${page.name}`, async ({ page: browserPage }) => {
    await browserPage.goto(page.path)
    await browserPage.waitForLoadState('networkidle')
    // Relative dates and "good morning" greetings move on their own.
    await browserPage.waitForTimeout(500)

    await expect(browserPage).toHaveScreenshot(`${page.name}.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.01,
      mask: [browserPage.locator('header')],
    })
  })
}
