import { test, expect } from '@playwright/test'
import { row, rowCell } from './fixtures'

/**
 * The owner side on a phone.
 *
 * There was no mobile layout at all: the sidebar was a hard `w-64 h-screen`
 * with no breakpoint, inside a `flex h-screen overflow-hidden` shell, so at
 * 375px it took 256px and left 119px for the application - with five tables of
 * five to ten columns scrolling sideways inside that.
 *
 * These assertions use the same `row` / `rowCell` fixtures as the desktop
 * specs. That is the point of DataTable emitting one contract as two elements:
 * the desktop `<tr>` and the mobile `<article>` carry identical handles, so
 * nothing here needed a mobile-specific selector.
 */
test.describe('mobile shell', () => {
  test('bottom bar replaces the sidebar', async ({ page }) => {
    await page.goto('/clients')
    await page.waitForLoadState('networkidle')

    // The desktop sidebar must not merely be narrow - it must be gone.
    await expect(page.getByRole('navigation', { name: 'ניווט ראשי' })).toBeHidden()

    const bar = page.getByRole('navigation', { name: 'ניווט' })
    await expect(bar).toBeVisible()
    for (const label of ['היום', 'פניות', 'משימות', 'עוד']) {
      await expect(bar.getByText(label, { exact: true })).toBeVisible()
    }
  })

  test('the more sheet reaches the registries', async ({ page }) => {
    await page.goto('/clients')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'עוד' }).click()
    const projects = page.getByRole('link', { name: /פרויקטים/ })
    await expect(projects).toBeVisible()
    await projects.click()
    await page.waitForURL(/\/projects/)
  })

  test('a list renders as cards, addressed by the same handles', async ({ page }) => {
    await page.goto('/clients')
    await page.waitForLoadState('networkidle')

    // No horizontal scroll: the body must never be wider than the viewport.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)

    const clientRow = row(page, 'לקוח פעיל')
    await expect(clientRow).toBeVisible()
    // `article` on mobile, `tr` on desktop - the fixture does not care.
    await expect(clientRow).toHaveJSProperty('tagName', 'ARTICLE')
    await expect(rowCell(clientRow, 'name')).toHaveText('לקוח פעיל')
  })

  test('page still reachable and readable at 390px', async ({ page }) => {
    await page.goto('/money')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: 'כספים' })).toBeVisible()
  })
})
