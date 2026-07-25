import { test, expect } from '@playwright/test'
import { BASE_URL } from './base-url'

// Authenticated context comes from the project's storageState.
async function createClient(request: import('@playwright/test').APIRequestContext, name: string) {
  const res = await request.post('/api/clients', { data: { name } })
  expect(res.ok()).toBeTruthy()
  return res.json()
}

test.describe('client form token', () => {
  test('generates and rotates a form token', async ({ request }) => {
    const client = await createClient(request, `טסט טוקן ${Date.now()}`)

    const first = await request.post(`/api/clients/${client.id}/form-token`)
    expect(first.status()).toBe(200)
    const { formToken: token1 } = await first.json()
    expect(token1).toBeTruthy()

    const second = await request.post(`/api/clients/${client.id}/form-token`)
    const { formToken: token2 } = await second.json()
    expect(token2).toBeTruthy()
    expect(token2).not.toBe(token1)
  })
})

test.describe('client form link UI', () => {
  test('shows and copies the form link', async ({ page, request }) => {
    const client = await createClient(request, `טסט קישור ${Date.now()}`)

    await page.goto(`/clients/${client.id}`)
    await expect(page.getByText('טופס פניות')).toBeVisible()
    await page.getByRole('button', { name: 'צור קישור' }).click()
    await expect(page.locator('code', { hasText: '/r/' })).toBeVisible()
    const codeText = await page.locator('code', { hasText: '/r/' }).innerText()
    expect(codeText).toMatch(/^https?:\/\/.+\/r\/[0-9a-f-]{36}$/)
  })
})

test.describe('public request submission', () => {
  async function mintToken(request: import('@playwright/test').APIRequestContext) {
    const client = await createClient(request, `טסט פנייה ${Date.now()}`)
    const res = await request.post(`/api/clients/${client.id}/form-token`)
    const { formToken } = await res.json()
    return { clientId: client.id, formToken }
  }

  test('creates a PENDING_REVIEW FORM request for a valid token', async ({ request, playwright }) => {
    const { formToken } = await mintToken(request)
    const title = `תקלה בטופס ${Date.now()}`

    const pub = await playwright.request.newContext({ baseURL: BASE_URL })
    const res = await pub.post('/api/public/requests', {
      multipart: { token: formToken, type: 'BUG', title, description: 'הכפתור לא עובד' },
    })
    expect(res.status()).toBe(201)
    const body = await res.json()
    expect(body.success).toBe(true)
    await pub.dispose()

    // Owner sees it in the pending-review queue with source FORM.
    const list = await request.get('/api/requests?pendingReview=true')
    const requests = await list.json()
    const found = requests.find((r: { title: string }) => r.title === title)
    expect(found).toBeTruthy()
    expect(found.source).toBe('FORM')
    expect(found.status).toBe('PENDING_REVIEW')
  })

  test('rejects an unknown token with 404', async ({ playwright }) => {
    const pub = await playwright.request.newContext({ baseURL: BASE_URL })
    const res = await pub.post('/api/public/requests', {
      multipart: { token: 'does-not-exist', title: 'x', description: 'y' },
    })
    expect(res.status()).toBe(404)
    await pub.dispose()
  })

  test('rejects a disallowed file type with 400', async ({ request, playwright }) => {
    const { formToken } = await mintToken(request)
    const pub = await playwright.request.newContext({ baseURL: BASE_URL })
    const res = await pub.post('/api/public/requests', {
      multipart: {
        token: formToken,
        title: 'עם קובץ',
        description: 'בדיקה',
        file: { name: 'bad.txt', mimeType: 'text/plain', buffer: Buffer.from('nope') },
      },
    })
    expect(res.status()).toBe(400)
    await pub.dispose()
  })

  test('honeypot submissions are silently dropped', async ({ request, playwright }) => {
    const { formToken } = await mintToken(request)
    const title = `ספאם ${Date.now()}`
    const pub = await playwright.request.newContext({ baseURL: BASE_URL })
    const res = await pub.post('/api/public/requests', {
      multipart: { token: formToken, title, description: 'spam', website: 'http://spam' },
    })
    expect(res.status()).toBe(201)
    await pub.dispose()

    const list = await request.get('/api/requests?pendingReview=true')
    const requests = await list.json()
    expect(requests.find((r: { title: string }) => r.title === title)).toBeUndefined()
  })
})

test.describe('requests dashboard shows form tickets', () => {
  test('form ticket appears with a form badge in the review queue', async ({ page, request, playwright }) => {
    const client = await createClient(request, `טסט לוח ${Date.now()}`)
    const tokRes = await request.post(`/api/clients/${client.id}/form-token`)
    const { formToken } = await tokRes.json()
    const title = `פנייה ללוח ${Date.now()}`

    const pub = await playwright.request.newContext({ baseURL: BASE_URL })
    await pub.post('/api/public/requests', {
      multipart: { token: formToken, type: 'BUG', title, description: 'בדיקה' },
    })
    await pub.dispose()

    await page.goto('/requests')
    const row = page.locator('tr', { hasText: title }).first()
    await expect(row).toBeVisible()
    await expect(row.getByText('טופס')).toBeVisible()
  })
})

test.describe('public form page', () => {
  test('renders not-found for an unknown token', async ({ page }) => {
    await page.goto('/r/nope-not-real')
    await expect(page.getByText('הקישור אינו תקין')).toBeVisible()
  })

  test('submits the form and shows a thank-you', async ({ page, request }) => {
    const client = await createClient(request, `טסט עמוד ${Date.now()}`)
    const tokRes = await request.post(`/api/clients/${client.id}/form-token`)
    const { formToken } = await tokRes.json()

    await page.goto(`/r/${formToken}`)
    await expect(page.getByRole('heading', { name: /דיווח תקלה/ })).toBeVisible()

    await page.locator('input[name="title"]').fill(`תקלה מהדפדפן ${Date.now()}`)
    await page.locator('textarea[name="description"]').fill('משהו לא עובד')
    await page.getByRole('button', { name: 'שליחה' }).click()

    await expect(page.getByText('תודה!')).toBeVisible()
  })
})
