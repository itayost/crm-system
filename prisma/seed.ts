import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Create test user
  const hashedPassword = await bcrypt.hash('password123', 10)
  
  const user = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      email: 'test@example.com',
      password: hashedPassword,
      name: 'משתמש בדיקה',
      role: 'OWNER',
    },
  })
  
  console.log('Created user:', user)
  
  // Create some test data
  const client = await prisma.client.create({
    data: {
      name: 'לקוח לדוגמה',
      email: 'client@example.com',
      phone: '050-1234567',
      company: 'חברה לדוגמה',
      type: 'REGULAR',
      status: 'ACTIVE',
      userId: user.id,
    },
  })
  
  console.log('Created client:', client)
  
  const project = await prisma.project.create({
    data: {
      name: 'פרויקט לדוגמה',
      description: 'תיאור הפרויקט',
      type: 'WEBSITE',
      status: 'IN_PROGRESS',
      stage: 'DEVELOPMENT',
      clientId: client.id,
      userId: user.id,
      budget: 15000,
      estimatedHours: 40,
    },
  })
  
  console.log('Created project:', project)
  
  // Create a test lead
  const lead = await prisma.lead.create({
    data: {
      name: 'ליד לדוגמה',
      email: 'lead@example.com',
      phone: '052-9876543',
      source: 'WEBSITE',
      status: 'NEW',
      projectType: 'אתר תדמית',
      estimatedBudget: 10000,
      notes: 'פנה דרך טופס יצירת קשר',
      userId: user.id,
    },
  })
  
  console.log('Created lead:', lead)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })