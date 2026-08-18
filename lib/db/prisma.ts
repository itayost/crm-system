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
    throw new Error('DATABASE_URL is not set; the database client cannot start.')
  }

  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
}

/**
 * Built on first use, not on import.
 *
 * `next build` collects page data by importing every route module, and a build
 * machine has no DATABASE_URL. Constructing eagerly turned a missing variable
 * into a failed build rather than a failed request. The check above still
 * fires, just at the moment something actually reaches for the database.
 */
let client: PrismaClient | undefined

function getClient(): PrismaClient {
  // Module scope holds it in every environment; globalThis additionally holds
  // it in development, where HMR would otherwise mint a client per reload.
  client ??= globalForPrisma.prisma ?? createPrismaClient()
  if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = client
  return client
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const instance = getClient()
    const value = Reflect.get(instance, property)
    // Bind so `prisma.$transaction(...)` keeps its receiver.
    return typeof value === 'function' ? value.bind(instance) : value
  },
})
