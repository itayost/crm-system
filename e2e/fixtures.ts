import { Page, Locator, expect } from '@playwright/test'

// --- Toast Assertions (react-hot-toast) ---

export async function expectToastSuccess(page: Page, text: string) {
  const toast = page.locator('[role="status"]').filter({ hasText: text })
  await expect(toast).toBeVisible({ timeout: 5000 })
}

export async function expectToastError(page: Page, text: string) {
  const toast = page.locator('[role="status"]').filter({ hasText: text })
  await expect(toast).toBeVisible({ timeout: 5000 })
}

// --- Rows ---

/**
 * A data row, by any text it contains.
 *
 * Bound to `data-testid="row"`, not to `tr`. Two reasons, and the second is the
 * one that matters: `tr` also matched the header row, and a list that renders as
 * cards on mobile has no `tr` at all. The row primitive emits the same testid
 * for both the desktop `<tr>` and the mobile `<article>`, so every assertion
 * below survives the table-to-card conversion untouched.
 */
export function row(page: Page, containsText: string): Locator {
  return page.locator(ROW).filter({ hasText: containsText })
}

/** A data row addressed by entity id - stable against copy changes. */
export function rowById(page: Page, id: string): Locator {
  return page.locator(`${ROW}[data-row-id="${id}"]`)
}

/**
 * `:visible` is load-bearing, not defensive.
 *
 * DataTable renders both trees and lets CSS pick one, because choosing at
 * runtime would need a media query the server cannot evaluate - so a row is
 * always in the DOM twice, once as a `<tr>` and once as an `<article>`. Without
 * this filter every row query matches both and trips strict mode. With it, a
 * row means the row the user can actually see, at whichever viewport the test
 * is running.
 */
const ROW = '[data-testid="row"]:visible'

/**
 * One field of a row, by column name.
 *
 * Replaces `row.locator('td').nth(1)` and `.last()`. Those encode the column
 * layout as a magic number, so appending a column silently retargets the
 * assertion at the wrong data.
 */
export function rowCell(rowLocator: Locator, col: string): Locator {
  return rowLocator.locator(`[data-col="${col}"]`)
}

/** @deprecated Use `row`. Kept so existing call sites keep reading naturally. */
export const getTableRow = row

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

/** The same chip, scoped to one row. */
export function rowStatusPill(rowLocator: Locator, text: string): Locator {
  return rowLocator.locator('[data-slot="status-pill"]').filter({ hasText: text })
}

// --- Dashboard ---

/** A named dashboard section card. */
export function section(page: Page, key: string): Locator {
  return page.locator(`[data-section="${key}"]`)
}

// --- Shell ---

export function sidebarLink(page: Page, name: string): Locator {
  return page.locator('nav[aria-label="ניווט ראשי"] a').filter({ hasText: name })
}

/**
 * The active nav link, read semantically.
 *
 * The previous assertion was `toHaveClass(/text-link/)`, which had already
 * broken once when design tokens replaced `text-blue-600`. `aria-current` is
 * what the attribute means, and it survives any restyle.
 */
export function activeSidebarLink(page: Page): Locator {
  return page.locator('nav a[aria-current="page"]')
}

export function userMenuTrigger(page: Page): Locator {
  return page.getByRole('button', { name: 'תפריט משתמש' })
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

export async function selectOption(page: Page, triggerText: RegExp, optionText: string) {
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
