import { test, expect } from '@playwright/test'
import { section } from './fixtures'

/**
 * היום, not דשבורד.
 *
 * The old page was five identical KPI tiles plus three quick-action buttons.
 * These assertions follow the question the page now answers - "what is owed,
 * and in what order" - rather than the old furniture. Blocks 1-6 render only
 * when they have something in them, so what is asserted here is the two that
 * always exist: the day line and the state strip.
 */
test.describe('Today', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('day-line: names the day and says whether anything is owed', async ({ page }) => {
    const dayLine = section(page, 'day-line')
    await expect(dayLine).toBeVisible()
    // Either a count of what needs you, or an explicit all-clear. Never blank.
    await expect(dayLine).toContainText(/דורשים אותך|באיחור|היום נקי/)
  })

  test('state-strip: four figures, each a real link', async ({ page }) => {
    const strip = section(page, 'state')
    await expect(strip).toBeVisible()

    for (const [name, href] of [
      ['פרויקטים פעילים', '/projects'],
      ['פניות פתוחות', '/requests'],
      ['לידים בצנרת', '/leads'],
      ['הכנסות', '/money'],
    ]) {
      await expect(strip.locator('a', { hasText: name })).toHaveAttribute('href', href)
    }
  })

  test('revenue-format: the money figure carries a shekel sign', async ({ page }) => {
    await expect(section(page, 'state').locator('a', { hasText: 'הכנסות' })).toContainText('₪')
  })

  test('active-projects: shows seeded projects', async ({ page }) => {
    const projects = section(page, 'active-projects')
    await expect(projects).toBeVisible()

    const names = ['פרויקט אתר', 'פרויקט אפליקציה']
    let found = 0
    for (const name of names) found += await projects.locator(`text=${name}`).count()
    expect(found).toBeGreaterThan(0)
  })

  test('navigation: the state strip goes where it says', async ({ page }) => {
    await section(page, 'state').locator('a', { hasText: 'לידים בצנרת' }).click()
    await expect(page).toHaveURL(/\/leads/)
  })
})
