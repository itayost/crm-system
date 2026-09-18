import { beforeEach, describe, expect, it, vi } from 'vitest'

const recordConversation = vi.fn()

vi.mock('@/lib/services/contacts.service', () => ({
  ContactsService: { recordConversation },
}))

vi.mock('@/lib/api/api-handler', () => ({
  withAuth: (handler: unknown) => handler,
  createResponse: (data: unknown) => ({ data }),
}))

const { POST } = await import('@/app/api/contacts/[id]/spoke/route')

describe('POST /api/contacts/[id]/spoke', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    recordConversation.mockResolvedValue({ id: 'contact-1' })
  })

  it('forwards the authenticated user, the id and the parsed body', async () => {
    const req = { json: async () => ({ nextActionNote: 'לחזור אליו' }) } as Request

    await (POST as unknown as (r: Request, c: unknown) => Promise<unknown>)(req, {
      params: Promise.resolve({ id: 'contact-1' }),
      userId: 'user-1',
    })

    expect(recordConversation).toHaveBeenCalledWith('user-1', 'contact-1', {
      nextActionNote: 'לחזור אליו',
    })
  })

  it('rejects a body that tries to set lastContactedAt', async () => {
    const req = {
      json: async () => ({ lastContactedAt: '2020-01-01T00:00:00.000Z' }),
    } as Request

    await (POST as unknown as (r: Request, c: unknown) => Promise<unknown>)(req, {
      params: Promise.resolve({ id: 'contact-1' }),
      userId: 'user-1',
    })

    expect(recordConversation).toHaveBeenCalledWith('user-1', 'contact-1', {})
  })
})
