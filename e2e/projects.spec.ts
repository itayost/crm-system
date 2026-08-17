import { test, expect } from '@playwright/test'
import {
  expectToastSuccess,
  expectToastError,
  getTableRow,
  getStatusPill,
  row,
} from './fixtures'

test.describe('Projects', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/projects')
    await page.waitForLoadState('networkidle')
  })

  test('list-shows-data: seeded projects are visible in the table', async ({ page }) => {
    await expect(row(page, 'פרויקט אתר')).toBeVisible()
    await expect(row(page, 'פרויקט אפליקציה')).toBeVisible()
  })

  test('filter-by-status: selecting a status filter updates the list', async ({ page }) => {
    // Open the status filter select (shadcn Select component)
    const statusTrigger = page.locator('button[role="combobox"]').filter({ hasText: /הכל|פעיל|הושלם/ })
    await statusTrigger.click()

    // Select "הושלם" (COMPLETED)
    await page.locator('[role="option"]').filter({ hasText: 'הושלם' }).click()
    await page.waitForLoadState('networkidle')

    // Both seeded projects are ACTIVE, so neither should be visible when filtering COMPLETED
    await expect(row(page, 'פרויקט אפליקציה')).not.toBeVisible()
    await expect(row(page, 'פרויקט אתר')).not.toBeVisible()
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

      // Fill the advance. The rest of a project's money is added as phases
      // on the detail page, so the create form no longer asks for a total.
      await page.locator('[role="dialog"] input[name="advanceAmount"]').fill('3000')

      // Submit
      await page.locator('[role="dialog"] button[type="submit"]').click()
      await expectToastSuccess(page, 'פרויקט נוצר בהצלחה')
      await page.waitForLoadState('networkidle')

      // Verify appears in list
      await expect(row(page, 'פרויקט בדיקה')).toBeVisible()

      // Get ID for cleanup
      const createdRow = row(page, 'פרויקט בדיקה')
      await createdRow.click()
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

  test('view-detail: project detail page shows the total in formatted ILS', async ({ page }) => {
    // "פרויקט אתר" is seeded as a 1,000 advance plus 1,500 + 1,500 + 1,000 of
    // phases, so the same 5,000 the spec always asserted - computed now.
    const projectRow = getTableRow(page, 'פרויקט אתר')
    await projectRow.click()
    await page.waitForLoadState('networkidle')

    // Verify project name
    await expect(page.locator('h1').filter({ hasText: 'פרויקט אתר' })).toBeVisible()

    // Shown twice: the info card's סה"כ and the phases card footer.
    await expect(page.locator('text=5,000 ₪').first()).toBeVisible()

    // Verify contact link
    await expect(page.locator('text=לקוח פעיל').first()).toBeVisible()
  })

  test('edit: changing the advance moves the project total', async ({ page }) => {
    // Navigate to "פרויקט אתר" detail
    const projectRow = getTableRow(page, 'פרויקט אתר')
    await projectRow.click()
    await page.waitForLoadState('networkidle')

    // Click edit button
    const editButton = page.locator('button').filter({ hasText: 'עריכה' })
    await editButton.click()
    await expect(page.locator('[role="dialog"]')).toBeVisible()

    // 1,000 -> 2,000 on a 4,000 phase total takes the project to 6,000.
    const advanceInput = page.locator('[role="dialog"] input[name="advanceAmount"]')
    await advanceInput.fill('2000')

    // Submit
    await page.locator('[role="dialog"] button[type="submit"]').click()
    await expectToastSuccess(page, 'פרויקט עודכן בהצלחה')
    await page.waitForLoadState('networkidle')

    // Verify updated total
    await expect(page.locator('text=6,000 ₪').first()).toBeVisible()

    // Restore the original advance
    await editButton.click()
    await expect(page.locator('[role="dialog"]')).toBeVisible()
    await page.locator('[role="dialog"] input[name="advanceAmount"]').fill('1000')
    await page.locator('[role="dialog"] button[type="submit"]').click()
    await expectToastSuccess(page, 'פרויקט עודכן בהצלחה')
  })

  test('phases-list: seeded phases and totals are on the detail page', async ({ page }) => {
    await getTableRow(page, 'פרויקט אתר').click()
    await page.waitForLoadState('networkidle')

    const card = page.locator('main').filter({ hasText: 'שלבים ותשלומים' }).last()
    await expect(card.getByText('אפיון')).toBeVisible()
    await expect(card.getByText('עיצוב')).toBeVisible()

    // 1,000 advance paid + a paid 1,500 phase.
    await expect(card.getByText('2,500 ₪')).toBeVisible()
  })

  test('phase-add-and-delete: a new phase changes the project total', async ({ page }) => {
    await getTableRow(page, 'פרויקט אתר').click()
    await page.waitForLoadState('networkidle')

    await page.locator('main button').filter({ hasText: 'הוסף שלב' }).click()
    await expect(page.locator('[role="dialog"]')).toBeVisible()
    await page.locator('[role="dialog"] input[name="name"]').fill('בדיקות')
    await page.locator('[role="dialog"] input[name="price"]').fill('2000')
    await page.locator('[role="dialog"] button[type="submit"]').click()
    await expectToastSuccess(page, 'שלב נוסף בהצלחה')
    await page.waitForLoadState('networkidle')

    // 5,000 + 2,000. The total is derived, so adding a phase moves it.
    await expect(page.locator('text=7,000 ₪').first()).toBeVisible()

    // Clean up: later assertions and the visual snapshots expect 5,000.
    await page.locator('main button[aria-label="מחיקת בדיקות"]').click()
    await page.locator('[role="alertdialog"] button').filter({ hasText: 'מחק' }).click()
    await expectToastSuccess(page, 'שלב נמחק בהצלחה')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('text=5,000 ₪').first()).toBeVisible()
  })

  test('phase-status-and-payment: approving does not pay, paying is its own act', async ({ page }) => {
    await getTableRow(page, 'פרויקט אתר').click()
    await page.waitForLoadState('networkidle')

    const statusSelect = page.locator('main button[aria-label="סטטוס עיצוב"]')
    await expect(statusSelect).toContainText('בעבודה')

    // Nothing is payable yet: the advance and אפיון are already paid, and
    // עיצוב has not been signed off, so no "סמן כשולם" is on the page at all.
    const payButtons = page.locator('main button').filter({ hasText: 'סמן כשולם' })
    await expect(payButtons).toHaveCount(0)

    await statusSelect.click()
    await page.locator('[role="option"]').filter({ hasText: 'אושר' }).click()
    await expectToastSuccess(page, 'סטטוס שלב עודכן')
    await page.waitForLoadState('networkidle')

    await expect(statusSelect).toContainText('אושר')

    // Approving made it payable but did not pay it: the button appears, and
    // the paid total is still 2,500.
    await expect(payButtons).toHaveCount(1)
    const card = page.locator('main').filter({ hasText: 'שלבים ותשלומים' }).last()
    await expect(card.getByText('שולם: 2,500 ₪')).toBeVisible()

    // Restore.
    await statusSelect.click()
    await page.locator('[role="option"]').filter({ hasText: 'בעבודה' }).click()
    await expectToastSuccess(page, 'סטטוס שלב עודכן')
  })

  test('phase-reorder: moving a phase up swaps it with its neighbour', async ({ page }) => {
    await getTableRow(page, 'פרויקט אתר').click()
    await page.waitForLoadState('networkidle')

    // Read the order off the per-phase status controls rather than a styling
    // class - each carries the phase name in its aria-label, so this says what
    // it means and does not break when the markup is restyled.
    //
    // Polled, not read once: reordering refetches the project, so a bare
    // evaluateAll can land while the list is re-rendering and see nothing.
    const card = page.locator('main').filter({ hasText: 'שלבים ותשלומים' }).last()
    const names = () =>
      card
        .locator('button[aria-label^="סטטוס "]')
        .evaluateAll((els) =>
          els.map((e) => (e.getAttribute('aria-label') ?? '').replace('סטטוס ', ''))
        )
    const expectOrder = (order: string[]) => expect.poll(names).toEqual(order)

    await expectOrder(['אפיון', 'עיצוב', 'פיתוח'])

    // Second row's "up" button.
    await card.locator('button[aria-label="הזז למעלה"]').nth(1).click()
    await expectToastSuccess(page, 'סדר השלבים עודכן')

    await expectOrder(['עיצוב', 'אפיון', 'פיתוח'])

    // Restore the seeded order.
    await card.locator('button[aria-label="הזז למעלה"]').nth(1).click()
    await expectToastSuccess(page, 'סדר השלבים עודכן')

    await expectOrder(['אפיון', 'עיצוב', 'פיתוח'])
  })

  test('project-requests: the project page shows its own פניות card', async ({ page }) => {
    await getTableRow(page, 'פרויקט אתר').click()
    await page.waitForLoadState('networkidle')

    // Exact, or the empty-state line ("אין פניות לפרויקט זה") matches too.
    await expect(page.locator('main').getByText('פניות', { exact: true })).toBeVisible()
    await expect(page.locator('text=אין פניות לפרויקט זה')).toBeVisible()
  })

  test('status-toggle: toggle between ACTIVE and COMPLETED', async ({ page }) => {
    // Navigate to "פרויקט אתר" detail (status: ACTIVE)
    const projectRow = getTableRow(page, 'פרויקט אתר')
    await projectRow.click()
    await page.waitForLoadState('networkidle')

    // Verify ACTIVE status
    await expect(getStatusPill(page, 'פעיל').first()).toBeVisible()

    // Click "סמן כהושלם" (ACTIVE -> COMPLETED)
    await page.locator('button').filter({ hasText: 'סמן כהושלם' }).click()
    await expectToastSuccess(page, 'סטטוס עודכן בהצלחה')
    await page.waitForLoadState('networkidle')

    // Verify COMPLETED status
    await expect(getStatusPill(page, 'הושלם').first()).toBeVisible()

    // Click "הפעל מחדש" (COMPLETED -> ACTIVE)
    await page.locator('button').filter({ hasText: 'הפעל מחדש' }).click()
    await expectToastSuccess(page, 'סטטוס עודכן בהצלחה')
    await page.waitForLoadState('networkidle')

    // Verify back to ACTIVE
    await expect(getStatusPill(page, 'פעיל').first()).toBeVisible()
  })

  test('delete-success: creates and deletes a project with no tasks', async ({ page }) => {
    // We need a real client (business) ID - get it from the clients API
    const clientsResponse = await page.request.get('/api/clients')
    const clients = await clientsResponse.json()
    const clientId = clients[0]?.id

    // Create via API with proper client ID
    const properCreate = await page.request.post('/api/projects', {
      data: {
        name: 'פרויקט למחיקה',
        type: 'LANDING_PAGE',
        priority: 'LOW',
        clientId,
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
    await expectToastError(page, 'לא ניתן למחוק פרויקט שיש לו משימות')
  })
})
