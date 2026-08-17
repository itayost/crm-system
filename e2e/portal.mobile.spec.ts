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
const createdProjectIds: string[] = []

async function mintPortal(request: import('@playwright/test').APIRequestContext) {
  const res = await request.post('/api/clients', { data: { name: `טסט פורטל ${Date.now()}` } })
  expect(res.ok()).toBeTruthy()
  const client = await res.json()
  createdClientIds.push(client.id)

  const tok = await request.post(`/api/clients/${client.id}/form-token`)
  const { formToken } = await tok.json()
  return { clientId: client.id, formToken }
}

/**
 * Teardown has to run inwards-out, because nothing here cascades by accident.
 *
 * ClientsService.delete refuses a client that still has projects, and
 * ProjectsService.delete refuses a project that still has tasks - both on
 * purpose, since they are the guards that stop a mis-click destroying a real
 * client's history. The consequence for a test is that deleting only the client
 * silently fails and leaves the whole tree behind, and this suite runs against
 * the same database as production.
 *
 * So: tasks, then requests, then projects (phases cascade with them), then the
 * client.
 */
test.afterEach(async ({ request }) => {
  while (createdProjectIds.length) {
    const projectId = createdProjectIds.pop()!

    const tasks = await request.get(`/api/tasks?projectId=${projectId}`)
    if (tasks.ok()) {
      for (const task of await tasks.json()) {
        await request.delete(`/api/tasks/${task.id}`)
      }
    }

    const requests = await request.get(`/api/requests?projectId=${projectId}`)
    if (requests.ok()) {
      const body = await requests.json()
      for (const item of Array.isArray(body) ? body : (body.requests ?? [])) {
        await request.delete(`/api/requests/${item.id}`)
      }
    }

    await request.delete(`/api/projects/${projectId}`)
  }

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

  /**
   * The one thing this surface exists for.
   *
   * A client opens the portal from a WhatsApp message that says "I prepared a
   * quote" and arrives to answer exactly one question, one-handed, on a phone.
   * So the assertions here are about reach, not about markup: the price is
   * above the fold, and so are the two buttons.
   */
  test('a quote can be answered without scrolling for the buttons', async ({ page, request }) => {
    const { clientId, formToken } = await mintPortal(request)

    const proj = await request.post('/api/projects', {
      data: { name: `פרויקט פורטל ${Date.now()}`, type: 'WEBSITE', priority: 'MEDIUM', clientId },
    })
    expect(proj.ok()).toBeTruthy()
    const project = await proj.json()
    createdProjectIds.push(project.id)

    const req = await request.post('/api/requests', {
      data: {
        title: 'עמוד הזמנת שולחן',
        description: 'עמוד ייעודי להזמנת שולחן.',
        type: 'REQUEST',
        priority: 'MEDIUM',
        clientId,
        projectId: project.id,
      },
    })
    expect(req.ok()).toBeTruthy()
    const created = await req.json()

    // sendQuote refuses a chargeable request with no project and no form token,
    // which is exactly why both were minted above.
    const quoted = await request.post(`/api/requests/${created.id}/quote`, {
      data: { billingKind: 'BILLABLE', quotedPrice: 1850, estimateHours: 6 },
    })
    expect(quoted.ok()).toBeTruthy()

    await page.goto(`/r/${formToken}/${created.id}`)

    // The price leads the page, in the display face.
    await expect(page.getByText('1,850 ₪')).toBeVisible()
    await expect(page.getByText('לא מתחילים לעבוד על זה לפני שתאשרו.')).toBeVisible()

    const approve = page.getByRole('button', { name: 'אישור ההצעה' })
    const decline = page.getByRole('button', { name: 'לא עכשיו' })

    // Both reachable in the first viewport, before any scrolling. This is the
    // assertion that would have caught the old layout, where the decision sat
    // below the description, the details list and the attachments.
    const fold = page.viewportSize()!.height
    for (const control of [approve, decline]) {
      const box = await control.boundingBox()
      expect(box, 'the decision must render').not.toBeNull()
      expect(box!.y + box!.height).toBeLessThanOrEqual(fold)
      // And large enough to hit with a thumb.
      expect(box!.height).toBeGreaterThanOrEqual(44)
    }

    // Declining opens a note rather than firing, because "no" is usually
    // "not at that price".
    await decline.click()
    await expect(page.getByLabel('מה לא מתאים? (לא חובה)')).toBeVisible()
    await page.getByRole('button', { name: 'ביטול' }).click()

    await approve.click()
    await expect(page.getByText('אושרה על ידך')).toBeVisible()
    // And the timeline now says it in the second person.
    await expect(page.getByText('אישרת את ההצעה')).toBeVisible()
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
