import { test, expect } from '@playwright/test'
import { E2E_PORT } from './base-url'
import { sidebarLink, activeSidebarLink, userMenuTrigger } from './fixtures'

test.describe('Navigation', () => {
  test('sidebar-links: each sidebar link navigates to the correct page', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const sidebarLinks = [
      { text: 'דשבורד', href: '/' },
      { text: 'אנשי קשר', href: '/contacts' },
      { text: 'פרויקטים', href: '/projects' },
      { text: 'משימות', href: '/tasks' },
    ]

    for (const link of sidebarLinks) {
      await sidebarLink(page, link.text).click()
      // App Router navigation is client-side, so there is no load event to wait
      // for: assert on the URL settling instead.
      await page.waitForURL(
        link.href === '/' ? new RegExp(`localhost:${E2E_PORT}/?$`) : new RegExp(link.href)
      )
    }
  })

  test('active-highlight: sidebar link shows active styling on current page', async ({ page }) => {
    await page.goto('/contacts')
    await page.waitForLoadState('networkidle')

    // Read the active state semantically. This assertion used to be
    // `toHaveClass(/text-link/)`, which had already broken once when design
    // tokens replaced `text-blue-600` - it was testing the styling, not the
    // behaviour. `aria-current` survives any restyle.
    await expect(activeSidebarLink(page)).toHaveText(/אנשי קשר/)
  })

  test('header-greeting: displays Hebrew greeting based on time of day', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Scoped to the volatile block rather than the <header> landmark, so the
    // shell rewrite does not silently widen what this asserts.
    await expect(page.locator('[data-volatile]')).toContainText(
      /בוקר טוב|צהריים טובים|ערב טוב|לילה טוב/
    )
  })

  test('header-user-menu: dropdown contains profile and logout items', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Open user dropdown in header
    await userMenuTrigger(page).click()

    // Verify menu items exist
    const profileItem = page.locator('[role="menuitem"]').filter({ hasText: 'פרופיל' })
    const logoutItem = page.locator('[role="menuitem"]').filter({ hasText: 'התנתק' })

    await expect(profileItem).toBeVisible()
    await expect(logoutItem).toBeVisible()
  })
})
