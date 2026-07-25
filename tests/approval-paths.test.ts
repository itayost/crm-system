import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Both ways Itay can approve a ticket must land on the same operation, or one of
 * them silently stops creating tasks and notifying clients.
 */

const requestsServiceMock = {
  approve: vi.fn(),
  dismiss: vi.fn(),
  getAll: vi.fn(),
  getById: vi.fn(),
  getByClient: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  createDrafts: vi.fn(),
}

const fuzzyMock = {
  fuzzyMatchRequest: vi.fn(),
  fuzzyMatchContact: vi.fn(),
  fuzzyMatchClient: vi.fn(),
  fuzzyMatchProject: vi.fn(),
  fuzzyMatchTask: vi.fn(),
}

vi.mock('@/lib/services/requests.service', () => ({ RequestsService: requestsServiceMock }))
vi.mock('@/lib/services/fuzzy-match', () => fuzzyMock)
vi.mock('@/lib/db/prisma', () => ({ prisma: {} }))
vi.mock('ai', () => ({ tool: <T>(definition: T) => definition }))

// The auth wrapper is not under test here: stand in for it with a fixed user.
vi.mock('@/lib/api/api-handler', () => ({
  withAuth:
    (handler: (req: Request, ctx: { params: Promise<{ id: string }>; userId: string }) => unknown) =>
    (req: Request, ctx: { params: Promise<{ id: string }> }) =>
      handler(req, { ...ctx, userId: 'user-1' }),
  createResponse: (data: unknown) => Response.json({ data }),
  errorResponse: (message: string, status: number) => Response.json({ error: message }, { status }),
}))

const { POST } = await import('@/app/api/requests/[id]/action/route')
const { createCrmTools } = await import('@/lib/services/whatsapp-tools')

/** The route only reads the JSON body; NextRequest's extras are irrelevant here. */
function actionRequest(action: string) {
  return new Request('http://localhost/api/requests/request-1/action', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action }),
  }) as unknown as Parameters<typeof POST>[0]
}

const params = Promise.resolve({ id: 'request-1' })

describe('approval paths', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requestsServiceMock.approve.mockResolvedValue({
      id: 'request-1',
      title: 'תיקון כפתור',
      status: 'OPEN',
      taskId: 'task-1',
    })
    requestsServiceMock.dismiss.mockResolvedValue({
      id: 'request-1',
      title: 'תיקון כפתור',
      status: 'DISMISSED',
    })
  })

  it('the dashboard action route approves through the shared operation', async () => {
    await POST(actionRequest('approve'), { params })

    expect(requestsServiceMock.approve).toHaveBeenCalledWith('user-1', 'request-1')
  })

  it('the dashboard action route dismisses through the shared operation', async () => {
    await POST(actionRequest('dismiss'), { params })

    expect(requestsServiceMock.dismiss).toHaveBeenCalledWith('user-1', 'request-1')
    expect(requestsServiceMock.approve).not.toHaveBeenCalled()
  })

  it("the owner agent's review tool approves through the same operation", async () => {
    fuzzyMock.fuzzyMatchRequest.mockResolvedValue({
      match: { id: 'request-1', title: 'תיקון כפתור' },
      matches: [],
      ambiguous: false,
    })

    const tools = createCrmTools('user-1') as unknown as Record<
      string,
      { execute: (input: unknown) => Promise<unknown> }
    >
    const result = await tools.reviewRequest.execute({
      titleQuery: 'כפתור',
      decision: 'approve',
    })

    expect(requestsServiceMock.approve).toHaveBeenCalledWith('user-1', 'request-1')
    expect(result).toMatchObject({ success: true })
  })
})
