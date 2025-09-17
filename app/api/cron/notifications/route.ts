// app/api/cron/notifications/route.ts
import { NextRequest } from 'next/server'
import { createResponse } from '@/lib/api/api-handler'
import { mockDb } from '@/lib/api/mock-db'

// GET /api/cron/notifications - Send daily notifications
export async function GET(req: NextRequest) {
  // Verify cron secret (Vercel cron jobs)
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }
  
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  
  // Find deadlines for tomorrow
  const upcomingDeadlines = mockDb.projects.filter(p => {
    if (!p.deadline) return false
    const deadline = new Date(p.deadline)
    return deadline.toDateString() === tomorrow.toDateString()
  })
  
  // Find overdue payments
  const overduePayments = mockDb.payments.filter(p => {
    return p.status === 'PENDING' && new Date(p.dueDate) < now
  })
  
  // Send notifications (mock)
  const notifications: Array<{
    type: string
    message: string
    projectId?: string
    paymentId?: string
  }> = []
  
  upcomingDeadlines.forEach(project => {
    notifications.push({
      type: 'DEADLINE',
      message: `Deadline tomorrow for project: ${project.name}`,
      projectId: project.id,
    })
  })
  
  overduePayments.forEach(payment => {
    notifications.push({
      type: 'PAYMENT_OVERDUE',
      message: `Payment overdue: ₪${payment.amount}`,
      paymentId: payment.id,
    })
  })
  
  // TODO: Send WhatsApp notifications
  console.log('Daily notifications:', notifications)
  
  return createResponse({
    success: true,
    notificationsSent: notifications.length,
    notifications,
  })
}