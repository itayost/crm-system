// lib/db/prisma.ts
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

/**
 * Prisma 7 no longer opens its own connection. The schema carries no url, so
 * the client takes a driver adapter and that adapter owns the pool.
 *
 * The URL is read here rather than from prisma.config.ts, which is CLI-only:
 * it configures migrate and generate, not the running app.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    // Fail at startup rather than on the first query inside a request.
    throw new Error('DATABASE_URL is not set; the database client cannot start.')
  }

  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
