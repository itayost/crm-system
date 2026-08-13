import { beforeEach, describe, expect, it, vi } from 'vitest'

const sweepMock = vi.fn()

vi.mock('@/lib/services/support-followups.service', () => ({
  SupportFollowupsService: { sweep: sweepMock },
}))

const { GET } = await import('@/app/api/cron/support-followups/route')

const CRON_SECRET = 'cron-secret'

function cronRequest(secret: string | null) {
  const headers: Record<string, string> = {}
  if (secret !== null) headers.authorization = `Bearer ${secret}`

  return new Request('http://localhost/api/cron/support-followups', {
    headers,
  }) as unknown as Parameters<typeof GET>[0]
}

describe('support follow-ups cron endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = CRON_SECRET
    delete process.env.WHATSAPP_BOT_PAUSED
    sweepMock.mockResolvedValue({
      considered: 2,
      firstReminders: 1,
      secondReminders: 0,
      filedUnconfirmed: 1,
    })
  })

  it('runs the sweep for an authorized call', async () => {
    const response = await GET(cronRequest(CRON_SECRET))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ ok: true, filedUnconfirmed: 1 })
  })

  // Reminders are the bot writing to a client on its own initiative, which is
  // exactly what a pause is meant to stop.
  it('sends no reminders while the bot is paused', async () => {
    process.env.WHATSAPP_BOT_PAUSED = '1'

    const response = await GET(cronRequest(CRON_SECRET))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true, paused: true })
    expect(sweepMock).not.toHaveBeenCalled()
  })

  it('rejects a wrong secret', async () => {
    const response = await GET(cronRequest('nope'))

    expect(response.status).toBe(401)
    expect(sweepMock).not.toHaveBeenCalled()
  })

  it('rejects a call with no authorization at all', async () => {
    const response = await GET(cronRequest(null))

    expect(response.status).toBe(401)
    expect(sweepMock).not.toHaveBeenCalled()
  })

  it('fails closed when the secret is not configured', async () => {
    delete process.env.CRON_SECRET

    const response = await GET(cronRequest(CRON_SECRET))

    expect(response.status).toBe(401)
    expect(sweepMock).not.toHaveBeenCalled()
  })

  it('reports a sweep failure without leaking details', async () => {
    sweepMock.mockRejectedValue(new Error('db down'))

    const response = await GET(cronRequest(CRON_SECRET))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Sweep failed' })
  })
})
