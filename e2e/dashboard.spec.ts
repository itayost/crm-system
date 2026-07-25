import { test, expect } from '@playwright/test'

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('kpi-cards: renders 4 KPI cards with data', async ({ page }) => {
    // The dashboard renders 4 KPI cards: revenue, active projects, leads, pending tasks
    const kpiTitles = ['הכנסות', 'פרויקטים פעילים', 'לידים בצנרת', 'משימות ממתינות']

    for (const title of kpiTitles) {
      const card = page.locator('text=' + title).first()
      await expect(card).toBeVisible()
    }
  })

  test('revenue-format: displays amount with shekel symbol', async ({ page }) => {
    // Revenue card should display amount in "X,XXX ₪" format
    const revenueSection = page.locator('text=הכנסות').locator('..')
    await expect(revenueSection).toContainText('₪')
  })


  test('active-projects: shows seeded projects', async ({ page }) => {
    // The "active projects" section should show seeded projects
    const activeProjectsSection = page.locator('text=הפרויקטים בעבודה').locator('..').locator('..')

    // "פרויקט אפליקציה" is IN_PROGRESS so it should appear in active projects
    // Note: the card title also says "פרויקטים פעילים" so we look in the card content
    const projectNames = ['פרויקט אתר', 'פרויקט אפליקציה']
    let foundCount = 0
    for (const name of projectNames) {
      const count = await activeProjectsSection.locator(`text=${name}`).count()
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
