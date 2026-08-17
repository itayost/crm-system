import { test, expect } from '@playwright/test'
import {
  fillContactForm,
  submitForm,
  expectToastSuccess,
  expectToastError,
  getTableRow,
  waitForSearchResults,
  getStatusPill,
  row,
} from './fixtures'

/**
 * The list lives at /leads now.
 *
 * The old /contacts page had three tabs, and its לקוחות tab was a near
 * duplicate of /clients: the real seam is pipeline-vs-roster, not
 * person-vs-business. /contacts/[id] is unchanged and is still where these
 * tests land when they click a row.
 */
test.describe('Contacts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/leads')
    await page.waitForLoadState('networkidle')
  })

  test('list-shows-data: seeded leads are visible in the list', async ({ page }) => {
    // Default segment is לטיפול - promised today or earlier, plus anyone with
    // no planned next action at all.
    await expect(row(page, 'ליד ראשון')).toBeVisible()

    // A client is not a lead, and no longer appears here at all.
    await expect(row(page, 'לקוח פעיל')).not.toBeVisible()
  })

  test('segment-pipeline: בצנרת shows live leads and hides lost ones', async ({ page }) => {
    await page.getByRole('tab', { name: /בצנרת/ }).click()

    await expect(row(page, 'ליד ראשון')).toBeVisible()
    await expect(row(page, 'ליד אבוד')).not.toBeVisible()
  })

  test('segment-lost: אבודים shows only terminal leads', async ({ page }) => {
    await page.getByRole('tab', { name: /אבודים/ }).click()

    await expect(row(page, 'ליד אבוד')).toBeVisible()
    await expect(row(page, 'ליד ראשון')).not.toBeVisible()
  })

  test('search: typing a name filters the list', async ({ page }) => {
    const searchInput = page.locator('input[type="search"]')
    await searchInput.fill('ליד ראשון')
    await waitForSearchResults(page)

    await expect(row(page, 'ליד ראשון')).toBeVisible()
    await expect(row(page, 'ליד שני')).not.toBeVisible()
  })

  test('create-success: creates a new contact and it appears in the list', async ({ page }) => {
    let createdContactId: string | undefined

    try {
      // Open create form dialog
      const addButton = page.locator('button').filter({ hasText: 'ליד חדש' })
      await addButton.click()

      // Wait for dialog to open
      await expect(page.locator('[role="dialog"]')).toBeVisible()

      // Fill the form using react-hook-form inputs
      await page.locator('[role="dialog"] input[name="name"]').fill('איש קשר בדיקה')
      await page.locator('[role="dialog"] input[name="phone"]').fill('0509999999')

      // Submit the form
      await page.locator('[role="dialog"] button[type="submit"]').click()

      await expectToastSuccess(page, 'איש קשר נוצר בהצלחה')

      // Wait for list to reload
      await page.waitForLoadState('networkidle')

      // Verify appears in list
      await expect(row(page, 'איש קשר בדיקה')).toBeVisible()

      // Get the ID for cleanup: find the row and click to get ID from URL
      const createdRow = row(page, 'איש קשר בדיקה')
      await createdRow.click()
      await page.waitForLoadState('networkidle')
      const url = page.url()
      createdContactId = url.split('/contacts/')[1]
    } finally {
      // Cleanup
      if (createdContactId) {
        await page.request.delete(`/api/contacts/${createdContactId}`)
      }
    }
  })

  test('create-validation: submitting empty form shows Hebrew validation errors', async ({ page }) => {
    // Open create form dialog
    const addButton = page.locator('button').filter({ hasText: 'ליד חדש' })
    await addButton.click()
    await expect(page.locator('[role="dialog"]')).toBeVisible()

    // Clear default values and submit empty
    await page.locator('[role="dialog"] input[name="name"]').fill('')
    await page.locator('[role="dialog"] input[name="phone"]').fill('')
    await page.locator('[role="dialog"] button[type="submit"]').click()

    // Verify Hebrew validation error messages
    await expect(page.locator('[role="dialog"]').locator('text=שם חובה')).toBeVisible()
    await expect(page.locator('[role="dialog"]').locator('text=טלפון חובה')).toBeVisible()
  })

  test('view-detail-lead: lead detail page shows lead fields but NO projects section', async ({ page }) => {
    // Click on the lead row
    const leadRow = getTableRow(page, 'ליד ראשון')
    await leadRow.click()
    await expect(page).toHaveURL(/\/contacts\/\w+/)
    await page.waitForLoadState('networkidle')

    // Verify we are on the detail page
    await expect(page.locator('h1').filter({ hasText: 'ליד ראשון' })).toBeVisible()

    // Verify status badge shows a lead status
    await expect(page.locator('text=חדש').first()).toBeVisible()

    // Verify convert button is visible (only for leads)
    await expect(page.locator('button').filter({ hasText: 'המר ללקוח' })).toBeVisible()

    // Verify projects section is NOT visible (leads don't have it)
    await expect(page.locator('main').locator('button:has-text("פרויקט חדש")')).not.toBeVisible()
  })

  test('view-detail-client: client detail page shows client fields and projects section', async ({ page }) => {
    // A client's person record is reached through the business now, since a
    // client is not a lead and does not appear on /leads.
    await page.goto('/clients')
    await page.waitForLoadState('networkidle')
    await row(page, 'לקוח פעיל').locator('a').first().click()
    await expect(page).toHaveURL(/\/clients\//)
    await page.getByRole('tab', { name: /אנשים/ }).click()
    const clientRow = row(page, 'לקוח פעיל')
    await clientRow.locator('a').first().click()
    await expect(page).toHaveURL(/\/contacts\/\w+/)
    await page.waitForLoadState('networkidle')

    // Verify we are on the detail page
    await expect(page.locator('h1').filter({ hasText: 'לקוח פעיל' })).toBeVisible()

    // Verify status badge shows "לקוח"
    await expect(getStatusPill(page, 'לקוח').first()).toBeVisible()

    // Verify projects section IS visible (clients have projects). Scoped to
    // main: the sidebar has a "פרויקטים" link too.
    await expect(page.locator('main').getByText('פרויקטים').first()).toBeVisible()
  })

  test('edit: changes contact name on detail page', async ({ page }) => {
    // Navigate to ליד ראשון detail
    const leadRow = getTableRow(page, 'ליד ראשון')
    await leadRow.click()
    await expect(page).toHaveURL(/\/contacts\/\w+/)
    await page.waitForLoadState('networkidle')

    // Click edit button
    const editButton = page.locator('button').filter({ hasText: 'עריכה' })
    await editButton.click()
    await expect(page.locator('[role="dialog"]')).toBeVisible()

    // Change the name
    const nameInput = page.locator('[role="dialog"] input[name="name"]')
    await nameInput.fill('ליד ראשון מעודכן')

    // Submit
    await page.locator('[role="dialog"] button[type="submit"]').click()
    await expectToastSuccess(page, 'איש קשר עודכן בהצלחה')
    await page.waitForLoadState('networkidle')

    // Verify updated
    await expect(page.locator('h1').filter({ hasText: 'ליד ראשון מעודכן' })).toBeVisible()

    // Restore original name
    await editButton.click()
    await expect(page.locator('[role="dialog"]')).toBeVisible()
    await page.locator('[role="dialog"] input[name="name"]').fill('ליד ראשון')
    await page.locator('[role="dialog"] button[type="submit"]').click()
    await expectToastSuccess(page, 'איש קשר עודכן בהצלחה')
  })

  test('convert-to-client: converts a lead to client status', async ({ page }) => {
    // Navigate to "ליד שני" detail page
    const leadRow = getTableRow(page, 'ליד שני')
    await leadRow.click()
    await expect(page).toHaveURL(/\/contacts\/\w+/)
    await page.waitForLoadState('networkidle')

    // Verify it is currently a lead
    await expect(page.locator('button').filter({ hasText: 'המר ללקוח' })).toBeVisible()

    // The try opens BEFORE the mutation, not after it.
    //
    // The click below is what creates the Client. Previously `try` started
    // three lines lower, so a failure in the toast assertion landed the
    // mutation and then skipped the cleanup - reproducing the exact leak the
    // note in `finally` describes. That fix moved the cleanup into `finally`
    // but left the boundary above the mutation, so it was only half done.
    try {
      // Click convert button
      await page.locator('button').filter({ hasText: 'המר ללקוח' }).click()
      await expectToastSuccess(page, 'הליד הומר ללקוח בהצלחה')
      await page.waitForLoadState('networkidle')

      // Verify status badge changed to "לקוח"
      await expect(getStatusPill(page, 'לקוח').first()).toBeVisible()

      // Convert button should no longer be visible
      await expect(page.locator('button').filter({ hasText: 'המר ללקוח' })).not.toBeVisible()
    } finally {
      const id = page.url().split('/contacts/')[1]
      // Revert fully, pass or fail. Converting also creates a Client (business)
      // named after the lead; leaving it behind puts a lead's name in the client
      // dropdown that projects.spec asserts against later in the same run.
      //
      // The finally is load-bearing, not defensive tidiness: this cleanup used
      // to sit after the assertions, so when the first one broke it never ran,
      // the Client leaked, and projects.spec failed too. One stale selector
      // reported as two unrelated bugs.
      const before = await (await page.request.get(`/api/contacts/${id}`)).json()
      await page.request.put(`/api/contacts/${id}`, {
        data: { status: 'QUOTED', clientId: null },
      })
      if (before.clientId) {
        await page.request.delete(`/api/clients/${before.clientId}`)
      }
    }
  })

  test('advance-stage: moves a lead through the pipeline from the detail page', async ({ page }) => {
    const leadRow = getTableRow(page, 'ליד ראשון')
    await leadRow.click()
    await expect(page).toHaveURL(/\/contacts\/\w+/)
    await page.waitForLoadState('networkidle')

    // The status is a Select, not a static badge - before this the only
    // transition the UI offered at all was "המר ללקוח".
    const statusSelect = page.locator('main button[role="combobox"]').first()
    await expect(statusSelect).toContainText('חדש')

    await statusSelect.click()
    await page.locator('[role="option"]').filter({ hasText: 'נקבעה פגישת אפיון' }).click()
    await expectToastSuccess(page, 'סטטוס עודכן בהצלחה')
    await page.waitForLoadState('networkidle')

    await expect(statusSelect).toContainText('נקבעה פגישת אפיון')

    // Restore: later tests and the leads-tab assertions expect NEW.
    const id = page.url().split('/contacts/')[1]
    await page.request.put(`/api/contacts/${id}`, { data: { status: 'NEW' } })
  })

  test('next-action: sets and clears the next action on a lead', async ({ page }) => {
    const leadRow = getTableRow(page, 'ליד ראשון')
    await leadRow.click()
    await expect(page).toHaveURL(/\/contacts\/\w+/)
    await page.waitForLoadState('networkidle')

    const editor = page.locator('main').filter({ hasText: 'פעולה הבאה' })
    await expect(editor.first()).toBeVisible()

    await page.locator('input[aria-label="תאריך פעולה הבאה"]').fill('2026-12-31')
    await page.locator('input[aria-label="תיאור פעולה הבאה"]').fill('להתקשר בחזרה')
    await page.locator('main button').filter({ hasText: 'שמירה' }).click()
    await expectToastSuccess(page, 'פעולה הבאה נשמרה')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('input[aria-label="תיאור פעולה הבאה"]')).toHaveValue('להתקשר בחזרה')

    await page.locator('main button').filter({ hasText: 'נקה' }).click()
    await expectToastSuccess(page, 'פעולה הבאה נוקתה')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('input[aria-label="תיאור פעולה הבאה"]')).toHaveValue('')
  })

  test('next-action-column: an overdue lead is flagged and sorts first', async ({ page }) => {
    await page.getByRole('tab', { name: /בצנרת/ }).click()

    const row = getTableRow(page, 'ליד שלישי')
    await expect(row).toBeVisible()
    await expect(row).toContainText('לשלוח הצעת מחיר')

    // Server-side sort puts the overdue lead above leads with nothing
    // scheduled. Asserted through expect() rather than a bare allTextContents
    // read, which raced the skeleton while the rows were still arriving.
    await expect(page.locator('[data-testid="row"]').first()).toContainText('ליד שלישי')
  })

  test('lost-visibility: a lost lead leaves the pipeline but stays findable', async ({ page }) => {
    await page.getByRole('tab', { name: /בצנרת/ }).click()
    await expect(row(page, 'ליד אבוד')).not.toBeVisible()

    await page.getByRole('tab', { name: /הכל/ }).click()
    await expect(row(page, 'ליד אבוד')).toBeVisible()
  })

  test('lost-lead-detail: a lost lead keeps the status select but loses the convert button', async ({ page }) => {
    await page.getByRole('tab', { name: /הכל/ }).click()

    await getTableRow(page, 'ליד אבוד').click()
    await expect(page).toHaveURL(/\/contacts\/\w+/)
    await page.waitForLoadState('networkidle')

    await expect(page.locator('main button[role="combobox"]').first()).toContainText('אבוד')
    await expect(page.locator('button').filter({ hasText: 'המר ללקוח' })).not.toBeVisible()
  })

  test('delete-success: creates and deletes a throwaway contact', async ({ page }) => {
    // Create a throwaway contact via API
    const createResponse = await page.request.post('/api/contacts', {
      data: {
        name: 'למחיקה',
        phone: '0501111111',
        source: 'OTHER',
      },
    })
    const created = await createResponse.json()
    const contactId = created.id

    // Navigate to the contact detail page
    await page.goto(`/contacts/${contactId}`)
    await page.waitForLoadState('networkidle')

    // Click delete button to open confirmation dialog
    const deleteButton = page.locator('button').filter({ hasText: 'מחיקה' })
    await deleteButton.click()

    // Confirm deletion in the alert dialog
    const confirmButton = page.locator('[role="alertdialog"] button').filter({ hasText: 'מחק' })
    await confirmButton.click()

    await expectToastSuccess(page, 'איש קשר נמחק בהצלחה')

    // Should redirect back to the list
    await expect(page).toHaveURL(/\/(leads|contacts)$/, { timeout: 10000 })
  })

  test('delete-blocked: cannot delete a client with projects', async ({ page }) => {
    // Reached through the business, since a client is not a lead.
    await page.goto('/clients')
    await page.waitForLoadState('networkidle')
    await row(page, 'לקוח פעיל').locator('a').first().click()
    await expect(page).toHaveURL(/\/clients\//)
    await page.getByRole('tab', { name: /אנשים/ }).click()
    await row(page, 'לקוח פעיל').locator('a').first().click()
    await expect(page).toHaveURL(/\/contacts\/\w+/)
    await page.waitForLoadState('networkidle')

    // Click delete button
    const deleteButton = page.locator('button').filter({ hasText: 'מחיקה' })
    await deleteButton.click()

    // Confirm deletion
    const confirmButton = page.locator('[role="alertdialog"] button').filter({ hasText: 'מחק' })
    await confirmButton.click()

    // Should show error toast (business rule prevents deletion)
    await expectToastError(page, 'לא ניתן למחוק איש קשר ראשי של לקוח שיש לו פרויקטים')
  })
})
