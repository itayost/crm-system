import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * A contact carries a clientId that the caller supplies. If that id is taken on
 * trust, a contact can be attached to another owner's business and then read
 * back together with that business's projects and tasks.
 */

const prismaMock = {
  contact: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
  client: { findFirst: vi.fn() },
}

vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/services/clients.service', () => ({
  ClientsService: { convertContactToClient: vi.fn() },
}))

const { ContactsService } = await import('@/lib/services/contacts.service')

const NEW_CONTACT = {
  name: 'דנה',
  phone: '0521234567',
  email: undefined,
  source: 'WHATSAPP' as const,
}

describe('contact client ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.contact.create.mockResolvedValue({ id: 'contact-1' })
    prismaMock.contact.update.mockResolvedValue({ id: 'contact-1' })
    prismaMock.contact.findFirst.mockResolvedValue({
      id: 'contact-1',
      clientId: null,
      convertedAt: null,
      client: null,
    })
  })

  it('accepts a client the owner owns', async () => {
    prismaMock.client.findFirst.mockResolvedValue({ id: 'client-1' })

    await ContactsService.create('user-1', { ...NEW_CONTACT, clientId: 'client-1' })

    expect(prismaMock.client.findFirst).toHaveBeenCalledWith({
      where: { id: 'client-1', userId: 'user-1' },
      select: { id: true },
    })
    expect(prismaMock.contact.create).toHaveBeenCalled()
  })

  it('refuses to create a contact against another owner client', async () => {
    prismaMock.client.findFirst.mockResolvedValue(null)

    await expect(
      ContactsService.create('user-1', { ...NEW_CONTACT, clientId: 'someone-elses-client' })
    ).rejects.toThrow('לקוח לא נמצא')

    expect(prismaMock.contact.create).not.toHaveBeenCalled()
  })

  it('refuses to move an existing contact onto another owner client', async () => {
    prismaMock.client.findFirst.mockResolvedValue(null)

    await expect(
      ContactsService.update('user-1', 'contact-1', {
        email: undefined,
        clientId: 'someone-elses-client',
      })
    ).rejects.toThrow('לקוח לא נמצא')

    expect(prismaMock.contact.update).not.toHaveBeenCalled()
  })

  it('does not query for a client when none was supplied', async () => {
    await ContactsService.create('user-1', NEW_CONTACT)

    expect(prismaMock.client.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.contact.create).toHaveBeenCalled()
  })
})
