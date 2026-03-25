import { test, expect } from '@playwright/test'

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
      const sidebarLink = page.locator('nav a').filter({ hasText: link.text })
      await sidebarLink.click()
      await page.waitForLoadState('networkidle')
      expect(page.url()).toContain(link.href === '/' ? 'localhost:3000' : link.href)
    }
  })

  test('active-highlight: sidebar link shows active styling on current page', async ({ page }) => {
    await page.goto('/contacts')
    await page.waitForLoadState('networkidle')

    const contactsLink = page.locator('nav a').filter({ hasText: 'אנשי קשר' })
    await expect(contactsLink).toHaveClass(/text-blue-600/)
  })

  test('header-greeting: displays Hebrew greeting based on time of day', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const header = page.locator('header')
    await expect(header).toContainText(/בוקר טוב|צהריים טובים|ערב טוב|לילה טוב/)
  })

  test('header-user-menu: dropdown contains profile and logout items', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Open user dropdown in header
    const userMenuTrigger = page.locator('header button').filter({ hasText: /E2E|Test|משתמש/ })
    await userMenuTrigger.click()

    // Verify menu items exist
    const profileItem = page.locator('[role="menuitem"]').filter({ hasText: 'פרופיל' })
    const logoutItem = page.locator('[role="menuitem"]').filter({ hasText: 'התנתק' })

    await expect(profileItem).toBeVisible()
    await expect(logoutItem).toBeVisible()
  })
})
