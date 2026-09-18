/**
 * One-off export, taken immediately before ADR 0004's schema teardown drops
 * these tables. Everything here is unrecoverable afterwards: WhatsAppMessage
 * alone holds months of real client conversation indexed from the personal
 * session.
 *
 * Writes to .ai-export/, which is gitignored. Run with:
 *   npx tsx scripts/export-ai-tables.ts
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { prisma } from '../lib/db/prisma'

const OUT = '.ai-export'

async function main() {
  mkdirSync(OUT, { recursive: true })

  const tables = {
    whatsAppMessage: () => prisma.whatsAppMessage.findMany(),
    botConversation: () => prisma.botConversation.findMany(),
    supportConversation: () => prisma.supportConversation.findMany(),
    agentProjectConfig: () => prisma.agentProjectConfig.findMany(),
    productCard: () => prisma.productCard.findMany(),
  }

  for (const [name, read] of Object.entries(tables)) {
    const rows = await read()
    writeFileSync(`${OUT}/${name}.json`, JSON.stringify(rows, null, 2))
    console.log(`${name}: ${rows.length} rows`)
  }

  // profileHe gets its own human-readable file: it is the one thing a person
  // has to read and merge by hand, not a blob to archive.
  const clients = await prisma.client.findMany({
    where: { profileHe: { not: null } },
    select: { id: true, name: true, notes: true, profileHe: true },
    orderBy: { name: 'asc' },
  })

  const md = clients
    .map(
      (c) =>
        `# ${c.name}\n\n` +
        `<!-- clientId: ${c.id} -->\n\n` +
        `## הערות (current, owner-private)\n\n${c.notes ?? '(none)'}\n\n` +
        `## פרופיל (to merge, then delete)\n\n${c.profileHe}\n\n---\n`
    )
    .join('\n')

  writeFileSync(`${OUT}/profileHe.md`, md)
  console.log(`profileHe: ${clients.length} clients with a profile`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
