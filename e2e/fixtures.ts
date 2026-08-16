import { Page, expect } from '@playwright/test'

// --- Toast Assertions (react-hot-toast) ---

export async function expectToastSuccess(page: Page, text: string) {
  const toast = page.locator('[role="status"]').filter({ hasText: text })
  await expect(toast).toBeVisible({ timeout: 5000 })
}

export async function expectToastError(page: Page, text: string) {
  const toast = page.locator('[role="status"]').filter({ hasText: text })
  await expect(toast).toBeVisible({ timeout: 5000 })
}

// --- Table Helpers ---

export function getTableRow(page: Page, containsText: string) {
  return page.locator('tr').filter({ hasText: containsText })
}

/**
 * A status chip, wherever it renders.
 *
 * `status-pill`, not `badge`. Every status in the product moved to StatusPill
 * in 877dcba (2026-08-03); Badge survives only for non-status chips and emits a
 * different data-slot. Six assertions across three specs kept looking for the
 * old one and had been failing ever since, because they were written against
 * the markup rather than through this helper. Route status assertions here so
 * the next redesign is one edit, not six.
 */
export function getStatusPill(page: Page, text: string) {
  return page.locator('[data-slot="status-pill"]').filter({ hasText: text })
}

// --- Formatting ---

export function formatILS(amount: number): string {
  return `${amount.toLocaleString()} ₪`
}

// --- Search / Debounce ---

export async function waitForSearchResults(page: Page) {
  await page.waitForTimeout(400)
  await page.waitForLoadState('networkidle')
}

// --- Form Helpers ---

async function selectOption(page: Page, triggerText: RegExp, optionText: string) {
  await page.locator('button[role="combobox"]').filter({ hasText: triggerText }).click()
  await page.locator('[role="option"]').filter({ hasText: optionText }).click()
}

export async function fillContactForm(page: Page, data: {
  name: string
  phone: string
  source?: string
  email?: string
  company?: string
  estimatedBudget?: string
  notes?: string
}) {
  await page.fill('input[name="name"]', data.name)
  await page.fill('input[name="phone"]', data.phone)

  if (data.source) {
    await selectOption(page, /אתר|טלפון|וואטסאפ|הפניה|אחר|בחר/, data.source)
  }

  if (data.email) {
    await page.fill('input[name="email"]', data.email)
  }

  if (data.company) {
    await page.fill('input[name="company"]', data.company)
  }

  if (data.estimatedBudget) {
    await page.fill('input[name="estimatedBudget"]', data.estimatedBudget)
  }

  if (data.notes) {
    await page.fill('textarea[name="notes"]', data.notes)
  }
}

export async function fillProjectForm(page: Page, data: {
  name: string
  type?: string
  contactName?: string
  advanceAmount?: string
  priority?: string
  description?: string
}) {
  await page.fill('input[name="name"]', data.name)

  if (data.type) {
    await selectOption(page, /דף נחיתה|אתר|חנות|אפליקציה|מערכת|ייעוץ|בחר/, data.type)
  }

  if (data.contactName) {
    await selectOption(page, /בחר לקוח|לקוח/, data.contactName)
  }

  if (data.advanceAmount) {
    await page.fill('input[name="advanceAmount"]', data.advanceAmount)
  }

  if (data.priority) {
    await selectOption(page, /נמוך|בינוני|גבוה|דחוף|בחר/, data.priority)
  }

  if (data.description) {
    await page.fill('textarea[name="description"]', data.description)
  }
}

export async function fillTaskForm(page: Page, data: {
  title: string
  priority?: string
  projectName?: string
  description?: string
}) {
  await page.fill('input[name="title"]', data.title)

  if (data.priority) {
    await selectOption(page, /נמוך|בינוני|גבוה|דחוף|בחר/, data.priority)
  }

  if (data.projectName) {
    await selectOption(page, /בחר פרויקט|פרויקט|ללא/, data.projectName)
  }

  if (data.description) {
    await page.fill('textarea[name="description"]', data.description)
  }
}

export async function submitForm(page: Page) {
  await page.click('button[type="submit"]')
}
