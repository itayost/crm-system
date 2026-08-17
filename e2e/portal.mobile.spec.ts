import { test, expect } from '@playwright/test'
import { BASE_URL } from './base-url'

/**
 * The portal at 390px, which is where it actually gets opened.
 *
 * A client reaches this from a WhatsApp link on a phone, to answer one
 * question. These are the things that only exist at that size: the identity
 * header (so a forwarded link says whose system it is), the footer's way back
 * to a human, and the decision pinned above the fold.
 */
const createdClientIds: string[] = []

async function mintPortal(request: import('@playwright/test').APIRequestContext) {
  const res = await request.post('/api/clients', { data: { name: `טסט פורטל ${Date.now()}` } })
  expect(res.ok()).toBeTruthy()
  const client = await res.json()
  createdClientIds.push(client.id)

  const tok = await request.post(`/api/clients/${client.id}/form-token`)
  const { formToken } = await tok.json()
  return { clientId: client.id, formToken }
}

test.afterEach(async ({ request }) => {
  while (createdClientIds.length) {
    await request.delete(`/api/clients/${createdClientIds.pop()!}`)
  }
})

test.describe('portal on a phone', () => {
  test('identifies whose system it is, and offers a way back to a human', async ({
    page,
    request,
  }) => {
    const { formToken } = await mintPortal(request)
    await page.goto(`/r/${formToken}`)

    // The wordmark, not the client's own name, is the page's identity.
    await expect(page.getByRole('banner')).toContainText('ItayOst')
    await expect(page.getByRole('contentinfo')).toContainText('הקישור אישי')

    // No horizontal scroll at 390px.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
  })

  test('the submit form is properly labelled', async ({ page, request }) => {
    const { formToken } = await mintPortal(request)
    await page.goto(`/r/${formToken}/requests/new`)

    // Every field reachable by its label - the old form had bare <label>
    // elements with no htmlFor, so none of these resolved.
    await expect(page.getByLabel('כותרת')).toBeVisible()
    await expect(page.getByLabel('תיאור')).toBeVisible()
    // The type is a radiogroup of chips now, not a <select>. The fieldset's
    // legend is what names it, and each chip is a real radio underneath.
    await expect(page.getByRole('group', { name: 'סוג הפנייה' })).toBeVisible()
    await expect(page.getByRole('radio', { name: 'תקלה' })).toBeChecked()
  })

  test('the home page answers before it asks', async ({ page, request }) => {
    const { formToken } = await mintPortal(request)
    await page.goto(`/r/${formToken}`)

    // A brand new client has nothing open, and the page should say so in a
    // sentence rather than showing three counters that all read zero.
    await expect(page.getByRole('heading', { level: 1 })).toContainText('הכול מטופל')

    // The form is not on this page any more.
    await expect(page.locator('textarea[name="description"]')).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'פנייה חדשה' }).first()).toBeVisible()
  })

  test('an invalid token still offers a way to reach us', async ({ page }) => {
    await page.goto('/r/nope-not-real')
    await expect(page.getByText('הקישור אינו תקין')).toBeVisible()
    await expect(page.getByRole('banner')).toContainText('ItayOst')
  })

  test('visual: portal home', async ({ page, request }) => {
    const { formToken } = await mintPortal(request)
    await page.goto(`/r/${formToken}`)
    await page.waitForLoadState('networkidle')

    // The snapshot name is static; the token in the URL is not, and must not
    // leak into a filename that gets committed.
    await expect(page).toHaveScreenshot('portal-home.png', { fullPage: true })
  })
})

// Referenced so the import is used even when BASE_URL is not needed directly.
void BASE_URL
