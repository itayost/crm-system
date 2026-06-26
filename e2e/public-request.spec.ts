import { test, expect } from '@playwright/test'

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
  })
})
