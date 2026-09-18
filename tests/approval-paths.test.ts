import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The dashboard action route is the only way left to approve or dismiss a
 * request - the owner agent's review tool that used to reach the same
 * operation through fuzzy title matching is gone.
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

vi.mock('@/lib/services/requests.service', () => ({ RequestsService: requestsServiceMock }))

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
})
