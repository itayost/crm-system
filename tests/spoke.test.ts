import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * דיברתי is the only writer of lastContactedAt once the WhatsApp webhooks are
 * gone. today.service reads that field for the quiet-leads count, so a lead
 * reached by phone has to be able to say so.
 */

const prismaMock = {
  contact: { findFirst: vi.fn(), update: vi.fn() },
}

vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }))

const { ContactsService } = await import('@/lib/services/contacts.service')

describe('recordConversation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.contact.findFirst.mockResolvedValue({ id: 'contact-1' })
    prismaMock.contact.update.mockResolvedValue({ id: 'contact-1' })
  })

  it('stamps lastContactedAt with the server clock, not a caller value', async () => {
    const before = Date.now()
    await ContactsService.recordConversation('user-1', 'contact-1', {})
    const after = Date.now()

    const stamped = prismaMock.contact.update.mock.calls[0][0].data.lastContactedAt as Date
    expect(stamped.getTime()).toBeGreaterThanOrEqual(before)
    expect(stamped.getTime()).toBeLessThanOrEqual(after)
  })

  it('scopes the lookup by userId', async () => {
    await ContactsService.recordConversation('user-1', 'contact-1', {})

    expect(prismaMock.contact.findFirst).toHaveBeenCalledWith({
      where: { id: 'contact-1', userId: 'user-1' },
    })
  })

  it('sets the next action alongside the stamp', async () => {
    await ContactsService.recordConversation('user-1', 'contact-1', {
      nextActionAt: '2026-10-01T00:00:00.000Z',
      nextActionNote: 'לשלוח הצעת מחיר',
    })

    expect(prismaMock.contact.update.mock.calls[0][0].data).toMatchObject({
      nextActionAt: new Date('2026-10-01T00:00:00.000Z'),
      nextActionNote: 'לשלוח הצעת מחיר',
    })
  })

  it('clears the next action when given null', async () => {
    await ContactsService.recordConversation('user-1', 'contact-1', {
      nextActionAt: null,
      nextActionNote: null,
    })

    expect(prismaMock.contact.update.mock.calls[0][0].data).toMatchObject({
      nextActionAt: null,
      nextActionNote: null,
    })
  })

  it('leaves the next action untouched when the field is absent', async () => {
    await ContactsService.recordConversation('user-1', 'contact-1', {})

    const data = prismaMock.contact.update.mock.calls[0][0].data
    expect(data).not.toHaveProperty('nextActionAt')
    expect(data).not.toHaveProperty('nextActionNote')
  })

  it('throws a Hebrew error for a contact the user does not own', async () => {
    prismaMock.contact.findFirst.mockResolvedValue(null)

    await expect(
      ContactsService.recordConversation('user-1', 'someone-elses', {})
    ).rejects.toThrow('איש קשר לא נמצא')
    expect(prismaMock.contact.update).not.toHaveBeenCalled()
  })
})
