import { test, expect } from '@playwright/test'
import { expectToastError } from './fixtures'

const TEST_USER = {
  email: 'e2e-test@test.com',
  password: 'password123',
}

// Auth tests do NOT use saved storageState (configured in playwright.config.ts)

test.describe('Authentication', () => {
  test('login-valid: redirects to dashboard on correct credentials', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    await page.fill('input[name="email"]', TEST_USER.email)
    await page.fill('input[name="password"]', TEST_USER.password)
    await page.click('button[type="submit"]')

    await page.waitForURL('/', { timeout: 15000 })
    expect(page.url()).toBe('http://localhost:3000/')
  })

  test('login-invalid: shows Hebrew error toast on wrong password', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    await page.fill('input[name="email"]', TEST_USER.email)
    await page.fill('input[name="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')

    await expectToastError(page, 'אימייל או סיסמה שגויים')
  })

  test('logout: redirects to login page after signing out', async ({ page }) => {
    // First, login
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    await page.fill('input[name="email"]', TEST_USER.email)
    await page.fill('input[name="password"]', TEST_USER.password)
    await page.click('button[type="submit"]')
    await page.waitForURL('/', { timeout: 15000 })

    // Open user menu dropdown in header
    const userMenuTrigger = page.locator('header button').filter({ hasText: /E2E|Test|משתמש/ })
    await userMenuTrigger.click()

    // Click logout
    const logoutItem = page.locator('[role="menuitem"]').filter({ hasText: 'התנתק' })
    await logoutItem.click()

    // Verify redirect to login
    await page.waitForURL('/login', { timeout: 15000 })
    expect(page.url()).toContain('/login')
  })
})
