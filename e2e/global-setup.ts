import { chromium, FullConfig } from '@playwright/test'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'
import { BASE_URL } from './base-url'

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

  // Mid-pipeline, with a next action that is already late - covers both the
  // overdue badge on the leads table and the "פעולות להיום" brief section.
  await prisma.contact.create({
    data: {
      name: 'ליד שלישי',
      phone: '0506789012',
      status: 'MEETING_SCHEDULED',
      source: 'REFERRAL',
      nextActionAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      nextActionNote: 'לשלוח הצעת מחיר',
      userId: user.id,
    },
  })

  // Terminal lead: must stay out of the לידים tab but remain findable.
  await prisma.contact.create({
    data: {
      name: 'ליד אבוד',
      phone: '0507890123',
      status: 'LOST',
      source: 'WEBSITE',
      userId: user.id,
    },
  })

  const clientActiveBiz = await prisma.client.create({
    data: { name: 'לקוח פעיל', userId: user.id },
  })

  const clientActive = await prisma.contact.create({
    data: {
      name: 'לקוח פעיל',
      phone: '0503456789',
      email: 'active@test.com',
      status: 'CLIENT',
      source: 'REFERRAL',
      convertedAt: new Date(),
      clientId: clientActiveBiz.id,
      isPrimary: true,
      role: 'בעלים',
      userId: user.id,
    },
  })

  const vipBiz = await prisma.client.create({
    data: { name: 'לקוח VIP', isVip: true, userId: user.id },
  })

  await prisma.contact.create({
    data: {
      name: 'לקוח VIP',
      phone: '0504567890',
      status: 'CLIENT',
      source: 'PHONE',
      isVip: true,
      convertedAt: new Date(),
      clientId: vipBiz.id,
      isPrimary: true,
      userId: user.id,
    },
  })

  const inactiveBiz = await prisma.client.create({
    data: { name: 'לקוח לא פעיל', userId: user.id },
  })

  await prisma.contact.create({
    data: {
      name: 'לקוח לא פעיל',
      phone: '0505678901',
      status: 'INACTIVE',
      source: 'OTHER',
      clientId: inactiveBiz.id,
      isPrimary: true,
      userId: user.id,
    },
  })

  // 4. Seed projects.
  //    Money is now advance + phases. Both projects keep the totals the specs
  //    already assert against - 5,000 and 15,000 - so those assertions still
  //    mean what they meant, they are just computed now rather than stored.
  const projectActive = await prisma.project.create({
    data: {
      name: 'פרויקט אתר',
      type: 'WEBSITE',
      status: 'ACTIVE',
      priority: 'HIGH',
      advanceAmount: 1000,
      advancePaidAt: new Date(),
      clientId: clientActiveBiz.id,
      primaryContactId: clientActive.id,
      userId: user.id,
      phases: {
        create: [
          { name: 'אפיון', order: 1, price: 1500, status: 'APPROVED', approvedAt: new Date(), paidAt: new Date() },
          { name: 'עיצוב', order: 2, price: 1500, status: 'IN_PROGRESS' },
          { name: 'פיתוח', order: 3, price: 1000, status: 'NOT_STARTED' },
        ],
      },
    },
  })

  // Covers the two states the brief and the dashboard care about: work waiting
  // on the client, and work signed off but not yet paid for.
  await prisma.project.create({
    data: {
      name: 'פרויקט אפליקציה',
      type: 'WEB_APP',
      status: 'ACTIVE',
      priority: 'URGENT',
      advanceAmount: 3000,
      clientId: clientActiveBiz.id,
      primaryContactId: clientActive.id,
      userId: user.id,
      phases: {
        create: [
          { name: 'אפיון', order: 1, price: 5000, status: 'APPROVED', approvedAt: new Date(), paidAt: new Date() },
          { name: 'פיתוח', order: 2, price: 7000, status: 'PENDING_APPROVAL' },
        ],
      },
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

  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 })

  // Debug: screenshot what the page actually shows
  await page.screenshot({ path: './e2e/.auth/debug-login.png' })
  console.log('Login page URL:', page.url())
  console.log('Login page title:', await page.title())

  await page.waitForSelector('input[name="email"]', { state: 'visible', timeout: 15000 })
  await page.fill('input[name="email"]', TEST_USER.email)
  await page.fill('input[name="password"]', TEST_USER.password)
  await page.click('button[type="submit"]')
  await page.waitForURL(`${BASE_URL}/`, { timeout: 15000 })

  await page.context().storageState({ path: './e2e/.auth/storageState.json' })
  await browser.close()

  await prisma.$disconnect()
}

async function cleanupTestData() {
  const testUser = await prisma.user.findUnique({
    where: { email: TEST_USER.email },
  })

  if (testUser) {
    await prisma.request.deleteMany({ where: { userId: testUser.id } })
    await prisma.task.deleteMany({ where: { userId: testUser.id } })
    await prisma.project.deleteMany({ where: { userId: testUser.id } })
    await prisma.contact.deleteMany({ where: { userId: testUser.id } })
    await prisma.client.deleteMany({ where: { userId: testUser.id } })
    await prisma.user.delete({ where: { id: testUser.id } })
  }
}

export default globalSetup
