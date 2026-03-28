import { test, expect } from '@playwright/test'
import {
  expectToastSuccess,
  expectToastError,
  getTableRow,
} from './fixtures'

test.describe('Projects', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/projects')
    await page.waitForLoadState('networkidle')
  })

  test('list-shows-data: seeded projects are visible in the table', async ({ page }) => {
    await expect(page.locator('td').filter({ hasText: 'פרויקט אתר' })).toBeVisible()
    await expect(page.locator('td').filter({ hasText: 'פרויקט אפליקציה' })).toBeVisible()
  })

  test('filter-by-status: selecting a status filter updates the list', async ({ page }) => {
    // Open the status filter select (shadcn Select component)
    const statusTrigger = page.locator('button[role="combobox"]').filter({ hasText: /הכל|פעיל|הושלם/ })
    await statusTrigger.click()

    // Select "הושלם" (COMPLETED)
    await page.locator('[role="option"]').filter({ hasText: 'הושלם' }).click()
    await page.waitForLoadState('networkidle')

    // Both seeded projects are ACTIVE, so neither should be visible when filtering COMPLETED
    await expect(page.locator('td').filter({ hasText: 'פרויקט אפליקציה' })).not.toBeVisible()
    await expect(page.locator('td').filter({ hasText: 'פרויקט אתר' })).not.toBeVisible()
  })

  test('create-success: creates a project with a client contact', async ({ page }) => {
    let createdProjectId: string | undefined

    try {
      // Open create form dialog
      const addButton = page.locator('button').filter({ hasText: 'פרויקט חדש' }).first()
      await addButton.click()
      await expect(page.locator('[role="dialog"]')).toBeVisible()

      // Fill project name
      await page.locator('[role="dialog"] input[name="name"]').fill('פרויקט בדיקה')

      // Select client contact - wait for clients to load
      await page.waitForTimeout(500)
      const clientSelect = page.locator('[role="dialog"]').locator('button[role="combobox"]').filter({ hasText: /בחר לקוח|טוען/ })
      await clientSelect.click()
      await page.locator('[role="option"]').filter({ hasText: 'לקוח פעיל' }).click()

      // Fill price
      await page.locator('[role="dialog"] input[name="price"]').fill('3000')

      // Submit
      await page.locator('[role="dialog"] button[type="submit"]').click()
      await expectToastSuccess(page, 'פרויקט נוצר בהצלחה')
      await page.waitForLoadState('networkidle')

      // Verify appears in list
      await expect(page.locator('td').filter({ hasText: 'פרויקט בדיקה' })).toBeVisible()

      // Get ID for cleanup
      const row = getTableRow(page, 'פרויקט בדיקה')
      await row.click()
      await page.waitForLoadState('networkidle')
      createdProjectId = page.url().split('/projects/')[1]
    } finally {
      if (createdProjectId) {
        await page.request.delete(`/api/projects/${createdProjectId}`)
      }
    }
  })

  test('create-blocked-non-client: leads do not appear in the client dropdown', async ({ page }) => {
    // Open create form dialog
    const addButton = page.locator('button').filter({ hasText: 'פרויקט חדש' }).first()
    await addButton.click()
    await expect(page.locator('[role="dialog"]')).toBeVisible()

    // Wait for clients to load
    await page.waitForTimeout(500)

    // Open the client select dropdown
    const clientSelect = page.locator('[role="dialog"]').locator('button[role="combobox"]').filter({ hasText: /בחר לקוח|טוען/ })
    await clientSelect.click()

    // Leads should NOT appear in the dropdown (API only returns phase=client)
    await expect(page.locator('[role="option"]').filter({ hasText: 'ליד ראשון' })).not.toBeVisible()
    await expect(page.locator('[role="option"]').filter({ hasText: 'ליד שני' })).not.toBeVisible()

    // Clients SHOULD appear
    await expect(page.locator('[role="option"]').filter({ hasText: 'לקוח פעיל' })).toBeVisible()
  })

  test('create-validation: submitting empty form shows Hebrew validation errors', async ({ page }) => {
    // Open create form dialog
    const addButton = page.locator('button').filter({ hasText: 'פרויקט חדש' }).first()
    await addButton.click()
    await expect(page.locator('[role="dialog"]')).toBeVisible()

    // Clear the name field and submit
    await page.locator('[role="dialog"] input[name="name"]').fill('')
    await page.locator('[role="dialog"] button[type="submit"]').click()

    // Verify validation errors
    await expect(page.locator('[role="dialog"]').locator('text=שם פרויקט חובה')).toBeVisible()
    await expect(page.locator('[role="dialog"]').locator('text=לקוח חובה')).toBeVisible()
  })

  test('view-detail: project detail page shows price in formatted ILS', async ({ page }) => {
    // Click on "פרויקט אתר" which has price: 5000
    const projectRow = getTableRow(page, 'פרויקט אתר')
    await projectRow.click()
    await page.waitForLoadState('networkidle')

    // Verify project name
    await expect(page.locator('h1').filter({ hasText: 'פרויקט אתר' })).toBeVisible()

    // Verify formatted price "5,000 ₪"
    await expect(page.locator('text=5,000 ₪')).toBeVisible()

    // Verify contact link
    await expect(page.locator('text=לקוח פעיל')).toBeVisible()
  })

  test('edit: changes project price on detail page', async ({ page }) => {
    // Navigate to "פרויקט אתר" detail
    const projectRow = getTableRow(page, 'פרויקט אתר')
    await projectRow.click()
    await page.waitForLoadState('networkidle')

    // Click edit button
    const editButton = page.locator('button').filter({ hasText: 'עריכה' })
    await editButton.click()
    await expect(page.locator('[role="dialog"]')).toBeVisible()

    // Change the price
    const priceInput = page.locator('[role="dialog"] input[name="price"]')
    await priceInput.fill('6000')

    // Submit
    await page.locator('[role="dialog"] button[type="submit"]').click()
    await expectToastSuccess(page, 'פרויקט עודכן בהצלחה')
    await page.waitForLoadState('networkidle')

    // Verify updated price
    await expect(page.locator('text=6,000 ₪')).toBeVisible()

    // Restore original price
    await editButton.click()
    await expect(page.locator('[role="dialog"]')).toBeVisible()
    await page.locator('[role="dialog"] input[name="price"]').fill('5000')
    await page.locator('[role="dialog"] button[type="submit"]').click()
    await expectToastSuccess(page, 'פרויקט עודכן בהצלחה')
  })

  test('status-toggle: toggle between ACTIVE and COMPLETED', async ({ page }) => {
    // Navigate to "פרויקט אתר" detail (status: ACTIVE)
    const projectRow = getTableRow(page, 'פרויקט אתר')
    await projectRow.click()
    await page.waitForLoadState('networkidle')

    // Verify ACTIVE status
    await expect(page.locator('[class*="badge"]').filter({ hasText: 'פעיל' })).toBeVisible()

    // Click "סמן כהושלם" (ACTIVE -> COMPLETED)
    await page.locator('button').filter({ hasText: 'סמן כהושלם' }).click()
    await expectToastSuccess(page, 'סטטוס עודכן בהצלחה')
    await page.waitForLoadState('networkidle')

    // Verify COMPLETED status
    await expect(page.locator('[class*="badge"]').filter({ hasText: 'הושלם' })).toBeVisible()

    // Click "הפעל מחדש" (COMPLETED -> ACTIVE)
    await page.locator('button').filter({ hasText: 'הפעל מחדש' }).click()
    await expectToastSuccess(page, 'סטטוס עודכן בהצלחה')
    await page.waitForLoadState('networkidle')

    // Verify back to ACTIVE
    await expect(page.locator('[class*="badge"]').filter({ hasText: 'פעיל' })).toBeVisible()
  })

  test('delete-success: creates and deletes a project with no tasks', async ({ page }) => {
    // Create a project via API for deletion testing
    const createResponse = await page.request.post('/api/projects', {
      data: {
        name: 'פרויקט למחיקה',
        type: 'LANDING_PAGE',
        priority: 'LOW',
        contactId: '', // Will need a real ID
      },
    })

    // We need a real client contact ID - get it from the contacts API
    const contactsResponse = await page.request.get('/api/contacts?phase=client')
    const contacts = await contactsResponse.json()
    const clientId = contacts[0]?.id

    // Create via API with proper client ID
    const properCreate = await page.request.post('/api/projects', {
      data: {
        name: 'פרויקט למחיקה',
        type: 'LANDING_PAGE',
        priority: 'LOW',
        contactId: clientId,
      },
    })
    const created = await properCreate.json()
    const projectId = created.id

    // Navigate to the project detail page
    await page.goto(`/projects/${projectId}`)
    await page.waitForLoadState('networkidle')

    // Click delete button to open confirmation dialog
    const deleteButton = page.locator('button').filter({ hasText: 'מחיקה' })
    await deleteButton.click()

    // Confirm deletion in the alert dialog
    const confirmButton = page.locator('[role="alertdialog"] button').filter({ hasText: 'מחק' })
    await confirmButton.click()

    await expectToastSuccess(page, 'פרויקט נמחק בהצלחה')

    // Should redirect to projects list
    await page.waitForURL('/projects', { timeout: 10000 })
  })

  test('delete-blocked: cannot delete a project with tasks', async ({ page }) => {
    // Navigate to "פרויקט אתר" detail page (has tasks)
    const projectRow = getTableRow(page, 'פרויקט אתר')
    await projectRow.click()
    await page.waitForLoadState('networkidle')

    // Click delete button
    const deleteButton = page.locator('button').filter({ hasText: 'מחיקה' })
    await deleteButton.click()

    // Confirm deletion
    const confirmButton = page.locator('[role="alertdialog"] button').filter({ hasText: 'מחק' })
    await confirmButton.click()

    // Should show error toast
    await expectToastError(page, 'שגיאה במחיקת פרויקט')
  })
})
