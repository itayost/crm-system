/**
 * Data Migration Script: Old Schema -> New Schema
 *
 * Run this script BEFORE `npm run db:push` to preserve existing data.
 * It reads from old tables using raw SQL and writes to the new Contact table.
 *
 * Usage: npx ts-node scripts/migrate-data.ts
 *
 * Status mappings:
 *   Lead.CONVERTED -> Contact.CLIENT (sets convertedAt)
 *   Lead.LOST -> Contact.INACTIVE
 *   Lead.NEW/CONTACTED/QUOTED/NEGOTIATING -> same status
 *   Client -> Contact.CLIENT (isVip = true if type was VIP)
 *   Task.WAITING_APPROVAL -> Task.IN_PROGRESS
 *
 * For a fresh start, skip this script and just run `npm run db:push`.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface OldLead {
  id: string
  name: string
  email: string | null
  phone: string
  company: string | null
  source: string
  status: string
  projectType: string | null
  estimatedBudget: number | null
  notes: string | null
  userId: string
  convertedToClientId: string | null
  convertedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

interface OldClient {
  id: string
  name: string
  email: string
  phone: string
  company: string | null
  address: string | null
  taxId: string | null
  type: string
  status: string
  notes: string | null
  userId: string
  createdAt: Date
  updatedAt: Date
}

interface OldProject {
  id: string
  name: string
  description: string | null
  type: string
  status: string
  priority: string
  startDate: Date | null
  deadline: Date | null
  completedAt: Date | null
  budget: number | null
  clientId: string
  userId: string
  createdAt: Date
  updatedAt: Date
}

interface OldTask {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  dueDate: Date | null
  completedAt: Date | null
  projectId: string
  userId: string
  createdAt: Date
  updatedAt: Date
}

function mapLeadStatus(status: string): string {
  switch (status) {
    case 'CONVERTED':
      return 'CLIENT'
    case 'LOST':
      return 'INACTIVE'
    default:
      return status
  }
}

function mapTaskStatus(status: string): string {
  if (status === 'WAITING_APPROVAL') {
    return 'IN_PROGRESS'
  }
  return status
}

async function migrate() {
  console.log('Starting data migration...\n')

  // Track client ID -> contact ID mapping for project FK updates
  const clientToContactMap = new Map<string, string>()
  // Track which converted leads map to which client
  const convertedLeadClientIds = new Set<string>()

  // Step 1: Read all leads
  const leads = await prisma.$queryRaw<OldLead[]>`SELECT * FROM "Lead" ORDER BY "createdAt" ASC`
  console.log(`Found ${leads.length} leads`)

  // Identify converted leads to avoid duplicating with their client records
  for (const lead of leads) {
    if (lead.convertedToClientId) {
      convertedLeadClientIds.add(lead.convertedToClientId)
    }
  }

  // Step 2: Read all clients
  const clients = await prisma.$queryRaw<OldClient[]>`SELECT * FROM "Client" ORDER BY "createdAt" ASC`
  console.log(`Found ${clients.length} clients`)

  // Step 3: Insert clients as contacts first (so we can map IDs for projects)
  for (const client of clients) {
    // Find if this client was converted from a lead
    const convertedLead = leads.find((l) => l.convertedToClientId === client.id)

    await prisma.$executeRaw`
      INSERT INTO "Contact" (
        "id", "name", "email", "phone", "company", "status", "source",
        "estimatedBudget", "projectType", "isVip", "address", "taxId",
        "notes", "convertedAt", "userId", "createdAt", "updatedAt"
      ) VALUES (
        ${client.id},
        ${client.name},
        ${client.email},
        ${client.phone},
        ${client.company},
        'CLIENT',
        ${convertedLead?.source ?? 'OTHER'},
        ${convertedLead?.estimatedBudget ?? null},
        ${convertedLead?.projectType ?? null},
        ${client.type === 'VIP'},
        ${client.address},
        ${client.taxId},
        ${client.notes},
        ${convertedLead?.convertedAt ?? client.createdAt},
        ${client.userId},
        ${client.createdAt},
        ${client.updatedAt}
      )
    `

    // Map old client ID to new contact ID (same ID in this case)
    clientToContactMap.set(client.id, client.id)
  }
  console.log(`Migrated ${clients.length} clients -> contacts`)

  // Step 4: Insert non-converted leads as contacts
  let leadsMigrated = 0
  for (const lead of leads) {
    // Skip leads that were converted — their data is merged with the client record above
    if (lead.convertedToClientId && convertedLeadClientIds.has(lead.convertedToClientId)) {
      continue
    }

    const newStatus = mapLeadStatus(lead.status)

    await prisma.$executeRaw`
      INSERT INTO "Contact" (
        "id", "name", "email", "phone", "company", "status", "source",
        "estimatedBudget", "projectType", "isVip", "address", "taxId",
        "notes", "convertedAt", "userId", "createdAt", "updatedAt"
      ) VALUES (
        ${lead.id},
        ${lead.name},
        ${lead.email},
        ${lead.phone},
        ${lead.company},
        ${newStatus}::"ContactStatus",
        ${lead.source}::"ContactSource",
        ${lead.estimatedBudget},
        ${lead.projectType},
        false,
        null,
        null,
        ${lead.notes},
        ${newStatus === 'CLIENT' ? lead.convertedAt : null},
        ${lead.userId},
        ${lead.createdAt},
        ${lead.updatedAt}
      )
    `
    leadsMigrated++
  }
  console.log(`Migrated ${leadsMigrated} leads -> contacts (${leads.length - leadsMigrated} skipped as converted)`)

  // Step 5: Migrate projects (update clientId -> contactId)
  const projects = await prisma.$queryRaw<OldProject[]>`SELECT * FROM "Project" ORDER BY "createdAt" ASC`
  console.log(`Found ${projects.length} projects`)

  for (const project of projects) {
    const contactId = clientToContactMap.get(project.clientId) ?? project.clientId

    await prisma.$executeRaw`
      INSERT INTO "Project" (
        "id", "name", "description", "type", "status", "priority",
        "startDate", "deadline", "completedAt", "price", "retention",
        "retentionFrequency", "contactId", "userId", "createdAt", "updatedAt"
      ) VALUES (
        ${project.id},
        ${project.name},
        ${project.description},
        ${project.type}::"ProjectType",
        ${project.status}::"ProjectStatus",
        ${project.priority}::"Priority",
        ${project.startDate},
        ${project.deadline},
        ${project.completedAt},
        ${project.budget},
        null,
        null,
        ${contactId},
        ${project.userId},
        ${project.createdAt},
        ${project.updatedAt}
      )
    `
  }
  console.log(`Migrated ${projects.length} projects`)

  // Step 6: Migrate tasks (projectId stays, status mapped)
  const tasks = await prisma.$queryRaw<OldTask[]>`SELECT * FROM "Task" ORDER BY "createdAt" ASC`
  console.log(`Found ${tasks.length} tasks`)

  for (const task of tasks) {
    const newStatus = mapTaskStatus(task.status)

    await prisma.$executeRaw`
      INSERT INTO "Task" (
        "id", "title", "description", "status", "priority",
        "dueDate", "completedAt", "projectId", "userId", "createdAt", "updatedAt"
      ) VALUES (
        ${task.id},
        ${task.title},
        ${task.description},
        ${newStatus}::"TaskStatus",
        ${task.priority}::"Priority",
        ${task.dueDate},
        ${task.completedAt},
        ${task.projectId},
        ${task.userId},
        ${task.createdAt},
        ${task.updatedAt}
      )
    `
  }
  console.log(`Migrated ${tasks.length} tasks`)

  console.log('\nMigration complete!')
  console.log('Skipped: payments, recurring payments, notifications, activities, documents, milestones')
}

migrate()
  .catch((e) => {
    console.error('Migration failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
