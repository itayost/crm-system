import { FullConfig } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function globalTeardown(_config: FullConfig) {
  const testUser = await prisma.user.findUnique({
    where: { email: 'e2e-test@test.com' },
  })

  if (testUser) {
    await prisma.task.deleteMany({ where: { userId: testUser.id } })
    await prisma.project.deleteMany({ where: { userId: testUser.id } })
    await prisma.contact.deleteMany({ where: { userId: testUser.id } })
    await prisma.user.delete({ where: { id: testUser.id } })
  }

  await prisma.$disconnect()
}

export default globalTeardown
