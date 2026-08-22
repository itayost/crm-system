import { loadEnvConfig } from '@next/env'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

// Playwright's Node runner loads no env files, and Prisma 7 reads
// DATABASE_URL from the process rather than from the schema the way 6 did.
// `@next/env` ships with Next and applies the same files in the same order the
// app itself uses, so the suite cannot end up pointed at a different database
// than the server under test.
loadEnvConfig(process.cwd())

/**
 * The E2E suite's own database client.
 *
 * It cannot reuse `lib/db/prisma.ts`: setup and teardown run under Playwright's
 * Node runner, outside Next, and nothing there resolves the `@/` alias. So the
 * adapter is constructed here instead - but in one place, because it was two.
 *
 * Prisma 7 refuses a bare `new PrismaClient()`; the schema carries no url, so
 * the client needs a driver adapter and that adapter owns the pool. Both files
 * still constructed one bare after the Prisma 7 upgrade, which took the whole
 * E2E suite down without typecheck, lint or build noticing - none of them run it.
 */
const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL is not set; the E2E suite cannot reach the database.')
}

export const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
