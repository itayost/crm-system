import { test, expect } from '@playwright/test'
import { kpi, section } from './fixtures'

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('kpi-cards: renders the KPI tiles with data', async ({ page }) => {
    // Addressed by key rather than by Hebrew copy, so renaming a tile's label
    // is a copy change and not a test failure.
    for (const key of ['revenue', 'active-projects', 'leads', 'pending-tasks']) {
      await expect(kpi(page, key)).toBeVisible()
    }
  })

  test('revenue-format: displays amount with shekel symbol', async ({ page }) => {
    // Previously `locator('text=הכנסות').locator('..')` - "whatever element
    // happens to wrap the word revenue". One extra wrapper div moved the
    // assertion off the value it meant to check.
    await expect(kpi(page, 'revenue')).toContainText('₪')
  })


  test('active-projects: shows seeded projects', async ({ page }) => {
    // Previously a double parent-hop from the heading text.
    const activeProjects = section(page, 'active-projects')

    // "פרויקט אפליקציה" is IN_PROGRESS so it should appear in active projects
    const projectNames = ['פרויקט אתר', 'פרויקט אפליקציה']
    let foundCount = 0
    for (const name of projectNames) {
      const count = await activeProjects.locator(`text=${name}`).count()
      foundCount += count
    }
    expect(foundCount).toBeGreaterThan(0)
  })

  test('quick-actions: buttons navigate to correct pages', async ({ page }) => {
    // Click "איש קשר חדש" button -> navigates to /contacts
    const newContactBtn = page.locator('button').filter({ hasText: 'איש קשר חדש' })
    await newContactBtn.click()
    await page.waitForURL(new RegExp('/contacts'))

    // Go back to dashboard
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Click "פרויקט חדש" button -> navigates to /projects
    const newProjectBtn = page.locator('button').filter({ hasText: 'פרויקט חדש' }).first()
    await newProjectBtn.click()
    await page.waitForURL(new RegExp('/projects'))

    // Go back to dashboard
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Click "משימה חדשה" button -> navigates to /tasks
    const newTaskBtn = page.locator('button').filter({ hasText: 'משימה חדשה' })
    await newTaskBtn.click()
    await page.waitForURL(new RegExp('/tasks'))
  })
})
