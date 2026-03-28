import { chromium, FullConfig } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const TEST_USER = {
  email: 'e2e-test@test.com',
  password: 'password123',
  name: 'E2E Test User',
}

async function globalSetup(_config: FullConfig) {
  // 1. Clean up any leftover test data from previous runs
  await cleanupTestData()

  // 2. Seed test user
  const hashedPassword = await bcrypt.hash(TEST_USER.password, 10)
  const user = await prisma.user.create({
    data: {
      email: TEST_USER.email,
      password: hashedPassword,
      name: TEST_USER.name,
    },
  })

  // 3. Seed contacts
  await prisma.contact.create({
    data: {
      name: 'ליד ראשון',
      phone: '0501234567',
      status: 'NEW',
      source: 'PHONE',
      userId: user.id,
    },
  })

  await prisma.contact.create({
    data: {
      name: 'ליד שני',
      phone: '0502345678',
      status: 'QUOTED',
      source: 'WEBSITE',
      estimatedBudget: 10000,
      userId: user.id,
    },
  })

  const clientActive = await prisma.contact.create({
    data: {
      name: 'לקוח פעיל',
      phone: '0503456789',
      email: 'active@test.com',
      status: 'CLIENT',
      source: 'REFERRAL',
      convertedAt: new Date(),
      userId: user.id,
    },
  })

  await prisma.contact.create({
    data: {
      name: 'לקוח VIP',
      phone: '0504567890',
      status: 'CLIENT',
      source: 'PHONE',
      isVip: true,
      convertedAt: new Date(),
      userId: user.id,
    },
  })

  await prisma.contact.create({
    data: {
      name: 'לקוח לא פעיל',
      phone: '0505678901',
      status: 'INACTIVE',
      source: 'OTHER',
      userId: user.id,
    },
  })

  // 4. Seed projects
  const projectActive = await prisma.project.create({
    data: {
      name: 'פרויקט אתר',
      type: 'WEBSITE',
      status: 'ACTIVE',
      priority: 'HIGH',
      price: 5000,
      contactId: clientActive.id,
      userId: user.id,
    },
  })

  await prisma.project.create({
    data: {
      name: 'פרויקט אפליקציה',
      type: 'WEB_APP',
      status: 'ACTIVE',
      priority: 'URGENT',
      price: 15000,
      contactId: clientActive.id,
      userId: user.id,
    },
  })

  // 5. Seed tasks
  await prisma.task.create({
    data: {
      title: 'משימה ראשונה',
      status: 'TODO',
      priority: 'HIGH',
      projectId: projectActive.id,
      userId: user.id,
    },
  })

  await prisma.task.create({
    data: {
      title: 'משימה עצמאית',
      status: 'TODO',
      priority: 'MEDIUM',
      userId: user.id,
    },
  })

  await prisma.task.create({
    data: {
      title: 'משימה שהושלמה',
      status: 'COMPLETED',
      priority: 'LOW',
      completedAt: new Date(),
      projectId: projectActive.id,
      userId: user.id,
    },
  })

  // 6. Login via browser and save auth state
  const browser = await chromium.launch()
  const page = await browser.newPage()

  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle', timeout: 30000 })

  // Debug: screenshot what the page actually shows
  await page.screenshot({ path: './e2e/.auth/debug-login.png' })
  console.log('Login page URL:', page.url())
  console.log('Login page title:', await page.title())

  await page.waitForSelector('input[name="email"]', { state: 'visible', timeout: 15000 })
  await page.fill('input[name="email"]', TEST_USER.email)
  await page.fill('input[name="password"]', TEST_USER.password)
  await page.click('button[type="submit"]')
  await page.waitForURL('http://localhost:3000/', { timeout: 15000 })

  await page.context().storageState({ path: './e2e/.auth/storageState.json' })
  await browser.close()

  await prisma.$disconnect()
}

async function cleanupTestData() {
  const testUser = await prisma.user.findUnique({
    where: { email: TEST_USER.email },
  })

  if (testUser) {
    await prisma.task.deleteMany({ where: { userId: testUser.id } })
    await prisma.project.deleteMany({ where: { userId: testUser.id } })
    await prisma.contact.deleteMany({ where: { userId: testUser.id } })
    await prisma.user.delete({ where: { id: testUser.id } })
  }
}

export default globalSetup
