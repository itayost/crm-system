import { test, expect } from '@playwright/test'
import { E2E_PORT } from './base-url'
import { sidebarLink, activeSidebarLink, userMenuTrigger } from './fixtures'

test.describe('Navigation', () => {
  test('sidebar-links: each sidebar link navigates to the correct page', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // The nav is two blocks now: the day (things that can be owed to you and
    // can reach zero) and the registries. "דשבורד" became "היום" because the
    // page stopped being a report about your own business.
    const links = [
      { text: 'היום', href: '/' },
      { text: 'פניות', href: '/requests' },
      { text: 'משימות', href: '/tasks' },
      { text: 'לידים', href: '/leads' },
      { text: 'לקוחות', href: '/clients' },
      { text: 'פרויקטים', href: '/projects' },
      { text: 'כספים', href: '/money' },
    ]

    for (const link of links) {
      await sidebarLink(page, link.text).click()
      // `toHaveURL` polls; `waitForURL` waits for a navigation event whose
      // default `load` never fires for App Router's client-side transitions,
      // so it can hang even though the URL did change.
      await expect(page).toHaveURL(
        link.href === '/' ? new RegExp(`localhost:${E2E_PORT}/?$`) : new RegExp(link.href),
      )
    }
  })

  test('active-highlight: the current page is marked semantically', async ({ page }) => {
    await page.goto('/clients')
    await page.waitForLoadState('networkidle')

    // Was `toHaveClass(/text-link/)`, which had already broken once when design
    // tokens replaced text-blue-600 - it tested the styling, not the behaviour.
    await expect(activeSidebarLink(page)).toHaveText(/לקוחות/)
  })

  test('bot-status: the header says whether the bot is talking to clients', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Replaces the greeting assertion. isBotPaused() is read per request and
    // used to be invisible in the UI entirely, so "the bot went quiet" was
    // diagnosed by reading a deploy log.
    await expect(page.getByTestId('bot-status')).toContainText(/הבוט פעיל|הבוט מושהה/)
  })

  test('header-user-menu: dropdown contains shortcuts and logout', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await userMenuTrigger(page).click()

    // "פרופיל" is gone - it routed to `/`, which is not a profile.
    await expect(page.locator('[role="menuitem"]').filter({ hasText: 'קיצורי מקלדת' })).toBeVisible()
    await expect(page.locator('[role="menuitem"]').filter({ hasText: 'התנתק' })).toBeVisible()
  })

  test('command-palette: opens on the search button and navigates', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'חיפוש ופעולות' }).click()
    const palette = page.getByRole('dialog')
    await expect(palette).toBeVisible()

    await palette.getByRole('textbox', { name: 'חיפוש ופעולות' }).fill('כספים')
    await palette.getByRole('button', { name: /כספים/ }).first().click()
    await page.waitForURL(/\/money/)
  })
})
