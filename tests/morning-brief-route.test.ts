import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The route, not the brief's content — that lives in
 * morning-brief-next-actions.test.ts. What this file guards is the defect
 * Task 4 fixed: the cron is the one caller that reads notifyOwner's returned
 * boolean, and it must generate the brief before attempting delivery, not
 * bail out early the way the old getOwnerChatId() guard did.
 */

const prismaMock = {
  user: { findFirst: vi.fn() },
}

const generateBrief = vi.fn()
const notifyOwner = vi.fn()

vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/services/morning-brief.service', () => ({
  MorningBriefService: { generateBrief: (...a: unknown[]) => generateBrief(...a) },
}))
vi.mock('@/lib/services/owner-line', () => ({
  notifyOwner: (...a: unknown[]) => notifyOwner(...a),
}))

const { GET } = await import('@/app/api/cron/morning-brief/route')

const CRON_SECRET = 'cron-secret'

function cronRequest(secret: string | null) {
  const headers: Record<string, string> = {}
  if (secret !== null) headers.authorization = `Bearer ${secret}`

  return new Request('http://localhost/api/cron/morning-brief', {
    headers,
  }) as unknown as Parameters<typeof GET>[0]
}

describe('morning brief cron endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = CRON_SECRET
    prismaMock.user.findFirst.mockResolvedValue({ id: 'owner-1' })
    generateBrief.mockResolvedValue('בוקר טוב, הנה הסיכום')
  })

  it('rejects an unauthorized call', async () => {
    const response = await GET(cronRequest('nope'))

    expect(response.status).toBe(401)
    expect(generateBrief).not.toHaveBeenCalled()
  })

  // The exact defect this task fixed: getOwnerChatId() had no OWNER_PHONE
  // fallback, so a fresh deployment 500'd. notifyOwner does have the
  // fallback; when it still cannot deliver, the cron must fail loudly so a
  // scheduled job nobody is watching stays visible to Vercel's monitoring.
  it('returns 500 when notifyOwner cannot deliver', async () => {
    notifyOwner.mockResolvedValue(false)

    const response = await GET(cronRequest(CRON_SECRET))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: 'Morning brief generated but could not be delivered',
    })
  })

  it('returns 200 with briefLength when notifyOwner delivers', async () => {
    notifyOwner.mockResolvedValue(true)

    const response = await GET(cronRequest(CRON_SECRET))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      briefLength: 'בוקר טוב, הנה הסיכום'.length,
    })
  })

  // Locks in the deliberate ordering change: the brief is generated before
  // delivery is even attempted. The old code checked for a chat id first and
  // bailed before generating anything, which is exactly what hid the missing
  // fallback. A future refactor that reintroduces that early return, or that
  // flips the delivered/undelivered branches, must fail this test.
  it('generates the brief even when delivery will fail', async () => {
    notifyOwner.mockResolvedValue(false)

    await GET(cronRequest(CRON_SECRET))

    expect(generateBrief).toHaveBeenCalledWith('owner-1')
    expect(notifyOwner).toHaveBeenCalledWith('בוקר טוב, הנה הסיכום', { about: 'the morning brief' })
  })

  it('returns 500 when there is no owner user', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null)

    const response = await GET(cronRequest(CRON_SECRET))

    expect(response.status).toBe(500)
    expect(generateBrief).not.toHaveBeenCalled()
  })
})
