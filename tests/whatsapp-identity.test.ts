import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = {
  contact: { findFirst: vi.fn(), findMany: vi.fn() },
}

vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }))

const { findContactByPhone, findContactByExactPhone, isOwnerPhone, normalizePhone } = await import(
  '@/lib/services/whatsapp-identity'
)

describe('normalizePhone', () => {
  it('reduces any Israeli format to local digits', () => {
    expect(normalizePhone('+972-50-123-4567')).toBe('0501234567')
    expect(normalizePhone('972501234567')).toBe('0501234567')
    expect(normalizePhone('050 123 4567')).toBe('0501234567')
  })
})

describe('findContactByPhone', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.contact.findFirst.mockResolvedValue(null)
  })

  it('matches on the normalized number or its last seven digits', async () => {
    await findContactByPhone('052-123 4567')

    expect(prismaMock.contact.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [{ phone: '0521234567' }, { phone: { endsWith: '1234567' } }],
      },
      select: { id: true, name: true, clientId: true },
    })
  })

  it('refuses to match on a number too short to identify anyone', async () => {
    await expect(findContactByPhone('')).resolves.toBeNull()
    await expect(findContactByPhone('12345')).resolves.toBeNull()

    expect(prismaMock.contact.findFirst).not.toHaveBeenCalled()
  })

  it('returns the matched contact', async () => {
    prismaMock.contact.findFirst.mockResolvedValue({
      id: 'contact-1',
      name: 'דנה',
      clientId: 'client-1',
    })

    await expect(findContactByPhone('0521234567')).resolves.toEqual({
      id: 'contact-1',
      name: 'דנה',
      clientId: 'client-1',
    })
  })
})

describe('findContactByExactPhone', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.contact.findMany.mockResolvedValue([])
  })

  it('accepts a stored number written in a different format', async () => {
    prismaMock.contact.findMany.mockResolvedValue([
      { id: 'contact-1', name: 'דנה', clientId: 'client-1', phone: '052-123-4567' },
    ])

    await expect(findContactByExactPhone('0521234567')).resolves.toEqual({
      id: 'contact-1',
      name: 'דנה',
      clientId: 'client-1',
    })
  })

  it('rejects a candidate that only shares the last seven digits', async () => {
    prismaMock.contact.findMany.mockResolvedValue([
      { id: 'contact-1', name: 'דנה', clientId: 'client-1', phone: '0521234567' },
    ])

    await expect(findContactByExactPhone('0541234567')).resolves.toBeNull()
  })

  it('picks the exact match out of several suffix candidates', async () => {
    prismaMock.contact.findMany.mockResolvedValue([
      { id: 'contact-1', name: 'דנה', clientId: 'client-1', phone: '0521234567' },
      { id: 'contact-2', name: 'יוסי', clientId: 'client-2', phone: '+972541234567' },
    ])

    await expect(findContactByExactPhone('054-123-4567')).resolves.toMatchObject({
      id: 'contact-2',
    })
  })

  it('refuses to match on a number too short to identify anyone', async () => {
    await expect(findContactByExactPhone('12345')).resolves.toBeNull()

    expect(prismaMock.contact.findMany).not.toHaveBeenCalled()
  })
})

describe('isOwnerPhone', () => {
  beforeEach(() => {
    process.env.OWNER_PHONE = '972501111111'
  })

  it('matches the owner across international and local formats', () => {
    expect(isOwnerPhone('0501111111')).toBe(true)
    expect(isOwnerPhone('972501111111')).toBe(true)
    expect(isOwnerPhone('+972-50-111-1111')).toBe(true)
  })

  it('rejects any other number', () => {
    expect(isOwnerPhone('0509999999')).toBe(false)
    expect(isOwnerPhone('')).toBe(false)
  })

  it('fails closed when the owner phone is not configured', () => {
    delete process.env.OWNER_PHONE

    expect(isOwnerPhone('0501111111')).toBe(false)
  })
})
