import { test, expect } from '@playwright/test'
import {
  expectToastSuccess,
  getTableRow,
  row,
  rowCell,
  rowStatusPill,
} from './fixtures'

test.describe('Tasks', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tasks')
    await page.waitForLoadState('networkidle')
  })

  test('list-shows-data: seeded tasks are visible in the table', async ({ page }) => {
    await expect(row(page, 'משימה ראשונה')).toBeVisible()
    await expect(row(page, 'משימה עצמאית')).toBeVisible()
    await expect(row(page, 'משימה שהושלמה')).toBeVisible()
  })

  test('filter-by-status: selecting a status filter updates the list', async ({ page }) => {
    // Open the status filter select
    const statusTrigger = page.locator('button[role="combobox"]').filter({ hasText: /הכל|לביצוע|בתהליך/ })
    await statusTrigger.click()

    // Select "הושלם" (COMPLETED)
    await page.locator('[role="option"]').filter({ hasText: 'הושלם' }).click()
    await page.waitForLoadState('networkidle')

    // "משימה שהושלמה" should be visible
    await expect(row(page, 'משימה שהושלמה')).toBeVisible()

    // TODO tasks should NOT be visible
    await expect(row(page, 'משימה ראשונה')).not.toBeVisible()
  })

  test('filter-standalone: toggle shows only tasks without a project', async ({ page }) => {
    // Toggle the standalone switch
    // Was `page.locator('#standalone')`. The switch already has a <Label
    // htmlFor="standalone">, so it is reachable by role and name.
    await page.getByRole('switch', { name: 'ללא פרויקט' }).click()
    await page.waitForLoadState('networkidle')

    // "משימה עצמאית" has no project, should be visible
    await expect(row(page, 'משימה עצמאית')).toBeVisible()

    // "משימה ראשונה" has a project, should NOT be visible
    await expect(row(page, 'משימה ראשונה')).not.toBeVisible()
  })

  test('create-with-project: creates a task linked to a project', async ({ page }) => {
    let createdTaskId: string | undefined

    try {
      // Open create form dialog
      const addButton = page.locator('button').filter({ hasText: 'משימה חדשה' })
      await addButton.click()
      await expect(page.locator('[role="dialog"]')).toBeVisible()

      // Fill the task title
      await page.locator('[role="dialog"] input[name="title"]').fill('משימת בדיקה עם פרויקט')

      // Wait for projects to load
      await page.waitForTimeout(500)

      // Select a project
      const projectSelect = page.locator('[role="dialog"]').locator('button[role="combobox"]').filter({ hasText: /ללא פרויקט|טוען|פרויקט/ })
      await projectSelect.click()
      await page.locator('[role="option"]').filter({ hasText: 'פרויקט אתר' }).click()

      // Submit
      await page.locator('[role="dialog"] button[type="submit"]').click()
      await expectToastSuccess(page, 'משימה נוצרה בהצלחה')
      await page.waitForLoadState('networkidle')

      // Verify appears in list with project name
      const taskRow = getTableRow(page, 'משימת בדיקה עם פרויקט')
      await expect(taskRow).toBeVisible()
      await expect(rowCell(taskRow, 'project')).toHaveText('פרויקט אתר')

      // Get task ID for cleanup via API
      const tasksResponse = await page.request.get('/api/tasks?search=משימת בדיקה עם פרויקט')
      const tasks = await tasksResponse.json()
      createdTaskId = tasks[0]?.id
    } finally {
      if (createdTaskId) {
        await page.request.delete(`/api/tasks/${createdTaskId}`)
      }
    }
  })

  test('create-standalone: creates a task without a project', async ({ page }) => {
    let createdTaskId: string | undefined

    try {
      // Open create form dialog
      const addButton = page.locator('button').filter({ hasText: 'משימה חדשה' })
      await addButton.click()
      await expect(page.locator('[role="dialog"]')).toBeVisible()

      // Fill the task title only (leave project as default "ללא פרויקט")
      await page.locator('[role="dialog"] input[name="title"]').fill('משימה עצמאית חדשה')

      // Submit
      await page.locator('[role="dialog"] button[type="submit"]').click()
      await expectToastSuccess(page, 'משימה נוצרה בהצלחה')
      await page.waitForLoadState('networkidle')

      // Verify appears in list with "-" in project column
      const taskRow = getTableRow(page, 'משימה עצמאית חדשה')
      await expect(taskRow).toBeVisible()

      // The project column should show "-"
      const projectCell = rowCell(taskRow, 'project')
      await expect(projectCell).toHaveText('-')

      // Get task ID for cleanup
      const tasksResponse = await page.request.get('/api/tasks?search=משימה עצמאית חדשה')
      const tasks = await tasksResponse.json()
      createdTaskId = tasks[0]?.id
    } finally {
      if (createdTaskId) {
        await page.request.delete(`/api/tasks/${createdTaskId}`)
      }
    }
  })

  test('edit: clicking a task row opens edit dialog and saves changes', async ({ page }) => {
    // Click on "משימה עצמאית" row to open edit dialog
    const taskRow = getTableRow(page, 'משימה עצמאית')
    await rowCell(taskRow, 'title').click()
    await expect(page.locator('[role="dialog"]')).toBeVisible()

    // Verify it is in edit mode
    await expect(page.locator('[role="dialog"]').locator('text=עריכת משימה')).toBeVisible()

    // Change the title
    const titleInput = page.locator('[role="dialog"] input[name="title"]')
    await titleInput.fill('משימה עצמאית מעודכנת')

    // Submit
    await page.locator('[role="dialog"] button[type="submit"]').click()
    await expectToastSuccess(page, 'משימה עודכנה בהצלחה')
    await page.waitForLoadState('networkidle')

    // Verify updated in list
    await expect(row(page, 'משימה עצמאית מעודכנת')).toBeVisible()

    // Restore original title
    const updatedRow = getTableRow(page, 'משימה עצמאית מעודכנת')
    await rowCell(updatedRow, 'title').click()
    await expect(page.locator('[role="dialog"]')).toBeVisible()
    await page.locator('[role="dialog"] input[name="title"]').fill('משימה עצמאית')
    await page.locator('[role="dialog"] button[type="submit"]').click()
    await expectToastSuccess(page, 'משימה עודכנה בהצלחה')
  })

  test('inline-completion: clicking checkbox toggles task to completed', async ({ page }) => {
    // Find "משימה ראשונה" row (status: TODO)
    const taskRow = getTableRow(page, 'משימה ראשונה')

    // Click the completion checkbox button (first cell)
    const checkbox = taskRow.locator('button[aria-label="סמן כהושלם"]')
    await checkbox.click()

    // Wait for optimistic update
    await page.waitForTimeout(300)

    // Verify the status badge changed to COMPLETED
    const statusBadge = rowStatusPill(taskRow, 'הושלם')
    await expect(statusBadge).toBeVisible()

    // Revert: click again to set back to TODO
    const uncheckButton = taskRow.locator('button[aria-label="סמן כלא הושלם"]')
    await uncheckButton.click()
    await page.waitForTimeout(300)
  })

  test('delete: removes a task via API call and verifies it is gone', async ({ page }) => {
    // Create a task via API for deletion
    const createResponse = await page.request.post('/api/tasks', {
      data: {
        title: 'משימה למחיקה',
        priority: 'LOW',
      },
    })
    const created = await createResponse.json()
    const taskId = created.id

    // Reload to see the new task
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(row(page, 'משימה למחיקה')).toBeVisible()

    // Delete via API
    await page.request.delete(`/api/tasks/${taskId}`)

    // Reload and verify gone
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(row(page, 'משימה למחיקה')).not.toBeVisible()
  })

  test('visible-in-project-detail: task appears in project detail page', async ({ page }) => {
    // Get the project ID for "פרויקט אתר"
    const projectsResponse = await page.request.get('/api/projects?search=פרויקט אתר')
    const projects = await projectsResponse.json()
    const projectId = projects[0]?.id

    // Navigate to project detail page
    await page.goto(`/projects/${projectId}`)
    await page.waitForLoadState('networkidle')

    // Verify "משימה ראשונה" appears in the tasks section
    await expect(page.locator('text=משימות').first()).toBeVisible()
    await expect(page.locator('text=משימה ראשונה')).toBeVisible()
  })
})
