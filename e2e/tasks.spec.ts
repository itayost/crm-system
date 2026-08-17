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

  test('list-shows-data: seeded tasks are visible in the list', async ({ page }) => {
    // Default segment is פתוחות: a completed task is not open work and is one
    // click away rather than mixed in with it.
    await expect(row(page, 'משימה ראשונה')).toBeVisible()
    await expect(row(page, 'משימה עצמאית')).toBeVisible()
    await expect(row(page, 'משימה שהושלמה')).not.toBeVisible()

    await page.getByRole('tab', { name: /הכל/ }).click()
    await expect(row(page, 'משימה שהושלמה')).toBeVisible()
  })

  test('filter-by-status: the הושלמו segment excludes open work', async ({ page }) => {
    // The status Select became a segment: mutually exclusive, counted, and the
    // pile you are working from rather than a dropdown you have to remember.
    await page.getByRole('tab', { name: /הושלמו/ }).click()

    await expect(row(page, 'משימה שהושלמה')).toBeVisible()
    await expect(row(page, 'משימה ראשונה')).not.toBeVisible()
  })

  test('filter-standalone: the project facet can select "no project"', async ({ page }) => {
    // Was a Switch of its own - a third control for what is really one value
    // of the project facet.
    await page.getByRole('combobox', { name: 'פרויקט' }).click()
    await page.getByRole('option', { name: 'ללא פרויקט' }).click()

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

  test('edit: a task row navigates to its own page, where it can be edited', async ({ page }) => {
    // The row navigates now, like every other list in the app. A task has an
    // address of its own, which is what /tasks/[id] exists to give it.
    await getTableRow(page, 'משימה עצמאית').locator('a').first().click()
    await expect(page).toHaveURL(/\/tasks\/\w+/)
    await expect(page.getByRole('heading', { name: 'משימה עצמאית' })).toBeVisible()

    try {
      await page.getByRole('button', { name: 'פעולות נוספות' }).click()
      await page.getByRole('menuitem', { name: 'עריכה' }).click()
      await expect(page.locator('[role="dialog"]')).toBeVisible()

      await page.locator('[role="dialog"] input[name="title"]').fill('משימה עצמאית מעודכנת')
      await page.locator('[role="dialog"] button[type="submit"]').click()
      await expectToastSuccess(page, 'משימה עודכנה בהצלחה')

      await expect(page.getByRole('heading', { name: 'משימה עצמאית מעודכנת' })).toBeVisible()
    } finally {
      // Restore pass or fail: list-shows-data and filter-standalone both name
      // this task, so leaving it renamed breaks them rather than this test.
      await page.getByRole('button', { name: 'פעולות נוספות' }).click()
      await page.getByRole('menuitem', { name: 'עריכה' }).click()
      await page.locator('[role="dialog"] input[name="title"]').fill('משימה עצמאית')
      await page.locator('[role="dialog"] button[type="submit"]').click()
      await expectToastSuccess(page, 'משימה עודכנה בהצלחה')
    }
  })

  test('inline-completion: completing a task moves it out of the open pile', async ({ page }) => {
    try {
      const taskRow = getTableRow(page, 'משימה ראשונה')
      await taskRow.getByRole('checkbox', { name: 'סמן כהושלם' }).click()

      // It does not just change colour - it leaves. The segment is the pile you
      // are working from, and a finished task is not in it.
      await expect(row(page, 'משימה ראשונה')).not.toBeVisible()

      await page.getByRole('tab', { name: /הושלמו/ }).click()
      const done = getTableRow(page, 'משימה ראשונה')
      await expect(rowStatusPill(done, 'הושלם')).toBeVisible()
    } finally {
      // Restore, pass or fail: filter-by-status asserts this task is not in the
      // הושלמו pile, so leaving it completed breaks a later test rather than
      // this one.
      await page.getByRole('tab', { name: /הכל/ }).click()
      const anywhere = getTableRow(page, 'משימה ראשונה')
      await anywhere.getByRole('checkbox', { name: 'סמן כלא הושלם' }).click()
      await expect(rowStatusPill(anywhere, 'לביצוע')).toBeVisible()
    }
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
