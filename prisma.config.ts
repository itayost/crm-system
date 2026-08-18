import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

/**
 * Prisma 7 moved connection URLs out of schema.prisma. This file is the CLI's
 * half of that split: migrate, introspect and generate read the URL from here.
 * The runtime half is lib/db/prisma.ts, which now hands the client a driver
 * adapter because the client no longer opens a connection of its own.
 *
 * `directUrl` is gone in 7. Prisma opens the direct connection for migrations
 * itself, so DATABASE_URL is the only URL configured now and DIRECT_URL is no
 * longer read anywhere.
 *
 * The datasource is declared only when the variable exists. Declaring it
 * unconditionally makes `prisma generate` throw without DATABASE_URL, which
 * would break `npm install` on a fresh clone: postinstall generates the client
 * before anyone has written a .env.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: process.env.DATABASE_URL ? { url: env('DATABASE_URL') } : undefined,
})
